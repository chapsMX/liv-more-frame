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

    // Actualizar la base de datos para eliminar el token
    const result = await sql`
      UPDATE user_connections 
      SET google_token = NULL, 
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