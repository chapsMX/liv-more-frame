import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    
    console.log('FID recibido:', user_fid); // Log para depuración
    
    if (!user_fid) {
      console.log('No se encontró FID en la URL'); // Log para depuración
      return NextResponse.json({
        is_whitelisted: false,
        can_use: false,
        accepted_tos: false,
        accepted_privacy_policy: false
      });
    }

    const fidNumber = parseInt(user_fid);
    if (isNaN(fidNumber)) {
      console.log('FID no es un número válido:', user_fid); // Log para depuración
      return NextResponse.json({
        is_whitelisted: false,
        can_use: false,
        accepted_tos: false,
        accepted_privacy_policy: false
      });
    }

    console.log('Consultando base de datos con FID:', fidNumber); // Log para depuración
    
    const result = await sql`
      SELECT is_whitelisted, can_use, accepted_tos, accepted_privacy_policy 
      FROM whitelist_users 
      WHERE user_fid = ${fidNumber}
    `;

    console.log('Resultado de la consulta:', result); // Log para depuración

    if (result.length === 0) {
      return NextResponse.json({
        is_whitelisted: false,
        can_use: false,
        accepted_tos: false,
        accepted_privacy_policy: false
      });
    }

    // Devolver los campos exactamente como vienen de la base de datos
    return NextResponse.json({
      is_whitelisted: result[0].is_whitelisted,
      can_use: result[0].can_use,
      accepted_tos: result[0].accepted_tos,
      accepted_privacy_policy: result[0].accepted_privacy_policy
    });
  } catch (error) {
    console.error('Error checking whitelist status:', error);
    return NextResponse.json(
      { error: 'Error al verificar el estado de whitelist' },
      { status: 500 }
    );
  }
} 