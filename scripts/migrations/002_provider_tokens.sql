-- Provider OAuth tokens (Garmin, Polar). One provider per user; tokens stored in 2026_users.
-- Run after 001_initial.sql: psql $DATABASE_URL -f scripts/migrations/002_provider_tokens.sql

ALTER TABLE "2026_users"
  ADD COLUMN IF NOT EXISTS provider_access_token text,
  ADD COLUMN IF NOT EXISTS provider_refresh_token text,
  ADD COLUMN IF NOT EXISTS provider_token_expires_at timestamptz;

COMMENT ON COLUMN "2026_users".provider_access_token IS 'OAuth access token for the connected provider (garmin/polar)';
COMMENT ON COLUMN "2026_users".provider_refresh_token IS 'OAuth refresh token for the connected provider';
COMMENT ON COLUMN "2026_users".provider_token_expires_at IS 'When the access token expires; refresh before this';
