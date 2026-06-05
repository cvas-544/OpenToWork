# OpenToWork — Project Rules & Context

## Project Vision
Privacy-first, self-hosted multi-agent job intelligence system.
No third-party SaaS. Everything on AWS EC2 + RDS.
Intelligence layer = provider-agnostic (Anthropic / OpenAI / NVIDIA NIM / Ollama). Orchestration = EC2 cron. Dashboard = React.

---

## Session Management
- Run /context every 30 minutes during active sessions
- Run /compact when context exceeds 50%
- Write STATUS.md after completing each agent or major feature
- Never rely on conversation memory — write all decisions to files
- Flag when a task is too large for one session and suggest a split

---

## Core Rules — Every Agent Must Follow
1. Claude API only — claude-haiku-4-5-20251001 (batch) · claude-sonnet-4-6 (reasoning)
2. Python 3.11+ only for agents
3. PostgreSQL via AWS RDS — DATABASE_URL env var only
4. Never hardcode credentials — always use .env
5. Never commit: .env · *.pem · *.key · *accessKeys* · data/cv.txt · *.csv
6. Never use `git add -A` — always `git add <specific-file>`
7. Run tests after every agent change
8. Keep CLAUDE.md updated after every session
9. Keep work-log.md updated after every completed task

---

## Tech Stack
- Orchestration: EC2 system cron (`/etc/cron.d/opentowork`) — replaced n8n entirely
  - Hourly Mon–Fri: `/run/pipeline/due` — fires only for users whose `schedule_times` matches Munich hour
  - Sunday 9am UTC: `/run/pipeline/weekly` (Agent 5+6)
  - Scripts: `scripts/run-pipeline.sh` + `scripts/run-weekly.sh` — JWT generated from JWT_SECRET
- Intelligence: Provider-agnostic via `llm_client.py`
  - `anthropic` — Claude Haiku (fast) + Sonnet (smart)
  - `openai` — GPT-4o-mini (fast) + GPT-4o (smart)
  - `nvidia` — DeepSeek-V4-Flash Non-Think (fast) + Think High (smart) via `https://integrate.api.nvidia.com/v1`
  - `ollama` — gemma2:9b universal fallback
- Database: PostgreSQL on AWS RDS (opentowork DB + langfuse DB)
- Dashboard: React + Vite + Tailwind + Recharts — deployed on Vercel
- Scraping: Arbeitsagentur REST API + Apify LinkedIn (`curious_coder/linkedin-jobs-scraper`) + Apify Indeed (`wannabe/indeed-scraper-de`)
- Observability: Langfuse v2 self-hosted on EC2 port 3010 (Docker, PostgreSQL on RDS `langfuse` DB) — IN PROGRESS

---

## Project Structure
```
OpenToWork/
├── .claude/
│   └── CLAUDE.md              ← This file
├── .claude-flow/
│   └── logs/
│       └── work-log.md        ← Session + agent action log
├── agents/
│   ├── job_scraper.py         ← Agent 1: scrape + dedup
│   ├── cv_matcher.py          ← Agent 2: Claude Haiku scoring
│   ├── gap_analyst.py         ← Agent 3: Claude Sonnet gap aggregation
│   ├── interview_coach.py     ← Agent 4: Claude Sonnet Q&A gen
│   ├── reporter.py            ← Agent 5: Gmail digest synthesis
│   └── app_tracker.py         ← Agent 6: pipeline tracking + reminders
├── db/
│   └── migrations/
│       └── 001_initial_schema.sql
├── n8n/
│   ├── docker-compose.yml
│   └── workflows/             ← Exported n8n JSON workflows
├── dashboard/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── index.css
│       ├── App.jsx            ← Main dashboard (all tabs)
│       └── components/
├── data/
│   └── cv.txt                 ← GITIGNORED — add your CV here
├── .env.example
└── .gitignore
```

---

## Agent Squad (6 Pipeline Agents)

| Agent | File | Model | Trigger |
|---|---|---|---|
| **1 — Job Scraper** | `agents/job_scraper.py` | — | Daily 8am n8n cron |
| **2 — CV Matcher** | `agents/cv_matcher.py` | claude-haiku-4-5-20251001 | After Agent 1 |
| **3 — Gap Analyst** | `agents/gap_analyst.py` | claude-sonnet-4-6 | After Agent 2 |
| **4 — Interview Coach** | `agents/interview_coach.py` | claude-sonnet-4-6 | Jobs score >= 80 only |
| **5 — Reporter** | `agents/reporter.py` | claude-sonnet-4-6 | After Agents 1-4 |
| **6 — App Tracker** | `agents/app_tracker.py` | — | Manual + weekly cron |

