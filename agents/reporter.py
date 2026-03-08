"""
Agent 5 — Reporter
Trigger: runs AFTER Agents 1-4 complete (n8n wait node)
Model: claude-sonnet-4-6 for synthesis
Sends structured daily digest via Gmail (n8n Gmail node webhook)
Logs report metadata to report_log table
"""

import os
import json
import requests
import psycopg2
import anthropic
from datetime import datetime, date

DATABASE_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
N8N_WEBHOOK_URL = os.environ.get("N8N_WEBHOOK_URL", "")
DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://your-ec2-ip:3000")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def load_todays_data() -> dict:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    today = date.today()

    cur.execute("SELECT COUNT(*) FROM job_listings WHERE DATE(scraped_at) = %s", (today,))
    total_found = cur.fetchone()[0]

    cur.execute(
        "SELECT id, title, company, location, score, matched_skills, missing_skills, url FROM job_listings WHERE DATE(scraped_at) = %s AND score >= 60 ORDER BY score DESC LIMIT 10",
        (today,),
    )
    top_jobs = [
        {"id": r[0], "title": r[1], "company": r[2], "location": r[3],
         "score": r[4], "matched_skills": r[5] or [], "missing_skills": r[6] or [], "url": r[7]}
        for r in cur.fetchall()
    ]

    cur.execute(
        "SELECT skill, frequency, closure_path FROM skill_gaps WHERE week_start = DATE_TRUNC('week', CURRENT_DATE) ORDER BY frequency DESC LIMIT 5",
    )
    gaps = [{"skill": r[0], "frequency": r[1], "closure_path": r[2]} for r in cur.fetchall()]

    cur.execute(
        """SELECT ip.questions FROM interview_prep ip
           JOIN job_listings jl ON ip.job_id = jl.id
           WHERE DATE(jl.scraped_at) = %s AND jl.score >= 80
           LIMIT 1""",
        (today,),
    )
    prep_row = cur.fetchone()
    top_prep_q = None
    if prep_row and prep_row[0]:
        questions = prep_row[0] if isinstance(prep_row[0], list) else json.loads(prep_row[0])
        top_prep_q = questions[0] if questions else None

    cur.close()
    conn.close()
    return {"total_found": total_found, "top_jobs": top_jobs, "gaps": gaps, "top_prep_q": top_prep_q}


def synthesize_email(data: dict) -> str:
    top5 = data["top_jobs"][:5]
    jobs_text = "\n".join(
        f"- [{j['score']}] {j['title']} @ {j['company']} ({j['location']}) | Matched: {', '.join(j['matched_skills'][:3])} | Missing: {', '.join(j['missing_skills'][:2])}"
        for j in top5
    )
    gaps_text = "\n".join(f"- {g['skill']} ({g['frequency']} jobs): {g['closure_path']}" for g in data["gaps"][:3])
    today_str = datetime.now().strftime("%B %d")

    prompt = f"""Generate a concise daily job hunt digest email for Vasu Chukka, a senior Python/AI engineer in Munich.

Data for {today_str}:
- Total jobs found: {data['total_found']}
- Jobs scoring >= 80 (top matches): {len([j for j in data['top_jobs'] if j['score'] >= 80])}

Top 5 matches:
{jobs_text}

Top skill gaps:
{gaps_text}

First interview prep question: {data['top_prep_q']['question'] if data['top_prep_q'] else 'N/A'}

Write the email body in clean HTML. Include:
1. Executive Summary (2-3 bullet points)
2. Top 5 Matches table
3. Skill Gap Intelligence (top 3)
4. Interview Prep Preview (first Q from top match)
5. Recommended Action Today (one specific thing)

Tone: professional, direct, actionable. No filler."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def send_via_n8n(subject: str, html_body: str):
    if not N8N_WEBHOOK_URL:
        print("[Agent 5] No N8N_WEBHOOK_URL set — skipping email send")
        return False
    payload = {"subject": subject, "html": html_body, "to": "vasu@example.com"}
    try:
        resp = requests.post(f"{N8N_WEBHOOK_URL}/webhook/send-report", json=payload, timeout=15)
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[Agent 5] Failed to send via n8n: {e}")
        return False


def log_report(data: dict, email_sent: bool, summary: str):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO report_log (report_date, jobs_found, jobs_scored, top_matches, email_sent, email_sent_at, summary_text)
        VALUES (CURRENT_DATE, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (report_date) DO UPDATE SET
            jobs_found = EXCLUDED.jobs_found,
            jobs_scored = EXCLUDED.jobs_scored,
            top_matches = EXCLUDED.top_matches,
            email_sent = EXCLUDED.email_sent,
            email_sent_at = EXCLUDED.email_sent_at
        """,
        (
            data["total_found"],
            len(data["top_jobs"]),
            len([j for j in data["top_jobs"] if j["score"] >= 80]),
            email_sent,
            datetime.now() if email_sent else None,
            summary[:500],
        ),
    )
    conn.commit()
    cur.close()
    conn.close()


def run():
    print("[Agent 5] Compiling daily report")
    data = load_todays_data()
    html_body = synthesize_email(data)

    today_str = datetime.now().strftime("%B %-d")
    top_count = len([j for j in data["top_jobs"] if j["score"] >= 80])
    subject = f"Job Digest | {today_str} — {data['total_found']} jobs found, {top_count} top matches"

    sent = send_via_n8n(subject, html_body)
    log_report(data, sent, html_body[:500])
    print(f"[Agent 5] Done. Email sent: {sent}")
    return {"subject": subject, "sent": sent, "jobs_found": data["total_found"]}


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
