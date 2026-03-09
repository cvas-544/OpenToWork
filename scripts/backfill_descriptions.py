"""
One-time backfill: fetch descriptions for existing jobs with empty descriptions.
Run once on EC2: python scripts/backfill_descriptions.py
"""

import os
import time
import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv()

ARBEITSAGENTUR_KEY = os.environ.get("ARBEITSAGENTUR_API_KEY", "jobboerse-jobsuche")
DATABASE_URL = os.environ["DATABASE_URL"]


def fetch_description(hash_id: str) -> str:
    if not hash_id:
        return ""
    try:
        url = f"https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/{hash_id}"
        resp = requests.get(url, headers={"X-API-Key": ARBEITSAGENTUR_KEY}, timeout=10)
        resp.raise_for_status()
        return resp.json().get("stellenbeschreibung", "")
    except Exception as e:
        print(f"  [WARN] fetch failed for {hash_id}: {e}")
        return ""


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT id, url FROM job_listings
        WHERE (description IS NULL OR description = '')
        AND source = 'arbeitsagentur'
    """)
    rows = cur.fetchall()
    print(f"[Backfill] {len(rows)} jobs need descriptions")

    updated = 0
    for job_id, url in rows:
        # Extract hashId from URL: .../jobdetail/{hashId}
        hash_id = url.rstrip("/").split("/")[-1] if url else ""
        desc = fetch_description(hash_id)
        if desc:
            cur.execute("UPDATE job_listings SET description = %s WHERE id = %s", (desc, job_id))
            updated += 1
            print(f"  [OK] #{job_id} — {len(desc)} chars")
        else:
            print(f"  [SKIP] #{job_id} — no description returned")
        time.sleep(0.2)  # be polite to the API

    conn.commit()
    cur.close()
    conn.close()
    print(f"[Backfill] Done — {updated}/{len(rows)} jobs updated")


if __name__ == "__main__":
    main()
