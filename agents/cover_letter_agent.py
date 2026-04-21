"""
Agent 8 — Cover Letter Generator + Self-Review Loop
Model: claude-sonnet-4-6
Trigger: POST /cv/cover-letter/preview (when "Include cover letter" is ON in CV Tailor modal)
Output: letter_text + scorecard dict (7 dimensions, 1-10 each, overall avg, passes bool)

Profile + voice rules embedded as constants — agent is self-contained for portability.
"""

import re
import json
from agents.llm_client import call_llm, get_llm_mode, call_claude_code_skill

# ── Embedded profile (from ~/.claude/skills/cover-letter/references/profile.md) ──

PROFILE = """
PERSONAL DETAILS:
- Name: Vasu Chukka
- Email: chukka.vasu@outlook.com
- Phone: +49 176 75865166
- Location: Isarstraße 68, Regensburg, Germany
- Website: vasuchukka.com

NARRATIVE BEAT — pivot_story:
Software engineer turned AI builder. I spent 4+ years at EDAG Group working on Battery Management
Systems and embedded software in safety-critical environments. That work taught me to build systems
that actually have to work. Around 2023 I started applying those same engineering standards to AI
— not prototyping, but deploying. Multi-agent systems, RAG pipelines, LLM orchestration, production
infrastructure. The transition was deliberate: I saw where software engineering was heading and built
toward it.

NARRATIVE BEAT — cta:
I would welcome the opportunity to discuss how my work aligns with [COMPANY]'s direction. You can
also speak directly with my AI at vasuchukka.com. I look forward to hearing from you.

PROJECT CARDS:

finsense_ai — FinsenseAI: Multi-Agent Financial Decision System
I architected and deployed a production multi-agent AI system using a custom GAME
(Goal-Action-Memory-Environment) framework. Each financial agent has its own isolated tool registry,
memory store, and execution environment. The system includes an orchestration layer for
agent-to-agent communication, intent classification, and dynamic task routing. Memory is handled
via BM25 retrieval over historical decisions. The full system runs on AWS (EC2, RDS) with FastAPI
microservices, GitHub Actions CI/CD, 250+ automated tests, and bidirectional MCP integration.

opentowork_project — OpenToWork: Autonomous Multi-Agent Job Application System
A production 6-agent autonomous pipeline orchestrated via n8n, with each agent implemented as an
independent FastAPI microservice backed by PostgreSQL. The system handles CV-job matching, skill
gap analysis, automated interview preparation, and ATS-optimized CV and cover letter generation
using dynamic keyword injection. Deployed on AWS with Docker Compose, it processes 1000+ real job
postings end-to-end without human intervention and exposes a 15-endpoint API layer.

talktovasu — talkToVasu: RAG-Based Personal AI Assistant and Voice Agent
Built a production RAG pipeline using Mistral mistral-embed (1024-dim) embeddings and Supabase
PGVector for semantic document retrieval. Added a semantic response cache (cosine similarity >= 0.92)
that bypasses LLM calls on repeated queries. Implemented LLM-based intent classification and
communication style detection using LangGraph, dynamically adapting response style per user. Built a
real-time voice-enabled interface using a voice-cloned TTS model and Web Speech API for VAD/STT,
enabling low-latency speech-to-response interaction.

edag_work — AI Engineer at EDAG Group (4+ years, Sep 2021 - Feb 2026)
At EDAG I designed and deployed an AI-powered test generation system that converts structured
requirements into automated test cases (CMOCKA/Python/C++), reducing manual test effort by up to
80%. I built a RAG pipeline using FAISS/PGVector to reuse historical test data for automated
edge-case and boundary-condition generation. I implemented a multi-agent AI system with context
engineering and MCP tool integration within a FastAPI-based architecture. All work followed ASPICE
and ISO 26262 compliance standards.

autoTinglish — autoTinglishSub: Multilingual ASR and Subtitle Generation System
Fine-tuned a Whisper ASR model for Telugu-English code-switching using a custom dataset, reducing
Word Error Rate from 75% to 15.1% and publishing the model to HuggingFace Hub. Built an end-to-end
MLOps and deployment pipeline using MLflow for experiment tracking and model versioning. Deployed a
production inference service using FastAPI with Prometheus and Grafana monitoring, containerized via
Docker Compose. Improved inference performance using CTranslate2 int8 quantization for 4-5x faster
CPU transcription.

beyondLabel — beyondLabel: Multi-Agent Nutrition Analysis System (RAG + LLM)
Developed an LLM-powered analysis system using FastAPI, LangChain, and Mistral 7B, integrating
OpenFoodFacts (3M+ products). Designed a multi-agent RAG architecture with specialized agents for
ingredient analysis, nutrition scoring, regulatory classification, and response synthesis.
Implemented advanced RAG techniques including Chain-of-Thought reasoning, Corrective RAG (CRAG)
for low-confidence retrieval, and Multi-Hop retrieval over a regulatory knowledge base in ChromaDB.

thesis_iav — Master's Thesis: Lithium-Ion Battery State of Charge Modelling (Neural Networks)
At IAV GmbH, developed a data-driven approach for modeling a Lithium-ion battery using neural
networks. Built a complete data pipeline covering collection, preprocessing, training, and
validation. Compared model architectures against each other and against conventional electrochemical
models. Achieved grade 1.3 (GPA). Strong foundation for roles requiring ML research, time-series
modeling, or physics-informed ML.

SKILLS BLOCKS:
agentic_ai: multi-agent system architecture, MCP tool integration, LangChain, LangGraph, context
engineering, agent orchestration, tool-using agent design. Anthropic certifications in Model Context
Protocol (including Advanced Topics). Production agentic systems running autonomously at scale.

backend_infra: FastAPI, REST APIs, microservices, AWS (EC2, RDS), Docker, Docker Compose, CI/CD via
GitHub Actions, Prometheus, Grafana, n8n, Supabase. Observability designed in from day one.

ml_research: model fine-tuning (Whisper, Mistral), embeddings (Mistral mistral-embed, dense
retrieval), MLflow, DVC, PyTorch, TensorFlow. Published fine-tuned models to HuggingFace Hub.
Production inference pipelines with CTranslate2 quantization.

vector_rag: production RAG systems using FAISS, ChromaDB, PGVector, with semantic caching,
Corrective RAG (CRAG), Chain-of-Thought retrieval, Multi-Hop retrieval. Knows when vector search
helps and when BM25 outperforms embeddings.

embedded_legacy: C/C++, CAN bus, AUTOSAR, ASPICE, ISO 26262 functional safety, model-in-the-loop
and software-in-the-loop testing. 4+ years safety-critical systems at EDAG Group.

CERTIFICATIONS:
- Model Context Protocol: Advanced Topics, Anthropic, Dec 2025
- Introduction to Model Context Protocol, Anthropic, Aug 2025
- AWS Certified AI Practitioner, AWS, May 2025
- Advanced Prompt Engineering, Vanderbilt University, May 2025
- AI Agents and Agentic AI with Python, Vanderbilt University, Apr 2025
"""

