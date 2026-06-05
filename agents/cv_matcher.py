"""
Agent 2 — CV Matcher

Provider routing:
  openai  → OpenAI Batch API (gpt-4o-mini) — async JSONL, 50% cheaper, no rate limits
  others  → real-time call_llm with ThreadPoolExecutor
"""

import io
import os
import json
import time
import psycopg2
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
from agents.llm_client import call_llm

load_dotenv()

CV_PATH            = Path(__file__).parent.parent / "data" / "cv.txt"
SCORE_THRESHOLD    = 60
BATCH_POLL_INTERVAL = 10   # seconds between status checks
BATCH_MAX_WAIT     = 600   # 10 min max wait for batch completion

PROVIDER_WORKERS = {
    "anthropic": 20,
    "openai":    20,   # fallback if batch fails
    "nvidia":    1,    # free-tier: sequential only
    "ollama":    3,
}


# ── Settings helpers ───────────────────────────────────────────────────────────
def _get_provider_settings(user_id: int) -> dict:
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute(
            "SELECT llm_provider, llm_api_key, llm_model_fast FROM user_settings WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        cur.close(); conn.close()
        if row:
            return {
                "provider":   (row[0] or "anthropic").lower(),
                "api_key":    row[1] or "",
                "model_fast": row[2],
            }
    except Exception:
        pass
    return {"provider": "anthropic", "api_key": "", "model_fast": None}


def _get_max_workers(user_id: int) -> int:
    settings = _get_provider_settings(user_id)
    return PROVIDER_WORKERS.get(settings["provider"], 5)


def load_cv_for_user(user_id: int) -> str:
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("SELECT cv_text FROM user_settings WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if row and row[0]:
            return row[0]
    except Exception:
        pass
    if CV_PATH.exists():
        return CV_PATH.read_text(encoding="utf-8")
    raise FileNotFoundError(f"No CV found for user {user_id}")


def load_profile_skills(user_id: int) -> list:
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("SELECT skills FROM user_profile WHERE user_id = %s LIMIT 1", (user_id,))
        row = cur.fetchone()
        cur.close(); conn.close()
        return row[0] if row else []
    except Exception:
        return []


# ── Prompt + parsing ───────────────────────────────────────────────────────────
def _build_prompt(job: dict, cv_text: str, profile_skills: list) -> str:
    skills_section = ""
    if profile_skills:
        skills_section = f"\n\nAdditional skills from user profile:\n{', '.join(profile_skills)}"
    return f"""You are a precise job-CV matching assistant. Score this job against the CV.

CV:
{cv_text}{skills_section}

Job:
Title: {job['title']}
Company: {job['company']}
Location: {job['location']}
Description: {job['description'][:2000]}

Return ONLY valid JSON with this exact structure:
{{
  "score": <integer 0-100>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "fit_reason": "<1-2 sentence explanation>",
  "red_flags": ["flag1"]
}}

Scoring guide:
- 80-100: Strong match, most requirements met
- 60-79: Good match, core skills present, minor gaps
- 40-59: Partial match, significant gaps
- 0-39: Poor fit"""


def _parse_score(text: str) -> dict:
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return {"score": 0, "matched_skills": [], "missing_skills": [], "fit_reason": "Parse error", "red_flags": []}


# ── Real-time scoring (non-OpenAI providers) ───────────────────────────────────
def score_job(job: dict, cv_text: str, profile_skills: list, user_id: int) -> dict:
    prompt = _build_prompt(job, cv_text, profile_skills)
    try:
        text = call_llm(prompt, max_tokens=512, user_id=user_id, speed="fast")
        return _parse_score(text)
    except Exception:
        return {"score": 0, "matched_skills": [], "missing_skills": [], "fit_reason": "Error", "red_flags": []}


# ── OpenAI Batch API ───────────────────────────────────────────────────────────
def _score_jobs_batch(
    jobs: list,
    cv_text: str,
    profile_skills: list,
    api_key: str,
    model: str = "gpt-4o-mini",
) -> dict:
    """
    Submit all jobs to OpenAI Batch API in one JSONL file.
    Polls until complete (up to BATCH_MAX_WAIT seconds).
    Returns {db_id: score_dict}.
    """
    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    # ── Build JSONL ──
    lines = []
    for job in jobs:
        lines.append(json.dumps({
            "custom_id": str(job["db_id"]),
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": {
                "model": model,
                "max_tokens": 512,
                "temperature": 0.1,
                "messages": [{"role": "user", "content": _build_prompt(job, cv_text, profile_skills)}],
            },
        }))

    jsonl_bytes = "\n".join(lines).encode()

    # ── Upload file ──
    batch_file = client.files.create(
        file=("batch.jsonl", io.BytesIO(jsonl_bytes), "application/jsonl"),
        purpose="batch",
    )
    print(f"[Agent 2] Batch file uploaded: {batch_file.id} ({len(jobs)} jobs)")

    # ── Submit batch ──
    batch = client.batches.create(
        input_file_id=batch_file.id,
        endpoint="/v1/chat/completions",
        completion_window="24h",
    )
    print(f"[Agent 2] Batch submitted: {batch.id} | model={model}")

    # ── Poll until complete ──
    start = time.time()
    while time.time() - start < BATCH_MAX_WAIT:
        batch = client.batches.retrieve(batch.id)
        done  = batch.request_counts.completed
        total = batch.request_counts.total
        print(f"[Agent 2] Batch {batch.status} — {done}/{total} ({int(time.time()-start)}s elapsed)")
        if batch.status == "completed":
            break
        if batch.status in ("failed", "expired", "cancelled"):
            raise RuntimeError(f"Batch {batch.id} ended with status '{batch.status}'")
        time.sleep(BATCH_POLL_INTERVAL)
    else:
        raise RuntimeError(
            f"Batch {batch.id} did not complete within {BATCH_MAX_WAIT}s — "
            f"check OpenAI dashboard and re-run Agent 2 once complete"
        )

    # ── Parse results ──
    output = client.files.content(batch.output_file_id)
    results = {}
    for line in output.text.strip().split("\n"):
        if not line.strip():
            continue
        item    = json.loads(line)
        db_id   = int(item["custom_id"])
        content = item["response"]["body"]["choices"][0]["message"]["content"]
        results[db_id] = _parse_score(content)

    print(f"[Agent 2] Batch complete — {len(results)}/{len(jobs)} results parsed")

    # Clean up uploaded input file (output file is read-only, managed by OpenAI)
    try:
        client.files.delete(batch_file.id)
    except Exception:
        pass

    return results


# ── DB save ────────────────────────────────────────────────────────────────────
def save_score(job_id: int, result: dict):
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE job_listings SET
            score = %s, matched_skills = %s, missing_skills = %s,
            fit_reason = %s, red_flags = %s, scored_at = %s
        WHERE id = %s
        """,
        (
            result.get("score", 0),
            result.get("matched_skills", []),
            result.get("missing_skills", []),
            result.get("fit_reason", ""),
            result.get("red_flags", []),
            datetime.now(),
            job_id,
        ),
    )
    conn.commit(); cur.close(); conn.close()


# ── Main entry point ───────────────────────────────────────────────────────────
def run(user_id: int = 1) -> list[dict]:
    # ── Load unscored jobs ──
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur  = conn.cursor()
    cur.execute(
        """
        SELECT id, title, company, location, description
        FROM job_listings
        WHERE score IS NULL
          AND scraped_at >= NOW() - INTERVAL '7 days'
          AND user_id = %s
        """,
        (user_id,),
    )
    rows = cur.fetchall()
    cur.close(); conn.close()

    if not rows:
        print(f"[Agent 2] No unscored jobs for user {user_id}")
        return []

    jobs = [
        {"db_id": r[0], "title": r[1], "company": r[2], "location": r[3] or "", "description": r[4] or ""}
        for r in rows
    ]

    cv_text        = load_cv_for_user(user_id)
    profile_skills = load_profile_skills(user_id)
    if profile_skills:
        print(f"[Agent 2] {len(profile_skills)} profile skills loaded")

    # ── Route by provider ──
    settings = _get_provider_settings(user_id)
    provider = settings["provider"]

    if provider == "openai":
        api_key = settings["api_key"]
        model   = settings["model_fast"] or "gpt-4o-mini"
        print(f"[Agent 2] OpenAI Batch API — {len(jobs)} jobs, model={model}")

        scores = _score_jobs_batch(jobs, cv_text, profile_skills, api_key, model)

        for job in jobs:
            result = scores.get(
                job["db_id"],
                {"score": 0, "matched_skills": [], "missing_skills": [], "fit_reason": "No batch result", "red_flags": []},
            )
            save_score(job["db_id"], result)
            job.update(result)

    else:
        max_workers = PROVIDER_WORKERS.get(provider, 5)
        print(f"[Agent 2] Scoring {len(jobs)} jobs for user {user_id} ({max_workers} workers, provider={provider})")

        def _score_and_save(job):
            result = score_job(job, cv_text, profile_skills, user_id)
            save_score(job["db_id"], result)
            job.update(result)
            return job

        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            jobs = list(pool.map(_score_and_save, jobs))

    # ── Report results ──
    scored = []
    for job in jobs:
        if job.get("score", 0) >= SCORE_THRESHOLD:
            scored.append(job)
            tier = "GREEN" if job["score"] >= 80 else "YELLOW"
            print(f"  [{tier}] {job['score']} — {job['title']} @ {job['company']}")

    print(f"[Agent 2] {len(scored)}/{len(jobs)} jobs >= {SCORE_THRESHOLD} for user {user_id}")
    return scored


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, default=str))
