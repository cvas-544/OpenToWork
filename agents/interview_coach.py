"""
Agent 4 — Interview Coach
Input: jobs where application status = 'Interview' for a user
Output: 10 technical Qs, STAR frameworks, culture Q&A, questions to ask — stored in interview_prep
"""

import os
import json
import psycopg2
from datetime import datetime
from agents.llm_client import call_llm

DATABASE_URL = os.environ["DATABASE_URL"]


def generate_prep(job: dict, user_id: int) -> dict:
    prompt = f"""You are an expert technical interview coach. Generate comprehensive interview prep for this job.

Job: {job['title']} at {job['company']}
Location: {job['location']}
Matched Skills: {', '.join(job.get('matched_skills', []))}
Missing Skills: {', '.join(job.get('missing_skills', []))}
Job Description (excerpt): {job.get('description', '')[:1500]}

Return ONLY valid JSON with this structure:
{{
  "questions": [
    {{
      "id": 1,
      "question": "...",
      "difficulty": "Easy|Medium|Hard",
      "category": "Technical|Behavioral|System Design",
      "star_framework": {{
        "situation": "...",
        "task": "...",
        "action": "...",
        "result": "..."
      }}
    }}
  ],
  "culture_qa": [
    {{"question": "...", "answer": "..."}}
  ],
  "questions_to_ask": ["...", "...", "..."]
}}

Generate exactly 10 questions (mix of difficulties). Include 3 culture Q&A pairs and 5 questions to ask the interviewer."""

    try:
        text = call_llm(prompt, max_tokens=4000, user_id=user_id, speed="smart")
        return json.loads(text)
    except json.JSONDecodeError:
        return {"questions": [], "culture_qa": [], "questions_to_ask": []}


def save_prep(job_id: int, prep: dict, user_id: int):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO interview_prep (job_id, questions, culture_qa, questions_to_ask, generated_at, user_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        """,
        (
            job_id,
            json.dumps(prep.get("questions", [])),
            json.dumps(prep.get("culture_qa", [])),
            prep.get("questions_to_ask", []),
            datetime.now(),
            user_id,
        ),
    )
    conn.commit()
    cur.close()
    conn.close()


def fetch_interview_jobs(user_id: int) -> list[dict]:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        """SELECT jl.id, jl.title, jl.company, jl.location, jl.description, jl.score, jl.matched_skills, jl.missing_skills
           FROM job_listings jl
           JOIN applications a ON a.job_id = jl.id AND a.user_id = jl.user_id
           WHERE a.status = 'Interview'
           AND jl.user_id = %s
           AND jl.id NOT IN (SELECT job_id FROM interview_prep WHERE user_id = %s)
           ORDER BY jl.score DESC""",
        (user_id, user_id)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {"db_id": r[0], "title": r[1], "company": r[2], "location": r[3],
         "description": r[4], "score": r[5], "matched_skills": r[6] or [], "missing_skills": r[7] or []}
        for r in rows
    ]


def run(user_id: int = 1) -> list[dict]:
    jobs = fetch_interview_jobs(user_id)
    print(f"[Agent 4] Generating interview prep for {len(jobs)} jobs (user {user_id})")

    results = []
    for job in jobs:
        print(f"  Prepping: {job['title']} @ {job['company']} (score: {job['score']})")
        prep = generate_prep(job, user_id)
        save_prep(job["db_id"], prep, user_id)
        results.append({"job": job["title"], "company": job["company"], "prep": prep})

    print(f"[Agent 4] Done — {len(results)} prep sets generated")
    return results


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, default=str))
