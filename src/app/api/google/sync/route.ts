import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get("fid");
  if (!fid) {
    return NextResponse.json({ error: "Missing fid" }, { status: 400 });
  }

  const rows = await sql`
    SELECT
      pc.user_id,
      gc.access_token,
      gc.refresh_token,
      gc.token_expires_at,
      gc.google_user_id,
      gc.timezone
    FROM "2026_google_connections" gc
    JOIN "2026_provider_connections" pc ON pc.id = gc.connection_id
    JOIN "2026_users" u ON u.id = pc.user_id
    WHERE u.fid = ${parseInt(fid, 10)}
      AND pc.disconnected_at IS NULL
  `;

  const conn = rows[0];
  if (!conn) {
    return NextResponse.json(
      { error: "No active Google connection" },
      { status: 404 }
    );
  }

  let accessToken = conn.access_token;
  const tz = conn.timezone ?? "UTC";
  const expiresAt = new Date(conn.token_expires_at);

  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      console.error(
        "[google/sync] token refresh failed:",
        await tokenRes.text()
      );
      await sql`
        UPDATE "2026_provider_connections"
        SET disconnected_at = now()
        WHERE user_id = ${conn.user_id}
          AND disconnected_at IS NULL
      `;
      return NextResponse.json(
        { error: "Token refresh failed" },
        { status: 401 }
      );
    }

    const { access_token, expires_in } = await tokenRes.json();
    const newExpiresAt = new Date(Date.now() + expires_in * 1000);

    await sql`
      UPDATE "2026_google_connections"
      SET access_token = ${access_token}, token_expires_at = ${newExpiresAt}
      WHERE google_user_id = ${conn.google_user_id}
    `;

    accessToken = access_token;
  }

  // 3 días para cubrir el día actual + margen de timezone
  const endMs = Date.now();
  const startMs = endMs - 3 * 24 * 60 * 60 * 1000;

  const res = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [
          {
            dataSourceId:
              "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
          },
        ],
        bucketByTime: {
          period: { type: "day", value: 1, timeZoneId: tz },
        },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    }
  );

  if (!res.ok) {
    console.error("[google/sync] fitness API failed:", await res.text());
    return NextResponse.json(
      { error: "Fitness API error" },
      { status: 500 }
    );
  }

  const { bucket } = await res.json();
  let synced = 0;

  for (const b of bucket ?? []) {
    const steps = (b.dataset?.[0]?.point ?? []).reduce(
      (sum: number, point: { value?: { intVal?: number }[] }) =>
        sum + (point.value?.[0]?.intVal ?? 0),
      0
    );
    if (!steps) continue;

    const midMs =
      (parseInt(b.startTimeMillis, 10) + parseInt(b.endTimeMillis, 10)) / 2;
    const date = new Date(midMs).toLocaleDateString("en-CA", {
      timeZone: tz,
    });

    const result = await sql`
      INSERT INTO "2026_daily_steps" (user_id, date, steps)
      VALUES (${conn.user_id}, ${date}, ${steps})
      ON CONFLICT (user_id, date) DO UPDATE
        SET steps = EXCLUDED.steps
      RETURNING id, (xmax = 0) AS inserted
    `;

    const action = result[0]?.inserted ? "Inserted" : "Updated";
    console.log(
      `[google/sync] ${action} ${steps} steps for user ${conn.user_id} on ${date} (tz: ${tz})`
    );
    synced++;
  }

  console.log(
    `[google/sync] done — ${synced} days synced for user ${conn.user_id}`
  );
  return NextResponse.json({ ok: true, synced });
}
