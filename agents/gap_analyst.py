"""
Agent 3 — Gap Analyst
Model: claude-sonnet-4-6 (complex reasoning)
Input: all scored jobs from Agent 2
Output: ranked skill gaps with closure paths, stored in skill_gaps table
"""

import os
import json
import psycopg2
import anthropic
from collections import Counter
from datetime import datetime, date, timedelta

DATABASE_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# Projects to map gaps against
YOUR_PROJECTS = [
    "OpenToWork / JobHunt AI — multi-agent job intelligence system (n8n, FastAPI, Claude API, PostgreSQL, React dashboard)",
    "FinsenseAI — AI-powered finance dashboard (Python, React, Claude API, AWS EC2, RDS)",
    "autoTinglishSub — fine-tuned Whisper model for Telugu/English subtitles (PyTorch, HuggingFace, CTranslate2)",
    "RAG Chatbot — document Q&A system (LangChain, vector embeddings, Python)",
    "Chrome Extension — browser automation tool (JavaScript)",
]


def get_week_start() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


def aggregate_gaps(jobs: list[dict]) -> list[tuple[str, int]]:
    all_missing = []
    for job in jobs:
        all_missing.extend(job.get("missing_skills", []))
    return Counter(all_missing).most_common(20)


def analyze_gaps(top_gaps: list[tuple[str, int]]) -> list[dict]:
    gap_list = "\n".join(f"- {skill} (needed by {count} jobs)" for skill, count in top_gaps)
    projects_text = "\n".join(f"- {p}" for p in YOUR_PROJECTS)

    prompt = f"""You are a career development strategist. Analyze these skill gaps for a senior Python/AI engineer job hunting in Munich.

Top missing skills (from today's job scan):
{gap_list}

Candidate's existing projects:
{projects_text}

For each skill, return a JSON array with objects:
{{
  "skill": "...",
  "frequency": <int>,
  "closure_path": "<fastest realistic way to demonstrate this skill in 1-2 weeks>",
  "project_mapping": "<which existing project can be extended to showcase this, or null>"
}}

Return ONLY the JSON array, no other text."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        return json.loads(response.content[0].text)
    except (json.JSONDecodeError, Exception):
        return [{"skill": s, "frequency": c, "closure_path": None, "project_mapping": None} for s, c in top_gaps]


def save_gaps(gap_analyses: list[dict]):
    week_start = get_week_start()
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    for gap in gap_analyses:
        cur.execute(
            """
            INSERT INTO skill_gaps (skill, frequency, week_start, closure_path, project_mapping)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (skill, week_start) DO UPDATE SET
                frequency = EXCLUDED.frequency,
                closure_path = EXCLUDED.closure_path,
                project_mapping = EXCLUDED.project_mapping
            """,
            (gap["skill"], gap["frequency"], week_start, gap.get("closure_path"), gap.get("project_mapping")),
        )
    conn.commit()
    cur.close()
    conn.close()


def fetch_jobs_from_db() -> list[dict]:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT missing_skills FROM job_listings WHERE score >= 60")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [{"missing_skills": r[0] or []} for r in rows]


def run(jobs: list[dict] = None) -> list[dict]:
    if jobs is None:
        jobs = fetch_jobs_from_db()
    print(f"[Agent 3] Analyzing skill gaps across {len(jobs)} scored jobs")
    if not jobs:
        print("[Agent 3] No scored jobs found — skipping")
        return []
    top_gaps = aggregate_gaps(jobs)
    print(f"  Top gaps: {[g[0] for g in top_gaps[:5]]}")

    gap_analyses = analyze_gaps(top_gaps)
    save_gaps(gap_analyses)
    print(f"[Agent 3] Saved {len(gap_analyses)} gap analyses to DB")
    return gap_analyses


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
