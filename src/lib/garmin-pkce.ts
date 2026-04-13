/**
 * Garmin OAuth2 PKCE: generate code_verifier and code_challenge (S256).
 * code_verifier: 43-128 chars [A-Za-z0-9-._~]
 * code_challenge: base64url(sha256(code_verifier))
 */
import { createHash, randomBytes } from "crypto";

const PKCE_COOKIE_NAME = "garmin_pkce";
const PKCE_COOKIE_MAX_AGE = 600; // 10 minutes

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url"); // 43 chars
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

export type PkcePayload = {
  state: string;
  code_verifier: string;
  fid: number;
};

export function getPkceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: PKCE_COOKIE_MAX_AGE,
    path: "/",
  };
}

export function encodePkceCookie(payload: PkcePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodePkceCookie(value: string): PkcePayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const data = JSON.parse(json) as PkcePayload;
    if (typeof data.state === "string" && typeof data.code_verifier === "string" && Number.isInteger(data.fid)) {
      return { state: data.state, code_verifier: data.code_verifier, fid: data.fid };
    }
  } catch {
    // ignore
  }
  return null;
}

export { PKCE_COOKIE_NAME };
