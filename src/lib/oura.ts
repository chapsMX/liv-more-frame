import { sql } from "@/lib/db";

type OuraConnection = {
  user_id: number;
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  oura_user_id: string;
  connection_id: number;
};

/**
 * Devuelve la conexión activa con un access_token válido.
 * Si el token está expirado, lo refresca automáticamente antes de retornar.
 */
export async function getValidOuraConnection(
  ouraUserId: string
): Promise<OuraConnection | null> {
  const rows = await sql`
    SELECT
      pc.user_id,
      oc.access_token,
      oc.refresh_token,
      oc.token_expires_at,
      oc.oura_user_id,
      oc.connection_id
    FROM "2026_oura_connections" oc
    JOIN "2026_provider_connections" pc ON pc.id = oc.connection_id
    WHERE oc.oura_user_id = ${ouraUserId}
      AND pc.disconnected_at IS NULL
  `;
  const conn = rows[0] as OuraConnection | undefined;

  if (!conn) return null;

  // Si el token expira en menos de 5 minutos, refrescamos
  const expiresAt = new Date(conn.token_expires_at);
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (!needsRefresh) return conn;

  console.log(`[oura] refreshing token for oura_user_id ${ouraUserId}`);

  const res = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[oura] token refresh failed for ${ouraUserId}:`, err);

    // Si el refresh falla (revocado, expirado), marcar como desconectado
    await sql`
      UPDATE "2026_provider_connections"
      SET disconnected_at = now()
      WHERE id = ${conn.connection_id}
    `;
    await sql`
      UPDATE "2026_users"
      SET provider = null, updated_at = now()
      WHERE id = ${conn.user_id}
    `;

    console.warn(
      `[oura] user ${conn.user_id} marked as disconnected due to invalid refresh token`
    );
    return null;
  }

  const { access_token, refresh_token, expires_in } = await res.json();
  const newExpiresAt = new Date(Date.now() + expires_in * 1000);

  // Actualizar tokens en BD
  await sql`
    UPDATE "2026_oura_connections"
    SET
      access_token     = ${access_token},
      refresh_token    = ${refresh_token},
      token_expires_at = ${newExpiresAt}
    WHERE oura_user_id = ${ouraUserId}
  `;

  console.log(`[oura] token refreshed for oura_user_id ${ouraUserId}`);

  return {
    ...conn,
    access_token,
    refresh_token,
    token_expires_at: newExpiresAt,
  };
}
