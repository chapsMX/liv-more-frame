import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
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
  // Validar verification token
  const token =
    req.headers.get("x-oura-verification-token") ??
    req.nextUrl.searchParams.get("verification_token");
  if (token !== process.env.OURA_VERIFICATION_TOKEN) {
    console.warn("[webhooks/oura/daily] invalid verification token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: OuraWebhookPayload;
  try {
    const text = await req.text();
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
  // 1. Buscar conexión activa con token válido (refresca si expirado)
  const connection = await getValidOuraConnection(payload.user_id);
  if (!connection) {
    console.warn(
      `[webhooks/oura/daily] no active connection for oura_user_id ${payload.user_id}`
    );
    return;
  }

  // 2. Obtener el documento de Oura por ID (object_id o id)
  const docId = payload.object_id ?? payload.id;
  if (!docId) {
    console.warn("[webhooks/oura/daily] missing id/object_id in payload:", payload);
    return;
  }

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
  const { day, steps } = activity; // day = "2026-03-12", steps = integer

  if (!day || steps == null) {
    console.warn(
      "[webhooks/oura/daily] missing day or steps in activity:",
      activity
    );
    return;
  }

  // 3. Upsert en 2026_daily_steps
  await sql`
    INSERT INTO "2026_daily_steps" (user_id, date, steps)
    VALUES (${connection.user_id}, ${day}, ${steps})
    ON CONFLICT (user_id, date) DO UPDATE
      SET steps = EXCLUDED.steps
  `;

  console.log(
    `[webhooks/oura/daily] saved ${steps} steps for user ${connection.user_id} on ${day}`
  );
}
