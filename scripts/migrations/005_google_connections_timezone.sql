-- Add timezone to Google connections for user's local date bucketing
-- Run: psql $DATABASE_URL -f scripts/migrations/005_google_connections_timezone.sql

ALTER TABLE "2026_google_connections"
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';
