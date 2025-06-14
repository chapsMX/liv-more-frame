import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'Missing user FID' },
        { status: 400 }
      );
    }

    console.log('🔍 Buscando rook_user_id para usuario:', fid);

    // Obtener el rook_user_id de la tabla rook_connection
    const result = await sql`
      SELECT rook_user_id, connection_status
      FROM rook_connection
      WHERE user_fid = ${fid}
      AND connection_status = 'active'
      LIMIT 1
    `;

    if (result.length === 0) {
      console.log('⚠️ No se encontró conexión activa de Rook para el usuario:', fid);
      return NextResponse.json(
        { error: 'No active Rook connection found' },
        { status: 404 }
      );
    }

    console.log('✅ rook_user_id encontrado:', result[0].rook_user_id);

    return NextResponse.json({
      rook_user_id: result[0].rook_user_id,
      connection_status: result[0].connection_status
    });

  } catch (error) {
    console.error('❌ Error obteniendo rook_user_id:', error);
    return NextResponse.json(
      { error: 'Error fetching Rook user ID' },
      { status: 500 }
    );
  }
} 