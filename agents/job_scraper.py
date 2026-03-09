"""
Agent 1 — Job Scraper
Trigger: Daily 8am cron via n8n
Sources: Arbeitsagentur REST API + Apify LinkedIn Jobs Scraper
Output: list of raw job dicts → passed to Agent 2 (cv_matcher)
"""

import os
import re
import json
import hashlib
import requests
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")
ARBEITSAGENTUR_KEY = os.environ.get("ARBEITSAGENTUR_API_KEY", "jobboerse-jobsuche")

TARGET_KEYWORDS = ["AI Engineer", "ML Engineer", "Python Developer", "Data Engineer", "Machine Learning"]
TARGET_LOCATIONS = ["München", "Munich", "Deutschland", "Remote"]


def get_db():
    return psycopg2.connect(DATABASE_URL)


def make_external_id(title: str, company: str, url: str) -> str:
    raw = f"{title}|{company}|{url}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def fetch_job_details(refnr: str) -> dict:
    """Fetch description + external apply URL from Arbeitsagentur job detail page (SSR ng-state JSON)."""
    empty = {"description": "", "external_url": ""}
    if not refnr:
        return empty
    try:
        url = f"https://www.arbeitsagentur.de/jobsuche/jobdetail/{refnr}"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        match = re.search(r'<script id="ng-state"[^>]*>(.*?)</script>', resp.text, re.DOTALL)
        if not match:
            return empty
        detail = json.loads(match.group(1)).get("jobdetail", {})
        return {
            "description": detail.get("stellenangebotsBeschreibung", ""),
            "external_url": detail.get("externeURL", ""),
        }
    except Exception:
        return empty


def scrape_arbeitsagentur(keyword: str, location: str = "München") -> list[dict]:
    url = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs"
    headers = {"X-API-Key": ARBEITSAGENTUR_KEY}
    params = {
        "was": keyword,
        "wo": location,
        "umkreis": 50,
        "angebotsart": 1,
        "page": 1,
        "size": 25,
    }
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        jobs = []
        for item in data.get("stellenangebote", []):
            refnr = item.get("refnr", "")
            details = fetch_job_details(refnr)
            apply_url = details["external_url"] or f"https://www.arbeitsagentur.de/jobsuche/jobdetail/{refnr}"
            jobs.append({
                "title": item.get("beruf", ""),
                "company": item.get("arbeitgeber", ""),
                "location": item.get("arbeitsort", {}).get("ort", location),
                "remote": False,
                "url": apply_url,
                "description": details["description"],
                "source": "arbeitsagentur",
                "date_posted": item.get("aktuelleVeroeffentlichungsdatum", ""),
            })
        return jobs
    except Exception as e:
        print(f"[Arbeitsagentur] Error for '{keyword}' in '{location}': {e}")
        return []


def scrape_apify_linkedin(keyword: str) -> list[dict]:
    if not APIFY_TOKEN:
        return []
    actor_id = "curious_coder~linkedin-jobs-scraper"
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
    params = {"token": APIFY_TOKEN}
    payload = {
        "includeKeyword": keyword,
        "locationName": "Munich",
        "countryName": "germany",
        "datePosted": "week",
        "pagesToFetch": 2,
    }
    try:
        resp = requests.post(url, params=params, json=payload, timeout=120)
        resp.raise_for_status()
        items = resp.json()
        jobs = []
        for item in items:
            location = item.get("location", "") or ""
            jobs.append({
                "title": item.get("job_title", ""),
                "company": item.get("company_name", ""),
                "location": location,
                "remote": "remote" in location.lower(),
                "url": item.get("URL", "") or item.get("url", ""),
                "description": item.get("description", "") or "",
                "source": "linkedin",
                "date_posted": item.get("date", "") or "",
            })
        print(f"[Apify/LinkedIn] '{keyword}': {len(jobs)} jobs")
        return jobs
    except Exception as e:
        print(f"[Apify/LinkedIn] Error for '{keyword}': {e}")
        return []


def deduplicate_and_save(jobs: list[dict]) -> list[dict]:
    """Insert new jobs into DB, return only those that didn't already exist."""
    conn = get_db()
    cur = conn.cursor()
    new_jobs = []
    for job in jobs:
        ext_id = make_external_id(job["title"], job["company"], job["url"])
        cur.execute("SELECT id FROM job_listings WHERE external_id = %s", (ext_id,))
        if cur.fetchone():
            continue  # already seen
        cur.execute(
            """
            INSERT INTO job_listings
              (external_id, title, company, location, remote, url, description, source, date_posted)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (ext_id, job["title"], job["company"], job["location"],
             job["remote"], job["url"], job["description"], job["source"], job["date_posted"]),
        )
        job["db_id"] = cur.fetchone()[0]
        new_jobs.append(job)
    conn.commit()
    cur.close()
    conn.close()
    return new_jobs


def run() -> list[dict]:
    print(f"[Agent 1] Starting job scrape at {datetime.now().isoformat()}")
    all_jobs = []

    for keyword in TARGET_KEYWORDS:
        all_jobs += scrape_arbeitsagentur(keyword, "München")
        all_jobs += scrape_apify_linkedin(keyword)

    new_jobs = deduplicate_and_save(all_jobs)
    print(f"[Agent 1] Found {len(all_jobs)} total, {len(new_jobs)} new jobs")
    return new_jobs


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, default=str))
