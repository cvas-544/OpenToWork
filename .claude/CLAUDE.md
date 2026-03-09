# OpenToWork — Project Rules & Context

## Project Vision
Privacy-first, self-hosted multi-agent job intelligence system.
No third-party SaaS. Everything on AWS EC2 + RDS.
Intelligence layer = Claude API. Orchestration = n8n. Dashboard = React.

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
- Orchestration: n8n on AWS EC2 (Docker)
- Intelligence: Claude API (anthropic SDK)
  - `claude-haiku-4-5-20251001` — Agent 2 (CV Matcher, batch scoring)
  - `claude-sonnet-4-6` — Agent 3, 4, 5 (reasoning, generation, synthesis)
- Database: PostgreSQL on AWS RDS
- Dashboard: React + Vite + Tailwind + Recharts
- Scraping: Arbeitsagentur REST API (free, X-API-Key: jobboerse-jobsuche) + SerpAPI
- Email: Gmail via n8n Gmail node

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
- Never use OpenAI or any other AI provider
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
- #2: PostgreSQL schema migration — 5 tables live on RDS
- #3: Agent 1 Job Scraper — FastAPI server + n8n workflow live, jobs saving to DB

### Session 1 — Next Up 🔜
- #4: Agent 2 — CV Matcher (Claude Haiku) ← NEXT
- #5: End-to-end pipeline test (Agents 1→2)

### Session 2 — Pending
- #6–10: Agents 3-6 + n8n wiring

### Session 3 — Pending
- #11–14: React dashboard Phase 1

### Session 4 — Pending
- #15–19: Dashboard Phase 2 + Deploy

---

## Last Updated
2026-03-09 — Session 1 in progress. #1+#2+#3 done. FastAPI agent server live (port 8000). n8n workflow for Agent 1 working. Next: #4 Agent 2 CV Matcher.
