import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    console.log('FID recibido:', fid); // Log para depuración
    
    if (!fid) {
      console.log('No se encontró FID en la URL'); // Log para depuración
      return NextResponse.json({
        isWhitelisted: false,
        canUse: false
      });
    }

    const fidNumber = parseInt(fid);
    if (isNaN(fidNumber)) {
      console.log('FID no es un número válido:', fid); // Log para depuración
      return NextResponse.json({
        isWhitelisted: false,
        canUse: false
      });
    }

    console.log('Consultando base de datos con FID:', fidNumber); // Log para depuración
    
    const result = await sql`
      SELECT is_whitelisted, can_use 
      FROM whitelist_users 
      WHERE user_fid = ${fidNumber}
    `;

    console.log('Resultado de la consulta:', result); // Log para depuración

    if (result.length === 0) {
      return NextResponse.json({
        isWhitelisted: false,
        canUse: false
      });
    }

    return NextResponse.json({
      isWhitelisted: result[0].is_whitelisted,
      canUse: result[0].can_use
    });
  } catch (error) {
    console.error('Error checking whitelist status:', error);
    return NextResponse.json(
      { error: 'Error al verificar el estado de whitelist' },
      { status: 500 }
    );
  }
} 