import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/db";

type PolarWebhookPayload = {
  event: string;
  user_id: number;
  entity_id: string;
  timestamp: string;
  url?: string;
};

type PolarActivitySummary = {
  steps?: number;
  start_time?: string;
};

/**
 * Polar AccessLink webhook receiver.
 * Handles PING (webhook registration verification) and ACTIVITY_SUMMARY events.
 *
 * Flow: Polar detects new activity -> POSTs here with a URL ->
 * we GET that URL with the user's access_token -> upsert steps in DB.
 */
export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  let payload: PolarWebhookPayload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Respond to PING immediately (before signature check -- Polar sends PING during registration)
  if (payload.event === "PING") {
    console.log("[webhooks/polar/activity] PING received");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Verify HMAC-SHA256 signature for all other events
  const signature = req.headers.get("Polar-Webhook-Signature");
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyText)
      .digest("hex");
    if (expected !== signature) {
      console.error("[webhooks/polar/activity] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  if (payload.event !== "ACTIVITY_SUMMARY" || !payload.url) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    await processActivity(payload);
  } catch (err) {
    console.error("[webhooks/polar/activity] processActivity error:", err);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function processActivity(payload: PolarWebhookPayload) {
  // 1. Look up connection by polar_user_id
  const connRows = await sql`
    SELECT
      pc.user_id,
      pc2.access_token
    FROM "2026_polar_connections" pc2
    INNER JOIN "2026_provider_connections" pc ON pc.id = pc2.connection_id
    WHERE pc2.polar_user_id = ${payload.user_id}
      AND pc.disconnected_at IS NULL
    LIMIT 1
  `;

  const row = connRows[0];
  if (!row) {
    console.warn(
      "[webhooks/polar/activity] No connection for polar_user_id:",
      payload.user_id
    );
    return;
  }

  const userId = row.user_id as number;
  const accessToken = row.access_token as string;

  // 2. Fetch the activity data from the URL Polar sent us
  const activityUrl =
    payload.url!.startsWith("http") ? payload.url! : `https://${payload.url!}`;
  const res = await fetch(activityUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 204) return;

  if (!res.ok) {
    console.error(
      "[webhooks/polar/activity] Polar API error:",
      res.status,
      await res.text()
    );
    return;
  }

  // Polar may return an object or an array (GET /v3/users/activities/{date} returns single object)
  const data = await res.json();
  const activities: PolarActivitySummary[] = Array.isArray(data)
    ? data
    : [data];

  let upserted = 0;
  for (const activity of activities) {
    if (activity.steps == null || !activity.start_time) continue;

    const date = activity.start_time.split("T")[0];
    const steps = Number(activity.steps);
    if (!Number.isFinite(steps) || steps < 0) continue;

    await sql`
      INSERT INTO "2026_daily_steps" (user_id, date, steps)
      VALUES (${userId}, ${date}, ${steps})
      ON CONFLICT (user_id, date) DO UPDATE SET
        steps = GREATEST(EXCLUDED.steps, "2026_daily_steps".steps)
    `;

    upserted++;
    console.log(
      `[webhooks/polar/activity] Upserted ${steps} steps for user ${userId} on ${date}`
    );
  }

  if (upserted === 0 && activities.length > 0) {
    console.warn(
      "[webhooks/polar/activity] No activities had steps/start_time. Raw sample:",
      JSON.stringify(activities[0]).slice(0, 300)
    );
  }
}
