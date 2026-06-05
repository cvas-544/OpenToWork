-- Migration 009: Fix applications UNIQUE constraint for multi-tenancy
-- Old constraint was on job_id alone; now each user can have a separate application per job

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_job_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_job_user ON applications(job_id, user_id);
