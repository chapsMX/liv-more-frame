import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(request: Request) {
  try {
    console.log('📝 Iniciando actualización de estado legal');
    const sql = neon(process.env.DATABASE_URL!);
    const { user_fid, accepted_tos, accepted_privacy_policy } = await request.json();

    console.log('📋 Datos recibidos:', {
      user_fid,
      accepted_tos,
      accepted_privacy_policy
    });

    if (!user_fid) {
      console.warn('⚠️ Error: FID no proporcionado');
      return NextResponse.json({ success: false, error: 'User FID is required' }, { status: 400 });
    }

    console.log('🔄 Ejecutando actualización en whitelist_users...');
    const result = await sql`
      UPDATE whitelist_users 
      SET accepted_tos = ${accepted_tos}, accepted_privacy_policy = ${accepted_privacy_policy}, updated_at = NOW() 
      WHERE user_fid = ${user_fid} 
      RETURNING *
    `;

    if (!result || result.length === 0) {
      console.warn(`⚠️ Usuario no encontrado para FID: ${user_fid}`);
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    console.log('✅ Actualización exitosa:', result[0]);
    return NextResponse.json({ 
      success: true, 
      user: result[0]
    });
  } catch (error) {
    console.error('❌ Error actualizando estado legal del usuario:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 