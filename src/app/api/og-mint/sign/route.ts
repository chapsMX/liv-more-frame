import { NextResponse } from "next/server";
import { encodePacked, keccak256, serializeSignature } from "viem";
import { sign } from "viem/accounts";

// Contract must verify the same message: keccak256(abi.encodePacked(fid, username, deadline))

export type OgMintSignBody = {
  fid: number;
  username: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OgMintSignBody;
    const { fid, username } = body;

    if (!fid || typeof fid !== "number" || typeof username !== "string") {
      return NextResponse.json(
        { success: false, error: "fid and username are required" },
        { status: 400 }
      );
    }

    const privateKey = process.env.OG_MINT_VERIFIER_PRIVATE_KEY;
    if (!privateKey || !privateKey.startsWith("0x")) {
      console.error("[og-mint/sign] OG_MINT_VERIFIER_PRIVATE_KEY not set or invalid (must be 0x-prefixed hex)");
      return NextResponse.json(
        { success: false, error: "OG mint verifier not configured. Set OG_MINT_VERIFIER_PRIVATE_KEY in server .env (0x-prefixed private key of the contract verifier)." },
        { status: 500 }
      );
    }

    const deadline = Math.floor(Date.now() / 1000) + 60 * 30; // 30 min

    const messageHash = keccak256(
      encodePacked(
        ["uint256", "string", "uint256"],
        [BigInt(fid), username, BigInt(deadline)]
      )
    );

    const signature = await sign({
      hash: messageHash,
      privateKey: privateKey as `0x${string}`,
      to: "object",
    });

    const yParity =
      signature.yParity !== undefined
        ? signature.yParity
        : (Number(signature.v) === 28 ? 1 : 0);

    const serialized = serializeSignature({
      r: signature.r,
      s: signature.s,
      v: signature.v,
      yParity,
    });

    return NextResponse.json({
      success: true,
      deadline,
      signature: serialized,
    });
  } catch (error) {
    console.error("[api/og-mint/sign] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
