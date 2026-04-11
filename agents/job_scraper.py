"""
Agent 1 — Job Scraper
Trigger: Daily 8am cron via n8n
Sources: Arbeitsagentur REST API + Apify LinkedIn Jobs Scraper
Output: list of raw job dicts → passed to Agent 2 (cv_matcher)
"""

import os
import re
import json
import time
import hashlib
import requests
import psycopg2
import urllib.parse
from datetime import datetime
from dotenv import load_dotenv
from apify_client import ApifyClient


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _elapsed(t0: float) -> str:
    return f"{time.time() - t0:.1f}s"

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")          # private account — Indeed actor
APIFY_TOKEN_PUBLIC = os.environ.get("APIFY_TOKEN_PUBLIC", "")  # public account — LinkedIn + other public actors
ARBEITSAGENTUR_KEY = os.environ.get("ARBEITSAGENTUR_API_KEY", "jobboerse-jobsuche")

ARBEITSAGENTUR_PROFESSION = "Softwareentwickler/in"  # broad profession — fetches all SW dev jobs
AI_FILTER_TERMS = [
    # from original keyword list
    "ai engineer", "ml engineer", "machine learning", "ki-engineer", "ki entwickler", "agentic ai",
    # short whole-word terms (need \b boundary)
    "ai", "ki", "ml",
    # broader AI/ML terms
    "deep learning", "llm", "nlp", "neural", "data science",
    "künstliche intelligenz", "maschinelles lernen",
]
# Pre-compiled regex: whole-word, case-insensitive
_AI_FILTER_RE = re.compile(
    r"\b(" + "|".join(re.escape(t) for t in AI_FILTER_TERMS) + r")\b",
    re.IGNORECASE,
)

def _is_ai_relevant(job: dict) -> bool:
    """Return True if title or description contains any AI/ML term as a whole word."""
    text = f"{job.get('title', '')} {job.get('description', '')}"
    return bool(_AI_FILTER_RE.search(text))
LINKEDIN_KEYWORDS = ["AI Engineer", "Agentic AI", "ML Engineer"]
TARGET_LOCATIONS = ["Germany", "Munich", "Berlin", "Frankfurt", "Stuttgart", "Remote"]

# Base LinkedIn search filters (copied from manual search — swap keywords per run)
LINKEDIN_BASE_PARAMS = {
    "f_JT": "F",                                           # Full-time
    "f_T": "30128,25206,31823",                            # Job function IDs
    "f_TPR": "r86400",                                     # Last 24 hours
    "f_WT": "1,3,2",                                       # On-site, Hybrid, Remote
    "geoId": "101282230",                                  # Germany
    "sortBy": "R",                                         # Relevance
}


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


def scrape_arbeitsagentur(keyword: str) -> list[dict]:
    t0 = time.time()
    url = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs"
    headers = {"X-API-Key": ARBEITSAGENTUR_KEY}
    params = {"was": keyword, "angebotsart": 1, "page": 1, "size": 25}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("stellenangebote", [])
        print(f"[{_ts()}][Arbeitsagentur] '{keyword}': {len(results)} listings found, fetching details...")
        jobs = []
        for i, item in enumerate(results):
            refnr = item.get("refnr", "")
            t_detail = time.time()
            details = fetch_job_details(refnr)
            apply_url = details["external_url"] or f"https://www.arbeitsagentur.de/jobsuche/jobdetail/{refnr}"
            jobs.append({
                "title": item.get("beruf", ""),
                "company": item.get("arbeitgeber", ""),
                "location": item.get("arbeitsort", {}).get("ort", "Germany"),
                "remote": False,
                "url": apply_url,
                "description": details["description"],
                "source": "arbeitsagentur",
                "date_posted": item.get("aktuelleVeroeffentlichungsdatum", ""),
            })
            if (i + 1) % 5 == 0:
                print(f"[{_ts()}][Arbeitsagentur] '{keyword}': {i+1}/{len(results)} details fetched ({_elapsed(t0)} total)")
        print(f"[{_ts()}][Arbeitsagentur] '{keyword}': done — {len(jobs)} jobs in {_elapsed(t0)}")
        return jobs
    except Exception as e:
        print(f"[{_ts()}][Arbeitsagentur] ERROR for '{keyword}' after {_elapsed(t0)}: {e}")
        return []


def scrape_apify_linkedin(keyword: str) -> list[dict]:
    if not APIFY_TOKEN_PUBLIC:
        print(f"[{_ts()}][LinkedIn] No APIFY_TOKEN_PUBLIC — skipping")
        return []
    t0 = time.time()
    search_url = (
        "https://www.linkedin.com/jobs/search/?"
        + urllib.parse.urlencode({**LINKEDIN_BASE_PARAMS, "keywords": keyword})
    )
    print(f"[{_ts()}][LinkedIn] '{keyword}': starting Apify actor run...")
    try:
        client = ApifyClient(APIFY_TOKEN_PUBLIC)
        run = client.actor("curious_coder/linkedin-jobs-scraper").call(
            run_input={"urls": [search_url], "count": 15},
            timeout_secs=300,
        )
        status = run.get("status", "?")
        print(f"[{_ts()}][LinkedIn] '{keyword}': actor finished — status={status} ({_elapsed(t0)})")
        jobs = []
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            location = item.get("location", "") or ""
            job_id = item.get("jobId", "") or item.get("id", "")
            apply_url = (
                item.get("applyUrl", "")
                or item.get("link", "")
                or item.get("jobUrl", "")
                or (f"https://www.linkedin.com/jobs/view/{job_id}" if job_id else "")
            )
            jobs.append({
                "title": item.get("title", ""),
                "company": item.get("companyName", ""),
                "location": location,
                "remote": "remote" in location.lower(),
                "url": apply_url,
                "description": item.get("descriptionText", "") or "",
                "source": "linkedin",
                "date_posted": item.get("postedAt", "") or "",
            })
        print(f"[{_ts()}][LinkedIn] '{keyword}': {len(jobs)} jobs collected (total {_elapsed(t0)})")
        return jobs
    except Exception as e:
        print(f"[{_ts()}][LinkedIn] ERROR for '{keyword}' after {_elapsed(t0)}: {e}")
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


