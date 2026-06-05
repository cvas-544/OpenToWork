-- Migration 013: per-user pipeline schedule
-- Stores UTC hours when Agent 1 pipeline should trigger for each user

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS schedule_times INTEGER[]
DEFAULT ARRAY[8, 12, 20];
