# OpenToWork 🤖

Privacy-first, self-hosted multi-agent job intelligence system — built on AWS, provider-agnostic LLMs.

No third-party SaaS lock-in. Everything runs on your own infrastructure.

---

## 🚀 What This System Does

OpenToWork runs a fully automated job-hunting pipeline that:

- Scrapes job listings from Arbeitsagentur (German federal job board), LinkedIn, and Indeed
- Scores each job against your CV using your chosen LLM provider
- Identifies skill gaps across all high-scoring roles (incremental, per-run)
- Generates interview Q&A sets when you move an application to Interview
- Tailors your LaTeX CV and writes self-reviewed cover letters per job
- Sends a weekly digest email with ranked opportunities
- Analyzes the job market weekly (demand trends, skill combinations, career directions)
- Tracks your application pipeline end-to-end

Built for engineers actively job hunting in Germany who want intelligence — not just listings.

---

## 🧠 Agent Squad

| Agent | Role | Trigger | Model |
|---|---|---|---|
| **1 — Job Scraper** | Arbeitsagentur + LinkedIn + Indeed (Apify) | Hourly cron (per-user schedule) | — |
| **2 — CV Matcher** | Scores jobs against your CV (0–100) | After Agent 1 | fast model · OpenAI Batch API when provider=openai |
| **3 — Gap Analyst** | Incremental skill-gap aggregation | After Agent 2 | smart model |
| **4 — Interview Coach** | Q&A sets per job | Status → Interview | smart model |
| **5 — Reporter** | Weekly digest email | Sunday cron | smart model |
| **6 — App Tracker** | Pipeline stages + follow-up reminders | Sunday cron | — |
| **7 — CV Tailor** | Job-specific LaTeX CV (Awesome-CV) | Manual, local only | smart model |
| **8 — Cover Letter** | Generate + self-review loop (7 dimensions) | Manual, local only | smart model |
| **9 — Market Analyst** | 6-section market report (sliding window) | Sunday cron + manual | smart model |

### Score Tiers
- **≥80 — Green**: Strong match
- **60–79 — Yellow**: Good match → included in digest
- **<60**: Filtered out entirely

---

## ✨ Features

- Fully automated pipeline on EC2 system cron — per-user schedule times (Munich hours)
- **Provider-agnostic LLM layer** — Anthropic Claude, OpenAI, NVIDIA NIM (DeepSeek), or local Ollama; configured per user in Settings
- **Multi-user** — JWT auth, per-user CV, keywords, provider, API keys, agent toggles, schedules
- Triple-source scraping: Arbeitsagentur REST API + Apify LinkedIn + Apify Indeed
- OpenAI Batch API for CV scoring (50% cheaper, no rate limits) when provider=openai
- Incremental skill-gap trend analysis + market demand radar
- On-demand interview prep, CV tailoring, and self-reviewing cover letters (Overleaf-ready ZIPs)
- Weekly market analysis report (demand direction, skill combos, market gaps, tech shifts)
- **Observability via AgentOps** — every LLM call logged with provider, model, tokens, and cost; viewable in the dashboard Traces tab
- React dashboard: Jobs Board, Map View, Skill Gaps, My Applications, Interview Prep, Analytics, Scrapers, Automation Logs, Traces, Settings
- Interactive Germany job map with city clustering (Leaflet + CartoDB)
- Self-hosted — AWS EC2 + RDS; dashboard on Vercel
- Privacy-first — your CV lives in your own database

---

## ⚙️ Tech Stack

### Backend
- **Python 3.11+** — all agent logic
- **FastAPI** + Uvicorn (4 workers) — agent API server, JWT auth middleware
- **LLM providers** — Anthropic · OpenAI · NVIDIA NIM · Ollama, routed per user by `agents/llm_client.py`
- **AgentOps** — LLM call observability (sessions, tokens, cost stored in PostgreSQL)
- **psycopg2** — PostgreSQL driver
- **apify-client** — LinkedIn + Indeed scraping

### Orchestration
- **EC2 system cron** (`/etc/cron.d/opentowork`) — hourly Mon–Fri pipeline (fires per user schedule) + Sunday weekly run (Agents 5, 6, 9)

### Database
- **PostgreSQL** on AWS RDS — `job_listings` · `skill_gaps` · `interview_prep` · `report_log` · `applications` · `manual_applications` · `user_profile` · `user_settings` · `users` · `automation_logs` · `agentops_sessions` · `analysis_reports`

