"""
Agent 3 — Gap Analyst
Model: claude-sonnet-4-6 (complex reasoning)
Input: all scored jobs (all time) from DB
Output: global per-skill gap table with project integration guidance or course suggestions
"""

import os
import json
import psycopg2
from collections import Counter
from agents.llm_client import call_llm

DATABASE_URL = os.environ["DATABASE_URL"]

# Projects to map gaps against
YOUR_PROJECTS = [
    "OpenToWork / JobHunt AI — multi-agent job intelligence system (n8n, FastAPI, Claude API, PostgreSQL, React dashboard)",
    "FinsenseAI — AI-powered finance dashboard (Python, React, Claude API, AWS EC2, RDS)",
    "autoTinglishSub — fine-tuned Whisper model for Telugu/English subtitles (PyTorch, HuggingFace, CTranslate2)",
    "RAG Chatbot — document Q&A system (LangChain, vector embeddings, Python)",
    "Chrome Extension — browser automation tool (JavaScript)",
]


def aggregate_gaps(jobs: list[dict]) -> list[tuple[str, int]]:
    all_missing = []
    for job in jobs:
        all_missing.extend(job.get("missing_skills", []))
    return Counter(all_missing).most_common(20)


def analyze_gaps(top_gaps: list[tuple[str, int]]) -> list[dict]:
    gap_list = "\n".join(f"- {skill} (needed by {count} jobs)" for skill, count in top_gaps)
    projects_text = "\n".join(f"- {p}" for p in YOUR_PROJECTS)

    prompt = f"""You are a career development strategist for Vasu Chukka, a senior Python/AI engineer job hunting in Munich.

Top missing skills (cumulative across all scanned jobs):
{gap_list}

Candidate's existing projects:
{projects_text}

For each skill, decide:
1. If the skill CAN be added to one of the existing projects → set project_mapping to the project name, how_to_implement to a specific 1-2 sentence implementation plan (what to build/add), online_course and example_project to null.
2. If NO existing project is a natural fit → set project_mapping and how_to_implement to null, online_course to the best free/paid course or certification (name + platform + rough hours), example_project to a small standalone project Vasu can build in 1-2 weeks to demonstrate the skill.

Return a JSON array, one object per skill:
{{
  "skill": "...",
  "frequency": <int>,
  "project_mapping": "<project name or null>",
  "how_to_implement": "<specific implementation plan for that project, or null>",
  "online_course": "<course/cert name, platform, hours — or null>",
  "example_project": "<small project to build if no existing project fits — or null>"
}}

Return ONLY the JSON array, no other text."""

    try:
        text = call_llm(prompt, model="claude-sonnet-4-6", max_tokens=6000)
        return json.loads(text)
    except (json.JSONDecodeError, Exception) as e:
        print(f"[Agent 3] LLM/parse error: {e}")
        return [{"skill": s, "frequency": c, "project_mapping": None, "how_to_implement": None, "online_course": None, "example_project": None} for s, c in top_gaps]


def save_gaps(gap_analyses: list[dict]):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    for gap in gap_analyses:
        cur.execute(
            """
            INSERT INTO skill_gaps (skill, frequency, project_mapping, how_to_implement, online_course, example_project, last_updated)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (skill) DO UPDATE SET
                frequency = EXCLUDED.frequency,
                project_mapping = EXCLUDED.project_mapping,
                how_to_implement = EXCLUDED.how_to_implement,
                online_course = EXCLUDED.online_course,
                example_project = EXCLUDED.example_project,
                last_updated = NOW()
            """,
            (
                gap["skill"], gap["frequency"],
                gap.get("project_mapping"), gap.get("how_to_implement"),
                gap.get("online_course"), gap.get("example_project"),
            ),
        )
    conn.commit()
    cur.close()
    conn.close()


def fetch_jobs_from_db() -> list[dict]:
    """Fetch all scored jobs — cumulative gap analysis across all time."""
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
