import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/db";

const ACTIVITIES_URL = "https://www.polaraccesslink.com/v3/users/activities";

type PolarWebhookPayload = {
  event: string;
  user_id?: number;
  date?: string;
  timestamp?: string;
  url?: string;
};

/**
 * Polar AccessLink webhook receiver.
 * Handles PING (webhook registration verification) and ACTIVITY_SUMMARY events.
 */
export async function POST(req: NextRequest) {
  const event = req.headers.get("Polar-Webhook-Event");
  const signature = req.headers.get("Polar-Webhook-Signature");

  const bodyText = await req.text();

  // Verify HMAC signature if secret is configured
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

  // Handle PING (required for webhook creation/activation)
  if (event === "PING") {
    console.log("[webhooks/polar/activity] PING received");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  let body: PolarWebhookPayload;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event !== "ACTIVITY_SUMMARY" || !body.user_id || !body.date) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Process asynchronously so we return 200 quickly
  processActivity(body.user_id, body.date).catch((err) => {
    console.error("[webhooks/polar/activity] processActivity error:", err);
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function processActivity(polarUserId: number, date: string) {
  const today = new Date().toISOString().split("T")[0];
  if (date === today) return; // day not finished

  // 1. Look up connection by polar_user_id
  const connRows = await sql`
    SELECT
      pc.user_id,
      pc2.access_token
    FROM "2026_polar_connections" pc2
    INNER JOIN "2026_provider_connections" pc ON pc.id = pc2.connection_id
    WHERE pc2.polar_user_id = ${polarUserId}
      AND pc.disconnected_at IS NULL
    LIMIT 1
  `;

  const row = connRows[0];
  if (!row) {
    console.warn(
      "[webhooks/polar/activity] No connection found for polar_user_id:",
      polarUserId
    );
    return;
  }

  const userId = row.user_id as number;
  const accessToken = row.access_token as string;

  // 2. Fetch activity data for the given date
  const res = await fetch(`${ACTIVITIES_URL}/${date}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 204) return; // no data for this date

  if (!res.ok) {
    console.error(
      "[webhooks/polar/activity] Polar API error:",
      res.status,
      await res.text()
    );
    return;
  }

  const activity = await res.json();
  const steps = Number(activity.steps);

  if (!Number.isFinite(steps) || steps < 0) return;

  // 3. Upsert into daily steps
  await sql`
    INSERT INTO "2026_daily_steps" (user_id, date, steps)
    VALUES (${userId}, ${date}, ${steps})
    ON CONFLICT (user_id, date) DO UPDATE SET
      steps = GREATEST(EXCLUDED.steps, "2026_daily_steps".steps)
  `;

  console.log(
    `[webhooks/polar/activity] Upserted ${steps} steps for user ${userId} on ${date}`
  );
}
