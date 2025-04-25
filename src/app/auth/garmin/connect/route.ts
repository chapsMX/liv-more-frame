import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { GARMIN_CONFIG } from '@/lib/garmin-config';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid es requerido' }, { status: 400 });
    }

    // Generar un estado único para la solicitud
    const state = crypto.randomBytes(32).toString('hex');

    // Guardar el estado en la base de datos
    await sql`
      INSERT INTO user_connections (user_fid, provider, state, created_at, updated_at)
      VALUES (${user_fid}, 'garmin', ${state}, NOW(), NOW())
      ON CONFLICT (user_fid, provider) 
      DO UPDATE SET state = ${state}, updated_at = NOW()
    `;

    // Construir la URL de autorización
    const authUrl = new URL(GARMIN_CONFIG.AUTHORIZE_URL);
    authUrl.searchParams.append('oauth_callback', GARMIN_CONFIG.CALLBACK_URL);
    authUrl.searchParams.append('oauth_consumer_key', GARMIN_CONFIG.CONSUMER_KEY);
    authUrl.searchParams.append('oauth_nonce', crypto.randomBytes(16).toString('hex'));
    authUrl.searchParams.append('oauth_signature_method', 'HMAC-SHA1');
    authUrl.searchParams.append('oauth_timestamp', Math.floor(Date.now() / 1000).toString());
    authUrl.searchParams.append('oauth_version', '1.0');
    authUrl.searchParams.append('state', state);

    return NextResponse.json({ url: authUrl.toString() });
  } catch (error) {
    console.error('Error al iniciar autenticación con Garmin:', error);
    return NextResponse.json(
      { error: 'Error al iniciar autenticación con Garmin' },
      { status: 500 }
    );
  }
} 