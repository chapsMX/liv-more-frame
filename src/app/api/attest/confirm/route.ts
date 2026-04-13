import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * Delegated attestation — Step 2: Frontend confirms the on-chain attestation UID.
 * Persists the UID in 2026_daily_steps.
 */
export async function POST(req: NextRequest) {
  const { stepId, attestationUID } = await req.json();

  if (!stepId || !attestationUID) {
    return NextResponse.json(
      { error: "stepId y attestationUID son requeridos" },
      { status: 400 }
    );
  }

  if (typeof attestationUID !== "string" || !attestationUID.startsWith("0x")) {
    return NextResponse.json(
      { error: "attestationUID inválido" },
      { status: 400 }
    );
  }

  const existing = await sql`
    SELECT id, attestation_hash FROM "2026_daily_steps" WHERE id = ${stepId} LIMIT 1
  `;

  if (!existing[0]) {
    return NextResponse.json(
      { error: "Registro de pasos no encontrado" },
      { status: 404 }
    );
  }

  if (existing[0].attestation_hash) {
    return NextResponse.json(
      { error: "Este día ya fue atestado" },
      { status: 409 }
    );
  }

  await sql`
    UPDATE "2026_daily_steps"
    SET
      attestation_hash = ${attestationUID},
      attested_at      = now()
    WHERE id = ${stepId}
  `;

  console.log(
    `[attest/confirm] Stored attestation ${attestationUID} for stepId ${stepId}`
  );

  return NextResponse.json({ ok: true, attestationUID });
}
