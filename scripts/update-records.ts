/**
 * Computes and upserts all-time records (daily, weekly, monthly) into 2026_records.
 * Only attested days (attestation_hash IS NOT NULL) are counted.
 *
 * Usage:
 *   npm run update-records
 *
 * Loads .env.local automatically if DATABASE_URL is not set.
 *
 * Required: DATABASE_URL
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

// Load .env.local if DATABASE_URL not set (Next.js convention)
if (!process.env.DATABASE_URL) {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // ignore
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Run with: source .env.local && npx tsx scripts/update-records.ts");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  console.log("[update-records] Computing all-time records from 2026_daily_steps (attested only)...\n");

  // --- Daily: single day with most steps ---
  const dailyRows = await sql`
    SELECT ds.user_id, ds.date, ds.steps
    FROM "2026_daily_steps" ds
    WHERE ds.attestation_hash IS NOT NULL
    ORDER BY ds.steps DESC
    LIMIT 1
  `;

  if (dailyRows.length > 0) {
    const d = dailyRows[0] as { user_id: number; date: string; steps: number };
    await sql`
      INSERT INTO "2026_records" (user_id, record_type, steps, period_start, period_end, achieved_at)
      VALUES (${d.user_id}, 'daily', ${d.steps}, ${d.date}::date, ${d.date}::date, now())
      ON CONFLICT (record_type) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        steps = EXCLUDED.steps,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        achieved_at = now()
    `;
    console.log(`  daily:   user_id=${d.user_id} steps=${d.steps} date=${d.date}`);
  } else {
    console.log("  daily:   no attested data, skipping");
  }

  // --- Weekly: best week (Mon–Sun, ISO 8601) by summed steps ---
  const weeklyRows = await sql`
    WITH by_week AS (
      SELECT
        ds.user_id,
        (ds.date - ((EXTRACT(ISODOW FROM ds.date)::int - 1) * interval '1 day'))::date AS week_start,
        SUM(ds.steps)::int AS total_steps
      FROM "2026_daily_steps" ds
      WHERE ds.attestation_hash IS NOT NULL
      GROUP BY ds.user_id, (ds.date - ((EXTRACT(ISODOW FROM ds.date)::int - 1) * interval '1 day'))::date
    )
    SELECT user_id, week_start, (week_start + interval '6 days')::date AS week_end, total_steps
    FROM by_week
    ORDER BY total_steps DESC
    LIMIT 1
  `;

  if (weeklyRows.length > 0) {
    const w = weeklyRows[0] as { user_id: number; week_start: string; week_end: string; total_steps: number };
    await sql`
      INSERT INTO "2026_records" (user_id, record_type, steps, period_start, period_end, achieved_at)
      VALUES (${w.user_id}, 'weekly', ${w.total_steps}, ${w.week_start}::date, ${w.week_end}::date, now())
      ON CONFLICT (record_type) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        steps = EXCLUDED.steps,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        achieved_at = now()
    `;
    console.log(`  weekly:  user_id=${w.user_id} steps=${w.total_steps} ${w.week_start}–${w.week_end}`);
  } else {
    console.log("  weekly:  no attested data, skipping");
  }

  // --- Monthly: best month by summed steps ---
  const monthlyRows = await sql`
    SELECT
      ds.user_id,
      (date_trunc('month', ds.date)::date) AS month_start,
      ((date_trunc('month', ds.date) + interval '1 month' - interval '1 day')::date) AS month_end,
      SUM(ds.steps)::int AS total_steps
    FROM "2026_daily_steps" ds
    WHERE ds.attestation_hash IS NOT NULL
    GROUP BY ds.user_id, date_trunc('month', ds.date)
    ORDER BY total_steps DESC
    LIMIT 1
  `;

  if (monthlyRows.length > 0) {
    const m = monthlyRows[0] as { user_id: number; month_start: string; month_end: string; total_steps: number };
    await sql`
      INSERT INTO "2026_records" (user_id, record_type, steps, period_start, period_end, achieved_at)
      VALUES (${m.user_id}, 'monthly', ${m.total_steps}, ${m.month_start}::date, ${m.month_end}::date, now())
      ON CONFLICT (record_type) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        steps = EXCLUDED.steps,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        achieved_at = now()
    `;
    console.log(`  monthly: user_id=${m.user_id} steps=${m.total_steps} ${m.month_start}–${m.month_end}`);
  } else {
    console.log("  monthly: no attested data, skipping");
  }

  console.log("\n[update-records] Done.");
}

main().catch((e) => {
  console.error("[update-records] Error:", e);
  process.exit(1);
});