# ── Embedded voice rules ──────────────────────────────────────────────────────

VOICE_RULES = """
HARD RULES (never break):
- No em dashes: use a comma, parentheses, or restructure instead
- No semicolons: use a period or conjunction instead
- No passive voice: "X was developed by me" -> "I developed X"
- No corporate filler: "passionate about", "leverage", "synergy", "utilize", "solutions",
  "innovative", "dynamic", "results-driven", "thought leader"
- No personal hedging: "I believe I could potentially", "I think I might be able to"
- No generic opening: never start with "I am writing to express my interest"
- No vague superlatives without numbers: always attach a specific metric
- No summary of the job posting back to them
- Never say "I am passionate about AI": show it through what was built
- No transitional crutches: "furthermore", "in conclusion", "in addition", "to summarize"

POSITIVE RULES:
- Builder-first framing: lead with what was built and what it does
- Specific numbers: "80% reduction", "WER from 75% to 15.1%", "1000+ jobs processed"
- Always name the actual tech stack (FastAPI, LangChain, PGVector, etc.)
- First-person, active voice throughout
- Vary sentence length: mix short punchy sentences with longer explanatory ones
- Always close with vasuchukka.com mention

TONE by company type:
startup (seed-Series B): short paragraphs, direct, speed-to-ship, contractions OK, fragments OK
scaleup (Series C+): pragmatic builder tone, outcome-focused, at-scale language
enterprise (large corp): structured paragraphs, compliance awareness, no contractions
research_lab (university/R&D): methodology-first, reference architectures and benchmarks

STRUCTURE (4 paragraphs, 350-450 words):
1. Opening: company-specific hook + role title + 1-line positioning
2. Background: condensed pivot story, 3-4 sentences
3. Projects: 2-3 selected cards adapted to JD keywords
4. Skills alignment + CTA with vasuchukka.com
"""

