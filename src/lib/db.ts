import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = neon(databaseUrl);

/** Table names (quoted for PostgreSQL when they start with a digit) */
export const TABLES = {
  users: '"2026_users"',
  dailySteps: '"2026_daily_steps"',
} as const;

export type User = {
  id: number;
  fid: number;
  username: string | null;
  eth_address: string | null;
  created_at: Date;
  updated_at: Date;
  provider: "garmin" | "polar" | null;
  og: boolean;
};

export type DailyStep = {
  id: number;
  user_id: number;
  date: string;
  steps: number;
  attestation_hash: string | null;
  created_at: Date;
};
