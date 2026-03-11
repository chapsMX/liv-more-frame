import sharp from "sharp";
import { NextResponse } from "next/server";
import { getAttestShareData, formatDateDisplay } from "@/lib/attest-share";

const WIDTH = 500;
const HEIGHT = 500;

function buildAttestSvg(data: {
  steps: number;
  date: string;
  displayName: string;
}): string {
  const stepsFormatted = data.steps.toLocaleString("en-US");
  const dateFormatted = formatDateDisplay(data.date);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0a"/>
      <stop offset="100%" style="stop-color:#1a1a1a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="1" y="1" width="498" height="498" fill="none" stroke="#333" stroke-width="1" rx="8"/>
  <text x="250" y="140" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#9ca3af" text-anchor="middle">LIVMORE</text>
  <text x="250" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(stepsFormatted)}</text>
  <text x="250" y="230" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle">steps attested</text>
  <text x="250" y="300" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#ff8800" text-anchor="middle">${escapeXml(data.displayName)}</text>
  <text x="250" y="330" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">${escapeXml(dateFormatted)}</text>
  <text x="250" y="420" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#4b5563" text-anchor="middle">One step at a time</text>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * GET /imagen/attest/[fid]/[date]
 * Returns an OG image for attestation share (PNG for Farcaster frames).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fid: string; date: string }> }
) {
  const { fid: fidStr, date } = await params;
  const fid = Number(fidStr);
  if (!Number.isInteger(fid) || fid < 1) {
    return new NextResponse("Invalid fid", { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new NextResponse("Invalid date", { status: 400 });
  }

  const data = await getAttestShareData(fid, date);
  if (!data) {
    return new NextResponse("Attestation not found", { status: 404 });
  }

  const displayName = data.displayName || data.username || `User #${fid}`;
  const svg = buildAttestSvg({
    steps: data.steps,
    date: data.date,
    displayName,
  });

  try {
    const png = await sharp(Buffer.from(svg, "utf-8"))
      .resize(WIDTH, HEIGHT)
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
    console.error("[imagen/attest] SVG to PNG failed:", err);
    return new NextResponse("Image generation failed", { status: 502 });
  }
}
