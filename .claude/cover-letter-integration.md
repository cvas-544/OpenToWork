# Cover Letter Agent — Integration Spec (Session 5)

## Overview
Extend the existing CV Tailor flow (Agent 7) with a production-grade cover letter generator
that uses a modular profile template, a self-review loop, and a human approval gate in the
dashboard before writing any files.

---

## What Exists Today
- `agents/cv_tailor.py` — Agent 7, has basic `generate_cover_letter()` (simple `\documentclass{letter}`, no style, no profile template)
- `server/api.py` — `POST /cv/tailor` accepts `include_cover_letter: bool`
- Dashboard — CV Tailor modal has "Include Cover Letter" toggle
- Output — `/Users/vasuchukka/Desktop/job/{Company}-{Title}/cover_letter.tex`
- Awesome-CV template — `~/Documents/Projects/Skills/coverLetter/template/base-CoverLetter/`

---

## What Needs to Be Built

### 1. `agents/cover_letter_agent.py` (Agent 8)
Replaces `generate_cover_letter()` in cv_tailor.py.

**Functions:**
```python
generate_cover_letter(job: dict) -> str
    # Modular profile-based generation
    # Selects 2-3 project cards based on JD focus
    # Adapts tone: startup / scaleup / enterprise / research_lab
    # Mirrors JD keywords naturally, targets 350-450 words

review_cover_letter(letter_text: str, job: dict) -> dict
    # Scores against 7 dimensions (each 1-10):
    #   impact_clarity, readability, structure,
    #   jargon_balance, closing_strength, voice_compliance, ats_coverage
    # Returns: {scores, overall, passes (bool, threshold >= 9.0), suggestions}

generate_with_review(job: dict, max_iterations: int = 2) -> dict
    # Loop: generate → review → revise until passes or max_iterations hit
    # Returns: {letter_text, scorecard, iterations, passes}
```

**Profile template (embedded in agent):**
Modular narrative beats + project bank from `~/.claude/skills/cover-letter/references/profile.md`:
- Narrative: pivot_story, cta
- Projects: finsense_ai, opentowork_project, talktovasu, edag_work, autoTinglish, beyondLabel, thesis_iav
- Skills blocks: agentic_ai, backend_infra, ml_research, vector_rag, embedded_legacy

**Card selection logic:**

| JD Focus | Top Cards |
|---|---|
| Multi-agent / agentic AI | finsense_ai + opentowork_project + edag_work |
| RAG / LLM pipelines | talktovasu + beyondLabel + edag_work |
| MLOps / fine-tuning / NLP | autoTinglish + edag_work + talktovasu |
| Backend / infra / DevOps | opentowork_project + edag_work + finsense_ai |
| Startup / full-stack AI | opentowork_project + talktovasu + finsense_ai |
| Research / academic | autoTinglish + beyondLabel + thesis_iav |

**Review rubric (7 dimensions):**
1. `impact_clarity` — business value/outcome explicit for each project?
2. `readability` — max 2-3 lines per paragraph, one idea per sentence?
3. `structure` — projects clearly separated with What→Why→Impact?
4. `jargon_balance` — technical terms balanced, readable by semi-technical reviewer?
5. `closing_strength` — positions as production-ready AI engineer?
6. `ats_coverage` — key JD keywords naturally mirrored?
7. `voice_compliance` — follows voice rules (no em dashes, no hedging, active voice, numbers)?

Pass threshold: all dimensions >= 8 AND overall average >= 9.0

**Model:** `claude-sonnet-4-6` (same as Agent 7)

---

### 2. New API Endpoints in `server/api.py`

```python
class CoverLetterPreviewRequest(BaseModel):
    job_id: int

class CoverLetterApproveRequest(BaseModel):
    job_id: int
    letter_text: str  # approved text from user

@app.post("/cv/cover-letter/preview")
def preview_cover_letter(body: CoverLetterPreviewRequest):
    # Fetch job from DB
    # Run cover_letter_agent.generate_with_review(job)
    # Return: {letter_text, scorecard, passes, iterations}

@app.post("/cv/cover-letter/approve")
def approve_cover_letter(body: CoverLetterApproveRequest):
    # Fetch job from DB
    # Inject approved letter_text into Awesome-CV template
    # Copy template assets (awesome-cv.cls, fontawesome.sty, fonts/)
    # Write coverletter.tex to /Desktop/job/{Company}-{Title}/
    # ZIP the output folder
    # Return: {status, folder, zip_path}
```

**Also modify `POST /cv/tailor`:**
- Add optional `cover_letter_text: Optional[str] = None` to `TailorRequest`
- If provided: use it instead of calling `generate_cover_letter()`
- If not provided and `include_cover_letter=True`: fall back to basic generation (backward compat)

---

### 3. Dashboard Modal Extension

**File:** `dashboard/src/components/` (existing CV Tailor modal component)

**Current flow:**
```
Toggle ON → [Generate CV + Cover Letter]
```

