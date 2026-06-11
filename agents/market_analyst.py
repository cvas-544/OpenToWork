"""
Agent 9 — Market Analysis Agent

Runs after Agent 2. Takes jobs with score >= 50, sends them as a single
LLM call (Sonnet), and stores a 5-section market report to analysis_reports.
"""

import json
import os
import re
import psycopg2
from datetime import datetime
from dotenv import load_dotenv
from agents.llm_client import call_llm

load_dotenv()

DEFAULT_SCORE_THRESHOLD = 50
DEFAULT_MAX_JOBS        = 50


# ── DB helpers ─────────────────────────────────────────────────────────────────
def _fetch_jobs(user_id: int, score_threshold: int, max_jobs: int, newest: bool = False) -> list:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur  = conn.cursor()
    order = "scraped_at DESC" if newest else "score DESC"
    cur.execute(
        f"""
        SELECT id, title, company, location, score, matched_skills, missing_skills, source
        FROM job_listings
        WHERE score >= %s
          AND scraped_at >= NOW() - INTERVAL '7 days'
          AND user_id = %s
        ORDER BY {order}
        LIMIT %s
        """,
        (score_threshold, user_id, max_jobs),
    )
    rows = cur.fetchall()
    cur.close(); conn.close()
    return [
        {
            "id":             r[0],
            "title":          r[1],
            "company":        r[2],
            "location":       r[3] or "",
            "score":          r[4],
            "matched_skills": r[5] or [],
            "missing_skills": r[6] or [],
            "source":         r[7] or "",
        }
        for r in rows
    ]


def _save_report(user_id: int, jobs: list, report: dict):
    job_ids = [j["id"] for j in jobs]
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur  = conn.cursor()
    cur.execute(
        """
        INSERT INTO analysis_reports
            (user_id, jobs_analyzed, job_ids, market_direction, skill_demand,
             skill_combinations, market_gap, tech_shifts, career_directions)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            len(jobs),
            job_ids,
            json.dumps(report.get("market_direction", {})),
            json.dumps(report.get("skill_demand", {})),
            json.dumps(report.get("skill_combinations", {})),
            json.dumps(report.get("market_gap", {})),
            json.dumps(report.get("tech_shifts", {})),
            json.dumps(report.get("career_directions", {})),
        ),
    )
    conn.commit(); cur.close(); conn.close()


# ── Prompt + parse ─────────────────────────────────────────────────────────────
def _build_prompt(jobs: list) -> str:
    jobs_json = json.dumps(jobs, ensure_ascii=False)
    return f"""You are a senior job market analyst specialising in AI/ML engineering roles.

Below are {len(jobs)} scored job listings (score >= 50) from the past 7 days.
Each job includes the candidate's matched and missing skills from their CV.

Jobs:
{jobs_json}

Analyse these jobs and return a JSON object with EXACTLY these keys:

{{
  "market_direction": {{
    "summary": "<2-3 sentence overview of where the market is heading>",
    "findings": ["<finding>", ...],
    "top_roles": ["<role>", ...]
  }},
  "skill_demand": {{
    "summary": "<summary of most-demanded skills across all jobs>",
    "top_skills": [
      {{"skill": "Python", "frequency": 42, "trend": "rising"}},
      ...
    ]
  }},
  "skill_combinations": {{
    "summary": "<which skill clusters appear together most often>",
    "patterns": [
      {{"combination": ["Python", "AWS", "Docker"], "frequency": 12}},
      ...
    ]
  }},
  "market_gap": {{
    "summary": "<skills the market wants that the candidate lacks>",
    "gaps": [
      {{"skill": "Kubernetes", "market_demand": "high", "user_level": "beginner"}},
      ...
    ]
  }},
  "tech_shifts": {{
    "summary": "<emerging vs declining technologies>",
    "shifts": ["<shift>", ...]
  }},
  "career_directions": {{
    "<short direction label>": <job count>,
    ...
  }}
}}

Rules:
- trend must be one of: "rising", "stable", "declining"
- market_demand must be one of: "high", "medium", "low"
- user_level must be one of: "strong", "partial", "beginner", "none"
- career_directions keys should be short labels e.g. "MLOps", "LLM Engineering", "Data Engineering", "Applied AI", "AI Platform"
- At most 8 items per findings[], shifts[], top_skills[], patterns[], gaps[] arrays
- At most 6 career direction keys
- Return ONLY the raw JSON object. No markdown fences, no explanation."""


_EMPTY_REPORT = {
    "market_direction":   {"summary": "", "findings": [], "top_roles": []},
    "skill_demand":       {"summary": "", "top_skills": []},
    "skill_combinations": {"summary": "", "patterns": []},
    "market_gap":         {"summary": "", "gaps": []},
    "tech_shifts":        {"summary": "", "shifts": []},
    "career_directions":  {},
}


def _parse_report(text: str) -> dict:
    text = text.strip()
    # strip ```json fences if present
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    print("[Agent 9] Failed to parse LLM response — returning empty report")
    return _EMPTY_REPORT.copy()


# ── Entry point ────────────────────────────────────────────────────────────────
def run(user_id: int = 1, score_threshold: int = DEFAULT_SCORE_THRESHOLD, max_jobs: int = DEFAULT_MAX_JOBS, newest: bool = False) -> dict:
    jobs = _fetch_jobs(user_id, score_threshold, max_jobs, newest=newest)
    if not jobs:
        print(f"[Agent 9] No jobs >= {score_threshold} for user {user_id}")
        return {}

    mode = "newest-first" if newest else "top-scored"
    print(f"[Agent 9] Analysing {len(jobs)} jobs ({mode}, score>={score_threshold}, limit={max_jobs}) for user {user_id}")
    prompt_jobs = [{k: v for k, v in j.items() if k != "id"} for j in jobs]
    text   = call_llm(_build_prompt(prompt_jobs), max_tokens=4000, user_id=user_id, speed="smart", trace_name="Agent 9 — Market Analyst")
    report = _parse_report(text)
    _save_report(user_id, jobs, report)
    print(f"[Agent 9] Report saved — {len(jobs)} jobs, {len(report.get('career_directions', {}))} directions")
    return report


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, ensure_ascii=False))