### Dashboard
- **React 18** + Vite + Tailwind CSS
- **Recharts** — charts and analytics
- **React Leaflet** + CartoDB Voyager — interactive job map
- Custom design system: Bebas Neue · Sora · DM Mono
- Deployed on **Vercel** (proxies `/api/*` to the EC2 API)

---

## 🏗️ Architecture

```
EC2 cron (hourly, Mon–Fri — per-user Munich schedule)
    ↓
Agent 1 — Job Scraper     → Arbeitsagentur + LinkedIn + Indeed → PostgreSQL
    ↓
Agent 2 — CV Matcher      → fast model scoring (parallel / OpenAI Batch)
    ↓
Agent 3 — Gap Analyst     → incremental skill-gap aggregation

EC2 cron (Sunday 9am UTC)
    ↓
Agent 5 — Reporter        → weekly digest email
Agent 6 — App Tracker     → follow-up reminders
Agent 9 — Market Analyst  → weekly market report

On demand (dashboard)
    Agent 4 — Interview Coach   (status → Interview)
    Agent 7 — CV Tailor         (local only)
    Agent 8 — Cover Letter      (local only)
```

---

## 📁 Project Structure

```
OpenToWork/
├── agents/
│   ├── job_scraper.py         # Agent 1: scrape + dedup
│   ├── cv_matcher.py          # Agent 2: CV scoring (batch / parallel)
│   ├── gap_analyst.py         # Agent 3: incremental gap aggregation
│   ├── interview_coach.py     # Agent 4: Q&A generation
│   ├── reporter.py            # Agent 5: weekly digest
│   ├── app_tracker.py         # Agent 6: pipeline tracking
│   ├── cv_tailor.py           # Agent 7: LaTeX CV tailoring (local)
│   ├── cover_letter_agent.py  # Agent 8: cover letter + self-review (local)
│   ├── market_analyst.py      # Agent 9: weekly market analysis
│   └── llm_client.py          # provider-agnostic LLM router + AgentOps
├── server/
│   ├── api.py                 # FastAPI server (all endpoints)
│   └── auth.py                # JWT auth (bcrypt + PyJWT)
├── db/
│   └── migrations/            # PostgreSQL schema migrations
├── scripts/                   # cron runners, local dev, EC2 helpers
├── dashboard/
│   └── src/
│       ├── App.jsx            # Full React dashboard
│       └── api.js             # API client
├── website/                   # static marketing site (Vercel)
├── data/
│   └── cv.txt                 # GITIGNORED — add your CV here
└── .env.example
```

---

## 🚀 Setup

### Prerequisites
- AWS account (EC2 + RDS)
- API key for at least one LLM provider (Anthropic / OpenAI / NVIDIA NIM) — or local Ollama
- Apify account + API token (LinkedIn / Indeed scraping)
- Gmail account (digest emails)

### 1. Clone the repo

```bash
git clone https://github.com/cvas-544/OpenToWork.git
cd OpenToWork
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, AGENTOPS_API_KEY, provider API keys
```

### 3. Run migrations

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_schema.sql   # then each migration in order
```

### 4. Start the API (EC2 or local)

```bash
venv/bin/uvicorn server.api:app --port 8000
```

### 5. Run the dashboard locally

```bash
cd dashboard
npm install
npm run dev
```

Then log in, open **Settings**, paste your CV, pick an LLM provider, and set your keywords + schedule.

---

## 📊 Dashboard Tabs

| Tab | Description |
|---|---|
| **Overview** | Run stats, top matches, agent status, pipeline funnel |
| **Jobs Board** | Full job list with filters, score breakdown, CV Tailor + cover letter, apply links |
| **Map View** | Interactive Germany map — city bubbles showing job count |
| **Skill Gaps** | Top missing skills by frequency + market demand radar |
| **My Applications** | Manual + scraped application tracking, status-driven interview prep |
| **Interview Prep** | Generated Q&A sets per application |
| **Analytics** | Score distribution, source breakdown, trend charts |
| **Scrapers** | Per-source job counts + 14-day scraping timeline |
| **Automation Logs** | Per-run agent logs, manual agent run buttons |
| **Traces** | AgentOps observability — per-call provider, model, tokens, cost |
| **Settings** | CV, LLM provider + keys, keywords, agent toggles, schedule, users (admin) |

---

## 📄 License

MIT

---

## 👨‍💼 Author

Built by Vasu Chukka

📬 chukka.vasu@outlook.com
💻 https://www.linkedin.com/in/vasu-chukka-1a3569116/
