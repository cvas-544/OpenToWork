-- Migration 018: store token usage and cost per AgentOps session
ALTER TABLE agentops_sessions
  ADD COLUMN IF NOT EXISTS prompt_tokens     INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS cost_usd          FLOAT;
