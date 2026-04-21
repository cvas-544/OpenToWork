-- Manual Applications — jobs tracked outside the scraper pipeline
CREATE TABLE IF NOT EXISTS manual_applications (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    company     TEXT NOT NULL,
    description TEXT,
    url         TEXT,
    status      TEXT NOT NULL DEFAULT 'applied',
                -- 'applied' | 'interview' | 'rejected' | 'offer'
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_applications_status ON manual_applications(status);
