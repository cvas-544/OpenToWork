-- Migration 016: add agent9 to pipeline_agents for existing users
UPDATE user_settings
SET pipeline_agents = array_append(pipeline_agents, 'agent9')
WHERE pipeline_agents IS NOT NULL
  AND NOT ('agent9' = ANY(pipeline_agents));

ALTER TABLE user_settings
    ALTER COLUMN pipeline_agents SET DEFAULT
        ARRAY['agent1','agent2','agent3','agent4','agent5','agent9'];
