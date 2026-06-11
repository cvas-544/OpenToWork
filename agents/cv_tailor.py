"""
Agent 7 — CV Tailor
Model: claude-sonnet-4-6 (reasoning — LaTeX generation needs quality)
Input: job_id from job_listings + base CV LaTeX + include_cover_letter flag
Output: tailored cv.tex (+ optional cover_letter.tex) saved to
        /Users/vasuchukka/Desktop/job/{Company}-{JobTitle}/
"""

import os
import re
import json
import shutil
import psycopg2
from pathlib import Path
from dotenv import load_dotenv
from agents.llm_client import call_llm, get_llm_mode, call_claude_code_skill

load_dotenv()

BASE_CV_DIR = Path("/Users/vasuchukka/Desktop/job/base-CV")
OUTPUT_BASE_DIR = Path("/Users/vasuchukka/Desktop/job")


def fetch_job(job_id: int) -> dict:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, title, company, description, missing_skills, matched_skills, fit_reason
        FROM job_listings
        WHERE id = %s
        """,
        (job_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise ValueError(f"Job ID {job_id} not found in database")
    return {
        "id": row[0],
        "title": row[1],
        "company": row[2],
        "description": row[3] or "",
        "missing_skills": row[4] or [],
        "matched_skills": row[5] or [],
        "fit_reason": row[6] or "",
    }


def sanitize_folder_name(company: str, title: str) -> str:
    """Create a clean folder name from company + job title."""
    raw = f"{company}-{title}"
    clean = re.sub(r"[^\w\s-]", "", raw)
    clean = re.sub(r"[\s]+", "-", clean.strip())
    return clean[:80]


def read_base_cv() -> str:
    cv_path = BASE_CV_DIR / "main.tex"
    if not cv_path.exists():
        raise FileNotFoundError(f"Base CV not found at {cv_path}")
    return cv_path.read_text(encoding="utf-8")


def preview_changes(job: dict, cv_tex: str) -> dict:
    """Return skills to add for this job + ALL skills currently in the CV for user review.
    CC mode: delegates to /cv-tailor skill via Claude Code CLI.
    """
    if get_llm_mode() == "cc":
        job_id = job.get("id")
        if job_id:
            args = f"job_id:{job_id} --preview"
        else:
            title = job.get("title", "")
            company = job.get("company", "")
            desc = job.get("description", "")[:800]
            args = f'--preview --title "{title}" --company "{company}" --description "{desc}"'
        output = call_claude_code_skill("cv-tailor", args)
        start = output.find("{")
        end = output.rfind("}") + 1
        return json.loads(output[start:end])

    missing = ", ".join(job["missing_skills"]) if job["missing_skills"] else "none"
    matched = ", ".join(job["matched_skills"][:15]) if job["matched_skills"] else "none"
    description_excerpt = job["description"][:2000]

    prompt = f"""You are an ATS resume consultant analyzing a CV for a specific job.

Analyze the CV LaTeX and return a JSON object with:
1. "skills_to_add": skills to inject into the CV's SKILLS section. Include:
   - All missing skills (not in CV but required by job)
   - Any matched skills that appear in the job description but are NOT already present in the CV text
2. "skills_to_remove": list EVERY skill name currently present in the CV's SKILLS section.
   Extract all skill names from all subsections (Programming Languages, Software Libraries, OS, IDEs, Tools, Hardware, Designing Tools, Others, Languages, Key Skills).
   List every single one — the user will decide which to keep or remove.

JOB TITLE: {job['title']}
COMPANY: {job['company']}

MISSING SKILLS (definitely add): {missing}
MATCHED SKILLS (add if not already in CV): {matched}

JOB DESCRIPTION:
{description_excerpt}

CV LaTeX (skills section):
{cv_tex}

Return ONLY valid JSON, no explanation:
{{"skills_to_add": ["skill1", "skill2"], "skills_to_remove": ["every", "skill", "in", "cv"]}}"""

    text = call_llm(prompt, max_tokens=2000, speed=\"smart\", trace_name=\"Agent 7 — CV Tailor\")
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


def tailor_cv(cv_tex: str, job: dict, skills_to_add: list, skills_to_remove: list) -> str:
    """Generate tailored LaTeX. CC mode: delegates to /cv-tailor skill."""
    if get_llm_mode() == "cc":
        job_id = job.get("id")
        add_str = ",".join(skills_to_add) if skills_to_add else ""
        remove_str = ",".join(skills_to_remove) if skills_to_remove else ""
        if job_id:
            args = f"job_id:{job_id} --add \"{add_str}\" --remove \"{remove_str}\""
        else:
            title = job.get("title", "")
            company = job.get("company", "")
            desc = job.get("description", "")[:600]
            args = f'--title "{title}" --company "{company}" --description "{desc}" --add "{add_str}" --remove "{remove_str}"'
        return call_claude_code_skill("cv-tailor", args)

    add_str = ", ".join(skills_to_add) if skills_to_add else "none"
    remove_str = ", ".join(skills_to_remove) if skills_to_remove else "none"
    description_excerpt = job["description"][:3000]

    prompt = f"""You are an expert ATS resume consultant and LaTeX developer.

TASK: Modify the LaTeX CV below to be tailored for this specific job. Follow these rules STRICTLY:

