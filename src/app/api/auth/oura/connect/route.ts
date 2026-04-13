import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get("fid");
  if (!fid) {
    return NextResponse.json({ error: "Missing fid" }, { status: 400 });
  }

  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri =
    process.env.OURA_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_URL || "https://app.livmore.life"}/api/auth/oura/callback`;

  if (!clientId || !redirectUri) {
    console.error("[oura connect] Missing OURA_CLIENT_ID or OURA_REDIRECT_URI");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "daily",
    state,
  });

  const res = NextResponse.redirect(
    `https://cloud.ouraring.com/oauth/authorize?${params}`,
    302
  );

  // Guardar fid + state en cookie para verificar en callback
  res.cookies.set("oura_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutos
    path: "/",
  });
  res.cookies.set("oura_oauth_fid", fid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return res;
}
