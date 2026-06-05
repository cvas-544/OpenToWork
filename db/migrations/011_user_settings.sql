-- Migration 011: per-user settings — CV, job keywords, LLM provider + keys, Apify tokens

CREATE TABLE IF NOT EXISTS user_settings (
    user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- CV
    cv_text             TEXT,
    -- Job search
    job_keywords        TEXT[]  DEFAULT ARRAY['AI Engineer', 'ML Engineer', 'Agentic AI'],
    job_location        TEXT    DEFAULT 'Germany',
    -- LLM
    llm_provider        TEXT    DEFAULT 'anthropic',  -- anthropic | openai | ollama
    llm_api_key         TEXT,
    llm_model_fast      TEXT,   -- Agent 2 (scoring) — default per provider if NULL
    llm_model_smart     TEXT,   -- Agents 3,4,5 (reasoning) — default per provider if NULL
    -- Scraper
    apify_token         TEXT,   -- private account (Indeed actor)
    apify_token_public  TEXT,   -- public account (LinkedIn actor)
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Seed admin user (id=1) from existing .env values so pipeline keeps working
INSERT INTO user_settings (user_id, llm_provider)
VALUES (1, 'anthropic')
ON CONFLICT (user_id) DO NOTHING;
