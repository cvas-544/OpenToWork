"""
Agent 4 — Interview Coach
Model: claude-sonnet-4-6 (high-quality generation)
Trigger: only for jobs scoring >= 80
Output: 10 technical Qs, STAR frameworks, culture Q&A, questions to ask — stored in interview_prep
"""

import os
import json
import psycopg2
import anthropic
from datetime import datetime

DATABASE_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
TOP_MATCH_THRESHOLD = 80

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def generate_prep(job: dict) -> dict:
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

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        return json.loads(response.content[0].text)
    except json.JSONDecodeError:
        return {"questions": [], "culture_qa": [], "questions_to_ask": []}


def save_prep(job_id: int, prep: dict):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO interview_prep (job_id, questions, culture_qa, questions_to_ask, generated_at)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        """,
        (
            job_id,
            json.dumps(prep.get("questions", [])),
            json.dumps(prep.get("culture_qa", [])),
            prep.get("questions_to_ask", []),
            datetime.now(),
        ),
    )
    conn.commit()
    cur.close()
    conn.close()


def fetch_top_jobs() -> list[dict]:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        """SELECT id, title, company, location, description, score, matched_skills, missing_skills
           FROM job_listings WHERE score >= %s AND DATE(scraped_at) = CURRENT_DATE
           AND id NOT IN (SELECT job_id FROM interview_prep)
           ORDER BY score DESC""",
        (TOP_MATCH_THRESHOLD,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {"db_id": r[0], "title": r[1], "company": r[2], "location": r[3],
         "description": r[4], "score": r[5], "matched_skills": r[6] or [], "missing_skills": r[7] or []}
        for r in rows
    ]


def run() -> list[dict]:
    jobs = fetch_top_jobs()
    print(f"[Agent 4] Generating interview prep for {len(jobs)} top matches (score >= {TOP_MATCH_THRESHOLD})")

    results = []
    for job in jobs:
        print(f"  Prepping: {job['title']} @ {job['company']} (score: {job['score']})")
        prep = generate_prep(job)
        save_prep(job["db_id"], prep)
        results.append({"job": job["title"], "company": job["company"], "prep": prep})

    print(f"[Agent 4] Done — {len(results)} prep sets generated")
    return results


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, default=str))
