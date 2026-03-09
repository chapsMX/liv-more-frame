import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const ACTIVITIES_URL = "https://www.polaraccesslink.com/v3/users/activities";

type PolarActivitySummary = {
  steps?: number;
  start_time?: string; // "2025-08-13T08:15:30"
};

/**
 * Polar backfill: fetch the last N days of daily activity and upsert steps.
 * Unlike Garmin (async backfill via webhook), Polar returns data directly.
 */
export async function POST(req: NextRequest) {
  const { userId, daysBack = 5 } = await req.json();

  // 1. Get access token from DB
  const result = await sql`
    SELECT pc2.access_token
    FROM "2026_polar_connections" pc2
    JOIN "2026_provider_connections" pc ON pc.id = pc2.connection_id
    WHERE pc.user_id = ${userId}
      AND pc.disconnected_at IS NULL
    LIMIT 1
  `;

  if (!result[0]) {
    return NextResponse.json(
      { error: "No Polar connection found" },
      { status: 404 }
    );
  }

  const { access_token } = result[0];

  // 2. Calculate date range
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);

  const toStr = to.toISOString().split("T")[0];
  const fromStr = from.toISOString().split("T")[0];

  // 3. Fetch activities from Polar
  const url = `${ACTIVITIES_URL}/?from=${fromStr}&to=${toStr}`;

  let activities: PolarActivitySummary[];
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (res.status === 204) {
      return NextResponse.json({
        ok: true,
        message: "No activity data available from Polar",
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[polar/backfill] Polar API error:", res.status, errText);
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    activities = await res.json();
  } catch (e) {
    console.error("[polar/backfill] Fetch error:", e);
    return NextResponse.json(
      { error: "Failed to fetch from Polar" },
      { status: 502 }
    );
  }

  // 4. Upsert steps into DB
  const today = new Date().toISOString().split("T")[0];
  let upserted = 0;

  for (const activity of activities) {
    if (activity.steps == null || !activity.start_time) continue;

    const date = activity.start_time.split("T")[0];
    if (date === today) continue; // day not finished

    const steps = Number(activity.steps);
    if (!Number.isFinite(steps) || steps < 0) continue;

    await sql`
      INSERT INTO "2026_daily_steps" (user_id, date, steps)
      VALUES (${userId}, ${date}, ${steps})
      ON CONFLICT (user_id, date) DO UPDATE SET
        steps = GREATEST(EXCLUDED.steps, "2026_daily_steps".steps)
    `;
    upserted++;
  }

  return NextResponse.json({
    ok: true,
    message: `Backfill complete: ${upserted} days upserted from ${fromStr} to ${toStr}`,
  });
}
