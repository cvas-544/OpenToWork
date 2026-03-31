"""
OpenToWork — Agent API
FastAPI server exposing agent run endpoints + data endpoints for n8n and dashboard.
"""

import os
import json
import uuid
import psycopg2
import psycopg2.extras
from collections import Counter
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from agents.run_logger import RunLogger

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
def run_agent1(run_id: Optional[str] = Query(default=None)):
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 1 — Job Scraper")
    logger.start()
    try:
        from agents.job_scraper import run
        result = run()
        logger.success(jobs_found=len(result))
        return {"status": "ok", "run_id": rid, "new_jobs": len(result), "jobs": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent2")
def run_agent2(run_id: Optional[str] = Query(default=None)):
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 2 — CV Matcher")
    logger.start()
    try:
        from agents.cv_matcher import run
        result = run()
        passed = [j for j in result if j.get("score", 0) >= 60]
        logger.success(jobs_scored=len(result), jobs_passed=len(passed))
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent3")
def run_agent3(run_id: Optional[str] = Query(default=None)):
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 3 — Gap Analyst")
    logger.start()
    try:
        from agents.gap_analyst import run
        result = run()
        logger.success(details={"gaps_analyzed": len(result)})
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent4")
def run_agent4(run_id: Optional[str] = Query(default=None)):
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 4 — Interview Coach")
    logger.start()
    try:
        from agents.interview_coach import run
        result = run()
        logger.success(details={"prep_sets": len(result)})
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent5")
def run_agent5(run_id: Optional[str] = Query(default=None)):
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 5 — Reporter")
    logger.start()
    try:
        from agents.reporter import run
        result = run()
        logger.success(details={"email_sent": result.get("email_sent", False)})
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent6")
def run_agent6(run_id: Optional[str] = Query(default=None)):
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 6 — App Tracker")
    logger.start()
    try:
        from agents.app_tracker import run
        result = run()
        logger.success(details={"reminders": len(result) if isinstance(result, list) else None})
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ── CV Tailor Endpoints ───────────────────────────────────────────────────────

class PreviewRequest(BaseModel):
    job_id: int


class TailorRequest(BaseModel):
    job_id: int
    include_cover_letter: bool = True
    skills_to_add: List[str] = []
    skills_to_remove: List[str] = []


@app.post("/cv/tailor/preview")
def tailor_cv_preview(body: PreviewRequest):
    try:
        from agents.cv_tailor import fetch_job, read_base_cv, preview_changes
        job = fetch_job(body.job_id)
        cv_tex = read_base_cv()
        result = preview_changes(job, cv_tex)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv/tailor")
def tailor_cv_endpoint(body: TailorRequest):
    try:
        from agents.cv_tailor import run
        result = run(body.job_id, body.include_cover_letter, body.skills_to_add, body.skills_to_remove)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cv/tailored/{job_id}")
def get_tailored_files(job_id: int):
    try:
        from agents.cv_tailor import fetch_job, sanitize_folder_name
        from pathlib import Path
        job = fetch_job(job_id)
        folder_name = sanitize_folder_name(job["company"], job["title"])
        output_dir = Path("/Users/vasuchukka/Desktop/job") / folder_name
        if not output_dir.exists():
            return {"exists": False, "folder": str(output_dir), "files": []}
        files = [f.name for f in output_dir.iterdir() if f.is_file()]
        return {"exists": True, "folder": str(output_dir), "files": files}
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

_AI_KEYWORDS = [
    "python", "pytorch", "tensorflow", "keras", "scikit", "sklearn", "pandas",
    "numpy", "opencv", "cuda", "langchain", "llm", "gpt", "claude", "openai",
    "anthropic", "huggingface", "transformer", "bert", "llama", "mistral",
    "gemini", "neural", "deep learning", "machine learning", "computer vision",
    "nlp", "rag", "embedding", "vector", "fine-tun", "mlflow", "kubeflow",
    "airflow", "mlops", "aiops", "prefect", "docker", "kubernetes", "k8s",
    "aws", "gcp", "azure", "fastapi", "flask", "postgresql", "postgres", "sql",
    "spark", "databricks", "snowflake", "dbt", "ray", "qdrant", "pinecone",
    "chroma", "weaviate", "faiss", "multi-agent", "agentic", "agent",
    "ci/cd", "n8n", "data engineer", "data science", "model", "inference",
    "training", "pipeline",
]

def _is_ai_skill(skill: str) -> bool:
    s = skill.lower()
    return any(kw in s for kw in _AI_KEYWORDS)

def _user_has_skill(market_skill: str, user_skills: set) -> bool:
    ms = market_skill.lower()
    for us in user_skills:
        ul = us.lower()
        if ul in ms or ms in ul:
            return True
        if set(ms.split()) & set(ul.split()):
            return True
    return False


@app.get("/data/radar")
def get_radar():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 1. Skills the user HAS — from matched_skills on high-score jobs (Agent 2 output)
    cur.execute("""
        SELECT DISTINCT lower(unnest(matched_skills)) AS skill
        FROM job_listings WHERE score >= 80 AND matched_skills IS NOT NULL
    """)
    matched_set = {r["skill"] for r in cur.fetchall() if r["skill"]}

    # 2. Also pull user_profile skills as fallback
    cur.execute("SELECT skills FROM user_profile WHERE user_id = 'default' LIMIT 1")
    row = cur.fetchone()
    profile_set = {s.lower() for s in (row["skills"] if row else [])}

    # Combined: user has a skill if it appears in matched OR profile
    has_skills = matched_set | profile_set

    # 3. Market skills — all skills from high-score jobs, count >= 3
    cur.execute("""
        SELECT skill, COUNT(*) AS frequency
        FROM (
            SELECT unnest(matched_skills) AS skill FROM job_listings WHERE score >= 80
            UNION ALL
            SELECT unnest(missing_skills) AS skill FROM job_listings WHERE score >= 80
        ) s
        WHERE skill IS NOT NULL AND trim(skill) != ''
        GROUP BY skill
        HAVING COUNT(*) >= 3
        ORDER BY frequency DESC
        LIMIT 15
    """)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    if not rows:
        return {"radar": []}

    max_freq = rows[0]["frequency"]
    radar = []
    for r in rows:
        skill = r["skill"]
        sl = skill.lower()
        user_has = any(sl in hs or hs in sl for hs in has_skills)
        label = skill.title()
        if len(label) > 14:
            label = label[:12] + "…"
        radar.append({
            "subject": label,
            "you": 85 if user_has else 15,
            "market": round((r["frequency"] / max_freq) * 100),
        })
    return {"radar": radar}


@app.get("/data/skills-daily")
def get_skills_daily():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT skill, COUNT(*) AS count
        FROM (
            SELECT unnest(matched_skills) AS skill FROM job_listings WHERE score >= 80
            UNION ALL
            SELECT unnest(missing_skills) AS skill FROM job_listings WHERE score >= 80
        ) s
        WHERE skill IS NOT NULL AND trim(skill) != ''
        GROUP BY skill
        ORDER BY count DESC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return {"skills": rows}


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


@app.get("/data/interview-prep")
def get_interview_prep():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT ip.id, ip.job_id, ip.questions, ip.culture_qa, ip.questions_to_ask, ip.generated_at,
               jl.title, jl.company, jl.score, jl.url, jl.location
        FROM interview_prep ip
        JOIN job_listings jl ON ip.job_id = jl.id
        ORDER BY ip.generated_at DESC
        LIMIT 20
    """)
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for r in rows:
        r["generated_at"] = str(r["generated_at"])
        if isinstance(r["questions"], str):
            r["questions"] = json.loads(r["questions"])
        if isinstance(r["culture_qa"], str):
            r["culture_qa"] = json.loads(r["culture_qa"])
    return {"prep": rows}


class StatusBody(BaseModel):
    status: str
    notes: str = ""


@app.post("/applications/{job_id}/status")
def update_application_status(job_id: int, body: StatusBody):
    try:
        from agents.app_tracker import update_status
        result = update_status(job_id, body.status, body.notes)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/data/pipeline")
def get_pipeline_data():
    try:
        from agents.app_tracker import get_pipeline
        return get_pipeline()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@app.get("/data/automation-logs")
def get_automation_logs():
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT
            run_id,
            MIN(started_at) AS run_started_at,
            MAX(completed_at) AS run_completed_at,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'agent_name', agent_name,
                    'status', status,
                    'started_at', started_at,
                    'completed_at', completed_at,
                    'jobs_found', jobs_found,
                    'jobs_scored', jobs_scored,
                    'jobs_passed', jobs_passed,
                    'error_message', error_message,
                    'details', details
                ) ORDER BY started_at
            ) AS agents,
            BOOL_AND(status = 'success') AS all_passed,
            BOOL_OR(status = 'failed') AS any_failed
        FROM automation_logs
        GROUP BY run_id
        ORDER BY MIN(started_at) DESC
        LIMIT 50
    """)
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for r in rows:
        r["run_started_at"] = str(r["run_started_at"]) if r["run_started_at"] else None
        r["run_completed_at"] = str(r["run_completed_at"]) if r["run_completed_at"] else None
    return {"runs": rows}
