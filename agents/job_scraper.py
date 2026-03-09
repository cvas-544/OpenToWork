"""
Agent 1 — Job Scraper
Trigger: Daily 8am cron via n8n
Sources: Arbeitsagentur REST API + SerpAPI Google Jobs
Output: list of raw job dicts → passed to Agent 2 (cv_matcher)
"""

import os
import json
import hashlib
import requests
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
SERP_API_KEY = os.environ.get("SERP_API_KEY", "")
ARBEITSAGENTUR_KEY = os.environ.get("ARBEITSAGENTUR_API_KEY", "jobboerse-jobsuche")

TARGET_KEYWORDS = ["AI Engineer", "ML Engineer", "Python Developer", "Data Engineer", "Machine Learning"]
TARGET_LOCATIONS = ["München", "Munich", "Deutschland", "Remote"]


def get_db():
    return psycopg2.connect(DATABASE_URL)


def make_external_id(title: str, company: str, url: str) -> str:
    raw = f"{title}|{company}|{url}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def fetch_description(refnr: str) -> str:
    """Fetch full job description from Arbeitsagentur detail endpoint using refnr."""
    if not refnr:
        return ""
    try:
        url = f"https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/{refnr}"
        resp = requests.get(url, headers={"X-API-Key": ARBEITSAGENTUR_KEY}, timeout=10)
        resp.raise_for_status()
        return resp.json().get("stellenbeschreibung", "")
    except Exception:
        return ""


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
            jobs.append({
                "title": item.get("beruf", ""),
                "company": item.get("arbeitgeber", ""),
                "location": item.get("arbeitsort", {}).get("ort", location),
                "remote": False,
                "url": f"https://www.arbeitsagentur.de/jobsuche/jobdetail/{refnr}",
                "description": fetch_description(refnr),
                "source": "arbeitsagentur",
                "date_posted": item.get("aktuelleVeroeffentlichungsdatum", ""),
            })
        return jobs
    except Exception as e:
        print(f"[Arbeitsagentur] Error for '{keyword}' in '{location}': {e}")
        return []


def scrape_serpapi(keyword: str) -> list[dict]:
    if not SERP_API_KEY:
        return []
    url = "https://serpapi.com/search"
    params = {
        "engine": "google_jobs",
        "q": f"{keyword} Munich Germany OR Remote",
        "hl": "en",
        "api_key": SERP_API_KEY,
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        jobs = []
        for item in data.get("jobs_results", []):
            jobs.append({
                "title": item.get("title", ""),
                "company": item.get("company_name", ""),
                "location": item.get("location", ""),
                "remote": "remote" in item.get("location", "").lower(),
                "url": item.get("job_id", ""),
                "description": item.get("description", ""),
                "source": "serpapi",
                "date_posted": item.get("detected_extensions", {}).get("posted_at", ""),
            })
        return jobs
    except Exception as e:
        print(f"[SerpAPI] Error for '{keyword}': {e}")
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
        all_jobs += scrape_serpapi(keyword)

    new_jobs = deduplicate_and_save(all_jobs)
    print(f"[Agent 1] Found {len(all_jobs)} total, {len(new_jobs)} new jobs")
    return new_jobs


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, default=str))
