import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { ROOK_CONFIG } from '@/constants/rook';

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

    console.log('🔍 Verificando conexiones de Rook para usuario:', fid);

    // Crear el Basic Auth token para la verificación en Rook
    const authToken = Buffer.from(`${process.env.ROOK_CLIENT_UUID}:${process.env.ROOK_CLIENT_SECRET}`).toString('base64');

    // Llamar a la API de Rook para verificar conexiones
    console.log('🔑 Intentando conexión con Rook API:', {
      url: `${ROOK_CONFIG.API_URL}/api/v1/user_id/${fid}/data_sources/authorized`,
      clientUuid: process.env.ROOK_CLIENT_UUID?.substring(0, 5) + '...',
      hasSecret: !!process.env.ROOK_CLIENT_SECRET
    });

    const response = await fetch(
      `${ROOK_CONFIG.API_URL}/api/v1/user_id/${fid}/data_sources/authorized`,
      {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error detallado al verificar conexiones:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      return NextResponse.json(
        { error: 'Error checking Rook connections', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Conexiones verificadas en Rook:', data);

    // Verificar si hay algún dispositivo conectado
    const connectedDevices = Object.entries(data.sources)
      .filter(([, isConnected]) => isConnected)
      .map(([device]) => device);

    if (connectedDevices.length > 0) {
      console.log('📱 Dispositivos conectados:', connectedDevices);

      // Actualizar whitelist_users
      await sql`
        UPDATE whitelist_users 
        SET 
          connected_provider = 'rook',
          updated_at = CURRENT_TIMESTAMP 
        WHERE user_fid = ${fid}
      `;

      // Actualizar o insertar en rook_connection
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
          ${fid},
          ${fid},
          'active',
          ${JSON.stringify(connectedDevices)}::jsonb,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_fid) DO UPDATE SET
          connection_status = 'active',
          data_sources = ${JSON.stringify(connectedDevices)}::jsonb,
          updated_at = CURRENT_TIMESTAMP,
          last_sync_at = CURRENT_TIMESTAMP
      `;

      // Devolver la información actualizada
      return NextResponse.json({
        provider: 'rook',
        rook_user_id: fid,
        connection_status: 'active',
        data_sources: connectedDevices,
        rook_authorized_sources: data.sources
      });
    }

    // Si no hay dispositivos conectados, devolver estado sin conexión
    return NextResponse.json({ 
      provider: null,
      rook_user_id: null,
      connection_status: 'inactive',
      rook_authorized_sources: data.sources
    });

  } catch (error) {
    console.error('❌ Error en verificación de conexiones:', error);
    return NextResponse.json(
      { error: 'Error checking connections' },
      { status: 500 }
    );
  }
} 