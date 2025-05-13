import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: Request) {
  try {
    console.log('🔍 Iniciando verificación de estado de usuario');
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    console.log('📋 FID recibido:', fid);

    if (!fid) {
      console.warn('⚠️ Error: FID no proporcionado en la solicitud');
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    
    console.log('🔄 Consultando estado del usuario en whitelist_users...');
    // Consultar estado del usuario
    const result = await sql`
      SELECT 
        is_whitelisted,
        accepted_tos,
        accepted_privacy_policy,
        can_use,
        username,
        display_name,
        eth_address
      FROM whitelist_users 
      WHERE user_fid = ${fid}
    `;

    if (result.length === 0) {
      console.log('ℹ️ Usuario no encontrado en whitelist_users');
      return NextResponse.json({
        isWhitelisted: false,
        acceptedTos: false,
        acceptedPrivacyPolicy: false,
        canUse: false
      });
    }

    const user = result[0];
    console.log('✅ Estado del usuario recuperado:', {
      isWhitelisted: user.is_whitelisted,
      acceptedTos: user.accepted_tos,
      acceptedPrivacyPolicy: user.accepted_privacy_policy,
      canUse: user.can_use,
      username: user.username
    });

    return NextResponse.json({
      isWhitelisted: user.is_whitelisted,
      acceptedTos: user.accepted_tos,
      acceptedPrivacyPolicy: user.accepted_privacy_policy,
      canUse: user.can_use,
      username: user.username,
      displayName: user.display_name,
      ethAddress: user.eth_address
    });

  } catch (error) {
    console.error('❌ Error verificando estado del usuario:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 