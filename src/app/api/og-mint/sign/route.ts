import { NextResponse } from "next/server";
import {
  type Hash,
  concat,
  encodeAbiParameters,
  keccak256,
  serializeSignature,
  toHex,
} from "viem";
import { sign } from "viem/accounts";

// Matches LivMore.sol _verifySignature: StepsOGMint(typeHash) + abi.encode(...), then EIP-191 wrap
const TYPEHASH_STRING =
  "StepsOGMint(uint256 fid,address recipient,string username,address contractAddress,uint256 chainId,uint256 deadline)";
const TYPEHASH = keccak256(toHex(TYPEHASH_STRING));

function toEthSignedMessageHash(hash: Hash): Hash {
  const prefix = "0x19457468657265756d205369676e6564204d6573736167653a0a3332" as const;
  return keccak256(concat([prefix, hash]));
}

export type OgMintSignBody = {
  fid: number;
  username: string;
  recipient?: string; // wallet address that will call mint (required for contract verification)
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OgMintSignBody;
    const { fid, username, recipient } = body;

    if (!fid || typeof fid !== "number" || typeof username !== "string") {
      return NextResponse.json(
        { success: false, error: "fid and username are required" },
        { status: 400 }
      );
    }

    if (!recipient || typeof recipient !== "string" || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { success: false, error: "recipient (wallet address) is required for signature" },
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

    const contractAddress =
      (process.env.NEXT_PUBLIC_OG_CONTRACT_ADDRESS as `0x${string}`) ||
      "0x73590BCC99a8E334454C08858da91d1e869558B9";
    const chainId = Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID ?? "8453");
    const deadline = Math.floor(Date.now() / 1000) + 60 * 30; // 30 min

    const usernameHash = keccak256(toHex(username));
    const msgHash = keccak256(
      encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "uint256" },
          { type: "address" },
          { type: "bytes32" },
          { type: "address" },
          { type: "uint256" },
          { type: "uint256" },
        ],
        [
          TYPEHASH,
          BigInt(fid),
          recipient as `0x${string}`,
          usernameHash,
          contractAddress,
          BigInt(chainId),
          BigInt(deadline),
        ]
      )
    );
    const ethSigned = toEthSignedMessageHash(msgHash);

    const signature = await sign({
      hash: ethSigned,
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
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "Error";
    console.error("[api/og-mint/sign] Error:", name, message, error);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        success: false,
        error: isDev ? `Internal server error: ${name} - ${message}` : "Internal server error",
      },
      { status: 500 }
    );
  }
}
