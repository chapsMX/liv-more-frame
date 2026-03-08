import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** Payload sent by Garmin daily summary webhook */
type GarminDailySummary = {
  userId: string;
  userAccessToken: string;
  summaryId?: string;
  calendarDate: string;
  steps: number;
  distanceInMeters?: number;
  durationInSeconds?: number;
};

type WebhookBody = {
  dailies?: GarminDailySummary[];
};

export async function POST(req: NextRequest) {
  let body: WebhookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dailies = body.dailies;
  if (!Array.isArray(dailies)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Respond 200 immediately — Garmin has ~30s timeout and will retry if no 200
  processDailies(dailies).catch((err) => {
    console.error("[webhooks/garmin/daily] processDailies error:", err);
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function processDailies(dailies: GarminDailySummary[]) {
  if (dailies.length === 0) return;

  const today = new Date().toISOString().split("T")[0];

  for (const summary of dailies) {
    if (!summary.userAccessToken || summary.calendarDate == null) continue;

    // 1. Find connection by access_token (and ensure still connected)
    const connRows = await sql`
      SELECT
        pc.user_id,
        gc.id AS garmin_connection_id,
        gc.garmin_user_id
      FROM "2026_garmin_connections" gc
      INNER JOIN "2026_provider_connections" pc ON pc.id = gc.connection_id
      WHERE gc.access_token = ${summary.userAccessToken}
        AND pc.disconnected_at IS NULL
      LIMIT 1
    `;

    const row = connRows[0];
    if (!row) continue;

    const userId = row.user_id as number;
    const garminConnectionId = row.garmin_connection_id as number;
    const currentGarminUserId = row.garmin_user_id as string | null;

    // 2. First webhook: backfill real Garmin user id (we may have stored placeholder "livmore-user-{id}")
    const isPlaceholder =
      !currentGarminUserId || currentGarminUserId.startsWith("livmore-user-");
    if (summary.userId && isPlaceholder) {
      await sql`
        UPDATE "2026_garmin_connections"
        SET garmin_user_id = ${summary.userId}
        WHERE id = ${garminConnectionId}
      `;
    }

    // 3. Ignore today — day not finished yet
    if (summary.calendarDate === today) continue;

    const steps = Number(summary.steps);
    if (!Number.isFinite(steps) || steps < 0) continue;

    // 4. Upsert steps: keep the greater value if we get duplicate syncs for same day
    await sql`
      INSERT INTO "2026_daily_steps" (user_id, date, steps)
      VALUES (${userId}, ${summary.calendarDate}, ${steps})
      ON CONFLICT (user_id, date) DO UPDATE SET
        steps = GREATEST(EXCLUDED.steps, "2026_daily_steps".steps)
    `;
  }
}
