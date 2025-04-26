import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { GARMIN_CONFIG } from '@/lib/garmin-config';
import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

export function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  tokenSecret: string = ''
): string {
  // Ordenar los parámetros alfabéticamente
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc: Record<string, string>, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  // Crear la cadena base
  const paramString = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString)
  ].join('&');

  // Crear la clave de firma
  const signingKey = `${encodeURIComponent(GARMIN_CONFIG.CONSUMER_SECRET)}&${encodeURIComponent(tokenSecret)}`;

  // Generar la firma
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  return signature;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      throw new Error('user_fid es requerido');
    }

    // Generar estado aleatorio para prevenir CSRF
    const state = crypto.randomBytes(32).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    // Parámetros OAuth para la solicitud del token temporal
    const params = {
      oauth_consumer_key: GARMIN_CONFIG.CONSUMER_KEY,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      oauth_callback: GARMIN_CONFIG.CALLBACK_URL
    };

    // Generar firma OAuth
    const signature = generateOAuthSignature(
      'POST',
      GARMIN_CONFIG.REQUEST_TOKEN_URL,
      params
    );

    // Construir el encabezado de autorización
    const authHeader = 'OAuth ' + Object.entries({
      ...params,
      oauth_signature: signature
    })
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .join(', ');

    // Solicitar el token temporal
    const response = await fetch(GARMIN_CONFIG.REQUEST_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader
      }
    });

    if (!response.ok) {
      throw new Error('Error al obtener el token temporal');
    }

    const data = await response.text();
    const tokenParams = new URLSearchParams(data);
    const oauth_token = tokenParams.get('oauth_token');
    const oauth_token_secret = tokenParams.get('oauth_token_secret');

    if (!oauth_token || !oauth_token_secret) {
      throw new Error('No se recibieron los tokens temporales');
    }

    // Guardar el token temporal y el estado en la base de datos
    await sql`
      INSERT INTO user_connections_garmin (
        user_fid,
        oauth_token,
        oauth_token_secret,
        state,
        created_at,
        updated_at
      ) VALUES (
        ${parseInt(user_fid)},
        ${oauth_token},
        ${oauth_token_secret},
        ${state},
        NOW(),
        NOW()
      )
      ON CONFLICT (user_fid) 
      DO UPDATE SET 
        oauth_token = ${oauth_token},
        oauth_token_secret = ${oauth_token_secret},
        state = ${state},
        updated_at = NOW()
    `;

    // Devolver la URL de autorización en formato JSON
    const authUrl = `${GARMIN_CONFIG.AUTHORIZE_URL}?oauth_token=${oauth_token}`;
    return NextResponse.json({ url: authUrl });

  } catch (error) {
    console.error('Error en la conexión con Garmin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 