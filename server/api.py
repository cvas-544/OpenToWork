"""
OpenToWork — Agent API
FastAPI server exposing agent run endpoints + data endpoints for n8n and dashboard.
"""

import os
import json
import psycopg2
import psycopg2.extras
from collections import Counter
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

    cur.execute("SELECT skills FROM user_profile WHERE user_id = 'default' LIMIT 1")
    row = cur.fetchone()
    user_skills = set(row["skills"] if row else [])
    ai_user_skills = {s for s in user_skills if _is_ai_skill(s)}

    cur.execute("SELECT matched_skills, missing_skills FROM job_listings WHERE score >= 60")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    freq: Counter = Counter()
    for r in rows:
        for skill in (r["matched_skills"] or []):
            if _is_ai_skill(skill):
                freq[skill] += 1
        for skill in (r["missing_skills"] or []):
            if _is_ai_skill(skill):
                freq[skill] += 1

    top = freq.most_common(8)
    if not top:
        return {"radar": []}

    max_freq = top[0][1]
    radar = []
    for skill, count in top:
        label = skill.title()
        if len(label) > 14:
            label = label[:12] + "…"
        radar.append({
            "subject": label,
            "you": 85 if _user_has_skill(skill, ai_user_skills) else 15,
            "market": round((count / max_freq) * 100),
        })
    return {"radar": radar}


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