# ── Card selection map ────────────────────────────────────────────────────────

CARD_MAP = {
    "agentic": ["finsense_ai", "opentowork_project", "edag_work"],
    "rag": ["talktovasu", "beyondLabel", "edag_work"],
    "mlops": ["autoTinglish", "edag_work", "talktovasu"],
    "backend": ["opentowork_project", "edag_work", "finsense_ai"],
    "startup": ["opentowork_project", "talktovasu", "finsense_ai"],
    "research": ["autoTinglish", "beyondLabel", "thesis_iav"],
    "automotive": ["edag_work", "finsense_ai", "thesis_iav"],
}


def _detect_jd_focus(jd_text: str) -> str:
    """Heuristic focus detection from JD text."""
    jd_lower = jd_text.lower()
    if any(w in jd_lower for w in ["multi-agent", "agentic", "orchestration", "mcp", "agent framework"]):
        return "agentic"
    if any(w in jd_lower for w in ["rag", "retrieval", "vector", "embedding", "langchain"]):
        return "rag"
    if any(w in jd_lower for w in ["mlops", "fine-tun", "finetun", "nlp", "asr", "speech", "whisper"]):
        return "mlops"
    if any(w in jd_lower for w in ["fastapi", "microservice", "devops", "infrastructure", "api engineer"]):
        return "backend"
    if any(w in jd_lower for w in ["research", "r&d", "phd", "publication", "paper", "benchmark"]):
        return "research"
    if any(w in jd_lower for w in ["autosar", "embedded", "can bus", "functional safety", "automotive"]):
        return "automotive"
    if any(w in jd_lower for w in ["startup", "seed", "series a", "series b", "founding"]):
        return "startup"
    return "agentic"  # default: most relevant to AI Engineer roles


def _detect_company_type(jd_text: str) -> str:
    """Detect company type from JD language."""
    jd_lower = jd_text.lower()
    if any(w in jd_lower for w in ["series a", "series b", "seed", "early-stage", "we're building", "founding"]):
        return "startup"
    if any(w in jd_lower for w in ["series c", "series d", "scaling", "millions of", "growth stage"]):
        return "scaleup"
    if any(w in jd_lower for w in ["research engineer", "r&d", "university", "institute", "phd", "publication"]):
        return "research_lab"
    return "enterprise"


