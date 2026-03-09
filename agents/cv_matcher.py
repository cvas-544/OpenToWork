"""
Agent 2 — CV Matcher
Model: claude-haiku-4-5-20251001 (fast, cheap — batch processing)
Input: raw jobs from Agent 1 + CV text
Output: jobs scored >= 60, each with score, matched_skills, missing_skills, fit_reason, red_flags
"""

import os
import json
import psycopg2
import anthropic
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

CV_PATH = Path(__file__).parent.parent / "data" / "cv.txt"
SCORE_THRESHOLD = 60

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def load_cv() -> str:
    if not CV_PATH.exists():
        raise FileNotFoundError(f"CV not found at {CV_PATH}. Add your CV text to data/cv.txt")
    return CV_PATH.read_text(encoding="utf-8")


def score_job(job: dict, cv_text: str) -> dict:
    prompt = f"""You are a precise job-CV matching assistant. Score this job against the CV.

CV:
{cv_text}

Job:
Title: {job['title']}
Company: {job['company']}
Location: {job['location']}
Description: {job['description'][:2000]}

Return ONLY valid JSON with this exact structure:
{{
  "score": <integer 0-100>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "fit_reason": "<1-2 sentence explanation>",
  "red_flags": ["flag1"]
}}

Scoring guide:
- 80-100: Strong match, most requirements met, location/remote fits
- 60-79: Good match, core skills present, minor gaps
- 40-59: Partial match, significant gaps
- 0-39: Poor fit"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        return json.loads(response.content[0].text)
    except json.JSONDecodeError:
        return {"score": 0, "matched_skills": [], "missing_skills": [], "fit_reason": "Parse error", "red_flags": []}


def save_score(job_id: int, result: dict):
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE job_listings SET
            score = %s,
            matched_skills = %s,
            missing_skills = %s,
            fit_reason = %s,
            red_flags = %s,
            scored_at = %s
        WHERE id = %s
        """,
        (
            result["score"],
            result.get("matched_skills", []),
            result.get("missing_skills", []),
            result.get("fit_reason", ""),
            result.get("red_flags", []),
            datetime.now(),
            job_id,
        ),
    )
    conn.commit()
    cur.close()
    conn.close()


def run() -> list[dict]:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("""
        SELECT id, title, company, location, description
        FROM job_listings
        WHERE score IS NULL
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        print("[Agent 2] No unscored jobs found")
        return []

    jobs = [
        {"db_id": r[0], "title": r[1], "company": r[2], "location": r[3] or "", "description": r[4] or ""}
        for r in rows
    ]

    print(f"[Agent 2] Scoring {len(jobs)} jobs against CV")
    cv_text = load_cv()
    scored = []

    for job in jobs:
        result = score_job(job, cv_text)
        save_score(job["db_id"], result)
        job.update(result)
        if result["score"] >= SCORE_THRESHOLD:
            scored.append(job)
            tier = "GREEN" if result["score"] >= 80 else "YELLOW"
            print(f"  [{tier}] {result['score']} — {job['title']} @ {job['company']}")

    print(f"[Agent 2] {len(scored)} jobs >= {SCORE_THRESHOLD} (filtered from {len(jobs)})")
    return scored


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, default=str))
