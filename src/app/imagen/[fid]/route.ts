import sharp from "sharp";
import { NextResponse } from "next/server";
import { fetchOgTokenSvg } from "@/lib/og-token";

const SIZE = 500;

/**
 * GET /imagen/[fid]
 * Returns the LivMore OG token as PNG (for Farcaster share/frames — they don't accept SVG).
 * Uses Sharp to convert on-chain SVG → PNG.
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

  try {
    const png = await sharp(Buffer.from(svg, "utf-8"))
      .resize(SIZE, SIZE)
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("[imagen] SVG to PNG failed:", err);
    return new NextResponse("Image generation failed", { status: 502 });
  }
}
