import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { user_fid, provider, rook_user_id } = await request.json();

    if (!user_fid || !provider || !rook_user_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('💾 Guardando conexión Rook:', {
      user_fid,
      provider,
      rook_user_id
    });

    // 1. Actualizar whitelist_users con el provider
    const userUpdate = await sql`
      UPDATE whitelist_users 
      SET 
        connected_provider = 'rook',
        updated_at = CURRENT_TIMESTAMP 
      WHERE user_fid = ${user_fid}
      RETURNING *
    `;

    if (userUpdate.length === 0) {
      throw new Error('User not found');
    }

    // 2. Insertar o actualizar en rook_connection
    await sql`
      INSERT INTO rook_connection (
        user_fid,
        rook_user_id,
        connection_status,
        data_sources,
        created_at,
        updated_at,
        last_sync_at
      ) VALUES (
        ${user_fid},
        ${rook_user_id},
        'active',
        ${JSON.stringify([provider])}::jsonb,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_fid) DO UPDATE SET
        rook_user_id = ${rook_user_id},
        connection_status = 'active',
        data_sources = 
          CASE 
            WHEN rook_connection.data_sources ? ${provider} THEN rook_connection.data_sources
            ELSE rook_connection.data_sources || ${JSON.stringify([provider])}::jsonb
          END,
        updated_at = CURRENT_TIMESTAMP,
        last_sync_at = CURRENT_TIMESTAMP
    `;

    console.log('✅ Conexión guardada exitosamente');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error guardando conexión Rook:', error);
    return NextResponse.json(
      { error: 'Error saving connection' },
      { status: 500 }
    );
  }
} 