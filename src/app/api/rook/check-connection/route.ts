import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    // Extraer el user_fid del query parameter
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ success: false, error: 'user_fid es requerido' }, { status: 400 });
    }

    console.log(`[API Rook Check] Verificando conexión para user_fid: ${user_fid}`);

    // Verificar si existe una conexión con Rook en la tabla user_connections
    const result = await sql`
      SELECT id, rook_user_id, provider, rook_token
      FROM user_connections
      WHERE user_fid = ${user_fid}
      LIMIT 1
    `;

    const connected = result.length > 0 && result[0].rook_user_id;
    const rookUserId = connected ? result[0].rook_user_id : null;
    const provider = connected ? result[0].provider : null;
    const hasToken = connected && result[0].rook_token ? true : false;

    console.log(`[API Rook Check] Usuario ${user_fid}: ${connected ? 'conectado' : 'no conectado'} a Rook`);
    
    if (connected) {
      console.log(`[API Rook Check] rook_user_id: ${rookUserId}, provider: ${provider}`);
      
      // También actualizamos la tabla whitelist_users para que sepa que el proveedor conectado es Rook
      await sql`
        UPDATE whitelist_users
        SET connected_provider = ${provider || 'rook'}
        WHERE user_fid = ${user_fid}
      `;
    }

    return NextResponse.json({
      success: true,
      connected,
      rook_user_id: rookUserId,
      provider,
      has_token: hasToken
    });
  } catch (error) {
    console.error('[API Rook Check] Error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
} 