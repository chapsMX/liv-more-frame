import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { sql } from "@/lib/db";
import { withRetry } from "@/lib/db-retry";

type DeregistrationItem = {
  userId: string;
  callbackURL?: string;
};

type DeregistrationPayload = {
  deregistrations?: DeregistrationItem[];
};

export async function POST(req: NextRequest) {
  let body: DeregistrationPayload = {};

  try {
    const text = await req.text();
    if (text) {
      body = JSON.parse(text);
    }
    // Si el body está vacío, body queda como {} → lista vacía → 200 OK ✅
  } catch {
    // Body malformado: igual respondemos 200 para no fallar el ping de Garmin
    console.warn("[webhooks/garmin/deregister] invalid JSON body, ignoring");
  }

  const list = body.deregistrations ?? [];

  // waitUntil: mantiene la función viva hasta que processDeregistrations termine
  waitUntil(
    processDeregistrations(list).catch((err) => {
      console.error("[webhooks/garmin/deregister] error:", err);
    })
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function processDeregistrations(deregistrations: DeregistrationItem[]) {
  if (!deregistrations.length) return;

  for (const item of deregistrations) {
    if (!item.userId) continue;

    // Marcar como desconectado en provider_connections
    const updated = await withRetry(() =>
      sql`
        UPDATE "2026_provider_connections" pc
        SET disconnected_at = now()
        FROM "2026_garmin_connections" gc
        WHERE gc.connection_id = pc.id
          AND gc.garmin_user_id = ${item.userId}
          AND pc.disconnected_at IS NULL
        RETURNING pc.user_id
      `
    );

    if (!updated.length) continue;

    const userId = updated[0].user_id as number;

    await withRetry(() =>
      sql`
        UPDATE "2026_users"
        SET provider = null, updated_at = now()
        WHERE id = ${userId}
      `
    );

    console.log(`[garmin/deregister] user ${userId} disconnected`)
  }
}