**New flow:**
```
Toggle ON → [Preview Cover Letter] button appears
    ↓
POST /cv/cover-letter/preview
    ↓
Modal expands to show:
  ┌─────────────────────────────────┐
  │ COVER LETTER PREVIEW            │
  │                                 │
  │ [letter text — scrollable]      │
  │                                 │
  │ REVIEW SCORECARD                │
  │ Impact Clarity    ██████████ 9  │
  │ Readability       █████████░ 8  │
  │ Structure         ██████████ 9  │
  │ ...                             │
  │ Overall: 9.1/10  ✅ PASSES      │
  │                                 │
  │ [Re-run]  [Approve & Generate]  │
  └─────────────────────────────────┘
```

**"Approve & Generate"** → calls `POST /cv/cover-letter/approve` with the displayed letter_text
then calls `POST /cv/tailor` with `cover_letter_text` = approved text

**"Re-run"** → calls `POST /cv/cover-letter/preview` again (triggers another generate + review cycle)

---

### 4. Awesome-CV Template Integration

**Template source:** `~/Documents/Projects/Skills/coverLetter/template/base-CoverLetter/`

**Fields to inject per application:**
```latex
\recipient{COMPANY_NAME}{ADDRESS}
\lettertitle{Subject: Application for ROLE_TITLE}
\letteropening{Dear Hiring Manager,}   % or specific name if known
% Body inside \begin{cvletter}...\end{cvletter}
```

**Assets to copy to output folder:**
- `awesome-cv.cls`
- `fontawesome.sty`
- `fonts/` directory

**LaTeX escaping:** `&` → `\&`, `%` → `\%`, `#` → `\#`, `_` → `\_`

**Compiler:** XeLaTeX (required for fontspec)

---

### 5. DB Migration (Optional — Session 5 scope decision)

```sql
-- migration 005_cover_letter_drafts.sql
CREATE TABLE cover_letter_drafts (
    id          SERIAL PRIMARY KEY,
    job_id      INTEGER REFERENCES job_listings(id) ON DELETE CASCADE,
    letter_text TEXT NOT NULL,
    scorecard   JSONB,
    overall_score FLOAT,
    passes      BOOLEAN DEFAULT FALSE,
    iterations  INTEGER DEFAULT 1,
    status      VARCHAR(20) DEFAULT 'draft',  -- draft | approved | rejected
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);
```

Allows: history per job, re-open approved letters, analytics on score trends.

---

## Full User Flow

```
Dashboard → Jobs Board → click job (score >= 60)
  → [Tailor CV] button
  → CV Tailor modal opens
  → Agent 7 preview: shows skills to add/remove
  → "Include Cover Letter" toggle ON
  → [Preview Letter] button
    → POST /cv/cover-letter/preview
    → Agent 8: generate → review → auto-revise (max 2 passes)
    → Returns letter + scorecard
  → Modal shows letter preview + scorecard
  → User reads, clicks [Approve & Generate ZIP]
    → POST /cv/cover-letter/approve
    → Writes coverletter.tex into Awesome-CV template
    → POST /cv/tailor (with cover_letter_text = approved)
    → Writes cv.tex + assets
    → ZIPs both → /Desktop/job/{Company}-{Title}/
    → Modal shows: "ZIP ready at /Desktop/job/..."
```

---

## Files to Create / Modify

| File | Action |
|---|---|
| `agents/cover_letter_agent.py` | CREATE — Agent 8 |
| `server/api.py` | MODIFY — add 2 endpoints, update TailorRequest |
| `dashboard/src/components/[CvTailorModal].jsx` | MODIFY — extend modal UI |
| `db/migrations/005_cover_letter_drafts.sql` | CREATE — optional |
| `agents/cv_tailor.py` | MINOR MODIFY — wire to Agent 8 when cover_letter_text provided |

---

## Agent Model Assignment
- `cover_letter_agent.py` — `claude-sonnet-4-6` (generation + review require quality)
- Fallback: `deepseek-r1:8b` (same as Agent 7)

---

## Session 5 GitHub Issue Structure (suggested)
```
#21 — feat: Agent 8 cover letter generator + review loop
#22 — feat: /cv/cover-letter/preview + /approve endpoints
#23 — feat: Dashboard CV Tailor modal cover letter preview + scorecard
#24 — feat: Awesome-CV template integration in output ZIP
#25 — feat: cover_letter_drafts DB migration (optional)
```

---

## Notes
- Voice rules reference: `~/.claude/skills/cover-letter/references/voice-rules.md`
- Profile template reference: `~/.claude/skills/cover-letter/references/profile.md`
- Both files should be read and embedded into `cover_letter_agent.py` at build time
  (not read at runtime — keep agent self-contained for EC2 portability)
- Agent 8 is local-only (same as Agent 7) — do not deploy to EC2

---

*Spec written: 2026-04-17 | Ready for Session 5*
