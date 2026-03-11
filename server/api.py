"""
OpenToWork — Agent API
FastAPI server exposing agent run endpoints + data endpoints for n8n and dashboard.
"""

import os
import json
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="OpenToWork Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Agent Run Endpoints ───────────────────────────────────────────────────────

@app.post("/run/agent1")
def run_agent1():
    try:
        from agents.job_scraper import run
        result = run()
        return {"status": "ok", "new_jobs": len(result), "jobs": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent2")
def run_agent2():
    try:
        from agents.cv_matcher import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent3")
def run_agent3():
    try:
        from agents.gap_analyst import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent4")
def run_agent4():
    try:
        from agents.interview_coach import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent5")
def run_agent5():
    try:
        from agents.reporter import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent6")
def run_agent6():
    try:
        from agents.app_tracker import run
        result = run()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Dashboard Data Endpoints ──────────────────────────────────────────────────

# ── Profile Endpoints ─────────────────────────────────────────────────────────

class SkillsBody(BaseModel):
    skills: List[str]


@app.get("/profile")
def get_profile():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT skills FROM user_profile WHERE user_id = 'default' LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return {"skills": []}
    return {"skills": row["skills"]}


@app.post("/profile/skills")
def update_skills(body: SkillsBody):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO user_profile (user_id, skills, updated_at)
        VALUES ('default', %s, NOW())
        ON CONFLICT (user_id) DO UPDATE SET skills = EXCLUDED.skills, updated_at = NOW()
        """,
        (json.dumps(body.skills),),
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "ok", "skills": body.skills}


# ── Dashboard Data Endpoints ──────────────────────────────────────────────────

@app.get("/data/jobs")
def get_jobs(limit: int = 200, score_min: int = 0):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT id, title, company, location, remote, url, source,
               score, date_posted, scraped_at, matched_skills, missing_skills, description
        FROM job_listings
        WHERE (score >= %s OR score IS NULL)
        ORDER BY scraped_at DESC
        LIMIT %s
    """, (score_min, limit))
    jobs = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    # Normalise for dashboard
    for j in jobs:
        j["matched"] = j.pop("matched_skills") or []
        j["missing"] = j.pop("missing_skills") or []
        j["date"] = j["scraped_at"].strftime("%b %d") if j.get("scraped_at") else ""
        j["created_at"] = str(j["scraped_at"])
        j["scraped_at"] = j["created_at"]
        j["date_posted"] = str(j["date_posted"]) if j.get("date_posted") else ""
        j["status"] = "new"
        j["description"] = j.get("description") or ""
    return {"jobs": jobs}


@app.get("/data/gaps")
def get_gaps():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT skill, frequency, week_start, closure_path, project_mapping
        FROM skill_gaps
        ORDER BY week_start DESC, frequency DESC
        LIMIT 50
    """)
    gaps = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for g in gaps:
        g["week_start"] = str(g["week_start"])
    return {"gaps": gaps}


@app.get("/data/stats")
def get_stats():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Total jobs + last run
    cur.execute("SELECT COUNT(*) AS total, MAX(scraped_at) AS last_run FROM job_listings")
    row = cur.fetchone()
    total = row["total"]
    last_run = row["last_run"]

    # Today's new jobs
    cur.execute("""
        SELECT COUNT(*) AS today FROM job_listings
        WHERE scraped_at >= CURRENT_DATE
    """)
    today = cur.fetchone()["today"]

    # Applied + Interviews (from applications table)
    cur.execute("""
        SELECT status, COUNT(*) AS count FROM applications
        WHERE status IN ('applied', 'interview', 'offer')
        GROUP BY status
    """)
    status_counts = {r["status"]: r["count"] for r in cur.fetchall()}

    # Daily trend — last 7 days
    cur.execute("""
        SELECT TO_CHAR(scraped_at, 'Dy') AS day, COUNT(*) AS jobs
        FROM job_listings
        WHERE scraped_at >= NOW() - INTERVAL '7 days'
        GROUP BY TO_CHAR(scraped_at, 'Dy'), DATE(scraped_at)
        ORDER BY DATE(scraped_at)
    """)
    trend = [dict(r) for r in cur.fetchall()]

    # Pipeline funnel
    cur.execute("""
        SELECT
          (SELECT COUNT(*) FROM job_listings) AS found,
          COUNT(*) FILTER (WHERE status = 'applied') AS applied,
          COUNT(*) FILTER (WHERE status = 'interview') AS interview,
          COUNT(*) FILTER (WHERE status = 'offer') AS offer
        FROM applications
    """)
    funnel = cur.fetchone()

    cur.close()
    conn.close()

    pipeline = [
        {"stage": "Found",     "count": funnel["found"]},
        {"stage": "Applied",   "count": funnel["applied"]},
        {"stage": "Interview", "count": funnel["interview"]},
        {"stage": "Offer",     "count": funnel["offer"]},
    ]

    return {
        "total": total,
        "today": today,
        "applied": status_counts.get("applied", 0),
        "interviews": status_counts.get("interview", 0),
        "trend": trend,
        "pipeline": pipeline,
        "last_run": last_run.isoformat() if last_run else None,
    }
