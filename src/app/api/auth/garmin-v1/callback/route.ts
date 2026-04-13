import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { getAccessToken, getWellnessUserId } from "@/lib/garmin-oauth1";
import {
  decodeOAuth1Cookie,
  GARMIN_OAUTH1_COOKIE_NAME,
} from "@/lib/garmin-oauth1-cookie";

/**
 * Garmin OAuth 1.0a callback.
 * Step 2: User returns with oauth_token and oauth_verifier; exchange for access token and save to DB.
 */
export async function GET(request: Request) {
  const consumerKey = process.env.GARMIN_CLIENT_ID;
  const consumerSecret = process.env.GARMIN_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_URL || "https://app.livmore.life";

  if (!consumerKey || !consumerSecret) {
    console.error("[garmin-v1 callback] Missing Garmin env vars");
    return NextResponse.redirect(`${appUrl}?error=server_error`, 302);
  }

  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get("oauth_token");
  const oauthVerifier = searchParams.get("oauth_verifier");

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.redirect(`${appUrl}?error=missing_oauth_token_or_verifier`, 302);
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(GARMIN_OAUTH1_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return NextResponse.redirect(`${appUrl}?error=invalid_state`, 302);
  }

  const payload = decodeOAuth1Cookie(cookieValue);
  if (!payload) {
    return NextResponse.redirect(`${appUrl}?error=invalid_state`, 302);
  }

  const { oauth_token_secret: oauthTokenSecret, fid } = payload;

  let accessTokenRes: { oauth_token: string; oauth_token_secret: string };
  try {
    accessTokenRes = await getAccessToken({
      consumerKey,
      consumerSecret,
      oauthToken,
      oauthTokenSecret,
      oauthVerifier,
    });
  } catch (e) {
    console.error("[garmin-v1 callback] getAccessToken failed:", e);
    return NextResponse.redirect(`${appUrl}?error=token_exchange_failed`, 302);
  }

  // Fetch real Garmin user id from Wellness API (persists across tokens)
  let garminUserId: string;
  try {
    garminUserId = await getWellnessUserId({
      consumerKey,
      consumerSecret,
      accessToken: accessTokenRes.oauth_token,
      accessTokenSecret: accessTokenRes.oauth_token_secret,
    });
  } catch (e) {
    console.warn("[garmin-v1 callback] getWellnessUserId failed, using placeholder:", e);
    // Fallback so connection still works; webhook can backfill later
    const userRowsForPlaceholder = await sql`SELECT id FROM "2026_users" WHERE fid = ${fid} LIMIT 1`;
    const uid = userRowsForPlaceholder[0]?.id as number | undefined;
    garminUserId = uid != null ? `livmore-user-${uid}` : `livmore-${fid}`;
  }

  try {
    // Resolve user id from fid
    const userRows = await sql`
      SELECT id FROM "2026_users" WHERE fid = ${fid} LIMIT 1
    `;
    if (userRows.length === 0) {
      console.error("[garmin-v1 callback] User not found for fid:", fid);
      return NextResponse.redirect(`${appUrl}?error=user_not_found`, 302);
    }
    const userId = userRows[0].id as number;

    // Upsert provider connection (one row per user; (re)connect Garmin)
    const connRows = await sql`
      INSERT INTO "2026_provider_connections" (user_id, provider)
      VALUES (${userId}, 'garmin')
      ON CONFLICT (user_id) DO UPDATE SET
        provider = 'garmin',
        disconnected_at = null
      RETURNING id
    `;
    const connectionId = connRows[0]?.id as number;
    if (connectionId == null) {
      console.error("[garmin-v1 callback] Failed to get connection_id");
      return NextResponse.redirect(`${appUrl}?error=db_update_failed`, 302);
    }

    // If we have real Garmin user id, update existing row by connection_id first (replace placeholder), else insert
    const isRealGarminId = !garminUserId.startsWith("livmore-user-") && !garminUserId.startsWith("livmore-");
    if (isRealGarminId) {
      const updated = await sql`
        UPDATE "2026_garmin_connections"
        SET garmin_user_id = ${garminUserId},
            access_token = ${accessTokenRes.oauth_token},
            token_secret = ${accessTokenRes.oauth_token_secret}
        WHERE connection_id = ${connectionId}
        RETURNING id
      `;
      if (updated.length === 0) {
        await sql`
          INSERT INTO "2026_garmin_connections" (connection_id, garmin_user_id, access_token, token_secret)
          VALUES (${connectionId}, ${garminUserId}, ${accessTokenRes.oauth_token}, ${accessTokenRes.oauth_token_secret})
          ON CONFLICT (garmin_user_id) DO UPDATE SET
            connection_id = EXCLUDED.connection_id,
            access_token = EXCLUDED.access_token,
            token_secret = EXCLUDED.token_secret
        `;
      }
    } else {
      await sql`
        INSERT INTO "2026_garmin_connections" (connection_id, garmin_user_id, access_token, token_secret)
        VALUES (${connectionId}, ${garminUserId}, ${accessTokenRes.oauth_token}, ${accessTokenRes.oauth_token_secret})
        ON CONFLICT (garmin_user_id) DO UPDATE SET
          connection_id = EXCLUDED.connection_id,
          access_token = EXCLUDED.access_token,
          token_secret = EXCLUDED.token_secret
      `;
    }

    // Keep 2026_users.provider in sync so the app knows which provider is connected
    await sql`
      UPDATE "2026_users"
      SET provider = 'garmin', updated_at = now()
      WHERE fid = ${fid}
    `;

    // Trigger backfill of historical steps after successful connection
    const baseUrl = process.env.NEXT_PUBLIC_URL;
    if (baseUrl) {
      try {
        await fetch(`${baseUrl}/api/garmin/backfill`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, daysBack: 5 }),
        });
      } catch (e) {
        console.error("[garmin-v1 callback] backfill request failed:", e);
      }
    }
  } catch (e) {
    console.error("[garmin-v1 callback] DB update failed:", e);
    return NextResponse.redirect(`${appUrl}?error=db_update_failed`, 302);
  }

  const res = NextResponse.redirect(`${appUrl}?garmin=connected`, 302);
  res.cookies.delete(GARMIN_OAUTH1_COOKIE_NAME);
  return res;
}