def generate_cover_letter(job: dict) -> str:
    """
    Generate a tailored cover letter using profile + voice rules.
    Returns plain text letter (not LaTeX) — LaTeX injection happens in api.py.
    """
    jd = job.get("description", "")[:3000]
    focus = _detect_jd_focus(jd)
    company_type = _detect_company_type(jd)
    cards = CARD_MAP.get(focus, CARD_MAP["agentic"])

    prompt = f"""You are writing a cover letter for Vasu Chukka applying to a job.

PROFILE (use this as your source of truth — do not invent facts):
{PROFILE}

VOICE RULES (follow strictly):
{VOICE_RULES}

JOB DETAILS:
- Role: {job.get("title", "AI Engineer")}
- Company: {job.get("company", "")}
- Matched skills: {", ".join(job.get("matched_skills", [])[:8])}
- Missing skills (mention only if you can frame them as learning direction): {", ".join(job.get("missing_skills", [])[:5])}

JOB DESCRIPTION (excerpt):
{jd}

DETECTED:
- JD Focus: {focus}
- Company type: {company_type}
- Selected project cards to use (pick 2-3 most relevant): {", ".join(cards)}

INSTRUCTIONS:
1. Write a 4-paragraph cover letter (350-450 words) in Vasu's voice
2. Para 1: company-specific hook — reference their product/mission, state the role, 1-line positioning
3. Para 2: condensed pivot_story (3-4 sentences max)
4. Para 3: 2-3 project cards from the selection above, adapted to mirror JD keywords naturally,
   each with at least one specific number
5. Para 4: skills alignment + CTA (fill [COMPANY] with actual company name) + vasuchukka.com
6. Apply {company_type} tone from voice rules
7. Do NOT use LaTeX — output plain text paragraphs only
8. Do NOT include any salutation, date, address, or closing signature — body paragraphs only

Output only the letter body (4 paragraphs), no headers, no labels, no explanation."""

    return call_llm(prompt, model="claude-sonnet-4-6", max_tokens=2000, agent_name="cover_letter_agent")


def review_cover_letter(letter_text: str, job: dict) -> dict:
    """
    Score the cover letter on 7 dimensions (1-10 each).
    Returns: {scores, overall, passes, suggestions}
    """
    jd = job.get("description", "")[:2000]

    prompt = f"""You are a senior recruiter and writing coach reviewing a cover letter.

Score this cover letter on exactly 7 dimensions, each from 1 to 10:

1. impact_clarity: Is business value / outcome explicit for each project mentioned? Are numbers present?
2. readability: Max 2-3 lines per paragraph, one idea per sentence, varied sentence length?
3. structure: Does it follow opening hook, pivot story, projects, skills+CTA? Clear paragraph separation?
4. jargon_balance: Technical terms balanced for a semi-technical reviewer, not overwhelming?
5. closing_strength: Does it close as a production-ready AI engineer? Is vasuchukka.com mentioned?
6. ats_coverage: Are key JD keywords naturally mirrored in the letter?
7. voice_compliance: No em dashes, no hedging, no "passionate about", active voice, numbers used?

JOB: {job.get("title", "")} at {job.get("company", "")}

JOB DESCRIPTION (excerpt):
{jd}

COVER LETTER:
{letter_text}

Return ONLY valid JSON:
{{
  "scores": {{
    "impact_clarity": <1-10>,
    "readability": <1-10>,
    "structure": <1-10>,
    "jargon_balance": <1-10>,
    "closing_strength": <1-10>,
    "ats_coverage": <1-10>,
    "voice_compliance": <1-10>
  }},
  "overall": <float, average of all 7>,
  "passes": <true if all >= 8 AND overall >= 9.0, else false>,
  "suggestions": ["<specific improvement 1>", "<specific improvement 2>"]
}}"""

    text = call_llm(prompt, model="claude-sonnet-4-6", max_tokens=800, agent_name="cover_letter_agent")
    start = text.find("{")
    end = text.rfind("}") + 1
    result = json.loads(text[start:end])

    # Recalculate overall and passes server-side for safety
    scores = result["scores"]
    overall = round(sum(scores.values()) / len(scores), 2)
    passes = all(v >= 8 for v in scores.values()) and overall >= 9.0
    result["overall"] = overall
    result["passes"] = passes
    return result


