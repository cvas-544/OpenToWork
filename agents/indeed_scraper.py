"""
Indeed Scraper — wraps the Scrapy spider in scrapers/indeed/
Runs as a subprocess to avoid Twisted/FastAPI event loop conflicts.
Output: list of job dicts in the standard OpenToWork format.
"""

import os
import csv
import sys
import glob
import subprocess
import tempfile
from pathlib import Path

SCRAPY_DIR = Path(__file__).parent.parent / "scrapers" / "indeed"
VENV_PYTHON = Path(__file__).parent.parent / "venv" / "bin" / "python"

INDEED_KEYWORDS = ["AI Engineer", "ML Engineer", "Machine Learning", "AI Architect"]
INDEED_LOCATION = "Germany"


def _run_spider(keyword: str, output_file: str) -> bool:
    """Run the indeed_search spider for one keyword, write CSV to output_file."""
    env = os.environ.copy()
    env["PYTHONPATH"] = str(SCRAPY_DIR)

    cmd = [
        str(VENV_PYTHON), "-m", "scrapy", "crawl", "indeed_search",
        "-s", "SCRAPEOPS_API_KEY=39617df9-6690-4abf-a69d-03bc5e563e08",
        "-s", "FEEDS={}",   # disable default CSV feed
        "-o", output_file,
        "-t", "csv",
        "-a", f"keyword={keyword}",
        "-a", f"location={INDEED_LOCATION}",
    ]

    try:
        result = subprocess.run(
            cmd,
            cwd=str(SCRAPY_DIR),
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            print(f"[Indeed] Spider error for '{keyword}':\n{result.stderr[-500:]}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"[Indeed] Spider timed out for '{keyword}'")
        return False
    except Exception as e:
        print(f"[Indeed] Subprocess error for '{keyword}': {e}")
        return False


def _parse_csv(csv_path: str) -> list[dict]:
    """Parse spider CSV output into standard job dicts."""
    jobs = []
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                jobkey = row.get("jobkey", "")
                city = row.get("jobLocationCity", "") or INDEED_LOCATION
                jobs.append({
                    "title": row.get("jobTitle", ""),
                    "company": row.get("company", ""),
                    "location": city,
                    "remote": "remote" in city.lower(),
                    "url": f"https://de.indeed.com/viewjob?jk={jobkey}" if jobkey else "",
                    "description": "",  # search spider doesn't fetch descriptions
                    "source": "indeed",
                    "date_posted": row.get("pubDate", ""),
                })
    except Exception as e:
        print(f"[Indeed] CSV parse error: {e}")
    return jobs


def scrape_indeed() -> list[dict]:
    """Scrape Indeed for all keywords, return deduplicated job list."""
    all_jobs = []

    for keyword in INDEED_KEYWORDS:
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            output_file = tmp.name

        print(f"[Indeed] Scraping '{keyword}' in {INDEED_LOCATION}...")
        success = _run_spider(keyword, output_file)

        if success and os.path.exists(output_file) and os.path.getsize(output_file) > 0:
            jobs = _parse_csv(output_file)
            print(f"[Indeed] '{keyword}': {len(jobs)} jobs")
            all_jobs += jobs
        else:
            print(f"[Indeed] '{keyword}': no results or spider failed")

        try:
            os.unlink(output_file)
        except Exception:
            pass

    # Deduplicate by jobkey (from URL)
    seen = set()
    unique = []
    for j in all_jobs:
        key = j["url"]
        if key and key not in seen:
            seen.add(key)
            unique.append(j)

    print(f"[Indeed] Total: {len(unique)} unique jobs across {len(INDEED_KEYWORDS)} keywords")
    return unique


if __name__ == "__main__":
    import json
    result = scrape_indeed()
    print(json.dumps(result[:3], indent=2))
