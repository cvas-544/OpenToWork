"""
Indeed Germany Job Scraper — Apify Actor
Uses Scrappey API to bypass Cloudflare, then extracts mosaic JSON from Indeed.

Input:  keyword, location, maxResults
Output: title, company, location, jobkey, url, date_posted, remote, source
"""

from __future__ import annotations

import json
import os
import re
import time
from urllib.parse import urlencode

import requests
from apify_client import ApifyClient

BASE_URL = "https://de.indeed.com/jobs"
SCRAPPEY_ENDPOINT = "https://publisher.scrappey.com/api/v1"


def build_url(keyword: str, location: str, offset: int = 0) -> str:
    params = {"q": keyword, "l": location, "filter": 0, "start": offset}
    return f"{BASE_URL}?{urlencode(params)}"


def extract_mosaic_data(html: str) -> list[dict]:
    match = re.search(
        r'window\.mosaic\.providerData\["mosaic-provider-jobcards"\]=(\{.+?\});',
        html,
    )
    if not match:
        return []
    try:
        blob = json.loads(match.group(1))
        return blob["metaData"]["mosaicProviderJobCardsModel"]["results"]
    except (KeyError, json.JSONDecodeError):
        return []


def parse_job(raw: dict, keyword: str, location: str) -> dict:
    jobkey = raw.get("jobkey", "")
    job_location = raw.get("jobLocationCity") or raw.get("jobLocationState") or location
    return {
        "title": raw.get("title", ""),
        "company": raw.get("company", ""),
        "location": job_location,
        "remote": raw.get("remoteLocation", False),
        "jobkey": jobkey,
        "url": f"https://de.indeed.com/viewjob?jk={jobkey}" if jobkey else "",
        "date_posted": raw.get("pubDate", ""),
        "salary_min": (raw.get("estimatedSalary") or {}).get("min"),
        "salary_max": (raw.get("estimatedSalary") or {}).get("max"),
        "snippet": raw.get("snippet", ""),
        "source": "indeed",
        "keyword": keyword,
    }


def fetch_via_scrappey(url: str, api_key: str, session_id: str) -> str | None:
    """Fetch a URL via Scrappey, returns HTML string or None on failure."""
    payload = {
        "cmd": "request.get",
        "url": url,
        "session": session_id,
        "premiumProxy": True,
        "proxyCountry": "Germany",
    }
    try:
        resp = requests.post(
            f"{SCRAPPEY_ENDPOINT}?key={api_key}",
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        solution = data.get("solution", {})
        html = solution.get("response", "")

        if not html or html.strip() in ("<html><head></head><body></body></html>", ""):
            print(f"[Indeed] Scrappey returned empty HTML for {url}")
            print(f"[Indeed] data={data.get('data')} verified={solution.get('verified')} status={solution.get('statusCode')}")
            return None
        return html
    except Exception as e:
        print(f"[Indeed] Scrappey error for {url}: {e}")
        return None


def scrape(keyword: str, location: str, max_results: int, api_key: str) -> list[dict]:
    all_jobs: list[dict] = []
    seen_keys: set[str] = set()
    # Use a consistent session so Scrappey reuses cookies across pages
    session_id = f"indeed-de-{keyword.replace(' ', '-').lower()}"

    offset = 0
    while len(all_jobs) < max_results:
        url = build_url(keyword, location, offset)
        print(f"[Indeed] Fetching offset={offset}: {url}")

        html = fetch_via_scrappey(url, api_key, session_id)
        if not html:
            print(f"[Indeed] No HTML returned at offset={offset}, stopping.")
            break

        raw_jobs = extract_mosaic_data(html)
        if not raw_jobs:
            print(f"[Indeed] Mosaic data not found at offset={offset} — may be blocked or end of results.")
            # Log a snippet to help debug
            snippet = html[:500].replace("\n", " ")
            print(f"[Indeed] HTML snippet: {snippet}")
            break

        new_count = 0
        for raw in raw_jobs:
            jobkey = raw.get("jobkey", "")
            if not jobkey or jobkey in seen_keys:
                continue
            seen_keys.add(jobkey)
            job = parse_job(raw, keyword, location)
            all_jobs.append(job)
            new_count += 1
            if len(all_jobs) >= max_results:
                break

        print(f"[Indeed] offset={offset}: {new_count} new jobs (total {len(all_jobs)})")
        if new_count == 0:
            break

        offset += 10
        time.sleep(1)  # small delay between pages

    return all_jobs


async def main() -> None:
    apify_token = os.environ.get("APIFY_TOKEN", "")
    kv_store_id = os.environ.get("APIFY_DEFAULT_KEY_VALUE_STORE_ID", "")
    dataset_id  = os.environ.get("APIFY_DEFAULT_DATASET_ID", "")
    input_key   = os.environ.get("APIFY_INPUT_KEY", "INPUT")
    scrappey_key = os.environ.get("SCRAPPEY_API_KEY", "")

    if not scrappey_key:
        print("[Indeed] ERROR: SCRAPPEY_API_KEY env var not set.")
        return

    actor_input = {}
    if apify_token and kv_store_id:
        client = ApifyClient(apify_token)
        record = client.key_value_store(kv_store_id).get_record(input_key)
        if record:
            actor_input = record["value"]

    keyword     = actor_input.get("keyword", "AI Engineer")
    location    = actor_input.get("location", "Germany")
    max_results = int(actor_input.get("maxResults", 20))

    print(f"[Indeed] keyword={keyword} location={location} max={max_results}")

    jobs = scrape(keyword, location, max_results, scrappey_key)
    print(f"[Indeed] Scraped {len(jobs)} jobs total")

    if apify_token and dataset_id and jobs:
        client = ApifyClient(apify_token)
        client.dataset(dataset_id).push_items(jobs)
        print(f"[Indeed] Pushed {len(jobs)} jobs to dataset {dataset_id}")
    else:
        print(json.dumps(jobs[:3], indent=2))


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
