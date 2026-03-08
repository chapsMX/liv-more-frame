import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

type DeregistrationPayload = {
  deregistrations?: { userId: string }[];
};

export async function POST(req: NextRequest) {
  let body: DeregistrationPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const list = body.deregistrations ?? [];
  processDeregistrations(list).catch((err) => {
    console.error("[webhooks/garmin/deregister] error:", err);
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function processDeregistrations(deregistrations: { userId: string }[]) {
  if (!deregistrations.length) return;

  for (const item of deregistrations) {
    if (!item.userId) continue;

    const updated = await sql`
      UPDATE "2026_provider_connections" pc
      SET disconnected_at = now()
      FROM "2026_garmin_connections" gc
      WHERE gc.connection_id = pc.id
        AND gc.garmin_user_id = ${item.userId}
        AND pc.disconnected_at IS NULL
      RETURNING pc.user_id
    `;

    for (const row of updated) {
      const userId = row.user_id as number;
      await sql`
        UPDATE "2026_users"
        SET provider = null, updated_at = now()
        WHERE id = ${userId}
      `;
    }
  }
}
