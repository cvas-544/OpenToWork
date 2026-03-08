# JobHunt AI — CLAUDE.md
# Project context for Claude Code sessions

## Project
Self-hosted multi-agent job intelligence system for Vasu Chukka.
Munich, DE · March 2026 · v1.0

## Stack
- Orchestration: n8n on AWS EC2 (Docker)
- Intelligence: Claude API (Haiku for batch, Sonnet for reasoning)
- Database: PostgreSQL on AWS RDS
- Dashboard: React + Vite + Tailwind + Recharts
- Email: Gmail via n8n Gmail node
- Scraping: Arbeitsagentur REST API + SerpAPI

## Agent Responsibilities
| Agent | Model | Trigger | Purpose |
|-------|-------|---------|---------|
| 1 - Job Scraper | — | Daily 8am cron | Scrape Arbeitsagentur + SerpAPI, dedup |
| 2 - CV Matcher | claude-haiku-4-5-20251001 | After Agent 1 | Score jobs 0-100 vs CV |
| 3 - Gap Analyst | claude-sonnet-4-6 | After Agent 2 | Aggregate skill gaps, rank frequency |
| 4 - Interview Coach | claude-sonnet-4-6 | Jobs >= 80 score | 10 Qs, STAR frameworks |
| 5 - Reporter | claude-sonnet-4-6 | After Agents 1-4 | Compile + send Gmail digest |
| 6 - App Tracker | — | Manual + weekly cron | Pipeline tracking + reminders |

## Score Tiers
- Green >= 80: Strong match → triggers Interview Coach
- Yellow 60-79: Good match → included in email
- Below 60: filtered out

## DB Tables (PostgreSQL on RDS)
- job_listings — scraped + scored jobs
- skill_gaps — aggregated gap trends
- interview_prep — generated Q&A sets
- report_log — daily report metadata
- applications — pipeline tracking

## Dashboard Tabs
Overview · Jobs Board · Map View · Skill Gaps · Timeline · Interview Prep · Analytics

## Design Tokens
- Primary: #E8621A (orange)
- Fonts: Bebas Neue (display), Sora (body), DM Mono (data)
- Style: Apple liquid glass cards (backdrop-filter blur), light mode

## Projects Context (for Gap Analyst framing)
- FinsenseAI (AI finance dashboard)
- RAG Chatbot
- Chrome Extension
- This Job Hunt System

---

## SECURITY RULES — MANDATORY
- NEVER use `git add -A` — always `git add <specific-file>`
- NEVER commit: .env, *.csv, *accessKeys*, *.pem, *.key, /data/cv.txt
- ALL API keys via environment variables — never hardcode
- CV text: /data/cv.txt — gitignored
- PostgreSQL: DATABASE_URL env var only
- n8n credentials: stored in n8n's built-in credential store only
- The AWS IAM key AKIAQH6PJB4R6BSHNC43 must be rotated before use

## Environment Variables (see .env.example)
ANTHROPIC_API_KEY, DATABASE_URL, SERP_API_KEY, GMAIL_CLIENT_ID,
GMAIL_CLIENT_SECRET, N8N_WEBHOOK_URL

## Build Sessions
- Session 1: n8n setup, DB schema, Agent 1 + 2, end-to-end test
- Session 2: Agent 3 + 4 + 5 + 6 (intelligence layer)
- Session 3: Dashboard Phase 1 (Overview, Jobs Board, Map View)
- Session 4: Dashboard Phase 2 (Gaps, Timeline, Interview Prep, Analytics) + deploy
