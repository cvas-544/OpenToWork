-- 002_user_profile.sql
-- User profile table with skills for Agent 2 matching

CREATE TABLE IF NOT EXISTS user_profile (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'default' UNIQUE,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pre-populate with skills extracted from CV
INSERT INTO user_profile (user_id, skills) VALUES (
  'default',
  '["Python", "TensorFlow", "Keras", "PyTorch", "Scikit-learn", "NumPy", "OpenCV",
    "Claude API", "Neural Networks", "Deep Learning", "Computer Vision",
    "LLM Integration", "Multi-agent Systems", "RAG",
    "C", "C++", "Embedded C", "CUDA",
    "AWS EC2", "AWS RDS", "PostgreSQL", "Docker", "n8n", "Git", "CI/CD", "Linux",
    "AUTOSAR", "MATLAB/Simulink", "CAN Bus", "MiL/SiL Testing", "ISO 26262", "ISO 21434", "ASPICE",
    "FastAPI", "React", "Vite", "Tailwind CSS", "Photoshop", "Adobe XD"]'::jsonb
) ON CONFLICT (user_id) DO NOTHING;
