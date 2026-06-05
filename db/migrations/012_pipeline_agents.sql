-- Migration 012: per-user pipeline agent selection
-- Allows each user to choose which agents run in their pipeline

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS pipeline_agents TEXT[]
DEFAULT ARRAY['agent1','agent2','agent3','agent4','agent5'];
