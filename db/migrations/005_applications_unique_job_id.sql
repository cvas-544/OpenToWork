-- Add unique constraint on applications.job_id to enable UPSERT in app_tracker.update_status
-- Remove duplicate rows first (keep the latest per job_id)
DELETE FROM applications a
USING applications b
WHERE a.job_id = b.job_id
  AND a.id < b.id;

ALTER TABLE applications
    ADD CONSTRAINT applications_job_id_unique UNIQUE (job_id);
