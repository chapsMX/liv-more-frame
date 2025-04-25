import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { GARMIN_CONFIG } from '@/lib/garmin-config';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const oauth_token = searchParams.get('oauth_token');
    const oauth_verifier = searchParams.get('oauth_verifier');
    const state = searchParams.get('state');

    if (!oauth_token || !oauth_verifier || !state) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    // Verificar el estado para prevenir CSRF
    const connection = await sql`
      SELECT user_fid FROM user_connections 
      WHERE state = ${state} AND provider = 'garmin'
    `;

    if (!connection[0]?.user_fid) {
      return NextResponse.json(
        { error: 'Estado inválido' },
        { status: 400 }
      );
    }

    const user_fid = connection[0].user_fid;

    // Intercambiar el token por tokens de acceso
    const tokenResponse = await fetch(GARMIN_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        oauth_token,
        oauth_verifier,
        oauth_consumer_key: GARMIN_CONFIG.CONSUMER_KEY,
        oauth_consumer_secret: GARMIN_CONFIG.CONSUMER_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Error al obtener tokens de acceso');
    }

    const tokens = await tokenResponse.json();

    // Guardar los tokens en la base de datos
    await sql`
      UPDATE user_connections
      SET 
        refresh_token = ${tokens.oauth_token_secret},
        token_expiry = NOW() + INTERVAL '1 year',
        state = NULL,
        updated_at = NOW()
      WHERE user_fid = ${user_fid} AND provider = 'garmin'
    `;

    // Devolver una página HTML que cierre la ventana y refresque la aplicación principal
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Garmin Connection</title>
          <script>
            window.onload = function() {
              if (window.opener) {
                window.opener.postMessage('refresh', '*');
                window.close();
              } else {
                window.location.href = '${process.env.NEXT_PUBLIC_URL}/dashboard';
              }
            }
          </script>
        </head>
        <body>
          <div style="text-align: center; margin-top: 50px; font-family: system-ui, -apple-system, sans-serif;">
            <h2 style="color: #4CAF50;">¡Conexión exitosa!</h2>
            <p>Puedes cerrar esta ventana y volver a la aplicación.</p>
            <button onclick="window.close()" style="
              background-color: #4CAF50;
              border: none;
              color: white;
              padding: 15px 32px;
              text-align: center;
              text-decoration: none;
              display: inline-block;
              font-size: 16px;
              margin: 4px 2px;
              cursor: pointer;
              border-radius: 4px;
            ">Cerrar ventana</button>
          </div>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Error en el callback de Garmin:', error);
    return NextResponse.json(
      { error: 'Error al procesar la autenticación' },
      { status: 500 }
    );
  }
} 