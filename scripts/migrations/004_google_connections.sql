-- Google Fit connections (OAuth 2.0 with refresh_token)
-- Run: psql $DATABASE_URL -f scripts/migrations/004_google_connections.sql

-- Allow 'google' (and oura) in provider if constraint exists
ALTER TABLE "2026_users" DROP CONSTRAINT IF EXISTS "2026_users_provider_check";
ALTER TABLE "2026_users" ADD CONSTRAINT "2026_users_provider_check"
  CHECK (provider IS NULL OR provider IN ('garmin', 'polar', 'oura', 'google'));

CREATE TABLE IF NOT EXISTS "2026_google_connections" (
  id                serial PRIMARY KEY,
  connection_id     int NOT NULL REFERENCES "2026_provider_connections" (id) ON DELETE CASCADE,
  google_user_id    text NOT NULL UNIQUE,
  access_token      text NOT NULL,
  refresh_token     text NOT NULL,
  token_expires_at  timestamptz NOT NULL,
  connected_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_2026_google_connections_google_user_id ON "2026_google_connections" (google_user_id);