RULES:
1. ADD these skills to the SKILLS section — inject each into the appropriate skill subsection (Programming Languages, Software Libraries, Tools, etc.): {add_str}
2. REMOVE these skills from the SKILLS section entirely: {remove_str}
3. Add ATS keywords from the job description into EXISTING bullet points where they fit naturally — do not add new bullet points
4. Do NOT change any dates, job titles, company names, education details, or personal info
5. Do NOT add new sections or restructure the document
6. Keep all LaTeX commands and formatting exactly as-is
7. Return ONLY the complete modified LaTeX — no explanation, no markdown fences

JOB TITLE: {job['title']}
COMPANY: {job['company']}

JOB DESCRIPTION (excerpt):
{description_excerpt}

BASE CV LaTeX:
{cv_tex}"""

    return call_llm(prompt, max_tokens=16000, speed="smart", trace_name="Agent 7 — CV Tailor")


def generate_cover_letter(job: dict) -> str:
    matched = ", ".join(job["matched_skills"][:8]) if job["matched_skills"] else ""
    description_excerpt = job["description"][:2000]

    prompt = f"""You are writing a professional cover letter for Vasu Chukka applying to a job.

Write a LaTeX cover letter document using \\documentclass{{letter}} style. Keep it under 350 words.
Structure: opening paragraph (enthusiasm + role), middle paragraph (2-3 relevant experiences/skills), closing paragraph (call to action).

Personal details to include:
- Name: Vasu Chukka
- Email: vasuchukka6118@gmail.com
- Phone: +49 176 75865166
- Location: Chemnitz, Germany

JOB TITLE: {job['title']}
COMPANY: {job['company']}
KEY MATCHING SKILLS: {matched}

JOB DESCRIPTION (excerpt):
{description_excerpt}

Return ONLY the complete LaTeX document — no explanation, no markdown fences."""

    return call_llm(prompt, max_tokens=2000, speed=\"smart\", trace_name=\"Agent 7 — CV Tailor\")


def copy_assets(output_dir: Path):
    """Copy fonts and asset files needed to compile the CV."""
    assets = ["fonts", "067-phone.pdf", "070-envelop.pdf", "072-location.pdf",
              "458-linkedin.pdf", "25231.png", "xing.png", "photo.jpg",
              "photo2.jpg", "signature.png"]
    for asset in assets:
        src = BASE_CV_DIR / asset
        dst = output_dir / asset
        if src.exists() and not dst.exists():
            if src.is_dir():
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)


def run_from_job(job: dict, include_cover_letter: bool = True,
                 skills_to_add: list = None, skills_to_remove: list = None,
                 cover_letter_text: str = None) -> dict:
    """Core tailoring logic — works with any job dict (from DB or inline)."""
    print(f"[Agent 7] Job: {job['title']} @ {job['company']}")

    folder_name = sanitize_folder_name(job["company"], job["title"])
    output_dir = OUTPUT_BASE_DIR / folder_name
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"[Agent 7] Output folder: {output_dir}")

    print("[Agent 7] Reading base CV...")
    cv_tex = read_base_cv()

    add = skills_to_add if skills_to_add is not None else job.get("missing_skills", [])
    remove = skills_to_remove if skills_to_remove is not None else []
    print(f"[Agent 7] Skills to add: {add}")
    print(f"[Agent 7] Skills to remove: {remove}")

    print("[Agent 7] Tailoring CV with Claude Sonnet...")
    tailored_cv = tailor_cv(cv_tex, job, add, remove)
    cv_path = output_dir / "cv.tex"
    cv_path.write_text(tailored_cv, encoding="utf-8")
    print(f"[Agent 7] CV saved → {cv_path}")

    cover_letter_path = None
    if include_cover_letter:
        if cover_letter_text:
            print("[Agent 7] Using pre-approved cover letter text (Agent 8)...")
            cover_letter = cover_letter_text
        else:
            print("[Agent 7] Generating cover letter (basic fallback)...")
            cover_letter = generate_cover_letter(job)
        cover_letter_path = output_dir / "cover_letter.tex"
        cover_letter_path.write_text(cover_letter, encoding="utf-8")
        print(f"[Agent 7] Cover letter saved → {cover_letter_path}")

    print("[Agent 7] Copying CV assets (fonts, images)...")
    copy_assets(output_dir)

    print("[Agent 7] Done ✅")
    return {
        "status": "ok",
        "job_id": job.get("id"),
        "job_title": job["title"],
        "company": job["company"],
        "folder": str(output_dir),
        "cv_path": str(cv_path),
        "cover_letter_path": str(cover_letter_path) if cover_letter_path else None,
        "missing_skills_added": job.get("missing_skills", []),
    }


def run(job_id: int, include_cover_letter: bool = True,
        skills_to_add: list = None, skills_to_remove: list = None,
        cover_letter_text: str = None) -> dict:
    print(f"[Agent 7] Fetching job ID {job_id}...")
    job = fetch_job(job_id)
    return run_from_job(job, include_cover_letter, skills_to_add, skills_to_remove, cover_letter_text)


if __name__ == "__main__":
    import sys
    import json
    job_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    include_cl = "--no-cover-letter" not in sys.argv
    result = run(job_id, include_cl)
    print(json.dumps(result, indent=2))
