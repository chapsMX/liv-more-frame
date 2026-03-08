import { sql } from "@/lib/db";

export type GarminTokens = {
  accessToken: string;
  tokenSecret: string;
  connectionId: number;
};

/**
 * Returns Garmin OAuth 1.0 tokens for a user by 2026_users.id.
 * Use this from API routes that need to call Garmin (e.g. steps).
 * Returns null if the user has no Garmin connection or it was disconnected.
 */
export async function getGarminTokensByUserId(
  userId: number
): Promise<GarminTokens | null> {
  const rows = await sql`
    SELECT gc.access_token, gc.token_secret, gc.connection_id
    FROM "2026_garmin_connections" gc
    INNER JOIN "2026_provider_connections" pc ON pc.id = gc.connection_id
    WHERE pc.user_id = ${userId}
      AND pc.provider = 'garmin'
      AND pc.disconnected_at IS NULL
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || !row.access_token || !row.token_secret) return null;
  return {
    accessToken: String(row.access_token),
    tokenSecret: String(row.token_secret),
    connectionId: Number(row.connection_id),
  };
}

/**
 * Returns Garmin OAuth 1.0 tokens for a user by Farcaster fid.
 */
export async function getGarminTokensByFid(
  fid: number
): Promise<GarminTokens | null> {
  const userRows = await sql`
    SELECT id FROM "2026_users" WHERE fid = ${fid} LIMIT 1
  `;
  if (userRows.length === 0) return null;
  const userId = userRows[0].id as number;
  return getGarminTokensByUserId(userId);
}
