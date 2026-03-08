"""
Agent 6 — Application Tracker
Trigger: manual (dashboard status updates) + weekly cron for follow-up reminders
Tracks pipeline: New > Saved > Applied > Interview > Rejected > Offer
Sends follow-up reminder emails via n8n webhook
"""

import os
import json
import requests
import psycopg2
from datetime import datetime, timedelta

DATABASE_URL = os.environ["DATABASE_URL"]
N8N_WEBHOOK_URL = os.environ.get("N8N_WEBHOOK_URL", "")

VALID_STATUSES = ["new", "saved", "applied", "interview", "rejected", "offer"]
FOLLOW_UP_DAYS = 7  # send reminder if applied > N days ago with no response


def get_db():
    return psycopg2.connect(DATABASE_URL)


def update_status(job_id: int, new_status: str, notes: str = "") -> dict:
    if new_status not in VALID_STATUSES:
        return {"error": f"Invalid status. Must be one of: {VALID_STATUSES}"}

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO applications (job_id, status, applied_at, last_updated, notes)
        VALUES (%s, %s, %s, NOW(), %s)
        ON CONFLICT (job_id) DO UPDATE SET
            status = EXCLUDED.status,
            last_updated = NOW(),
            notes = COALESCE(NULLIF(EXCLUDED.notes, ''), applications.notes),
            applied_at = CASE
                WHEN EXCLUDED.status = 'applied' AND applications.applied_at IS NULL
                THEN NOW()
                ELSE applications.applied_at
            END
        RETURNING id, status
        """,
        (job_id, new_status, datetime.now() if new_status == "applied" else None, notes),
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return {"application_id": row[0], "status": row[1]}


def get_pipeline() -> dict:
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT a.status, COUNT(*) as count,
               json_agg(json_build_object(
                   'job_id', jl.id, 'title', jl.title, 'company', jl.company,
                   'score', jl.score, 'applied_at', a.applied_at, 'notes', a.notes
               ) ORDER BY a.last_updated DESC) as jobs
        FROM applications a
        JOIN job_listings jl ON a.job_id = jl.id
        GROUP BY a.status
        """,
    )
    pipeline = {status: {"count": 0, "jobs": []} for status in VALID_STATUSES}
    for row in cur.fetchall():
        pipeline[row[0]] = {"count": row[1], "jobs": row[2]}
    cur.close()
    conn.close()
    return pipeline


def check_follow_ups() -> list[dict]:
    conn = get_db()
    cur = conn.cursor()
    cutoff = datetime.now() - timedelta(days=FOLLOW_UP_DAYS)
    cur.execute(
        """
        SELECT a.id, jl.title, jl.company, a.applied_at
        FROM applications a
        JOIN job_listings jl ON a.job_id = jl.id
        WHERE a.status = 'applied'
          AND a.applied_at <= %s
          AND a.follow_up_sent = FALSE
        """,
        (cutoff,),
    )
    due = [{"app_id": r[0], "title": r[1], "company": r[2], "applied_at": r[3]} for r in cur.fetchall()]
    cur.close()
    conn.close()
    return due


def send_follow_up_reminders(due_apps: list[dict]):
    if not N8N_WEBHOOK_URL or not due_apps:
        return

    for app in due_apps:
        days_ago = (datetime.now() - app["applied_at"]).days
        payload = {
            "subject": f"Follow-up reminder: {app['title']} @ {app['company']}",
            "html": f"<p>You applied to <strong>{app['title']}</strong> at <strong>{app['company']}</strong> {days_ago} days ago — no response yet. Consider following up.</p>",
        }
        try:
            requests.post(f"{N8N_WEBHOOK_URL}/webhook/send-reminder", json=payload, timeout=10)
            # Mark as sent
            conn = get_db()
            cur = conn.cursor()
            cur.execute("UPDATE applications SET follow_up_sent = TRUE WHERE id = %s", (app["app_id"],))
            conn.commit()
            cur.close()
            conn.close()
            print(f"[Agent 6] Reminder sent for {app['title']} @ {app['company']}")
        except Exception as e:
            print(f"[Agent 6] Failed to send reminder: {e}")


def run_weekly_check():
    print("[Agent 6] Running weekly follow-up check")
    due = check_follow_ups()
    print(f"[Agent 6] {len(due)} applications due for follow-up")
    send_follow_up_reminders(due)
    return due


def get_rejection_patterns() -> list[dict]:
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT jl.missing_skills, COUNT(*) as rejections
        FROM applications a
        JOIN job_listings jl ON a.job_id = jl.id
        WHERE a.status = 'rejected'
        GROUP BY jl.missing_skills
        ORDER BY rejections DESC
        LIMIT 10
        """
    )
    patterns = [{"missing_skills": r[0], "rejections": r[1]} for r in cur.fetchall()]
    cur.close()
    conn.close()
    return patterns


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "pipeline":
        print(json.dumps(get_pipeline(), indent=2, default=str))
    elif len(sys.argv) > 1 and sys.argv[1] == "check":
        result = run_weekly_check()
        print(json.dumps(result, indent=2, default=str))
    else:
        print("Usage: python app_tracker.py [pipeline|check]")
