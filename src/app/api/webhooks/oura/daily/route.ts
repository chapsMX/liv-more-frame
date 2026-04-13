import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import crypto from "crypto";
import { sql } from "@/lib/db";
import { getValidOuraConnection } from "@/lib/oura";

type OuraWebhookPayload = {
  id?: string; // oura document id (object_id in Oura docs)
  object_id?: string;
  data_type: string; // "daily_activity"
  event_type: string; // "create" | "update"
  user_id: string; // oura_user_id
};

/**
 * GET: Oura verification challenge during subscription setup.
 * Oura sends GET ?verification_token=...&challenge=... and we must return { challenge }.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("verification_token");
  const challenge = req.nextUrl.searchParams.get("challenge");

  if (token !== process.env.OURA_VERIFICATION_TOKEN || !challenge) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ challenge });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-oura-signature");
  const timestamp = req.headers.get("x-oura-timestamp");

  if (!signature || !timestamp) {
    console.warn("[webhooks/oura/daily] missing signature headers");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const text = await req.text();

  // Verificar HMAC: SHA256(timestamp + body) con CLIENT_SECRET
  const hmac = crypto.createHmac("sha256", process.env.OURA_CLIENT_SECRET!);
  hmac.update(timestamp + text);
  const calculatedSignature = hmac.digest("hex").toUpperCase();

  if (calculatedSignature !== signature) {
    console.warn("[webhooks/oura/daily] invalid HMAC signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: OuraWebhookPayload;
  try {
    if (!text) return NextResponse.json({ ok: true }, { status: 200 });
    body = JSON.parse(text);
  } catch {
    console.warn("[webhooks/oura/daily] invalid JSON");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.data_type !== "daily_activity") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  waitUntil(
    processDailyActivity(body).catch((err) => {
      console.error("[webhooks/oura/daily] error:", err);
    })
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function processDailyActivity(payload: OuraWebhookPayload) {
  console.log(
    `[webhooks/oura/daily] received ${payload.event_type} for oura_user_id ${payload.user_id}`
  );

  const connection = await getValidOuraConnection(payload.user_id);
  if (!connection) {
    console.warn(
      `[webhooks/oura/daily] no active connection for oura_user_id ${payload.user_id}`
    );
    return;
  }

  const docId = payload.object_id ?? payload.id;
  if (!docId) {
    console.warn(
      "[webhooks/oura/daily] missing id/object_id in payload:",
      payload
    );
    return;
  }

  console.log(
    `[webhooks/oura/daily] fetching activity ${docId} for user ${connection.user_id}`
  );

  const res = await fetch(
    `https://api.ouraring.com/v2/usercollection/daily_activity/${docId}`,
    { headers: { Authorization: `Bearer ${connection.access_token}` } }
  );

  if (!res.ok) {
    console.error(
      `[webhooks/oura/daily] failed to fetch activity ${docId}:`,
      await res.text()
    );
    return;
  }

  const activity = await res.json();
  const { day, steps } = activity;

  if (!day || steps == null) {
    console.warn(
      "[webhooks/oura/daily] missing day or steps in activity:",
      activity
    );
    return;
  }

  // Upsert y detectar si fue insert o update (xmax = 0 en inserts nuevos)
  const result = await sql`
    INSERT INTO "2026_daily_steps" (user_id, date, steps)
    VALUES (${connection.user_id}, ${day}, ${steps})
    ON CONFLICT (user_id, date) DO UPDATE
      SET steps = EXCLUDED.steps
    RETURNING id, (xmax = 0) AS inserted
  `;

  const wasInserted = result[0]?.inserted;
  const action = wasInserted ? "Inserted" : "Updated";

  console.log(
    `[webhooks/oura/daily] ${action} ${steps} steps for user ${connection.user_id} (fid lookup via oura_user_id: ${payload.user_id}) on ${day} — event: ${payload.event_type}`
  );
}
