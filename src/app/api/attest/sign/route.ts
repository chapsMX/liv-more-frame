import { NextRequest, NextResponse } from "next/server";
import { EAS, SchemaEncoder, Delegated } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { sql } from "@/lib/db";

const EAS_CONTRACT = "0x4200000000000000000000000000000000000021";
const SCHEMA_UID =
  "0x10f5a99897da1b3498e634a2d6d33699be16eef4cfbea167a6d502c9d12729d8";
const BASE_RPC = "https://mainnet.base.org";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Delegated attestation — Step 1: Server signs EIP-712 (no gas).
 * Returns the signature + message so the frontend can submit the tx.
 */
export async function POST(req: NextRequest) {
  const { userId, date, walletAddress } = await req.json();

  if (!userId || !date || !walletAddress) {
    return NextResponse.json(
      { error: "userId, date y walletAddress son requeridos" },
      { status: 400 }
    );
  }

  if (!ethers.isAddress(walletAddress)) {
    return NextResponse.json(
      { error: "walletAddress inválido" },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().split("T")[0];
  if (date >= today) {
    return NextResponse.json(
      { error: "No puedes atestar el día actual o días futuros" },
      { status: 400 }
    );
  }

  const rows = await sql`
    SELECT
      ds.id,
      ds.steps,
      ds.attestation_hash,
      u.fid,
      u.username,
      u.eth_address
    FROM "2026_daily_steps" ds
    JOIN "2026_users" u ON u.id = ds.user_id
    WHERE ds.user_id = ${userId}
      AND ds.date    = ${date}
    LIMIT 1
  `;

  if (!rows[0]) {
    return NextResponse.json(
      { error: "No hay pasos registrados para ese día" },
      { status: 404 }
    );
  }

  const row = rows[0];

  if (row.attestation_hash) {
    return NextResponse.json(
      { error: "Este día ya fue atestado", attestationUID: row.attestation_hash },
      { status: 409 }
    );
  }

  const providerRow = await sql`
    SELECT provider
    FROM "2026_provider_connections"
    WHERE user_id = ${userId}
      AND disconnected_at IS NULL
    LIMIT 1
  `;
  const provider = (providerRow[0]?.provider as string) ?? "unknown";

  const privateKey = process.env.EAS_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("[attest/sign] Missing EAS_SIGNER_PRIVATE_KEY");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const rpcProvider = new ethers.JsonRpcProvider(BASE_RPC);
  const signer = new ethers.Wallet(privateKey, rpcProvider);
  const attesterAddress = await signer.getAddress();

  const eas = new EAS(EAS_CONTRACT);
  eas.connect(signer);

  // Encode the schema data
  const schemaEncoder = new SchemaEncoder(
    "string title, string description, uint64 fid, string username, uint32 steps, string provider, string date"
  );

  const encodedData = schemaEncoder.encodeData([
    { name: "title", value: "Daily Steps", type: "string" },
    { name: "description", value: `${row.steps} steps on ${date}`, type: "string" },
    { name: "fid", value: BigInt(row.fid), type: "uint64" },
    { name: "username", value: (row.username as string) ?? "", type: "string" },
    { name: "steps", value: row.steps as number, type: "uint32" },
    { name: "provider", value: provider, type: "string" },
    { name: "date", value: date, type: "string" },
  ]);

  const recipient = walletAddress as string;

  try {
    console.log("[attest/sign] Attester address:", attesterAddress);
    console.log("[attest/sign] Recipient:", recipient);

    const version = await eas.getVersion();
    console.log("[attest/sign] EAS contract version:", version);

    const delegated = new Delegated(
      { address: EAS_CONTRACT, chainId: BigInt(8453), version },
      eas
    );

    const response = await delegated.signDelegatedAttestation(
      {
        schema: SCHEMA_UID,
        recipient,
        expirationTime: BigInt(0),
        revocable: true,
        refUID: ZERO_BYTES32,
        data: encodedData,
        value: BigInt(0),
        deadline: BigInt(0),
      },
      signer
    );

    console.log(
      `[attest/sign] Signed delegated attestation for user ${userId} on ${date} (${row.steps} steps)`
    );

    console.log("[attest/sign] response.message keys:", Object.keys(response.message));

    // Serialize BigInt values for JSON transport (some may be undefined depending on EAS version)
    const msg = response.message;
    const message = {
      recipient: msg.recipient,
      expirationTime: (msg.expirationTime ?? BigInt(0)).toString(),
      revocable: msg.revocable,
      refUID: msg.refUID,
      data: msg.data,
      value: (msg.value ?? BigInt(0)).toString(),
      nonce: (msg.nonce ?? BigInt(0)).toString(),
      deadline: (msg.deadline ?? BigInt(0)).toString(),
    };

    return NextResponse.json({
      ok: true,
      signature: response.signature,
      message,
      attester: attesterAddress,
      schema: SCHEMA_UID,
      stepId: row.id,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const errStack = e instanceof Error ? e.stack : undefined;
    console.error("[attest/sign] Signing failed:", errMsg);
    if (errStack) console.error("[attest/sign] Stack:", errStack);
    return NextResponse.json(
      { error: "Failed to sign attestation", detail: errMsg },
      { status: 500 }
    );
  }
}
