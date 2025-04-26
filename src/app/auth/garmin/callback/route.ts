import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { generateOAuthSignature } from '../connect/route';
import { GARMIN_CONFIG } from '@/lib/garmin-config';
import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

interface TokenResult {
  oauth_token_secret: string;
  state: string;
  user_fid: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const oauth_token = searchParams.get('oauth_token');
    const oauth_verifier = searchParams.get('oauth_verifier');

    if (!oauth_token || !oauth_verifier) {
      throw new Error('oauth_token y oauth_verifier son requeridos');
    }

    // Obtener el token secret y user_fid almacenados
    const tokenResult = (await sql`
      SELECT oauth_token_secret, state, user_fid
      FROM user_connections_garmin 
      WHERE oauth_token = ${oauth_token}
    `) as TokenResult[];

    if (tokenResult.length === 0) {
      throw new Error('Token no encontrado');
    }

    const { oauth_token_secret, state, user_fid } = tokenResult[0];

    // Generar parámetros OAuth para solicitar el token de acceso
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const params = {
      oauth_consumer_key: GARMIN_CONFIG.CONSUMER_KEY,
      oauth_token: oauth_token,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      oauth_verifier: oauth_verifier
    };

    const signature = generateOAuthSignature(
      'POST',
      GARMIN_CONFIG.ACCESS_TOKEN_URL,
      params,
      oauth_token_secret
    );

    const authHeader = 'OAuth ' + Object.entries({
      ...params,
      oauth_signature: signature
    })
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .join(', ');

    // Solicitar el token de acceso
    const response = await fetch(GARMIN_CONFIG.ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader
      }
    });

    if (!response.ok) {
      throw new Error('Error al obtener el token de acceso');
    }

    const data = await response.text();
    const accessTokenParams = new URLSearchParams(data);
    const accessToken = accessTokenParams.get('oauth_token');
    const accessTokenSecret = accessTokenParams.get('oauth_token_secret');

    if (!accessToken || !accessTokenSecret) {
      throw new Error('No se recibieron los tokens de acceso');
    }

    // Establecer fecha de expiración a 1 año
    const tokenExpiry = new Date();
    tokenExpiry.setFullYear(tokenExpiry.getFullYear() + 1);

    // Actualizar los tokens en la base de datos
    await sql`
      UPDATE user_connections_garmin 
      SET access_token = ${accessToken},
          refresh_token = ${accessTokenSecret},
          token_expiry = ${tokenExpiry},
          updated_at = NOW()
      WHERE oauth_token = ${oauth_token}
    `;

    // Redirigir al usuario a la página principal con un mensaje de éxito y script de recarga
    const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_URL}`);
    redirectUrl.searchParams.set('status', 'success');
    redirectUrl.searchParams.set('provider', 'garmin');
    redirectUrl.searchParams.set('reload', 'true');
    return NextResponse.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('Error en el callback de Garmin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}?status=error&provider=garmin&message=${encodeURIComponent(errorMessage)}`
    );
  }
} 