INDEED_KEYWORDS = [
    ("AI Engineer", 2),
    ("Agentic AI", 2),
    ("KI", 2),
    ("AI", 4),
]

INDEED_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch_indeed_description(url: str) -> str:
    """Fetch full job description from an Indeed viewjob page. Falls back to empty string."""
    if not url:
        return ""
    try:
        resp = requests.get(url, headers=INDEED_HEADERS, timeout=10)
        if resp.status_code != 200:
            return ""
        html = resp.text
        # Indeed embeds job data in a <script> tag as window._initialData or mosaic JSON
        match = re.search(r'"jobDescriptionText"\s*:\s*"((?:[^"\\]|\\.)*)"', html)
        if match:
            return match.group(1).encode().decode("unicode_escape")
        # Fallback: look for sanitized description div
        match = re.search(r'id="jobDescriptionText"[^>]*>(.*?)</div>', html, re.DOTALL)
        if match:
            return re.sub(r"<[^>]+>", " ", match.group(1)).strip()
        return ""
    except Exception:
        return ""


def scrape_apify_indeed() -> list[dict]:
    if not APIFY_TOKEN:
        print(f"[{_ts()}][Indeed] No APIFY_TOKEN — skipping")
        return []
    client = ApifyClient(APIFY_TOKEN)
    jobs = []
    for keyword, max_results in INDEED_KEYWORDS:
        t0 = time.time()
        print(f"[{_ts()}][Indeed] '{keyword}': starting Apify actor run...")
        try:
            run = client.actor("wannabe/indeed-scraper-de").call(
                run_input={"keyword": keyword, "location": "Germany", "maxResults": max_results},
                timeout_secs=600,
            )
            status = run.get("status", "?")
            print(f"[{_ts()}][Indeed] '{keyword}': actor finished — status={status} ({_elapsed(t0)})")
            batch = []
            for item in client.dataset(run["defaultDatasetId"]).iterate_items():
                pub = item.get("date_posted", "")
                if pub and str(pub).lstrip("-").isdigit():
                    ts = int(pub)
                    if ts > 1e10:
                        ts //= 1000
                    pub = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
                batch.append({
                    "title": item.get("title", ""),
                    "company": item.get("company", ""),
                    "location": item.get("location", "Germany"),
                    "remote": item.get("remote", False),
                    "url": item.get("url", ""),
                    "description": item.get("descriptionText") or item.get("snippet", ""),
                    "date_posted": pub,
                    "source": "indeed",
                })
            print(f"[{_ts()}][Indeed] '{keyword}': {len(batch)} jobs from dataset (total {_elapsed(t0)})")
            jobs += batch
        except Exception as e:
            print(f"[{_ts()}][Indeed] ERROR for '{keyword}' after {_elapsed(t0)}: {e}")
    return jobs


def run() -> list[dict]:
    t_start = time.time()
    print(f"[{_ts()}][Agent 1] ===== START =====")

    all_jobs = []

    # --- Arbeitsagentur ---
    t_section = time.time()
    print(f"[{_ts()}][Agent 1] -- Arbeitsagentur (profession='{ARBEITSAGENTUR_PROFESSION}' + AI filter) --")
    raw_aa = scrape_arbeitsagentur(ARBEITSAGENTUR_PROFESSION)
    aa_jobs = [j for j in raw_aa if _is_ai_relevant(j)]
    print(f"[{_ts()}][Agent 1] Arbeitsagentur filter: {len(raw_aa)} fetched → {len(aa_jobs)} AI-relevant ({_elapsed(t_section)})")
    all_jobs += aa_jobs

    # --- LinkedIn ---
    t_section = time.time()
    print(f"[{_ts()}][Agent 1] -- LinkedIn ({len(LINKEDIN_KEYWORDS)} keywords) --")
    linkedin_jobs = []
    for keyword in LINKEDIN_KEYWORDS:
        linkedin_jobs += scrape_apify_linkedin(keyword)
    all_jobs += linkedin_jobs
    print(f"[{_ts()}][Agent 1] LinkedIn done — {_elapsed(t_section)}, {len(linkedin_jobs)} jobs, {len(all_jobs)} total")

    # --- Indeed ---
    t_section = time.time()
    print(f"[{_ts()}][Agent 1] -- Indeed ({len(INDEED_KEYWORDS)} keywords) --")
    indeed_jobs = scrape_apify_indeed()
    all_jobs += indeed_jobs
    print(f"[{_ts()}][Agent 1] Indeed done — {_elapsed(t_section)}, {len(indeed_jobs)} jobs, {len(all_jobs)} total")

    # --- Dedup + Save ---
    t_section = time.time()
    print(f"[{_ts()}][Agent 1] -- Deduplicating and saving to DB --")
    new_jobs = deduplicate_and_save(all_jobs)
    print(f"[{_ts()}][Agent 1] DB save done — {_elapsed(t_section)}")

    print(f"[{_ts()}][Agent 1] ===== DONE — {len(all_jobs)} scraped, {len(new_jobs)} new, total elapsed: {_elapsed(t_start)} =====")
    return new_jobs


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, default=str))
