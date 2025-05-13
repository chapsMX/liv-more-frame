import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(request: Request) {
  try {
    console.log('👤 Iniciando proceso de agregar usuario a whitelist');
    const sql = neon(process.env.DATABASE_URL!);
    const { user_fid, username, eth_address, display_name } = await request.json();

    console.log('📋 Datos del usuario:', {
      user_fid,
      username,
      eth_address,
      display_name
    });

    if (!user_fid || !username || !eth_address) {
      console.warn('⚠️ Error: Faltan campos requeridos', {
        user_fid: !!user_fid,
        username: !!username,
        eth_address: !!eth_address
      });
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    console.log('🔄 Insertando/Actualizando usuario en whitelist_users...');
    // Insertar en la base de datos
    await sql`
      INSERT INTO whitelist_users (
        user_fid, 
        username, 
        eth_address, 
        display_name, 
        is_whitelisted,
        accepted_tos,
        accepted_privacy_policy,
        can_use,
        can_create,
        updated_at
      ) VALUES (
        ${user_fid}, 
        ${username}, 
        ${eth_address}, 
        ${display_name}, 
        true,
        false,
        false,
        false,
        false,
        NOW()
      )
      ON CONFLICT (user_fid) 
      DO UPDATE SET 
        is_whitelisted = true,
        username = EXCLUDED.username,
        eth_address = EXCLUDED.eth_address,
        display_name = EXCLUDED.display_name,
        updated_at = NOW()
    `;

    console.log('✅ Usuario agregado/actualizado exitosamente en whitelist');
    return NextResponse.json({ 
      success: true,
      message: 'User added to whitelist successfully' 
    });

  } catch (error) {
    console.error('❌ Error agregando usuario a whitelist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 