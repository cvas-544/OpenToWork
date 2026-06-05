-- Migration 008: Multi-tenancy — add user_id to all data tables
-- Backfills existing rows to admin user (id=1)

ALTER TABLE job_listings        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE applications        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE manual_applications ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE skill_gaps          ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE interview_prep      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE automation_logs     ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE report_log          ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_profile        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Backfill all existing rows to admin (id=1)
UPDATE job_listings        SET user_id = 1 WHERE user_id IS NULL;
UPDATE applications        SET user_id = 1 WHERE user_id IS NULL;
UPDATE manual_applications SET user_id = 1 WHERE user_id IS NULL;
UPDATE skill_gaps          SET user_id = 1 WHERE user_id IS NULL;
UPDATE interview_prep      SET user_id = 1 WHERE user_id IS NULL;
UPDATE automation_logs     SET user_id = 1 WHERE user_id IS NULL;
UPDATE report_log          SET user_id = 1 WHERE user_id IS NULL;
UPDATE user_profile        SET user_id = 1 WHERE user_id IS NULL;

-- Add NOT NULL after backfill
ALTER TABLE job_listings        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE applications        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE manual_applications ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE skill_gaps          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE interview_prep      ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE automation_logs     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE report_log          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_profile        ALTER COLUMN user_id SET NOT NULL;

-- Indexes for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_job_listings_user        ON job_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user        ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_applications_user ON manual_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_gaps_user          ON skill_gaps(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_prep_user      ON interview_prep(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_user     ON automation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_report_log_user          ON report_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_user        ON user_profile(user_id);
