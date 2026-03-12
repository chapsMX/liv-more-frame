import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { sql } from "@/lib/db";
import { withRetry } from "@/lib/db-retry";

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
    console.warn("[webhooks/garmin/daily] Invalid JSON or empty body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dailies = body.dailies;
  if (!Array.isArray(dailies)) {
    console.log(
      "[webhooks/garmin/daily] Received request but dailies is missing or not array. Keys:",
      body ? Object.keys(body) : "null",
      "dailies type:",
      typeof dailies
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (dailies.length === 0) {
    console.log("[webhooks/garmin/daily] Received dailies array is empty");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const garminUserIds = [...new Set(dailies.map((d) => d.userId).filter(Boolean))];
  const sampleToken = dailies[0]?.userAccessToken?.slice(0, 30) ?? "none";
  console.log(
    "[webhooks/garmin/daily] Received",
    dailies.length,
    "dailies. Garmin userId(s):",
    garminUserIds.join(", ") || "(none)",
    "| userAccessToken sample (first 30):",
    sampleToken + "..."
  );

  // waitUntil: mantiene la función viva hasta que processDailies termine
  waitUntil(
    processDailies(dailies).catch((err) => {
      console.error("[webhooks/garmin/daily] processDailies error:", err);
    })
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}

type ConnRow = {
  access_token: string;
  user_id: number;
  garmin_connection_id: number;
  garmin_user_id: string | null;
};

async function processDailies(dailies: GarminDailySummary[]) {
  if (dailies.length === 0) return;

  // 1. Batch lookup: get all connections for unique tokens in one query
  const tokens = [...new Set(dailies.map((d) => d.userAccessToken).filter(Boolean))];
  if (tokens.length === 0) {
    console.warn("[webhooks/garmin/daily] No userAccessToken in any summary");
    return;
  }

  let connRows: ConnRow[];
  try {
    connRows = (await withRetry(() =>
      sql`
        SELECT
          gc.access_token,
          pc.user_id,
          gc.id AS garmin_connection_id,
          gc.garmin_user_id
        FROM "2026_garmin_connections" gc
        INNER JOIN "2026_provider_connections" pc ON pc.id = gc.connection_id
        WHERE gc.access_token = ANY(${tokens})
          AND pc.disconnected_at IS NULL
      `
    )) as ConnRow[];
  } catch (err) {
    console.error("[webhooks/garmin/daily] Batch connection lookup failed, trying per-token:", err);
    // Fallback: per-token lookup (old behavior)
    connRows = [];
    for (const token of tokens) {
      const rows = (await withRetry(() =>
        sql`
          SELECT gc.access_token, pc.user_id, gc.id AS garmin_connection_id, gc.garmin_user_id
          FROM "2026_garmin_connections" gc
          INNER JOIN "2026_provider_connections" pc ON pc.id = gc.connection_id
          WHERE gc.access_token = ${token} AND pc.disconnected_at IS NULL
        `
      )) as ConnRow[];
      connRows.push(...rows);
    }
  }

  console.log(
    "[webhooks/garmin/daily] Found",
    connRows.length,
    "connection(s) for",
    tokens.length,
    "token(s). Tokens in DB:",
    connRows.map((r) => r.access_token.slice(0, 12) + "...").join(", ") || "none"
  );

  const connByToken = new Map<string, ConnRow>();
  for (const row of connRows) {
    connByToken.set(row.access_token, row);
  }

  // 2. Collect rows to upsert and connection updates for backfill
  const toUpsert: { userId: number; date: string; steps: number }[] = [];
  const backfillUpdates: { id: number; garminUserId: string }[] = [];

  for (const summary of dailies) {
    if (!summary.userAccessToken || summary.calendarDate == null) continue;

    let row = connByToken.get(summary.userAccessToken);
    if (!row && summary.userId) {
      // Fallback: lookup by garmin_user_id (Health API may use different token format)
      const byGarminUserId = (await withRetry(() =>
        sql`
          SELECT gc.access_token, pc.user_id, gc.id AS garmin_connection_id, gc.garmin_user_id
          FROM "2026_garmin_connections" gc
          INNER JOIN "2026_provider_connections" pc ON pc.id = gc.connection_id
          WHERE gc.garmin_user_id = ${summary.userId}
            AND pc.disconnected_at IS NULL
          LIMIT 1
        `
      )) as ConnRow[];
      row = byGarminUserId[0];
      if (row) {
        connByToken.set(summary.userAccessToken, row);
        console.log(
          "[webhooks/garmin/daily] Matched by garmin_user_id. userId:",
          summary.userId
        );
      }
    }
    if (!row) {
      console.warn(
        "[webhooks/garmin/daily] No connection found. userAccessToken (first 20):",
        summary.userAccessToken.slice(0, 20) + "...",
        "garmin userId:",
        summary.userId,
        "calendarDate:",
        summary.calendarDate,
        "steps:",
        summary.steps
      );
      continue;
    }

    const userId = row.user_id;
    const currentGarminUserId = row.garmin_user_id;

    // Backfill real Garmin user id (we may have stored placeholder)
    const isPlaceholder =
      !currentGarminUserId || currentGarminUserId.startsWith("livmore-user-");
    if (summary.userId && isPlaceholder) {
      backfillUpdates.push({ id: row.garmin_connection_id, garminUserId: summary.userId });
    }

    // Save today too — needed for "attest yesterday when today has activity" trigger
    const steps = Number(summary.steps);
    if (!Number.isFinite(steps) || steps < 0) continue;

    toUpsert.push({ userId, date: summary.calendarDate, steps });
  }

  if (toUpsert.length === 0) {
    console.log(
      "[webhooks/garmin/daily] No rows to upsert (all filtered or no connection). Dailies:",
      dailies.map((d) => ({ date: d.calendarDate, steps: d.steps }))
    );
    return;
  }

  // 3. Batch backfill garmin_user_id (rare, usually 0-1)
  for (const { id, garminUserId } of backfillUpdates) {
    await withRetry(() =>
      sql`
        UPDATE "2026_garmin_connections"
        SET garmin_user_id = ${garminUserId}
        WHERE id = ${id}
      `
    );
  }

  // 4. Upsert steps — try batch first, fallback to individual
  try {
    const userIds = toUpsert.map((r) => r.userId);
    const dates = toUpsert.map((r) => r.date);
    const stepsArr = toUpsert.map((r) => r.steps);

    await withRetry(() =>
      sql`
        INSERT INTO "2026_daily_steps" (user_id, date, steps)
        SELECT * FROM UNNEST(
          ${userIds}::int[],
          ${dates}::date[],
          ${stepsArr}::int[]
        ) AS t(user_id, date, steps)
        ON CONFLICT (user_id, date) DO UPDATE SET
          steps = GREATEST(EXCLUDED.steps, "2026_daily_steps".steps)
      `
    );
  } catch (batchErr) {
    console.error("[webhooks/garmin/daily] Batch upsert failed, falling back to individual:", batchErr);
    for (const r of toUpsert) {
      await withRetry(() =>
        sql`
          INSERT INTO "2026_daily_steps" (user_id, date, steps)
          VALUES (${r.userId}, ${r.date}, ${r.steps})
          ON CONFLICT (user_id, date) DO UPDATE SET
            steps = GREATEST(EXCLUDED.steps, "2026_daily_steps".steps)
        `
      );
    }
  }

  for (const r of toUpsert) {
    console.log(
      `[webhooks/garmin/daily] Upserted ${r.steps} steps for user ${r.userId} on ${r.date}`
    );
  }
}
