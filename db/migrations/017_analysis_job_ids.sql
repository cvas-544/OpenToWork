-- Migration 017: store which job IDs were used in each analysis run
ALTER TABLE analysis_reports ADD COLUMN IF NOT EXISTS job_ids INTEGER[] DEFAULT '{}';
