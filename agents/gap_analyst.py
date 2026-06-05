"""
Agent 3 — Gap Analyst
Input: newly scored jobs (gap_analyzed = false) for a user
Output: incremental skill_gaps updates
"""

import os
import json
import psycopg2
from collections import Counter
from agents.llm_client import call_llm

DATABASE_URL = os.environ["DATABASE_URL"]

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


def analyze_gaps(top_gaps: list[tuple[str, int]], user_id: int) -> list[dict]:
    gap_list = "\n".join(f"- {skill} (needed by {count} jobs)" for skill, count in top_gaps)
    projects_text = "\n".join(f"- {p}" for p in YOUR_PROJECTS)

    prompt = f"""You are a career development strategist for a senior Python/AI engineer job hunting in Germany.

Top missing skills (cumulative across all scanned jobs):
{gap_list}

Candidate's existing projects:
{projects_text}

For each skill, decide:
1. If it CAN be added to an existing project → set project_mapping to the project name, how_to_implement to a specific 1-2 sentence plan, online_course and example_project to null.
2. If NO existing project fits → set project_mapping and how_to_implement to null, online_course to the best course (name + platform + hours), example_project to a small standalone project.

Return a JSON array, one object per skill:
{{
  "skill": "...",
  "frequency": <int>,
  "project_mapping": "<project name or null>",
  "how_to_implement": "<implementation plan or null>",
  "online_course": "<course/cert name, platform, hours — or null>",
  "example_project": "<small project or null>"
}}

Return ONLY the JSON array, no other text."""

    try:
        text = call_llm(prompt, max_tokens=6000, user_id=user_id, speed="smart")
        return json.loads(text)
    except (json.JSONDecodeError, Exception) as e:
        print(f"[Agent 3] LLM/parse error: {e}")
        return [{"skill": s, "frequency": c, "project_mapping": None, "how_to_implement": None,
                 "online_course": None, "example_project": None} for s, c in top_gaps]


def save_gaps(gap_analyses: list[dict], user_id: int):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    for gap in gap_analyses:
        cur.execute(
            """
            INSERT INTO skill_gaps (skill, frequency, project_mapping, how_to_implement, online_course, example_project, last_updated, user_id)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s)
            ON CONFLICT (skill) DO UPDATE SET
                frequency = skill_gaps.frequency + EXCLUDED.frequency,
                project_mapping = COALESCE(EXCLUDED.project_mapping, skill_gaps.project_mapping),
                how_to_implement = COALESCE(EXCLUDED.how_to_implement, skill_gaps.how_to_implement),
                online_course = COALESCE(EXCLUDED.online_course, skill_gaps.online_course),
                example_project = COALESCE(EXCLUDED.example_project, skill_gaps.example_project),
                last_updated = NOW()
            """,
            (gap["skill"], gap["frequency"], gap.get("project_mapping"), gap.get("how_to_implement"),
             gap.get("online_course"), gap.get("example_project"), user_id),
        )
    conn.commit(); cur.close(); conn.close()


def fetch_jobs_from_db(user_id: int) -> list[dict]:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, missing_skills FROM job_listings "
        "WHERE score >= 60 AND gap_analyzed = false "
        "AND scraped_at >= NOW() - INTERVAL '7 days' "
        "AND user_id = %s",
        (user_id,)
    )
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [{"id": r[0], "missing_skills": r[1] or []} for r in rows]


def mark_jobs_analyzed(job_ids: list[int]):
    if not job_ids:
        return
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("UPDATE job_listings SET gap_analyzed = true WHERE id = ANY(%s)", (job_ids,))
    conn.commit(); cur.close(); conn.close()


def run(user_id: int = 1, jobs: list[dict] = None) -> list[dict]:
    if jobs is None:
        jobs = fetch_jobs_from_db(user_id)
    print(f"[Agent 3] {len(jobs)} unanalyzed jobs for user {user_id}")
    if not jobs:
        return []
    top_gaps = aggregate_gaps(jobs)
    print(f"  Top gaps: {[g[0] for g in top_gaps[:5]]}")
    gap_analyses = analyze_gaps(top_gaps, user_id)
    save_gaps(gap_analyses, user_id)
    job_ids = [j["id"] for j in jobs if "id" in j]
    mark_jobs_analyzed(job_ids)
    print(f"[Agent 3] Saved {len(gap_analyses)} gaps, marked {len(job_ids)} jobs analyzed")
    return gap_analyses


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
