import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getValidOuraConnection } from "@/lib/oura";

export async function POST(req: NextRequest) {
  let body: { fid?: number; days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fid, days = 7 } = body;
  if (!fid) {
    return NextResponse.json({ error: "fid is required" }, { status: 400 });
  }

  // Buscar usuario
  const userRows = await sql`
    SELECT id FROM "2026_users" WHERE fid = ${fid}
  `;
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Buscar oura_user_id
  const ouraRows = await sql`
    SELECT oc.oura_user_id
    FROM "2026_oura_connections" oc
    JOIN "2026_provider_connections" pc ON pc.id = oc.connection_id
    WHERE pc.user_id = ${user.id}
      AND pc.disconnected_at IS NULL
  `;
  const ouraConn = ouraRows[0];
  if (!ouraConn) {
    return NextResponse.json(
      { error: "No active Oura connection" },
      { status: 404 }
    );
  }

  const connection = await getValidOuraConnection(ouraConn.oura_user_id);
  if (!connection) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(
    Date.now() - days * 86400000
  )
    .toISOString()
    .split("T")[0];

  const res = await fetch(
    `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`,
    { headers: { Authorization: `Bearer ${connection.access_token}` } }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("[oura/backfill] Oura API error:", res.status, errText);
    return NextResponse.json({ error: errText }, { status: 500 });
  }

  const json = await res.json();
  const data = json.data ?? json; // Oura v2 returns { data: [...] }
  const activities = Array.isArray(data) ? data : [];

  let saved = 0;

  for (const activity of activities) {
    const day = activity.day ?? activity.date ?? activity.timestamp?.split("T")[0];
    const steps = activity.steps;

    if (!day || steps == null) continue;

    await sql`
      INSERT INTO "2026_daily_steps" (user_id, date, steps)
      VALUES (${connection.user_id}, ${day}, ${steps})
      ON CONFLICT (user_id, date) DO UPDATE
        SET steps = EXCLUDED.steps
    `;
    saved++;
  }

  return NextResponse.json({
    ok: true,
    saved,
    startDate,
    endDate,
  });
}