### Score Tiers
- **Green >= 80**: Strong match → triggers Agent 4 (Interview Coach)
- **Yellow 60-79**: Good match → included in email, skips Agent 4
- **Below 60**: Filtered out entirely

---

## Database Tables (PostgreSQL on AWS RDS)
| Table | Purpose |
|---|---|
| `job_listings` | Scraped + scored jobs |
| `skill_gaps` | Aggregated gap trends (weekly) |
| `interview_prep` | Generated Q&A sets |
| `report_log` | Daily report metadata |
| `applications` | Pipeline tracking |

---

## Dashboard Tabs & Design
Tabs: Overview · Jobs Board · Map View · Skill Gaps · Timeline · Interview Prep · Analytics

Design tokens: Primary `#E8621A` · Fonts: Bebas Neue (display) · Sora (body) · DM Mono (data)
Style: Apple liquid glass cards · light mode

---

## Build Sessions
| Session | Focus | Issues |
|---|---|---|
| **1 — Foundation** | n8n setup, DB schema, Agent 1+2, e2e test | #1–5 |
| **2 — Intelligence Layer** | Agents 3-6, n8n wiring | #6–10 |
| **3 — Dashboard Phase 1** | React scaffold, Overview, Jobs Board, Map View | #11–14 |
| **4 — Dashboard Phase 2 + Deploy** | Gaps, Timeline, Interview Prep, Analytics, deploy | #15–19 |

---

## Development Workflow

```
opentowork-pm (orchestrates)
  → coder (implements agent/feature)
  → tester (runs tests — MUST PASS before continuing)
      ↓ if FAIL → creates blocking GitHub issue → board → back to coder
  → reviewer (final gate before commit)
      ↓ if BLOCKED → creates blocking GitHub issue → board → back to coder
  → opentowork-github-pm (PR + board update)
```

### Blocking Issue Rules
- Every test failure or reviewer blocker → its own GitHub issue labelled `bug,blocking`
- Blocking issue added to project board **immediately** when created
- Blocking issue goes through full board flow — **never added straight to Done**
- Parent issue NEVER closed while any blocking issues remain open

---

## Token & Time Tracking
- Every agent (coder, tester, reviewer, opentowork-github-pm) reports tokens used + time taken
- PM aggregates into Task Summary in work-log.md at end of each completed issue
- PM identifies top token consumer per issue

---

## Commit & PR Rules
- Commit message: one line · under 10 words · `type: description — closes #N`
- PR body: one sentence max · no checklists · no Co-Authored-By
- Types: `fix` `feat` `refactor` `test` `chore` `infra`
- Always `git add <specific-file>` — NEVER `git add -A`

---

