import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const ROOK_API_URL = 'https://api.rook-connect.review';
const ROOK_CLIENT_UUID = process.env.ROOK_CLIENT_UUID!;
const ROOK_CLIENT_SECRET = process.env.ROOK_CLIENT_SECRET!;

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { user_id, data_source } = await request.json();

    if (!user_id || !data_source) {
      return NextResponse.json(
        { error: 'Missing user_id or data_source' },
        { status: 400 }
      );
    }

    console.log('🔍 Revocando autorización de Rook:', { user_id, data_source });

    // Crear el Basic Auth token
    const authToken = Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_CLIENT_SECRET}`).toString('base64');

    // Llamar a la API de Rook
    const response = await fetch(
      `${ROOK_API_URL}/api/v1/user_id/${user_id}/data_sources/revoke_auth`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data_source }),
      }
    );

    if (!response.ok) {
      console.error('❌ Error al revocar autorización:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Error revoking authorization' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Autorización revocada:', data);

    // Actualizamos el estado en nuestra base de datos usando neon
    await sql`
      UPDATE whitelist_users 
      SET connected_provider = NULL 
      WHERE user_fid = ${user_id}
    `;

    console.log('✅ Base de datos actualizada para el usuario:', user_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error en revocación de autorización:', error);
    return NextResponse.json(
      { error: 'Error revoking authorization' },
      { status: 500 }
    );
  }
} 