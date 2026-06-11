-- Migration 014: per-user weekday schedule (1=Mon … 5=Fri)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS schedule_days INTEGER[] DEFAULT '{1,2,3,4,5}';

-- Back-fill existing rows
UPDATE user_settings SET schedule_days = '{1,2,3,4,5}' WHERE schedule_days IS NULL;