## GitHub Repository
- URL: https://github.com/cvas-544/OpenToWork
- Owner: cvas-544
- Project Board: OpenToWork — Build Roadmap (Project #3)
- Project URL: https://github.com/users/cvas-544/projects/3
- Project ID: PVT_kwHOAzmK_s4BRHr5
- Branch strategy: `main` → `feat/[issue-number]-[description]` or `fix/[issue-number]-[description]`

### GitHub Project Field IDs
```
Status field:   PVTSSF_lAHOAzmK_s4BRHr5zg_Cn-Q
  Todo=f75ad846 | In Progress=47fc9ee4 | Done=98236657

Priority field: PVTSSF_lAHOAzmK_s4BRHr5zg_CpYw
  High=9f0ffc15 | Medium=8d9ccd45 | Low=a6e66352

Session field:  PVTSSF_lAHOAzmK_s4BRHr5zg_CpY0
  Pre-requisite=d2be508c | Session 1=a44f1519
  Session 2=16b629d9 | Session 3=4d7dea53 | Session 4=f87c43b7
```

### Project Item IDs
```
#1  n8n Docker          → PVTI_lAHOAzmK_s4BRHr5zgm64Jo
#2  PostgreSQL schema   → PVTI_lAHOAzmK_s4BRHr5zgm64KE
#3  Agent 1 Scraper     → PVTI_lAHOAzmK_s4BRHr5zgm64KU
#4  Agent 2 CV Matcher  → PVTI_lAHOAzmK_s4BRHr5zgm64KY
#5  e2e test S1         → PVTI_lAHOAzmK_s4BRHr5zgm64Kg
#6  Agent 3 Gap         → PVTI_lAHOAzmK_s4BRHr5zgm64Kk
#7  Agent 4 Coach       → PVTI_lAHOAzmK_s4BRHr5zgm64LA
#8  Agent 5 Reporter    → PVTI_lAHOAzmK_s4BRHr5zgm64LE
#9  Agent 6 Tracker     → PVTI_lAHOAzmK_s4BRHr5zgm64LQ
#10 n8n wiring          → PVTI_lAHOAzmK_s4BRHr5zgm64LY
#11 React scaffold      → PVTI_lAHOAzmK_s4BRHr5zgm64Lo
#12 Overview tab        → PVTI_lAHOAzmK_s4BRHr5zgm64L4
#13 Jobs Board tab      → PVTI_lAHOAzmK_s4BRHr5zgm64L8
#14 Map View tab        → PVTI_lAHOAzmK_s4BRHr5zgm64MI
#15 Skill Gaps tab      → PVTI_lAHOAzmK_s4BRHr5zgm64MY
#16 Timeline tab        → PVTI_lAHOAzmK_s4BRHr5zgm64Mg
#17 Interview Prep tab  → PVTI_lAHOAzmK_s4BRHr5zgm64Mo
#18 Analytics tab       → PVTI_lAHOAzmK_s4BRHr5zgm64Ms
#19 Deploy              → PVTI_lAHOAzmK_s4BRHr5zgm64M4
#20 Security (DONE)     → PVTI_lAHOAzmK_s4BRHr5zgm64NE
```

---

## What NOT to Do
- Never hardcode API keys, DB credentials, or CV content
- Never commit .env, cv.txt, *.csv, *.pem, *.key
- Never use `git add -A`
- Never skip tests before commit
- Never add a blocking issue straight to Done — always full board flow

---

## Session Start Checklist
- [ ] Read this CLAUDE.md fully
- [ ] Check last 20 lines of `.claude-flow/logs/work-log.md`
- [ ] Check GitHub board for open/in-progress issues
- [ ] Confirm which session you're in (1, 2, 3, or 4)
- [ ] Confirm EC2 and RDS are running (Session 1+)
- [ ] Then start working

## Session End Checklist
- [ ] Update this CLAUDE.md — current state, completed issues, next issue
- [ ] Update memory file at `~/.claude/projects/-Users-vasuchukka/memory/opentowork.md`
- [ ] Log session summary in `.claude-flow/logs/work-log.md`
- [ ] Confirm GitHub board reflects actual state
- [ ] Note any new bugs or blockers found

---

## Current State

### Completed ✅
- Pre-requisite #20: AWS IAM key rotated
- #1: n8n Docker setup on EC2 — running on 16.170.177.86:5678
- #2: PostgreSQL schema — 6 tables on RDS
- #3: Agent 1 Job Scraper — FastAPI + n8n workflow live
- #22: Dashboard live data — api.py fixed, live jobs showing
- #4: Agent 2 CV Matcher — scoring pipeline live (Claude Haiku + Ollama fallback)
- #24: Profile tab — DB-backed skills (39 from CV), add/remove UI
- Jobs Board: filters, resizable panel, Apply button, Arbeitsagentur SSR descriptions
- Apify `curious_coder/linkedin-jobs-scraper` replacing SerpAPI
- n8n schedule triggers: 8am, noon, 8pm daily (Mon–Fri)
- Agent 3 Gap Analyst: /data/gaps, /data/radar, /data/skills-daily endpoints live
- Skill Gaps tab: All Skills pill grid + Skills Radar (live) + carousel (6 per page, 20 total)
- Radar chart fixed: uses matched_skills + user_profile fallback, top 18 skills, fillOpacity 0.45
- Map bubbles + score circles: Midnight Shadow / Orange color scheme
- **Agent 7 CV Tailor**: preview modal (add/remove skills) → Claude Sonnet → cv.tex + cover_letter.tex
- **Ollama fallback**: `agents/llm_client.py` — Claude primary, llama3 fallback (Agents 2-5), deepseek-r1:8b for Agent 7
- **Automation Logs tab**: `automation_logs` DB table + RunLogger + dashboard tab (replaces Recent Reports)
- **Agent 4 trigger**: fires on Interview status change only (not score threshold)
- **Agent 5 Reporter**: weekly Sunday digest (not daily), saves report to `reports/weekly/`
- **n8n pipeline updated**: Schedule → Agent1 → Agent2 → Agent3 | Sunday → Agent5 → Agent6
- **n8n timeouts fixed**: EXECUTIONS_TIMEOUT=1800, Agent2=30min, others=10min
- `scripts/ec2-restart-n8n.sh` — SSH pull + docker compose restart
- **Dashboard search bar**: above Jobs Board containers, 80% white opacity, filters by title
- **Dashboard connection banner**: shown when API unreachable (no mock fallback, empty states)
- **Automation Logs timezone**: Europe/Berlin display (was UTC)
- **Automation Logs grouping**: 2-hour window client-side grouping → one row per pipeline run
- **launchd auto-start**: 3 plists in `scripts/launchd/` (tunnel + api + dashboard), `install-autostart.sh`
- **n8n workflow JSON**: fixed malformed Agent 4 node, added run_id query param, timeout per agent
- **run_logger.py**: fixed UTC datetime (timezone.utc)
- **Indeed scraper live**: `wannabe/indeed-scraper-de` (ID: 9qhb5j6V4P6hNBKWF) build 0.1.26 — Scrappey for search, AlterLab for detail page descriptions
- **Indeed keywords**: `["AI Engineer"×2, "Agentic AI"×2, "KI"×2, "AI"×4]` — 10 jobs/run total (was 20)
- **Scrapper dashboard tab**: top 3 glass cards (Arbeitsagentur/LinkedIn/Indeed job counts) + bottom line chart (14-day timeline per scraper), `/data/scraper-stats` endpoint
- **Indeed dashboard fixes**: purple "Indeed" tag, correct apply button label, Unix timestamp → date conversion (backfilled 55 jobs)
- **EC2 container fix**: was running without volume mount — fixed via `docker compose up --force-recreate agents`
- **LinkedIn scraper**: unblocked — now on new public Apify account (`APIFY_TOKEN_PUBLIC`)
- **Apify token split**: `APIFY_TOKEN` (private account, Indeed actor) + `APIFY_TOKEN_PUBLIC` (public account, LinkedIn)
- **Agent 2 fix**: Claude was silently failing (no Anthropic credits) → credits topped up 2026-04-07; llm_client.py now surfaces exact Claude error reason in failure message
- **llm_client.py**: added `ANTHROPIC_API_KEY` presence check — raises immediately instead of falling back to Ollama
- **Manual Applications (My Applications tab)**: new `manual_applications` DB table (migration 004) + 4 API endpoints (CRUD + status patch) + `ManualTracker` dashboard component. Status → Interview auto-triggers Agent 4. Stats endpoint now counts both `applications` + `manual_applications` in Applied/Interviews/pipeline.
- **My Applications split-panel**: clicking any stat card (Applied/Interview/Rejected/Offer) opens a Jobs Board-style split view — left list filtered by status, right resizable detail panel with company avatar, description, notes, status-move buttons, delete. Breadcrumb bar lets you switch between statuses without returning to overview. All Applications flat list on overview for quick access.
- **Agent 8 Cover Letter Generator**: `agents/cover_letter_agent.py` — generate_cover_letter + review_cover_letter (7 dimensions, threshold 9.0) + generate_with_review (max 2 iterations). Profile + voice rules embedded as constants. Model: claude-sonnet-4-6 → llama3 fallback.
- **Cover Letter API endpoints** (local only): `POST /cv/cover-letter/preview` (job_id) · `POST /cv/cover-letter/approve` (job_id + letter_text → Awesome-CV ZIP) · `POST /cv/cover-letter/preview-manual` (title/company/description) · `POST /cv/cover-letter/approve-manual`
- **CV Tailor refactor**: `run_from_job(job_dict)` core extracted from `run(job_id)` — enables manual app tailoring without DB job_id. `TailorRequest` now accepts optional `cover_letter_text`.
- **Manual app endpoints**: `POST /cv/tailor/preview-manual` · `POST /cv/tailor-manual` (4 total manual variants)
- **Jobs Board CV Tailor modal extended**: "Include cover letter" toggle ON → "Preview Cover Letter" button → Agent 8 runs → scorecard bars (7 dims) + letter preview + Re-run / Approve & Generate ZIP flow.
- **My Applications "Cover Letter" button**: dark button in detail panel → opens cover-letter-only modal (no CV skills) → Agent 8 generate → scorecard → Re-run / Approve & Save ZIP. Button turns green "✓ Letter Ready" after ZIP saved.
- **Cover letter output**: `~/Desktop/job/{Company}-{Title}/coverletter.tex` + `~/Desktop/job/CoverLetter_{Company}_{Date}.zip` (Overleaf-ready, XeLaTeX)
- **LLM mode toggle (dashboard topbar)**: 3-way toggle Local/CC/Online — `GET/POST /settings/llm-mode` API endpoints, runtime-switchable via module-level `_llm_mode` global in `llm_client.py`
- **CC mode**: Claude Code CLI (OAuth subscription, Sonnet 4.6) via subprocess — `/cv-tailor` and `/cover-letter` skills at `~/.claude/skills/`. NVM path auto-resolved. `ANTHROPIC_API_KEY` stripped so CLI uses OAuth.
- **gemma2:9b universal fallback**: replaces per-agent llama3/deepseek — all agents now fall back to gemma2:9b via Ollama
- **Job status persistence**: Jobs Board status changes now saved to `applications` table via UPSERT. Migration 005 added UNIQUE constraint on `applications.job_id`. `/data/jobs` LEFT JOINs applications for persisted status on load.
- **Agent 3 incremental gap analysis**: Migration 006 adds `gap_analyzed BOOLEAN DEFAULT FALSE` to `job_listings`. Agent 3 only fetches `gap_analyzed=false` jobs, increments skill counts (not overwrite), marks jobs analyzed after. All pre-2026-04-21 jobs marked as analyzed (skip backfill).
- **AgentRunner dashboard component**: per-agent run buttons in Automation Logs tab (Agents 1–6)
- **Phase 6 — Multi-user + Provider-agnostic LLM** ✅ (2026-06-02):
  - Migration 011: `user_settings` table (cv_text, job_keywords, llm_provider, llm_api_key, llm_model_fast, llm_model_smart, apify_token, apify_token_public)
  - `llm_client.py` rewritten: `call_llm(prompt, max_tokens, user_id, speed)` routes to anthropic/openai/ollama per user DB row
  - All agents refactored: `run(user_id=1)`, all DB queries filter by user_id, all LLM calls use user_id
  - `api.py`: all `/run/agent*` pass `user_id` from JWT; `GET/PUT /settings/user`; `POST /run/pipeline/all` (parallel threads per user, admin-only)
  - Settings UI: Pipeline Settings section (CV, provider, API key, model overrides, keywords, Apify tokens)
  - n8n workflow: daily schedule now calls `/run/pipeline/all` (single node, returns immediately, agents run in background); auth Bearer token added to all n8n HTTP nodes
  - EC2: uvicorn upgraded to `--workers 4`; admin JWT token (no expiry) seeded in n8n workflow
  - Vercel deployed: https://opentowork-dashboard.vercel.app

- **Phase 7 — Per-user scheduling + NVIDIA NIM + Observability** ✅ (2026-06-05):
  - Migration 012: `pipeline_agents TEXT[]` — per-user agent toggles in Settings
  - Migration 013: `schedule_times INTEGER[]` — per-user Munich hour triggers (default {8,12,20})
  - Cron changed from `0 8,12,20 * * 1-5` → `0 * * * 1-5` (hourly), `/run/pipeline/due` checks Munich hour
  - NVIDIA NIM added as provider: `deepseek-ai/deepseek-v4-flash`, Non-Think (fast) + Think High (smart)
  - `cv_matcher.py`: ThreadPoolExecutor parallel scoring — PROVIDER_WORKERS: anthropic=20, openai=20, nvidia=1 (free-tier sequential), ollama=3
  - Schedule time picker in Settings UI: 24 hour buttons (Munich time), toggleable
  - Langfuse v2 self-hosted on EC2 port 3010 — Docker, uses `langfuse` DB on RDS
  - Langfuse `@observe` wired into `llm_client.py` — traces all `call_llm` calls; model stored at trace-level metadata (trace list API doesn't return observations)
  - `langfuse.anthropic` + `langfuse.openai` wrappers for auto token/cost capture
  - AgentOps integrated alongside Langfuse — `start_session`/`end_session` per `call_llm` call; sessions stored in `agentops_sessions` DB table (AgentOps 0.4.x removed public list API)
  - **Traces tab** in dashboard: toggle Langfuse / AgentOps; Langfuse table shows model/speed/latency/tokens/cost; AgentOps table reads from DB + enriches with live `/v2/sessions/<id>/stats` (parallel httpx); deep link to `app.agentops.ai` per session
  - **OpenAI Batch API for Agent 2**: when provider=openai, `_score_jobs_batch()` uploads JSONL → polls → parses (50% cheaper, no rate limits). Non-OpenAI providers still use ThreadPoolExecutor
  - `requirements.txt`: added `langfuse==2.60.10`, `agentops>=0.3.0`, `httpx>=0.27.0`
  - `.gitignore`: added `n8n/workflows/` (hardcoded JWT), `dashboard/.env.local`, `.mcp.json`, `data/`

### Indeed Scraper — Live ✅
- Actor: `wannabe/indeed-scraper-de` (ID: 9qhb5j6V4P6hNBKWF) at `scrapers/apify-indeed/`
- Current build: 0.1.26
- Search pages: Scrappey (`SCRAPPEY_API_KEY` in Apify actor env) — 4 credits/request, `proxyCountry: Germany`
- Detail pages: AlterLab (`ALTERLAB_API_KEY` in Apify actor env) — $0.00250/job
- Keywords: `["AI Engineer"×2, "Agentic AI"×2, "KI"×2, "AI"×4]` — 10 detail fetches/run (was 20)
- Cost per run: ~10 Scrappey credits (search) + 10 AlterLab requests (~$0.025)
- AlterLab key: `sk_live_4e4fnazj7dgm_...` (in Apify actor env as `ALTERLAB_API_KEY`)
- Scrappey key: updated 2026-04-05

### Scraper Budget (as of 2026-04-07)
| Service | Remaining | Per run | Runs left | Days left |
|---|---|---|---|---|
| Scrappey | 153 credits | 16 credits | **9 runs** | **~3 working days** |
| AlterLab | $0.98 (~392 jobs) | 20 requests ($0.05) | **19 runs** | ~6 working days |
| Apify public ($5 grant) | ~$5 | ~$0.02 | **250+ runs** | not bottleneck |
- **Bottleneck: Scrappey** — top up to extend Indeed scraping beyond 3 days
- Indeed actor fixed 2026-04-08: added Dockerfile + requirements.txt (was running blank Node.js template)
- Full pipeline verified working end-to-end 2026-04-08

### Agent Architecture (current)
| Agent | Trigger | Model | Notes |
|---|---|---|---|
| 1 — Job Scraper | EC2 cron hourly (Munich time) | — | Arbeitsagentur + LinkedIn (APIFY_TOKEN_PUBLIC from DB) + Indeed (APIFY_TOKEN from DB) |
| 2 — CV Matcher | After Agent 1 | user's provider fast model | **OpenAI Batch API** (if provider=openai) — JSONL upload → poll → parse. Others: ThreadPoolExecutor. PROVIDER_WORKERS: anthropic=20, openai=20, nvidia=1, ollama=3 |
| 3 — Gap Analyst | After Agent 2 | user's provider smart model | Single LLM call (aggregated gaps), no parallelism needed |
| 4 — Interview Coach | Status → Interview | user's provider smart model | On-demand only |
| 5 — Reporter | Sunday 9am UTC | user's provider smart model | Weekly digest → reports/weekly/ |
| 6 — App Tracker | Sunday 9am UTC (after 5) | — | Follow-up reminders |
| 7 — CV Tailor | Manual (local only) | Sonnet → gemma2:9b | LaTeX output, `run_from_job()` core, CC mode via /cv-tailor skill |
| 8 — Cover Letter | Manual (local only) | Sonnet → gemma2:9b | generate + self-review loop (max 2 passes, threshold 9.0), CC mode via /cover-letter skill |

### CV Tailor + Cover Letter — Local Only (not on EC2)
- `agents/cv_tailor.py` — Agent 7: `preview_changes` + `tailor_cv` + `run_from_job(job_dict)` + `run(job_id)`
- `agents/cover_letter_agent.py` — Agent 8: `generate_cover_letter` + `review_cover_letter` + `generate_with_review`
- Profile + voice rules embedded as constants in Agent 8 (not runtime file reads)
- `server/api.py` — 7 local endpoints: preview · tailor · tailored/{id} · cover-letter/preview · cover-letter/approve · preview-manual · tailor-manual · cover-letter/preview-manual · cover-letter/approve-manual
- Base CV: `/Users/vasuchukka/Desktop/job/base-CV/main.tex`
- Awesome-CV template: `~/Documents/Projects/Skills/coverLetter/template/base-CoverLetter/`
- Output: `~/Desktop/job/{Company}-{Title}/` (cv.tex + coverletter.tex + assets + ZIP)
- Dashboard: `.env.local` → `VITE_API_URL=http://localhost:8000`
- Run locally: `venv/bin/uvicorn server.api:app --reload --port 8000`
- Overleaf: compile with **XeLaTeX** (fontspec requires it)

### LLM Backend — Local Models
- Ollama running at `http://localhost:11434`
- Available: `llama3:latest` (4.4GB) · `deepseek-r1:8b` (4.7GB) · `mistral:latest` (3.9GB) · `llama2:latest` (3.6GB) · `gemma2:9b`
- **Universal fallback**: `gemma2:9b` for all agents (replaces per-agent llama3/deepseek overrides)
- LLM mode toggle live on dashboard (top right): **Local** (gemma2:9b direct) · **CC** (Claude Code CLI, OAuth) · **Online** (Claude API → gemma2:9b fallback)
- Anthropic API credits exhausted as of 2026-04-21 — agents falling back to gemma2:9b

### Local Dev
- Dashboard: http://localhost:3002
- API: http://localhost:8000
- Start: `bash scripts/start-local.sh`
- Stop: `bash scripts/stop-local.sh`
- EC2 restart: `bash scripts/ec2-restart-n8n.sh`

---

---

## Infrastructure

### AWS
- EC2: `ubuntu@51.20.75.205` (eu-north-1, new account `150105760014`)
- RDS: `finsense-db.c5scmqi2ado9.eu-north-1.rds.amazonaws.com` PostgreSQL 5432 db=opentowork
- EC2 SSH: `ssh -i /Users/vasuchukka/FinsenseKey.pem ubuntu@51.20.75.205`
- FastAPI systemd: `sudo systemctl restart opentowork-api`
- API live at: `http://51.20.75.205:8000`

### Vercel
- Dashboard: https://opentowork-dashboard.vercel.app
- Deploy: `cd dashboard && vercel deploy --prod`
- Proxy: `vercel.json` rewrites `/api/*` → `http://51.20.75.205:8000/*`

### Deployment Rules
| Change | Target |
|---|---|
| `server/api.py`, `server/auth.py` | scp → EC2 + systemctl restart |
| `db/migrations/*.sql` | psql → RDS |
| `dashboard/src/**` | vercel deploy --prod |
| `agents/*.py` | scp → EC2 |
| `website/**` | cd website && vercel deploy --prod --yes |

---

## Auth & Multi-tenancy (Session 5)

### JWT Auth
- `server/auth.py` — bcrypt + PyJWT (sub stored as str, decoded to int)
- `JWT_SECRET` in `.env` — `otw-jwt-secret-change-in-prod-2026`
- Middleware: `AuthMiddleware` in `api.py` — PUBLIC_PATHS = `{"/health", "/auth/login"}`
- Endpoints: `/auth/login` · `/auth/register` (admin) · `/auth/users` (admin) · `/auth/me` · `/auth/change-password`

### Multi-tenancy
- Migration 008: `user_id INTEGER NOT NULL` on all data tables, backfilled to user_id=1
- Migration 009: `(job_id, user_id)` unique index on applications (replaced single job_id)
- Migration 010: Fixed `user_profile.user_id` VARCHAR→INTEGER (was 'default', now FK to users)
- All API data endpoints filter by `current_user["sub"]`
- All agents hardcode `user_id=1` for EC2 background runs (to be replaced in Phase 6)

### Users
- Admin: `vasu.chukka97@gmail.com` / `OpenToWork2026!` (id=1)

### Settings UI (Phase 5 — done)
- Settings tab in dashboard: change password, sign out
- Admin section: list/create/delete users
- API: `GET/POST /auth/change-password`, `GET /auth/users`, `POST /auth/register`, `DELETE /auth/users/{id}`

---

## Phase 6 — Multi-user + Provider-agnostic LLM ✅ COMPLETE (2026-06-02)

All agents accept `user_id=1` default. Each user's settings loaded from `user_settings` at run time.
n8n calls `POST /run/pipeline/all` (admin token) → parallel background threads per user.
New users onboard via Settings tab: paste CV, pick LLM provider, enter API key, set keywords.

---

## Marketing Website (Session 8 — 2026-06-05)

Static marketing site for public-facing OpenToWork landing page.

### Files
```
website/
├── index.html          ← single-file site (all CSS + HTML + JS inline)
├── vercel.json         ← outputDirectory:".", framework:null (static)
├── design-system.md   ← FULL design token reference (read this first)
└── assets/
    ├── neue-haas-grotesk-display-pro/   ← self-hosted TTF fonts (7 weights)
    ├── globe.svg        → Job Scraper
    ├── target.svg       → CV Matcher
    ├── venn.svg         → Skill Gaps
    ├── star.svg         → Interview Coach
    ├── clock.svg        → Reporter / time saved
    ├── grid.svg         → App Tracker
    ├── plus.svg         → CV Tailor
    ├── phillips.svg     → Cover Letter
    ├── expand.svg       → Generic / hero
    ├── dots.svg         → Lost applications pain
    └── halflines.svg    → Background texture
```

### Live URL
https://opentowork-site.vercel.app

### Design System
Sourced from Figma: https://www.figma.com/design/edZchVLmFPKxtaPBV8zsAr/The-Brand-Design-System--Community-  
**Always read `website/design-system.md` before editing the website** — contains all color tokens, type scale, letter spacing, illustration node IDs, grain CSS, and deploy instructions.

### Key Design Tokens
- Dark bg: `#191919` (Charcoal) · Light bg: `#FFFAEE` (Vanilla) · Accent: `#FE5102` (Orange brand-500)
- Hero font: Neue Haas Grotesk Display Pro, weight 700, `letter-spacing: -4px` (extra tight desktop)
- Section titles: same font, `letter-spacing: -1px` (snug desktop)
- Body: Space Grotesk (Google Fonts fallback — no Text Pro TTF available)
- Cards: `border-radius: 20px`

### CSS Variable System
```css
:root             { --bg:#191919; --surface:#1E1E1E; --border:#383838; --text:#FFFAEE; --accent:#FE5102; --fill-0:#FFFAEE; --stroke-0:#FFFAEE; }
[data-theme=light]{ --bg:#FFFAEE; --surface:#FFFAF5; --border:#DDDEE2; --text:#191919; --fill-0:#191919; --stroke-0:#191919; }
```
`--fill-0` / `--stroke-0` cascade into inline SVG illustrations for theme-aware recoloring.

### Known Gotchas
- SVG illustrations must be **inlined** (not `<img>`) for CSS variable inheritance
- Strip `overflow="visible"` from Figma SVG exports — breaks container clip at 64×64
- Grain element uses `background-position` animation, NOT `transform` translate — translating a 200%×200% element shifts it out of viewport bounds and causes a visible dark layer artifact every ~8s
- `overflow-x: hidden` on `body` breaks `position: fixed` on `::before` — use a real `<div id="grain">` instead
- Fonts: `@font-face url()` pointing to TTF files in assets/ — Vercel serves them. No `local()` fallback needed since files are bundled.

---

## Last Updated
2026-06-05 — Session 9: Phase 7 observability complete. Langfuse @observe + anthropic/openai wrappers, AgentOps start/end session per call_llm, agentops_sessions DB table (workaround for missing list API), Traces tab in dashboard (Langfuse + AgentOps toggle), AgentOps stats enrichment via /v2/sessions/<id>/stats. Agent 2 switched to OpenAI Batch API (gpt-4o-mini). NVIDIA workers reduced to 1 (free-tier). .gitignore hardened (n8n/workflows, data/, .env.local, .mcp.json).
