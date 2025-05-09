import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    // Obtener datos del cuerpo de la petición
    const data = await request.json();
    const { user_fid, rook_user_id } = data;

    if (!user_fid || !rook_user_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_fid y rook_user_id son requeridos' 
      }, { status: 400 });
    }

    console.log(`[API Rook Save] Guardando conexión para user_fid: ${user_fid}, rook_user_id: ${rook_user_id}`);

    // Verificar si ya existe una conexión para este usuario
    const existingConnection = await sql`
      SELECT id FROM user_connections
      WHERE user_fid = ${user_fid}
      LIMIT 1
    `;

    if (existingConnection.length > 0) {
      // Actualizar la conexión existente
      await sql`
        UPDATE user_connections
        SET 
          rook_user_id = ${rook_user_id},
          provider = 'rook',
          updated_at = CURRENT_TIMESTAMP
        WHERE user_fid = ${user_fid}
      `;
      console.log(`[API Rook Save] Conexión actualizada para user_fid: ${user_fid}`);
    } else {
      // Crear una nueva conexión
      await sql`
        INSERT INTO user_connections
          (user_fid, rook_user_id, provider, created_at, updated_at)
        VALUES
          (${user_fid}, ${rook_user_id}, 'rook', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      console.log(`[API Rook Save] Nueva conexión creada para user_fid: ${user_fid}`);
    }

    // Actualizar también el proveedor en whitelist_users
    await sql`
      UPDATE whitelist_users
      SET connected_provider = 'rook'
      WHERE user_fid = ${user_fid}
    `;

    return NextResponse.json({
      success: true,
      message: 'Conexión guardada correctamente'
    });
  } catch (error) {
    console.error('[API Rook Save] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 