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
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from agents.run_logger import RunLogger
from server.auth import hash_password, verify_password, create_token, get_current_user, require_admin

load_dotenv()

app = FastAPI(title="OpenToWork Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ─── JWT Auth Middleware ───────────────────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from server.auth import decode_token

PUBLIC_PATHS = {"/health", "/auth/login"}

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        try:
            request.state.user = decode_token(auth[7:])
        except Exception:
            return JSONResponse({"detail": "Invalid token"}, status_code=401)
        return await call_next(request)

app.add_middleware(AuthMiddleware)


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "user"

@app.post("/auth/login")
def login(req: LoginRequest):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, email, password_hash, role FROM users WHERE email = %s", (req.email,))
    user = cur.fetchone()
    cur.close(); conn.close()
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"], user["role"])
    return {"token": token, "email": user["email"], "role": user["role"]}

@app.post("/auth/register")
def register(req: RegisterRequest, _admin=Depends(require_admin)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    if cur.fetchone():
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="Email already exists")
    cur.execute(
        "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, %s) RETURNING id, email, role",
        (req.email, hash_password(req.password), req.role)
    )
    new_user = cur.fetchone()
    conn.commit(); cur.close(); conn.close()
    return {"id": new_user["id"], "email": new_user["email"], "role": new_user["role"]}

@app.get("/auth/users")
def list_users(_admin=Depends(require_admin)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, email, role, created_at FROM users ORDER BY created_at")
    users = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    for u in users:
        if u.get("created_at"):
            u["created_at"] = u["created_at"].isoformat()
    return {"users": users}

@app.delete("/auth/users/{user_id}")
def delete_user(user_id: int, _admin=Depends(require_admin)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit(); cur.close(); conn.close()
    return {"ok": True}

@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return {"id": current_user["sub"], "email": current_user["email"], "role": current_user["role"]}

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@app.post("/auth/change-password")
def change_password(req: ChangePasswordRequest, current_user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT password_hash FROM users WHERE id = %s", (current_user["sub"],))
    row = cur.fetchone()
    if not row or not verify_password(req.current_password, row["password_hash"]):
        cur.close(); conn.close()
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(req.new_password), current_user["sub"]))
    conn.commit(); cur.close(); conn.close()
    return {"ok": True}


# ─── LLM Mode Toggle ──────────────────────────────────────────────────────────

class LLMModeRequest(BaseModel):
    mode: str  # "online" | "local"

@app.get("/settings/llm-mode")
def get_llm_mode_endpoint():
    from agents.llm_client import get_llm_mode
    return {"mode": get_llm_mode()}

@app.post("/settings/llm-mode")
def set_llm_mode_endpoint(body: LLMModeRequest):
    from agents.llm_client import set_llm_mode
    try:
        set_llm_mode(body.mode)  # accepts "online" | "cc" | "local"
        return {"mode": body.mode}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Per-User Settings ─────────────────────────────────────────────────────────

class UserSettingsBody(BaseModel):
    cv_text: Optional[str] = None
    job_keywords: Optional[List[str]] = None
    job_location: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model_fast: Optional[str] = None
    llm_model_smart: Optional[str] = None
    apify_token: Optional[str] = None
    apify_token_public: Optional[str] = None
    pipeline_agents: Optional[List[str]] = None
    schedule_times: Optional[List[int]] = None


@app.get("/settings/user")
def get_user_settings(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """SELECT cv_text, job_keywords, job_location, llm_provider,
                  llm_model_fast, llm_model_smart, apify_token, apify_token_public,
                  pipeline_agents, schedule_times, updated_at
           FROM user_settings WHERE user_id = %s""",
        (uid,)
    )
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        return {}
    data = dict(row)
    # Never return the raw API key — only whether it is set
    data["updated_at"] = str(data["updated_at"]) if data.get("updated_at") else None
    return data


@app.put("/settings/user")
def update_user_settings(body: UserSettingsBody, current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO user_settings (user_id, cv_text, job_keywords, job_location,
            llm_provider, llm_api_key, llm_model_fast, llm_model_smart,
            apify_token, apify_token_public, pipeline_agents, schedule_times, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            cv_text           = COALESCE(EXCLUDED.cv_text,           user_settings.cv_text),
            job_keywords      = COALESCE(EXCLUDED.job_keywords,      user_settings.job_keywords),
            job_location      = COALESCE(EXCLUDED.job_location,      user_settings.job_location),
            llm_provider      = COALESCE(EXCLUDED.llm_provider,      user_settings.llm_provider),
            llm_api_key       = COALESCE(EXCLUDED.llm_api_key,       user_settings.llm_api_key),
            llm_model_fast    = COALESCE(EXCLUDED.llm_model_fast,    user_settings.llm_model_fast),
            llm_model_smart   = COALESCE(EXCLUDED.llm_model_smart,   user_settings.llm_model_smart),
            apify_token       = COALESCE(EXCLUDED.apify_token,       user_settings.apify_token),
            apify_token_public= COALESCE(EXCLUDED.apify_token_public,user_settings.apify_token_public),
            pipeline_agents   = COALESCE(EXCLUDED.pipeline_agents,   user_settings.pipeline_agents),
            schedule_times    = COALESCE(EXCLUDED.schedule_times,    user_settings.schedule_times),
            updated_at        = NOW()
        """,
        (uid, body.cv_text, body.job_keywords, body.job_location,
         body.llm_provider, body.llm_api_key, body.llm_model_fast, body.llm_model_smart,
         body.apify_token, body.apify_token_public, body.pipeline_agents, body.schedule_times),
    )
    conn.commit(); cur.close(); conn.close()
    return {"status": "ok"}


# ── Agent Run Endpoints ───────────────────────────────────────────────────────

@app.post("/run/agent1")
def run_agent1(run_id: Optional[str] = Query(default=None), current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 1 — Job Scraper", user_id=uid)
    logger.start()
    try:
        from agents.job_scraper import run
        result = run(user_id=uid)
        logger.success(jobs_found=len(result))
        return {"status": "ok", "run_id": rid, "new_jobs": len(result), "jobs": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent2")
def run_agent2(run_id: Optional[str] = Query(default=None), current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 2 — CV Matcher", user_id=uid)
    logger.start()
    try:
        from agents.cv_matcher import run
        result = run(user_id=uid)
        passed = [j for j in result if j.get("score", 0) >= 60]
        logger.success(jobs_scored=len(result), jobs_passed=len(passed))
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent3")
def run_agent3(run_id: Optional[str] = Query(default=None), current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 3 — Gap Analyst", user_id=uid)
    logger.start()
    try:
        from agents.gap_analyst import run
        result = run(user_id=uid)
        logger.success(details={"gaps_analyzed": len(result)})
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent4")
def run_agent4(run_id: Optional[str] = Query(default=None), current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 4 — Interview Coach", user_id=uid)
    logger.start()
    try:
        from agents.interview_coach import run
        result = run(user_id=uid)
        logger.success(details={"prep_sets": len(result)})
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent5")
def run_agent5(run_id: Optional[str] = Query(default=None), current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 5 — Reporter", user_id=uid)
    logger.start()
    try:
        from agents.reporter import run
        result = run(user_id=uid)
        logger.success(details={"email_sent": result.get("email_sent", False)})
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/agent6")
def run_agent6(run_id: Optional[str] = Query(default=None), current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    rid = run_id or str(uuid.uuid4())
    logger = RunLogger(run_id=rid, agent_name="Agent 6 — App Tracker", user_id=uid)
    logger.start()
    try:
        from agents.app_tracker import run
        result = run()
        logger.success(details={"reminders": len(result) if isinstance(result, list) else None})
        return {"status": "ok", "run_id": rid, "result": result}
    except Exception as e:
        logger.fail(error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run/pipeline/all")
def run_pipeline_all(_admin=Depends(require_admin)):
    """Run the full pipeline for every user in user_settings — in parallel background threads."""
    import threading

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM user_settings ORDER BY user_id")
    user_ids = [r[0] for r in cur.fetchall()]
    cur.close(); conn.close()

    if not user_ids:
        return {"status": "ok", "message": "No users in user_settings", "users": []}

    shared_run_id = str(uuid.uuid4())

    def _run_for_user(uid: int):
        # Load which agents this user has enabled
        try:
            _conn = get_db(); _cur = _conn.cursor()
            _cur.execute("SELECT pipeline_agents FROM user_settings WHERE user_id = %s", (uid,))
            _row = _cur.fetchone()
            _cur.close(); _conn.close()
            enabled = set(_row[0]) if _row and _row[0] else {"agent1", "agent2", "agent3", "agent4", "agent5"}
        except Exception:
            enabled = {"agent1", "agent2", "agent3", "agent4", "agent5"}

        print(f"[Pipeline] Starting for user {uid} — enabled: {sorted(enabled)} (run {shared_run_id})")
        try:
            if "agent1" in enabled:
                from agents.job_scraper import run as scrape
                logger1 = RunLogger(run_id=shared_run_id, agent_name="Agent 1 — Job Scraper", user_id=uid)
                logger1.start()
                new_jobs = scrape(user_id=uid)
                logger1.success(jobs_found=len(new_jobs))

            if "agent2" in enabled:
                from agents.cv_matcher import run as match
                logger2 = RunLogger(run_id=shared_run_id, agent_name="Agent 2 — CV Matcher", user_id=uid)
                logger2.start()
                scored = match(user_id=uid)
                passed = [j for j in scored if j.get("score", 0) >= 60]
                logger2.success(jobs_scored=len(scored), jobs_passed=len(passed))

            if "agent3" in enabled:
                from agents.gap_analyst import run as gaps
                logger3 = RunLogger(run_id=shared_run_id, agent_name="Agent 3 — Gap Analyst", user_id=uid)
                logger3.start()
                gap_result = gaps(user_id=uid)
                logger3.success(details={"gaps_analyzed": len(gap_result)})

            print(f"[Pipeline] Done for user {uid}")
        except Exception as e:
            print(f"[Pipeline] Error for user {uid}: {e}")

    threads = []
    for uid in user_ids:
        t = threading.Thread(target=_run_for_user, args=(uid,), daemon=True)
        t.start()
        threads.append(t)

    return {
        "status": "ok",
        "run_id": shared_run_id,
        "users": user_ids,
        "message": f"Pipeline started for {len(user_ids)} user(s)",
    }


@app.post("/run/pipeline/due")
def run_pipeline_due(_admin=Depends(require_admin)):
    """Called every hour by cron — fires pipeline only for users whose schedule_times includes the current Munich hour."""
    import threading
    from datetime import datetime
    from zoneinfo import ZoneInfo

    current_hour = datetime.now(ZoneInfo("Europe/Berlin")).hour

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT user_id FROM user_settings WHERE %s = ANY(schedule_times) ORDER BY user_id",
        (current_hour,)
    )
    due_users = [r[0] for r in cur.fetchall()]
    cur.close(); conn.close()

    if not due_users:
        return {"status": "ok", "hour": current_hour, "users": [], "message": "No users scheduled for this Munich hour"}

    shared_run_id = str(uuid.uuid4())

    def _run_for_user(uid: int):
        try:
            _conn = get_db(); _cur = _conn.cursor()
            _cur.execute("SELECT pipeline_agents FROM user_settings WHERE user_id = %s", (uid,))
            _row = _cur.fetchone()
            _cur.close(); _conn.close()
            enabled = set(_row[0]) if _row and _row[0] else {"agent1", "agent2", "agent3"}
        except Exception:
            enabled = {"agent1", "agent2", "agent3"}

        print(f"[Pipeline/due] user={uid} Munich hour={current_hour} enabled={sorted(enabled)}")
        try:
            if "agent1" in enabled:
                from agents.job_scraper import run as scrape
                l1 = RunLogger(run_id=shared_run_id, agent_name="Agent 1 — Job Scraper", user_id=uid)
                l1.start(); new_jobs = scrape(user_id=uid); l1.success(jobs_found=len(new_jobs))

            if "agent2" in enabled:
                from agents.cv_matcher import run as match
                l2 = RunLogger(run_id=shared_run_id, agent_name="Agent 2 — CV Matcher", user_id=uid)
                l2.start(); scored = match(user_id=uid)
                l2.success(jobs_scored=len(scored), jobs_passed=len([j for j in scored if j.get("score", 0) >= 60]))

            if "agent3" in enabled:
                from agents.gap_analyst import run as gaps
                l3 = RunLogger(run_id=shared_run_id, agent_name="Agent 3 — Gap Analyst", user_id=uid)
                l3.start(); gap_result = gaps(user_id=uid); l3.success(details={"gaps_analyzed": len(gap_result)})

        except Exception as e:
            print(f"[Pipeline/due] Error for user {uid}: {e}")

    for uid in due_users:
        threading.Thread(target=_run_for_user, args=(uid,), daemon=True).start()

    return {
        "status": "ok",
        "run_id": shared_run_id,
        "hour": current_hour,
        "users": due_users,
        "message": f"Pipeline started for {len(due_users)} user(s) scheduled at Munich hour {current_hour}",
    }


# ── CV Tailor Endpoints ───────────────────────────────────────────────────────

class PreviewRequest(BaseModel):
    job_id: int


class TailorRequest(BaseModel):
    job_id: int
    include_cover_letter: bool = True
    skills_to_add: List[str] = []
    skills_to_remove: List[str] = []
    cover_letter_text: Optional[str] = None


class CoverLetterPreviewRequest(BaseModel):
    job_id: int


class ManualTailorPreviewRequest(BaseModel):
    title: str
    company: str
    description: str = ""


class ManualTailorRequest(BaseModel):
    title: str
    company: str
    description: str = ""
    include_cover_letter: bool = True
    skills_to_add: List[str] = []
    skills_to_remove: List[str] = []
    cover_letter_text: Optional[str] = None


class CoverLetterApproveManualRequest(BaseModel):
    title: str
    company: str
    letter_text: str


class CoverLetterApproveRequest(BaseModel):
    job_id: int
    letter_text: str


@app.post("/cv/tailor/preview")
def tailor_cv_preview(body: PreviewRequest):
    try:
        from agents.cv_tailor import fetch_job, read_base_cv, preview_changes
        from agents.llm_client import get_llm_mode
        job = fetch_job(body.job_id)
        cv_tex = "" if get_llm_mode() == "cc" else read_base_cv()
        result = preview_changes(job, cv_tex)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv/tailor")
def tailor_cv_endpoint(body: TailorRequest):
    try:
        from agents.cv_tailor import run
        result = run(
            body.job_id,
            body.include_cover_letter,
            body.skills_to_add,
            body.skills_to_remove,
            body.cover_letter_text,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv/cover-letter/preview")
def preview_cover_letter(body: CoverLetterPreviewRequest):
    try:
        from agents.cv_tailor import fetch_job
        from agents.cover_letter_agent import generate_with_review
        job = fetch_job(body.job_id)
        result = generate_with_review(job, max_iterations=2)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv/cover-letter/approve")
def approve_cover_letter(body: CoverLetterApproveRequest):
    import re
    import shutil
    import zipfile
    from pathlib import Path
    from datetime import date

    try:
        from agents.cv_tailor import fetch_job, sanitize_folder_name

        job = fetch_job(body.job_id)
        folder_name = sanitize_folder_name(job["company"], job["title"])
        output_dir = Path("/Users/vasuchukka/Desktop/job") / folder_name
        output_dir.mkdir(parents=True, exist_ok=True)

        template_dir = Path("/Users/vasuchukka/Documents/Projects/Skills/coverLetter/template/base-CoverLetter")
        template_tex = (template_dir / "coverletter.tex").read_text(encoding="utf-8")

        # LaTeX-escape the letter body text
        def latex_escape(text: str) -> str:
            replacements = [
                ("&", r"\&"), ("%", r"\%"), ("#", r"\#"), ("_", r"\_"),
                ("~", r"\textasciitilde{}"), ("^", r"\textasciicircum{}"),
            ]
            for src, dst in replacements:
                text = text.replace(src, dst)
            return text

        escaped_body = latex_escape(body.letter_text)
        # Convert plain paragraphs to LaTeX paragraphs (blank line = paragraph break)
        paragraphs = [p.strip() for p in escaped_body.split("\n\n") if p.strip()]
        latex_body = "\n\n".join(paragraphs)

        company_name = latex_escape(job["company"])
        role_title = latex_escape(job["title"])

        # Inject recipient
        template_tex = re.sub(
            r"\\recipient\s*\{[^}]*\}\s*\{[^}]*\}",
            f"\\\\recipient\n  {{{company_name}}}\n  {{Germany\\\\\\n}}",
            template_tex,
            flags=re.DOTALL,
        )
        # Inject title
        template_tex = re.sub(
            r"\\lettertitle\{[^}]*\}",
            f"\\\\lettertitle{{Subject: Application for {role_title}}}",
            template_tex,
        )
        # Inject body between \begin{cvletter} and \end{cvletter}
        template_tex = re.sub(
            r"\\begin\{cvletter\}.*?\\end\{cvletter\}",
            f"\\\\begin{{cvletter}}\n{latex_body}\n\\\\end{{cvletter}}",
            template_tex,
            flags=re.DOTALL,
        )

        # Write coverletter.tex
        cl_path = output_dir / "coverletter.tex"
        cl_path.write_text(template_tex, encoding="utf-8")

        # Copy template assets
        for asset in ["awesome-cv.cls", "fontawesome.sty"]:
            src = template_dir / asset
            dst = output_dir / asset
            if src.exists() and not dst.exists():
                shutil.copy2(src, dst)
        fonts_src = template_dir / "fonts"
        fonts_dst = output_dir / "fonts"
        if fonts_src.exists() and not fonts_dst.exists():
            shutil.copytree(fonts_src, fonts_dst)

        # Create ZIP
        company_slug = re.sub(r"[^\w]", "_", job["company"])[:30]
        today_str = date.today().isoformat()
        zip_name = f"CoverLetter_{company_slug}_{today_str}.zip"
        zip_path = output_dir.parent / zip_name
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in output_dir.rglob("*"):
                if f.is_file() and f.suffix in {".tex", ".cls", ".sty", ".otf", ".ttf"}:
                    zf.write(f, f.relative_to(output_dir.parent))

        return {
            "status": "ok",
            "folder": str(output_dir),
            "coverletter_tex": str(cl_path),
            "zip_path": str(zip_path),
            "zip_name": zip_name,
        }
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


# ── Manual App CV Tailor Endpoints ────────────────────────────────────────────

def _build_manual_job(title: str, company: str, description: str) -> dict:
    return {
        "id": None,
        "title": title,
        "company": company,
        "description": description,
        "missing_skills": [],
        "matched_skills": [],
        "fit_reason": "",
    }


@app.post("/cv/tailor/preview-manual")
def tailor_cv_preview_manual(body: ManualTailorPreviewRequest):
    try:
        from agents.cv_tailor import read_base_cv, preview_changes
        from agents.llm_client import get_llm_mode
        job = _build_manual_job(body.title, body.company, body.description)
        cv_tex = "" if get_llm_mode() == "cc" else read_base_cv()
        result = preview_changes(job, cv_tex)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv/tailor-manual")
def tailor_cv_manual_endpoint(body: ManualTailorRequest):
    try:
        from agents.cv_tailor import run_from_job
        job = _build_manual_job(body.title, body.company, body.description)
        result = run_from_job(job, body.include_cover_letter, body.skills_to_add, body.skills_to_remove, body.cover_letter_text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv/cover-letter/preview-manual")
def preview_cover_letter_manual(body: ManualTailorPreviewRequest):
    try:
        from agents.cover_letter_agent import generate_with_review
        job = _build_manual_job(body.title, body.company, body.description)
        result = generate_with_review(job, max_iterations=2)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv/cover-letter/approve-manual")
def approve_cover_letter_manual(body: CoverLetterApproveManualRequest):
    import re
    import shutil
    import zipfile
    from pathlib import Path
    from datetime import date

    try:
        from agents.cv_tailor import sanitize_folder_name

        folder_name = sanitize_folder_name(body.company, body.title)
        output_dir = Path("/Users/vasuchukka/Desktop/job") / folder_name
        output_dir.mkdir(parents=True, exist_ok=True)

        template_dir = Path("/Users/vasuchukka/Documents/Projects/Skills/coverLetter/template/base-CoverLetter")
        template_tex = (template_dir / "coverletter.tex").read_text(encoding="utf-8")

        def latex_escape(text: str) -> str:
            for src, dst in [("&", r"\&"), ("%", r"\%"), ("#", r"\#"), ("_", r"\_"),
                              ("~", r"\textasciitilde{}"), ("^", r"\textasciicircum{}")]:
                text = text.replace(src, dst)
            return text

        escaped_body = latex_escape(body.letter_text)
        paragraphs = [p.strip() for p in escaped_body.split("\n\n") if p.strip()]
        latex_body = "\n\n".join(paragraphs)

        company_name = latex_escape(body.company)
        role_title = latex_escape(body.title)

        template_tex = re.sub(
            r"\\recipient\s*\{[^}]*\}\s*\{[^}]*\}",
            f"\\\\recipient\n  {{{company_name}}}\n  {{Germany\\\\\\n}}",
            template_tex, flags=re.DOTALL,
        )
        template_tex = re.sub(
            r"\\lettertitle\{[^}]*\}",
            f"\\\\lettertitle{{Subject: Application for {role_title}}}",
            template_tex,
        )
        template_tex = re.sub(
            r"\\begin\{cvletter\}.*?\\end\{cvletter\}",
            f"\\\\begin{{cvletter}}\n{latex_body}\n\\\\end{{cvletter}}",
            template_tex, flags=re.DOTALL,
        )

        cl_path = output_dir / "coverletter.tex"
        cl_path.write_text(template_tex, encoding="utf-8")

        for asset in ["awesome-cv.cls", "fontawesome.sty"]:
            src = template_dir / asset
            dst = output_dir / asset
            if src.exists() and not dst.exists():
                shutil.copy2(src, dst)
        fonts_src = template_dir / "fonts"
        fonts_dst = output_dir / "fonts"
        if fonts_src.exists() and not fonts_dst.exists():
            shutil.copytree(fonts_src, fonts_dst)

        company_slug = re.sub(r"[^\w]", "_", body.company)[:30]
        today_str = date.today().isoformat()
        zip_name = f"CoverLetter_{company_slug}_{today_str}.zip"
        zip_path = output_dir.parent / zip_name
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in output_dir.rglob("*"):
                if f.is_file() and f.suffix in {".tex", ".cls", ".sty", ".otf", ".ttf"}:
                    zf.write(f, f.relative_to(output_dir.parent))

        return {
            "status": "ok",
            "folder": str(output_dir),
            "coverletter_tex": str(cl_path),
            "zip_path": str(zip_path),
            "zip_name": zip_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Dashboard Data Endpoints ──────────────────────────────────────────────────

# ── Profile Endpoints ─────────────────────────────────────────────────────────

class SkillsBody(BaseModel):
    skills: List[str]


@app.get("/profile")
def get_profile(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT skills FROM user_profile WHERE user_id = %s LIMIT 1", (uid,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return {"skills": []}
    return {"skills": row["skills"]}


@app.post("/profile/skills")
def update_skills(body: SkillsBody, current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO user_profile (user_id, skills, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (user_id) DO UPDATE SET skills = EXCLUDED.skills, updated_at = NOW()
        """,
        (uid, json.dumps(body.skills)),
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
def get_radar(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 1. Skills the user HAS — from matched_skills on high-score jobs (Agent 2 output)
    cur.execute("""
        SELECT DISTINCT lower(unnest(matched_skills)) AS skill
        FROM job_listings WHERE score >= 80 AND matched_skills IS NOT NULL AND user_id = %s
    """, (uid,))
    matched_set = {r["skill"] for r in cur.fetchall() if r["skill"]}

    # 2. Also pull user_profile skills as fallback
    cur.execute("SELECT skills FROM user_profile WHERE user_id = %s LIMIT 1", (uid,))
    row = cur.fetchone()
    profile_set = {s.lower() for s in (row["skills"] if row else [])}

    # Combined: user has a skill if it appears in matched OR profile
    has_skills = matched_set | profile_set

    # 3. Market skills — all skills from high-score jobs, count >= 3
    cur.execute("""
        SELECT skill, COUNT(*) AS frequency
        FROM (
            SELECT unnest(matched_skills) AS skill FROM job_listings WHERE score >= 80 AND user_id = %s
            UNION ALL
            SELECT unnest(missing_skills) AS skill FROM job_listings WHERE score >= 80 AND user_id = %s
        ) s
        WHERE skill IS NOT NULL AND trim(skill) != ''
        GROUP BY skill
        HAVING COUNT(*) >= 3
        ORDER BY frequency DESC
        LIMIT 15
    """, (uid, uid))
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
def get_skills_daily(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT skill, COUNT(*) AS count
        FROM (
            SELECT unnest(matched_skills) AS skill FROM job_listings WHERE score >= 80 AND user_id = %s
            UNION ALL
            SELECT unnest(missing_skills) AS skill FROM job_listings WHERE score >= 80 AND user_id = %s
        ) s
        WHERE skill IS NOT NULL AND trim(skill) != ''
        GROUP BY skill
        ORDER BY count DESC
    """, (uid, uid))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return {"skills": rows}


@app.get("/data/jobs")
def get_jobs(limit: int = 200, score_min: int = 0, current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT jl.id, jl.title, jl.company, jl.location, jl.remote, jl.url, jl.source,
               jl.score, jl.date_posted, jl.scraped_at, jl.matched_skills, jl.missing_skills, jl.description,
               COALESCE(a.status, 'new') AS status
        FROM job_listings jl
        LEFT JOIN applications a ON a.job_id = jl.id AND a.user_id = %s
        WHERE jl.user_id = %s AND (jl.score >= %s OR jl.score IS NULL)
        ORDER BY jl.scraped_at DESC
        LIMIT %s
    """, (uid, uid, score_min, limit))
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
        j["description"] = j.get("description") or ""
    return {"jobs": jobs}


@app.get("/data/gaps")
def get_gaps(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT skill, frequency, project_mapping, how_to_implement, online_course, example_project, last_updated
        FROM skill_gaps
        WHERE user_id = %s
        ORDER BY frequency DESC
        LIMIT 50
    """, (uid,))
    gaps = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for g in gaps:
        if g.get("last_updated"):
            g["last_updated"] = str(g["last_updated"])
    return {"gaps": gaps}


@app.get("/data/interview-prep")
def get_interview_prep(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT ip.id, ip.job_id, ip.questions, ip.culture_qa, ip.questions_to_ask, ip.generated_at,
               jl.title, jl.company, jl.score, jl.url, jl.location
        FROM interview_prep ip
        JOIN job_listings jl ON ip.job_id = jl.id
        WHERE ip.user_id = %s
        ORDER BY ip.generated_at DESC
        LIMIT 20
    """, (uid,))
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


VALID_STATUSES = {"new", "saved", "applied", "interview", "offer", "rejected"}

@app.post("/applications/{job_id}/status")
def update_application_status(job_id: int, body: StatusBody, current_user=Depends(get_current_user)):
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_STATUSES}")
    uid = current_user["sub"]
    try:
        from datetime import datetime
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO applications (job_id, user_id, status, applied_at, last_updated, notes)
            VALUES (%s, %s, %s, %s, NOW(), %s)
            ON CONFLICT (job_id, user_id) DO UPDATE SET
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
            (job_id, uid, body.status, datetime.now() if body.status == "applied" else None, body.notes),
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        result = {"application_id": row[0], "status": row[1]}

        if body.status.lower() == "interview":
            import threading
            def run_agent4_async(_uid=uid, _job_id=job_id):
                try:
                    rid = str(uuid.uuid4())
                    logger = RunLogger(run_id=rid, agent_name="Agent 4 — Interview Coach", user_id=_uid)
                    logger.start()
                    from agents.interview_coach import run
                    prep = run(user_id=_uid)
                    logger.success(details={"prep_sets": len(prep)})
                    print(f"[API] Agent 4 triggered for job {_job_id} — {len(prep)} prep set(s) generated")
                except Exception as e:
                    print(f"[API] Agent 4 failed for job {_job_id}: {e}")
            threading.Thread(target=run_agent4_async, daemon=True).start()
            result["interview_prep"] = "generating"

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/data/pipeline")
def get_pipeline_data(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    try:
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
            WHERE a.user_id = %s
            GROUP BY a.status
            """,
            (uid,),
        )
        pipeline = {s: {"count": 0, "jobs": []} for s in VALID_STATUSES}
        for row in cur.fetchall():
            pipeline[row[0]] = {"count": row[1], "jobs": row[2]}
        cur.close()
        conn.close()
        return pipeline
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/data/stats")
def get_stats(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Total jobs + last run
    cur.execute("SELECT COUNT(*) AS total, MAX(scraped_at) AS last_run FROM job_listings WHERE user_id = %s", (uid,))
    row = cur.fetchone()
    total = row["total"]
    last_run = row["last_run"]

    # Today's new jobs
    cur.execute("""
        SELECT COUNT(*) AS today FROM job_listings
        WHERE scraped_at >= CURRENT_DATE AND user_id = %s
    """, (uid,))
    today = cur.fetchone()["today"]

    # Applied + Interviews (from applications + manual_applications)
    cur.execute("""
        SELECT status, COUNT(*) AS count FROM (
            SELECT status FROM applications WHERE status IN ('applied', 'interview', 'offer', 'rejected') AND user_id = %s
            UNION ALL
            SELECT status FROM manual_applications WHERE status IN ('applied', 'interview', 'offer', 'rejected') AND user_id = %s
        ) combined
        GROUP BY status
    """, (uid, uid))
    status_counts = {r["status"]: r["count"] for r in cur.fetchall()}

    # Daily trend — all time
    cur.execute("""
        SELECT TO_CHAR(DATE(scraped_at), 'DD Mon') AS day, COUNT(*) AS jobs
        FROM job_listings WHERE user_id = %s
        GROUP BY DATE(scraped_at)
        ORDER BY DATE(scraped_at)
    """, (uid,))
    trend = [dict(r) for r in cur.fetchall()]

    # Pipeline funnel (scraped + manual combined)
    cur.execute("""
        SELECT
          (SELECT COUNT(*) FROM job_listings WHERE user_id = %s) AS found,
          SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) AS applied,
          SUM(CASE WHEN status = 'interview' THEN 1 ELSE 0 END) AS interview,
          SUM(CASE WHEN status = 'offer' THEN 1 ELSE 0 END) AS offer,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
        FROM (
            SELECT status FROM applications WHERE user_id = %s
            UNION ALL
            SELECT status FROM manual_applications WHERE user_id = %s
        ) combined
    """, (uid, uid, uid))
    funnel = cur.fetchone()

    cur.close()
    conn.close()

    pipeline = [
        {"stage": "Found",     "count": funnel["found"]},
        {"stage": "Applied",   "count": funnel["applied"]},
        {"stage": "Rejected",  "count": funnel["rejected"]},
        {"stage": "Interview", "count": funnel["interview"]},
        {"stage": "Offer",     "count": funnel["offer"]},
    ]

    return {
        "total": total,
        "today": today,
        "applied": sum(status_counts.get(s, 0) for s in ("applied", "interview", "offer", "rejected")),
        "interviews": status_counts.get("interview", 0),
        "trend": trend,
        "pipeline": pipeline,
        "last_run": last_run.isoformat() if last_run else None,
    }


@app.get("/data/scraper-stats")
def get_scraper_stats(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Total jobs per source
    cur.execute("""
        SELECT source, COUNT(*) AS total
        FROM job_listings WHERE user_id = %s
        GROUP BY source
    """, (uid,))
    totals = {r["source"]: r["total"] for r in cur.fetchall()}

    # Daily jobs per source — all time, last 30 distinct days
    cur.execute("""
        SELECT TO_CHAR(DATE(scraped_at), 'Mon DD') AS date,
               DATE(scraped_at) AS raw_date,
               source,
               COUNT(*) AS count
        FROM job_listings
        WHERE user_id = %s AND DATE(scraped_at) IN (
            SELECT DISTINCT DATE(scraped_at)
            FROM job_listings WHERE user_id = %s
            ORDER BY DATE(scraped_at) DESC
            LIMIT 30
        )
        GROUP BY DATE(scraped_at), source
        ORDER BY DATE(scraped_at)
    """, (uid, uid))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Build timeline: [{date, arbeitsagentur, linkedin, indeed}, ...]
    from collections import defaultdict
    day_map = defaultdict(lambda: {"arbeitsagentur": 0, "linkedin": 0, "indeed": 0})
    for r in rows:
        day_map[r["date"]][r["source"]] = r["count"]
    timeline = [{"date": d, **counts} for d, counts in sorted(day_map.items())]

    return {
        "totals": {
            "arbeitsagentur": totals.get("arbeitsagentur", 0),
            "linkedin": totals.get("linkedin", 0),
            "indeed": totals.get("indeed", 0),
        },
        "timeline": timeline,
    }


# ── Manual Applications ───────────────────────────────────────────────────────

class ManualAppBody(BaseModel):
    title: str
    company: str
    description: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    status: str = "applied"


class ManualStatusBody(BaseModel):
    status: str
    notes: Optional[str] = None


@app.post("/manual-applications")
def create_manual_application(body: ManualAppBody, current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        INSERT INTO manual_applications (title, company, description, url, status, notes, user_id, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING *
        """,
        (body.title, body.company, body.description, body.url, body.status, body.notes, uid),
    )
    row = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    row["created_at"] = str(row["created_at"]) if row["created_at"] else None
    row["updated_at"] = str(row["updated_at"]) if row["updated_at"] else None
    return {"status": "ok", "application": row}


@app.get("/manual-applications")
def list_manual_applications(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM manual_applications WHERE user_id = %s ORDER BY created_at DESC", (uid,))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for r in rows:
        r["created_at"] = str(r["created_at"]) if r["created_at"] else None
        r["updated_at"] = str(r["updated_at"]) if r["updated_at"] else None
    return {"applications": rows}


@app.patch("/manual-applications/{app_id}/status")
def update_manual_application_status(app_id: int, body: ManualStatusBody, current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        UPDATE manual_applications
        SET status = %s, notes = COALESCE(NULLIF(%s, ''), notes), updated_at = NOW()
        WHERE id = %s AND user_id = %s
        RETURNING *
        """,
        (body.status, body.notes or "", app_id, uid),
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    row = dict(row)
    row["created_at"] = str(row["created_at"]) if row["created_at"] else None
    row["updated_at"] = str(row["updated_at"]) if row["updated_at"] else None

    # Auto-trigger Agent 4 when moved to Interview
    if body.status.lower() == "interview":
        import threading
        def run_agent4_async(_uid=uid, _app_id=app_id):
            try:
                rid = str(uuid.uuid4())
                logger = RunLogger(run_id=rid, agent_name="Agent 4 — Interview Coach", user_id=_uid)
                logger.start()
                from agents.interview_coach import run
                prep = run(user_id=_uid)
                logger.success(details={"prep_sets": len(prep)})
                print(f"[API] Agent 4 triggered for manual app {_app_id} — {len(prep)} prep set(s)")
            except Exception as e:
                print(f"[API] Agent 4 failed for manual app {_app_id}: {e}")
        threading.Thread(target=run_agent4_async, daemon=True).start()
        row["interview_prep"] = "generating"

    return {"status": "ok", "application": row}


@app.delete("/manual-applications/{app_id}")
def delete_manual_application(app_id: int, current_user=Depends(get_current_user)):
    uid = current_user["sub"]
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM manual_applications WHERE id = %s AND user_id = %s", (app_id, uid))
    deleted = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    if not deleted:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"status": "ok"}


@app.get("/data/automation-logs")
def get_automation_logs(current_user=Depends(get_current_user)):
    uid = current_user["sub"]
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
        WHERE user_id = %s
        GROUP BY run_id
        ORDER BY MIN(started_at) DESC
        LIMIT 50
    """, (uid,))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for r in rows:
        r["run_started_at"] = str(r["run_started_at"]) if r["run_started_at"] else None
        r["run_completed_at"] = str(r["run_completed_at"]) if r["run_completed_at"] else None
    return {"runs": rows}


# ── Langfuse traces proxy ──────────────────────────────────────────────────────
@app.get("/data/traces")
def get_traces(limit: int = 50, current_user=Depends(get_current_user)):
    """Proxy Langfuse traces filtered by current user."""
    import httpx
    uid = str(current_user["sub"])
    langfuse_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3010")
    secret_key    = os.environ.get("LANGFUSE_SECRET_KEY", "")
    public_key    = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    if not secret_key:
        return {"traces": [], "message": "Langfuse not configured"}
    try:
        resp = httpx.get(
            f"{langfuse_host}/api/public/traces",
            params={"limit": limit, "userId": uid},
            auth=(public_key, secret_key),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"traces": data.get("data", []), "meta": data.get("meta", {})}
    except Exception as e:
        return {"traces": [], "error": str(e)}


@app.get("/data/agentops")
def get_agentops_sessions(limit: int = 50, current_user=Depends(get_current_user)):
    """Read AgentOps sessions from our DB, enriched with live stats from AgentOps API."""
    import httpx
    from concurrent.futures import ThreadPoolExecutor, as_completed

    user_id = int(current_user["sub"])
    ao_api_key = os.environ.get("AGENTOPS_API_KEY", "")

    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute(
            """
            SELECT session_id, provider, model, speed, end_state, created_at
            FROM agentops_sessions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
    except Exception as e:
        return {"sessions": [], "error": str(e)}

    sessions = [
        {
            "session_id": r[0],
            "provider": r[1],
            "model": r[2],
            "speed": r[3],
            "end_state": r[4],
            "created_at": r[5].isoformat() if r[5] else None,
            "detail_url": f"https://app.agentops.ai/sessions/{r[0]}" if r[0] else None,
        }
        for r in rows
    ]

    # Enrich with live stats from AgentOps (cost, tokens, duration, llm_calls)
    def _fetch_stats(session: dict) -> dict:
        sid = session.get("session_id")
        if not sid or not ao_api_key:
            return session
        try:
            resp = httpx.get(
                f"https://api.agentops.ai/v2/sessions/{sid}/stats",
                headers={"X-Agentops-Api-Key": ao_api_key},
                timeout=5,
            )
            if resp.status_code == 200:
                stats = resp.json()
                session["cost"]       = stats.get("accumulated_cost")
                session["tokens"]     = stats.get("prompt_tokens", 0) + stats.get("completion_tokens", 0)
                session["llm_calls"]  = stats.get("llm_calls", stats.get("counts", {}).get("llms"))
                session["duration_ms"] = stats.get("duration")
        except Exception:
            pass
        return session

    if ao_api_key and sessions:
        with ThreadPoolExecutor(max_workers=min(10, len(sessions))) as pool:
            futures = {pool.submit(_fetch_stats, s): s for s in sessions}
            enriched = [f.result() for f in as_completed(futures)]
        enriched.sort(key=lambda s: s.get("created_at") or "", reverse=True)
        sessions = enriched

    return {"sessions": sessions, "meta": {"total": len(sessions)}}