def revise_cover_letter(letter_text: str, scorecard: dict, job: dict) -> str:
    """Revise a letter based on scorecard suggestions."""
    jd = job.get("description", "")[:2000]
    suggestions = "\n".join(f"- {s}" for s in scorecard.get("suggestions", []))
    scores = scorecard.get("scores", {})
    weak = [dim for dim, score in scores.items() if score < 8]

    prompt = f"""You are revising a cover letter for Vasu Chukka based on reviewer feedback.

PROFILE (source of truth — do not invent facts):
{PROFILE}

VOICE RULES (follow strictly):
{VOICE_RULES}

JOB: {job.get("title", "")} at {job.get("company", "")}

JOB DESCRIPTION (excerpt):
{jd}

CURRENT LETTER:
{letter_text}

REVIEWER FEEDBACK:
Weak dimensions (score < 8): {", ".join(weak) if weak else "none"}
Suggestions:
{suggestions}

INSTRUCTIONS:
- Fix the weak dimensions and apply the suggestions
- Keep the same 4-paragraph structure (350-450 words)
- Do NOT change facts, numbers, or tech stack references
- Output only the revised letter body (4 paragraphs), no headers, no explanation"""

    return call_llm(prompt, model="claude-sonnet-4-6", max_tokens=2000, agent_name="cover_letter_agent")


def _parse_letter_from_skill_output(output: str) -> str:
    """Extract cover letter text from the /cover-letter skill's formatted output."""
    # Skill outputs sections separated by ════ lines
    # Find text between COVER LETTER header and next ════ block
    match = re.search(
        r"═+\s*COVER LETTER\s*═+\s*(.*?)\s*═+",
        output,
        re.DOTALL | re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    # Fallback: return full output if format not found
    return output.strip()


def _generate_with_review_cc(job: dict) -> dict:
    """CC mode: invoke /cover-letter skill via Claude Code CLI."""
    job_id = job.get("id")
    if job_id:
        args = f"job_id:{job_id}"
    else:
        # Manual app — pass title + company + description as text
        title = job.get("title", "")
        company = job.get("company", "")
        desc = job.get("description", "")[:800]
        args = f"{title} at {company}\n{desc}"

    print(f"[Agent 8] CC mode — invoking /cover-letter skill ({args[:60]}...)")
    output = call_claude_code_skill("cover-letter", args)
    letter_text = _parse_letter_from_skill_output(output)
    return {
        "letter_text": letter_text,
        "scorecard": None,  # skill handles quality internally
        "iterations": 1,
        "passes": True,
        "mode": "cc",
    }


def generate_with_review(job: dict, max_iterations: int = 2) -> dict:
    """
    Generate cover letter, review it, revise if needed.
    CC mode: delegates entirely to /cover-letter skill via Claude Code CLI.
    Returns: {letter_text, scorecard, iterations, passes}
    """
    if get_llm_mode() == "cc":
        return _generate_with_review_cc(job)

    print(f"[Agent 8] Generating cover letter for {job.get('title')} @ {job.get('company')}...")
    letter_text = generate_cover_letter(job)

    for i in range(1, max_iterations + 1):
        print(f"[Agent 8] Reviewing (iteration {i}/{max_iterations})...")
        scorecard = review_cover_letter(letter_text, job)
        print(f"[Agent 8] Score: {scorecard['overall']:.1f}/10 | Passes: {scorecard['passes']}")

        if scorecard["passes"] or i == max_iterations:
            return {
                "letter_text": letter_text,
                "scorecard": scorecard,
                "iterations": i,
                "passes": scorecard["passes"],
            }

        print(f"[Agent 8] Revising (iteration {i})...")
        letter_text = revise_cover_letter(letter_text, scorecard, job)

    # Fallback (should not reach here)
    return {"letter_text": letter_text, "scorecard": scorecard, "iterations": max_iterations, "passes": False}
