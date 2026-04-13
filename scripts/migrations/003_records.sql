-- All-time records (daily, weekly, monthly) for leaderboard
-- Run: psql $DATABASE_URL -f scripts/migrations/003_records.sql

CREATE TABLE IF NOT EXISTS "2026_records" (
  id            serial PRIMARY KEY,
  user_id       int NOT NULL REFERENCES "2026_users" (id) ON DELETE CASCADE,
  record_type   text NOT NULL CHECK (record_type IN ('daily', 'weekly', 'monthly')),
  steps         int NOT NULL,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  achieved_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_type)
);

CREATE INDEX IF NOT EXISTS idx_2026_records_record_type ON "2026_records" (record_type);
COMMENT ON TABLE "2026_records" IS 'All-time records: best daily, weekly, monthly steps (one row per type)';
