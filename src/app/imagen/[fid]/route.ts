import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import sharp from "sharp";
import { OG_ABI, OG_CONTRACT_ADDRESS } from "@/lib/og-contract";
import { NextResponse } from "next/server";

const WIDTH_3_2 = 750;
const HEIGHT_3_2 = 500;
const NFT_SIZE = 500;
const LEFT_OFFSET = (WIDTH_3_2 - NFT_SIZE) / 2; // 125
const BG_RGB = { r: 5, g: 5, b: 15 }; // #05050F

/**
 * GET /imagen/[fid]
 * Returns the LivMore OG token image as PNG in 3:2 aspect ratio (share card format).
 * Converts the on-chain SVG to PNG; no text overlays, just background + NFT centered.
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

  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  let tokenUri: string;
  try {
    tokenUri = await publicClient.readContract({
      address: OG_CONTRACT_ADDRESS,
      abi: OG_ABI,
      functionName: "tokenURI",
      args: [BigInt(fid)],
    });
  } catch {
    return new NextResponse("Token not found", { status: 404 });
  }

  if (!tokenUri || typeof tokenUri !== "string") {
    return new NextResponse("Token not found", { status: 404 });
  }

  let imageDataUri: string;

  if (tokenUri.startsWith("data:application/json;base64,")) {
    try {
      const b64 = tokenUri.slice("data:application/json;base64,".length);
      const jsonStr = Buffer.from(b64, "base64").toString("utf-8");
      const data = JSON.parse(jsonStr) as { image?: string };
      if (!data?.image) return new NextResponse("No image in token", { status: 502 });
      imageDataUri = data.image;
    } catch {
      return new NextResponse("Invalid token metadata", { status: 502 });
    }
  } else {
    return new NextResponse("Unsupported token URI format", { status: 502 });
  }

  // Token image is data:image/svg+xml;base64,... — decode to SVG buffer
  let svgBuffer: Buffer;
  if (imageDataUri.startsWith("data:image/svg+xml;base64,")) {
    const b64 = imageDataUri.slice("data:image/svg+xml;base64,".length);
    svgBuffer = Buffer.from(b64, "base64");
  } else {
    return new NextResponse("Token image is not SVG", { status: 502 });
  }

  try {
    // Render NFT SVG to 500x500 PNG (no extra text)
    const nftPng = await sharp(svgBuffer)
      .resize(NFT_SIZE, NFT_SIZE)
      .png()
      .toBuffer();

    // 3:2 background (#05050F) + NFT centered, no text
    const background = await sharp({
      create: {
        width: WIDTH_3_2,
        height: HEIGHT_3_2,
        channels: 3,
        background: BG_RGB,
      },
    })
      .png()
      .toBuffer();

    const png = await sharp(background)
      .composite([{ input: nftPng, left: LEFT_OFFSET, top: 0 }])
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
