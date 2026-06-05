-- Migration 010: Fix user_profile.user_id column type (was VARCHAR 'default', needs INTEGER FK)

-- Drop old constraints/indexes referencing the varchar user_id
ALTER TABLE user_profile DROP CONSTRAINT IF EXISTS user_profile_user_id_key;
DROP INDEX IF EXISTS idx_user_profile_user;

-- Replace varchar user_id with proper integer FK
ALTER TABLE user_profile DROP COLUMN user_id;
ALTER TABLE user_profile ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
UPDATE user_profile SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE user_profile ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX idx_user_profile_user ON user_profile(user_id);
