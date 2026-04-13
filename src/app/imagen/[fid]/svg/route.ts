import { NextResponse } from "next/server";
import { fetchOgTokenSvg } from "@/lib/og-token";

/**
 * GET /imagen/[fid]/svg
 * Returns the LivMore OG token as raw SVG (for miniapp display).
 * No Sharp, no Fontconfig — SVG is 100% on-chain.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fid: string }> }
) {
  const fidStr = (await params).fid;
  const fid = Number(fidStr);
  if (!Number.isInteger(fid) || fid < 1) {
    return new NextResponse("Invalid fid", { status: 400 });
  }

  const svg = await fetchOgTokenSvg(fid);
  if (!svg) {
    return new NextResponse("Token not found", { status: 404 });
  }

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
