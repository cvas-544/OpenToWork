-- Track which jobs have been included in Agent 3 gap analysis
-- Agent 3 now only processes new unanalyzed jobs and increments existing counts
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS gap_analyzed BOOLEAN DEFAULT FALSE;
