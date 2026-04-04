-- Migration 003: skill_gaps — global per-skill data (no weekly separation)
-- Drop weekly unique constraint, add per-skill uniqueness + richer guidance columns

-- 1. Drop old (skill, week_start) unique constraint
ALTER TABLE skill_gaps DROP CONSTRAINT IF EXISTS skill_gaps_skill_week_start_key;

-- 2. Make week_start nullable (keep column, stop enforcing it)
ALTER TABLE skill_gaps ALTER COLUMN week_start DROP NOT NULL;

-- 3. Add richer guidance columns
ALTER TABLE skill_gaps ADD COLUMN IF NOT EXISTS how_to_implement TEXT;
ALTER TABLE skill_gaps ADD COLUMN IF NOT EXISTS online_course TEXT;
ALTER TABLE skill_gaps ADD COLUMN IF NOT EXISTS example_project TEXT;
ALTER TABLE skill_gaps ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

-- 4. Deduplicate: keep one row per skill (highest frequency, lowest id as tiebreaker)
DELETE FROM skill_gaps
WHERE id NOT IN (
    SELECT DISTINCT ON (skill) id
    FROM skill_gaps
    ORDER BY skill, frequency DESC, id ASC
);

-- 5. Add unique constraint on skill only
ALTER TABLE skill_gaps ADD CONSTRAINT skill_gaps_skill_key UNIQUE (skill);
