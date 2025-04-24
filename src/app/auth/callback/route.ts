import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { OAuth2Client } from 'google-auth-library';

const sql = neon(process.env.DATABASE_URL!);

// Asegurarnos de que tenemos todas las variables de entorno necesarias
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Faltan variables de entorno necesarias para Google OAuth');
}

const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI
});

export async function GET(request: Request) {
  try {
    console.log('=== Iniciando proceso de guardado de tokens (GET) ===');
    console.log('URL completa:', request.url);
    
    // Obtener el código y el estado (user_fid) de la URL
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const userFid = url.searchParams.get('state'); // Obtener user_fid del estado

    console.log('Datos recibidos:', {
      code: code ? 'Presente' : 'Ausente',
      userFid,
      userFidTipo: typeof userFid
    });

    if (!code || !userFid) {
      console.error('Faltan datos requeridos:', { code: !!code, userFid: !!userFid });
      return NextResponse.json({ 
        success: false, 
        error: 'Faltan datos requeridos' 
      }, { status: 400 });
    }

    // Convertir userFid a número y validar
    const userFidNumber = parseInt(userFid);
    if (isNaN(userFidNumber)) {
      console.error('userFid no es un número válido:', userFid);
      return NextResponse.json({
        success: false,
        error: 'ID de usuario inválido'
      }, { status: 400 });
    }

    // 1. Verificar que el usuario existe en whitelist
    console.log('Verificando usuario en whitelist...', { userFidNumber });
    const whitelistCheck = await sql`
      SELECT user_fid FROM whitelist_users WHERE user_fid = ${userFidNumber}
    `;
    console.log('Resultado whitelist:', whitelistCheck);

    if (whitelistCheck.length === 0) {
      console.error('Usuario no encontrado en whitelist');
      return NextResponse.json({ 
        success: false, 
        error: 'Usuario no autorizado' 
      }, { status: 403 });
    }

    // 2. Obtener tokens de Google
    console.log('Obteniendo tokens de Google...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens recibidos:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });

    if (!tokens.access_token) {
      console.error('No se recibió access_token');
      return NextResponse.json({ 
        success: false, 
        error: 'No se recibieron tokens válidos' 
      }, { status: 400 });
    }

    // 3. Guardar en la base de datos
    console.log('Guardando tokens en la base de datos...');
    await sql`
      INSERT INTO user_connections (
        user_fid,
        provider,
        google_token,
        refresh_token,
        token_expiry
      ) VALUES (
        ${userFidNumber},
        'google',
        ${tokens.access_token},
        ${tokens.refresh_token},
        ${new Date(tokens.expiry_date!)}
      )
      ON CONFLICT (user_fid, provider) 
      DO UPDATE SET
        google_token = EXCLUDED.google_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expiry = EXCLUDED.token_expiry,
        updated_at = CURRENT_TIMESTAMP
    `;

    // 4. Devolver una página HTML que cierre la ventana y refresque la aplicación principal
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Fit Connection</title>
          <script>
            window.onload = function() {
              // Notificar a la ventana principal que debe refrescarse
              if (window.opener) {
                window.opener.postMessage('refresh', '*');
              }
              
              // Cerrar la ventana actual
              window.close();
              
              // Si la ventana no se cierra (por ejemplo, en Safari), redirigir a la aplicación principal
              setTimeout(function() {
                window.location.href = '${process.env.NEXT_PUBLIC_URL}';
              }, 1000);
            }
          </script>
        </head>
        <body>
          <div style="text-align: center; margin-top: 50px;">
            <h2>Google Fit connection successful!</h2>
            <p>You can close this window and return to the application.</p>
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
    console.error('Error en el callback de Google:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar la autenticación' },
      { status: 500 }
    );
  }
}

// Mantener el método POST para compatibilidad
export async function POST(request: Request) {
  return GET(request);
} 