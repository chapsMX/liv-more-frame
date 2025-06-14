import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Configuración de la conexión a Neon
const sql = neon(process.env.DATABASE_URL!);

// GET /api/attestations/[id]
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await params;
    const attestationId = parseInt(id);
    if (isNaN(attestationId)) {
      return NextResponse.json(
        { error: 'Invalid attestation ID' },
        { status: 400 }
      );
    }

    const attestation = await sql`
      SELECT 
        a.id,
        a.name,
        a.display_name,
        a.wallet,
        a.metric_type,
        a.goal_value,
        a.actual_value,
        a.timestamp,
        a.challenge_id,
        a.title,
        a.description,
        a.image_url,
        a.attestation_uid,
        a.created_at,
        a.user_fid,
        u.username,
        u.display_name as user_display_name
      FROM user_attestations a
      LEFT JOIN whitelist_users u ON a.user_fid = u.user_fid
      WHERE a.id = ${attestationId}
    `;

    if (!attestation || attestation.length === 0) {
      return NextResponse.json(
        { error: 'Attestation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ attestation: attestation[0] });
  } catch (error) {
    console.error('Error fetching attestation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 