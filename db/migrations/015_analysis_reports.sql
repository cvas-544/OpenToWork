-- Migration 015: market analysis reports
CREATE TABLE IF NOT EXISTS analysis_reports (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generated_at        TIMESTAMPTZ DEFAULT NOW(),
    jobs_analyzed       INTEGER NOT NULL DEFAULT 0,
    market_direction    JSONB,
    skill_demand        JSONB,
    skill_combinations  JSONB,
    market_gap          JSONB,
    tech_shifts         JSONB,
    career_directions   JSONB
);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_user
    ON analysis_reports(user_id, generated_at DESC);
