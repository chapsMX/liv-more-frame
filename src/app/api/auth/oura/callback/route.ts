import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { getValidOuraConnection } from "@/lib/oura";

const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const OURA_PERSONAL_INFO_URL =
  "https://api.ouraring.com/v2/usercollection/personal_info";

export async function GET(req: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://app.livmore.life";

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("oura_oauth_state")?.value;
  const fid = cookieStore.get("oura_oauth_fid")?.value;

  const res = NextResponse.redirect(`${appUrl}?oura=error`, 302);

  // Limpiar cookies en la respuesta
  res.cookies.delete("oura_oauth_state");
  res.cookies.delete("oura_oauth_fid");

  if (error || !code || !state || !fid) {
    console.error("[oura/callback] missing params:", { error, code, state, fid });
    return res;
  }

  // Validar state para prevenir CSRF
  if (state !== savedState) {
    console.error("[oura/callback] state mismatch", { state, savedState });
    return res;
  }

  // Buscar usuario interno por fid
  const userRows = await sql`
    SELECT id FROM "2026_users" WHERE fid = ${parseInt(fid, 10)}
  `;
  const user = userRows[0];
  if (!user) {
    console.error("[oura/callback] user not found for fid:", fid);
    return res;
  }

  const userId = user.id as number;

  // Intercambiar code por tokens
  const redirectUri =
    process.env.OURA_REDIRECT_URI ||
    `${appUrl}/api/auth/oura/callback`;
  const tokenRes = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    console.error(
      "[oura/callback] token exchange failed:",
      await tokenRes.text()
    );
    return res;
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json();
  const tokenExpiresAt = new Date(Date.now() + (expires_in ?? 86400) * 1000);

  // Obtener oura_user_id
  const userRes = await fetch(OURA_PERSONAL_INFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    console.error(
      "[oura/callback] failed to fetch oura user:",
      await userRes.text()
    );
    return res;
  }

  const userData = await userRes.json();
  const ouraUserId = String(userData.id ?? userData.user_id ?? "");

  if (!ouraUserId) {
    console.error("[oura/callback] no id in personal_info response");
    return res;
  }

  // Guardar en BD (upsert provider_connections por UNIQUE user_id)
  try {
    const connRows = await sql`
      INSERT INTO "2026_provider_connections" (user_id, provider)
      VALUES (${userId}, 'oura')
      ON CONFLICT (user_id) DO UPDATE SET
        provider = 'oura',
        disconnected_at = null
      RETURNING id
    `;
    const connectionId = connRows[0]?.id as number;

    await sql`
      INSERT INTO "2026_oura_connections"
        (connection_id, oura_user_id, access_token, refresh_token, token_expires_at)
      VALUES
        (${connectionId}, ${ouraUserId}, ${access_token}, ${refresh_token}, ${tokenExpiresAt})
      ON CONFLICT (oura_user_id) DO UPDATE SET
        connection_id = EXCLUDED.connection_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at
    `;

    await sql`
      UPDATE "2026_users"
      SET provider = 'oura', updated_at = now()
      WHERE id = ${userId}
    `;

    console.log(
      `[oura/callback] user ${userId} (fid: ${fid}) connected as oura_user_id: ${ouraUserId}`
    );
  } catch (err) {
    console.error("[oura/callback] DB error:", err);
    return res;
  }

  waitUntil(
    backfillOuraHistory(userId, ouraUserId).catch((err) => {
      console.error("[oura/callback] backfill error:", err);
    })
  );

  res.headers.set("Location", `${appUrl}?oura=success`);
  return res;
}

async function backfillOuraHistory(userId: number, ouraUserId: string) {
  const connection = await getValidOuraConnection(ouraUserId);
  if (!connection) return;

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(
    Date.now() - 10 * 86400000
  )
    .toISOString()
    .split("T")[0];

  const res = await fetch(
    `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`,
    { headers: { Authorization: `Bearer ${connection.access_token}` } }
  );

  if (!res.ok) {
    console.error(
      "[oura/backfill] failed to fetch activity:",
      await res.text()
    );
    return;
  }

  const json = await res.json();
  const data = json.data ?? json;
  const activities = Array.isArray(data) ? data : [];

  let saved = 0;

  for (const activity of activities) {
    const day = activity.day ?? activity.date ?? activity.timestamp?.split("T")[0];
    const steps = activity.steps;

    if (!day || steps == null) continue;

    await sql`
      INSERT INTO "2026_daily_steps" (user_id, date, steps)
      VALUES (${userId}, ${day}, ${steps})
      ON CONFLICT (user_id, date) DO UPDATE
        SET steps = EXCLUDED.steps
    `;
    saved++;
  }

  console.log(`[oura/backfill] saved ${saved} days for user ${userId}`);
}
