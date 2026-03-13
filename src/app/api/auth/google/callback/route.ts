import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { sql } from "@/lib/db";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(req: NextRequest) {
  // DEBUG TEMPORAL
  console.log("[google/callback] full URL:", req.nextUrl.toString());
  console.log("[google/callback] search params:", Object.fromEntries(req.nextUrl.searchParams));
  console.log("[google/callback] all cookies:", (await cookies()).getAll());
  // FIN DEBUG

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://app.livmore.life";

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  const fid = cookieStore.get("google_oauth_fid")?.value;

  const res = NextResponse.redirect(`${appUrl}?google=error`, 302);
  res.cookies.delete("google_oauth_state");
  res.cookies.delete("google_oauth_fid");

  if (error || !code || !state || !fid) {
    console.error("[google/callback] missing params:", { error, code, state, fid });
    return res;
  }

  if (state !== savedState) {
    console.error("[google/callback] state mismatch");
    return res;
  }

  const userRows = await sql`
    SELECT id FROM "2026_users" WHERE fid = ${parseInt(fid, 10)}
  `;
  const user = userRows[0];
  if (!user) {
    console.error("[google/callback] user not found for fid:", fid);
    return res;
  }

  const userId = user.id as number;

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${appUrl}/api/auth/google/callback`;
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[google/callback] token exchange failed:", await tokenRes.text());
    return res;
  }

  const { access_token, refresh_token, expires_in, id_token } =
    await tokenRes.json();

  if (!refresh_token) {
    console.error("[google/callback] no refresh_token received");
    return res;
  }

  if (!id_token) {
    console.error("[google/callback] no id_token received");
    return res;
  }

  // Decodificar id_token (JWT) para obtener el sub — no requiere llamada extra
  const payload = JSON.parse(
    Buffer.from(id_token.split(".")[1], "base64url").toString()
  );
  const googleUserId = payload.sub as string;

  if (!googleUserId) {
    console.error("[google/callback] no sub in id_token");
    return res;
  }

  const tokenExpiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000);

  try {
    const connRows = await sql`
      INSERT INTO "2026_provider_connections" (user_id, provider)
      VALUES (${userId}, 'google')
      ON CONFLICT (user_id) DO UPDATE SET
        provider = 'google',
        disconnected_at = null
      RETURNING id
    `;
    const connectionId = connRows[0]?.id as number;

    await sql`
      INSERT INTO "2026_google_connections"
        (connection_id, google_user_id, access_token, refresh_token, token_expires_at)
      VALUES
        (${connectionId}, ${googleUserId}, ${access_token}, ${refresh_token}, ${tokenExpiresAt})
      ON CONFLICT (google_user_id) DO UPDATE SET
        connection_id = EXCLUDED.connection_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at
    `;

    await sql`
      UPDATE "2026_users"
      SET provider = 'google', updated_at = now()
      WHERE id = ${userId}
    `;

    console.log(
      `[google/callback] user ${userId} (fid: ${fid}) connected as google_user_id: ${googleUserId}`
    );
  } catch (err) {
    console.error("[google/callback] DB error:", err);
    return res;
  }

  waitUntil(
    backfillGoogleSteps(userId, googleUserId, access_token).catch((err) => {
      console.error("[google/callback] backfill error:", err);
    })
  );

  res.headers.set("Location", `${appUrl}?google=success`);
  return res;
}

async function backfillGoogleSteps(
  userId: number,
  _googleUserId: string,
  accessToken: string
) {
  const endMs = Date.now();
  const startMs = endMs - 30 * 24 * 60 * 60 * 1000;

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
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    }
  );

  if (!res.ok) {
    console.error("[google/backfill] failed:", await res.text());
    return;
  }

  const { bucket } = await res.json();
  let saved = 0;

  for (const b of bucket ?? []) {
    const steps = (b.dataset?.[0]?.point ?? []).reduce(
      (sum: number, point: { value?: { intVal?: number }[] }) =>
        sum + (point.value?.[0]?.intVal ?? 0),
      0
    );
    if (!steps) continue;

    const date = new Date(parseInt(b.startTimeMillis, 10))
      .toISOString()
      .split("T")[0];

    await sql`
      INSERT INTO "2026_daily_steps" (user_id, date, steps)
      VALUES (${userId}, ${date}, ${steps})
      ON CONFLICT (user_id, date) DO UPDATE
        SET steps = EXCLUDED.steps
    `;
    saved++;
  }

  console.log(`[google/backfill] saved ${saved} days for user ${userId}`);
}
