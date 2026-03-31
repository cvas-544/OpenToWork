"""
Agent 5 — Reporter
Trigger: Every Sunday via n8n schedule (weekly digest)
Model: claude-sonnet-4-6 for synthesis
Saves weekly HTML report to reports/weekly/ folder
Logs report metadata to report_log table
"""

import os
import json
import psycopg2
from pathlib import Path
from datetime import datetime, date, timedelta
from agents.llm_client import call_llm

DATABASE_URL = os.environ["DATABASE_URL"]
REPORTS_DIR = Path(__file__).parent.parent / "reports" / "weekly"


def load_weeks_data() -> dict:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Current week: Monday to today
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    # Total jobs scraped this week
    cur.execute("SELECT COUNT(*) FROM job_listings WHERE DATE(scraped_at) >= %s", (week_start,))
    total_found = cur.fetchone()[0]

    # Total jobs scored this week
    cur.execute("SELECT COUNT(*) FROM job_listings WHERE DATE(scraped_at) >= %s AND score IS NOT NULL", (week_start,))
    total_scored = cur.fetchone()[0]

    # Top 10 matches this week (score >= 60)
    cur.execute(
        """SELECT id, title, company, location, score, matched_skills, missing_skills, url
           FROM job_listings
           WHERE DATE(scraped_at) >= %s AND score >= 60
           ORDER BY score DESC LIMIT 10""",
        (week_start,),
    )
    top_jobs = [
        {"id": r[0], "title": r[1], "company": r[2], "location": r[3],
         "score": r[4], "matched_skills": r[5] or [], "missing_skills": r[6] or [], "url": r[7]}
        for r in cur.fetchall()
    ]

    # Applications moved to interview this week
    cur.execute(
        """SELECT COUNT(*) FROM applications
           WHERE status = 'interview' AND DATE(last_updated) >= %s""",
        (week_start,),
    )
    interviews_this_week = cur.fetchone()[0]

    # Applications submitted this week
    cur.execute(
        """SELECT COUNT(*) FROM applications
           WHERE status = 'applied' AND DATE(applied_at) >= %s""",
        (week_start,),
    )
    applied_this_week = cur.fetchone()[0]

    # Top skill gaps this week
    cur.execute(
        """SELECT skill, frequency, closure_path
           FROM skill_gaps
           WHERE week_start = DATE_TRUNC('week', CURRENT_DATE)
           ORDER BY frequency DESC LIMIT 5"""
    )
    gaps = [{"skill": r[0], "frequency": r[1], "closure_path": r[2]} for r in cur.fetchall()]

    # Interview prep generated this week
    cur.execute(
        """SELECT ip.questions FROM interview_prep ip
           JOIN job_listings jl ON ip.job_id = jl.id
           WHERE DATE(ip.generated_at) >= %s AND jl.score >= 80
           ORDER BY jl.score DESC LIMIT 1""",
        (week_start,),
    )
    prep_row = cur.fetchone()
    top_prep_q = None
    if prep_row and prep_row[0]:
        questions = prep_row[0] if isinstance(prep_row[0], list) else json.loads(prep_row[0])
        top_prep_q = questions[0] if questions else None

    cur.close()
    conn.close()
    return {
        "total_found": total_found,
        "total_scored": total_scored,
        "top_jobs": top_jobs,
        "interviews_this_week": interviews_this_week,
        "applied_this_week": applied_this_week,
        "gaps": gaps,
        "top_prep_q": top_prep_q,
        "week_start": week_start.strftime("%B %d"),
        "week_end": today.strftime("%B %d, %Y"),
    }


def synthesize_email(data: dict) -> str:
    top5 = data["top_jobs"][:5]
    jobs_text = "\n".join(
        f"- [{j['score']}] {j['title']} @ {j['company']} ({j['location']}) | Matched: {', '.join(j['matched_skills'][:3])} | Missing: {', '.join(j['missing_skills'][:2])}"
        for j in top5
    )
    gaps_text = "\n".join(
        f"- {g['skill']} ({g['frequency']} jobs): {g['closure_path'] or 'No closure path yet'}"
        for g in data["gaps"][:3]
    )

    prompt = f"""Generate a concise weekly job hunt digest email for Vasu Chukka, a senior Python/AI engineer in Munich.

Week: {data['week_start']} — {data['week_end']}

Weekly stats:
- Total jobs scraped: {data['total_found']}
- Jobs scored: {data['total_scored']}
- Jobs scoring >= 80 (strong matches): {len([j for j in data['top_jobs'] if j['score'] >= 80])}
- Applications submitted: {data['applied_this_week']}
- Interviews secured: {data['interviews_this_week']}

Top 5 matches this week:
{jobs_text}

Top skill gaps (from this week's job scan):
{gaps_text}

Top interview prep question: {data['top_prep_q']['question'] if data['top_prep_q'] else 'None generated this week'}

Write the email body in clean HTML. Include:
1. Weekly Summary (3-4 bullet points — wins, numbers, key trends)
2. Top 5 Matches table (score, title, company, key gap)
3. Skill Gap Intelligence (top 3 with closure paths)
4. Interview Prep Preview (top question if available)
5. Focus for Next Week (one specific actionable recommendation)

Tone: professional, direct, motivating. No filler."""

    return call_llm(prompt, model="claude-sonnet-4-6", max_tokens=3000)


def save_report_file(filename: str, html_body: str) -> str:
    """Save HTML report to reports/weekly/ and return the file path."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORTS_DIR / filename
    path.write_text(html_body, encoding="utf-8")
    return str(path)


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
            data["total_scored"],
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
    print("[Agent 5] Compiling weekly report")
    data = load_weeks_data()
    html_body = synthesize_email(data)

    top_count = len([j for j in data["top_jobs"] if j["score"] >= 80])
    filename = f"week-{date.today().strftime('%Y-%m-%d')}.html"
    saved_path = save_report_file(filename, html_body)

    log_report(data, True, html_body[:500])
    print(f"[Agent 5] Done. Report saved → {saved_path}")
    return {
        "jobs_found": data["total_found"],
        "top_matches": top_count,
        "report_path": saved_path,
        "week": f"{data['week_start']} – {data['week_end']}",
    }


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
