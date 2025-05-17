import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'Missing user FID' },
        { status: 400 }
      );
    }

    console.log('🔍 Verificando conexión del usuario:', fid);

    // Consultar el estado de conexión en whitelist_users
    const result = await sql`
      SELECT connected_provider
      FROM whitelist_users
      WHERE user_fid = ${fid}
    `;

    if (result.length === 0) {
      console.log('❌ Usuario no encontrado:', fid);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const connectedProvider = result[0].connected_provider;
    console.log('✅ Estado de conexión recuperado:', {
      fid,
      connectedProvider: connectedProvider || null
    });

    return NextResponse.json({
      connectedProvider: connectedProvider || null
    });

  } catch (error) {
    console.error('❌ Error verificando conexión:', error);
    return NextResponse.json(
      { error: 'Error checking connection status' },
      { status: 500 }
    );
  }
} 