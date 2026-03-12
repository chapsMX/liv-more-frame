/**
 * Cookie storage for Oura OAuth 2.0 flow.
 * Stores the user's fid and a random state value during the authorization redirect.
 */
const COOKIE_NAME = "oura_oauth";
const MAX_AGE = 600; // 10 minutes

export type OuraOAuthCookiePayload = {
  state: string;
  fid: number;
};

export function getOuraCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
    path: "/",
  };
}

export function encodeOuraCookie(payload: OuraOAuthCookiePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeOuraCookie(
  value: string
): OuraOAuthCookiePayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const data = JSON.parse(json) as OuraOAuthCookiePayload;
    if (typeof data.state === "string" && Number.isInteger(data.fid)) {
      return { state: data.state, fid: data.fid };
    }
  } catch {
    // ignore
  }
  return null;
}

export { COOKIE_NAME as OURA_OAUTH_COOKIE_NAME };
