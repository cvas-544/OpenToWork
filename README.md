# OpenToWork 🤖

Privacy-first, self-hosted multi-agent job intelligence system — built on AWS, powered by Claude.

No third-party SaaS. Everything runs on your own infrastructure.

---

## 🚀 What This System Does

OpenToWork runs a fully automated daily pipeline that:

- Scrapes job listings from Arbeitsagentur (German federal job board) and LinkedIn
- Scores each job against your CV using Claude Haiku
- Identifies skill gaps across all high-scoring roles
- Generates interview Q&A sets for your top matches
- Sends a daily digest email with ranked opportunities
- Tracks your application pipeline end-to-end

Built for engineers actively job hunting in Germany who want intelligence — not just listings.

---

## 🧠 Agent Squad

| Agent | Role | Model |
|---|---|---|
| **Agent 1 — Job Scraper** | Scrapes Arbeitsagentur + LinkedIn via Apify | — |
| **Agent 2 — CV Matcher** | Scores jobs against your CV (0–100) | Claude Haiku |
| **Agent 3 — Gap Analyst** | Aggregates missing skills across top matches | Claude Sonnet |
| **Agent 4 — Interview Coach** | Generates Q&A sets for jobs scoring ≥80 | Claude Sonnet |
| **Agent 5 — Reporter** | Synthesises daily digest email | Claude Sonnet |
| **Agent 6 — App Tracker** | Tracks pipeline stages + sends reminders | — |

### Score Tiers
- **≥80 — Green**: Strong match → triggers Interview Coach
- **60–79 — Yellow**: Good match → included in email digest
- **<60**: Filtered out entirely

---

## ✨ Features

- Fully automated daily pipeline (8am / noon / 8pm cron via n8n)
- Dual-source scraping: Arbeitsagentur REST API + Apify LinkedIn scraper
- CV-aware scoring using Claude Haiku batch processing
- Skill gap trend analysis across all recent jobs
- Auto-generated interview prep for top matches
- Daily email digest with ranked job intelligence
- React dashboard with Jobs Board, Map View, Skill Gaps, Timeline, Analytics
- Interactive Germany job map with city clustering (Leaflet + CartoDB)
- Full application pipeline tracker
- Self-hosted — no third-party SaaS, everything on AWS EC2 + RDS
- Privacy-first — your CV never leaves your own infrastructure

---

## ⚙️ Tech Stack

### Backend
- **Python 3.11+** — all agent logic
- **FastAPI** + Uvicorn — agent API server
- **Anthropic Claude API** — Haiku (scoring) · Sonnet (reasoning + generation)
- **psycopg2** — PostgreSQL driver
- **apify-client** — LinkedIn job scraping
- **python-dotenv** — environment management

### Orchestration
- **n8n** — workflow automation + scheduling (self-hosted on EC2)
- **Docker + Docker Compose** — two containers: n8n + Python agents

### Database
- **PostgreSQL** on AWS RDS
- 6 tables: `job_listings` · `skill_gaps` · `interview_prep` · `report_log` · `applications` · `user_profile`

### Dashboard
- **React 18** + Vite
- **Tailwind CSS**
- **Recharts** — charts and analytics
- **React Leaflet** + Leaflet.js — interactive job map
- **CartoDB Voyager** — map tiles (free, no API key)
- Custom design system: Bebas Neue · Sora · DM Mono

### Infrastructure
- **AWS EC2** — Docker host
- **AWS RDS** — managed PostgreSQL
- **Apify** — LinkedIn scraping actor

---

## 🏗️ Architecture

```
n8n cron (8am / noon / 8pm)
    ↓
Agent 1 — Job Scraper     → Arbeitsagentur + LinkedIn → PostgreSQL
    ↓
Agent 2 — CV Matcher      → Claude Haiku scoring → job_listings (scored)
    ↓              ↓
Agent 3             Agent 4
Gap Analyst         Interview Coach (≥80 only)
    ↓              ↓
Agent 5 — Reporter        → Daily digest email
    ↓
Agent 6 — App Tracker     → Pipeline tracking (manual / weekly)
```

---

## 📁 Project Structure

```
OpenToWork/
├── agents/
│   ├── job_scraper.py         # Agent 1: scrape + dedup
│   ├── cv_matcher.py          # Agent 2: Claude Haiku scoring
│   ├── gap_analyst.py         # Agent 3: skill gap aggregation
│   ├── interview_coach.py     # Agent 4: Q&A generation
│   ├── reporter.py            # Agent 5: email digest
│   └── app_tracker.py         # Agent 6: pipeline tracking
├── server/
│   └── api.py                 # FastAPI server (all endpoints)
├── db/
│   └── migrations/            # PostgreSQL schema migrations
├── n8n/
│   ├── docker-compose.yml
│   └── workflows/             # Exported n8n workflow JSONs
├── dashboard/
│   └── src/
│       ├── App.jsx            # Full React dashboard
│       └── api.js             # API client
├── data/
│   └── cv.txt                 # GITIGNORED — add your CV here
└── .env.example
```

---

## 🚀 Setup

### Prerequisites
- AWS account (EC2 + RDS)
- Anthropic API key
- Apify account + API token
- Gmail account (for digest emails via n8n)

### 1. Clone the repo

```bash
git clone https://github.com/cvas-544/OpenToWork.git
cd OpenToWork
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in: DATABASE_URL, ANTHROPIC_API_KEY, APIFY_TOKEN
```

### 3. Add your CV

```bash
# Add your CV as plain text
cp your-cv.txt data/cv.txt
```

### 4. Deploy to EC2

```bash
# On your EC2 instance
cd ~/n8n
docker compose up -d
```

### 5. Run the dashboard locally

```bash
cd dashboard
npm install
npm run dev
```

---

## 📊 Dashboard Tabs

| Tab | Description |
|---|---|
| **Overview** | Daily run stats, top matches, agent status, pipeline funnel |
| **Jobs Board** | Full job list with filters, score breakdown, apply links |
| **Map View** | Interactive Germany map — city bubbles showing job count |
| **Skill Gaps** | Top missing skills by frequency + market demand radar |
| **Projects Timeline** | Gantt chart of your GitHub projects |
| **Interview Prep** | Generated Q&A sets for top-scoring roles |
| **Analytics** | Score distribution, source breakdown, trend charts |

---

## 🔮 Roadmap

- Agent 3 Gap Analyst — skill trend aggregation
- Agent 4 Interview Coach — Q&A generation
- Agent 5 Reporter — email digest
- Agent 6 App Tracker — pipeline reminders
- n8n full pipeline wiring (Agents 3–6)
- Dashboard live data for Skill Gaps + Interview Prep tabs
- Public deploy option (Vercel + Railway)

---

## 📄 License

MIT

---

## 👨‍💼 Author

Built by Vasu Chukka

📬 chukka.vasu@outlook.com
💻 https://www.linkedin.com/in/vasu-chukka-1a3569116/
