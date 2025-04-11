import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { userFid } = await request.json();
    
    console.log('Desconectando usuario FID:', userFid);
    
    if (!userFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'No se proporcionó FID de usuario' 
      }, { status: 400 });
    }

    // Primero, obtener el registro actual
    const currentConnection = await sql`
      SELECT id, user_fid, google_token, refresh_token, token_expiry
      FROM user_connections 
      WHERE user_fid = ${parseInt(userFid)}
    `;

    if (currentConnection.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No se encontró la conexión del usuario' 
      }, { status: 404 });
    }

    // Actualizar la base de datos para eliminar los tokens
    const result = await sql`
      UPDATE user_connections 
      SET google_token = NULL,
          refresh_token = NULL,
          token_expiry = NULL,
          updated_at = ${new Date()}
      WHERE user_fid = ${parseInt(userFid)}
      RETURNING id, user_fid, updated_at
    `;

    console.log('Resultado de desconexión:', {
      success: result.length > 0,
      user_fid: result[0]?.user_fid,
      updated_at: result[0]?.updated_at
    });

    return NextResponse.json({
      success: true,
      message: 'Conexión revocada exitosamente'
    });

  } catch (error) {
    console.error('Error al desconectar:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Error al revocar la conexión',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 