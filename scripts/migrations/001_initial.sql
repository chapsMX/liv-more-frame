-- LivMore MVP: initial schema (tables prefixed 2026_)
-- Run this in Neon SQL Editor or: psql $DATABASE_URL -f scripts/migrations/001_initial.sql
-- Note: names starting with a digit require double quotes in PostgreSQL.

-- Users: Farcaster identity + provider + OG status (from Neynar: fid, username, eth_address)
CREATE TABLE IF NOT EXISTS "2026_users" (
  id          serial PRIMARY KEY,
  fid         bigint UNIQUE NOT NULL,
  username    text,
  eth_address text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  provider    text CHECK (provider IS NULL OR provider IN ('garmin', 'polar')),
  og          boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_2026_users_fid ON "2026_users" (fid);

-- Daily steps: one row per user per calendar day; attestation_hash set when user attests (EAS)
CREATE TABLE IF NOT EXISTS "2026_daily_steps" (
  id               serial PRIMARY KEY,
  user_id          int NOT NULL REFERENCES "2026_users" (id) ON DELETE CASCADE,
  date             date NOT NULL,
  steps            int NOT NULL,
  attestation_hash text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_2026_daily_steps_user_id ON "2026_daily_steps" (user_id);
CREATE INDEX IF NOT EXISTS idx_2026_daily_steps_date ON "2026_daily_steps" (date);
CREATE INDEX IF NOT EXISTS idx_2026_daily_steps_user_date ON "2026_daily_steps" (user_id, date);

COMMENT ON TABLE "2026_users" IS 'LivMore users; fid/username/eth_address from Neynar; og=true after OG NFT mint';
COMMENT ON COLUMN "2026_users".provider IS 'Connected device provider: garmin or polar; one per user';
COMMENT ON TABLE "2026_daily_steps" IS 'Steps per calendar day; steps count only after attestation (attestation_hash set)';
COMMENT ON COLUMN "2026_daily_steps".date IS 'Calendar day the steps belong to (e.g. 2025-02-24)';
