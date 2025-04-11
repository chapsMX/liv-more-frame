import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { OAuth2Client } from 'google-auth-library';

const sql = neon(process.env.DATABASE_URL!);

// Asegurarnos de que tenemos todas las variables de entorno necesarias
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
  throw new Error('Faltan variables de entorno necesarias para Google OAuth');
}

const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI
});

export async function POST(request: Request) {
  try {
    console.log('=== Iniciando proceso de guardado de tokens ===');
    console.log('Usando redirect URI:', process.env.GOOGLE_REDIRECT_URI);
    
    const { code } = await request.json();
    const userFid = request.headers.get('x-user-fid');

    console.log('Headers recibidos:', Object.fromEntries(request.headers.entries()));
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
    try {
      const result = await sql`
        INSERT INTO user_connections 
          (user_fid, google_token, token_expiry, updated_at)
        VALUES 
          (${userFidNumber}, 
           ${tokens.access_token}, 
           ${tokens.expiry_date ? new Date(tokens.expiry_date) : null}, 
           ${new Date()})
        ON CONFLICT (user_fid) 
        DO UPDATE SET 
          google_token = EXCLUDED.google_token,
          token_expiry = EXCLUDED.token_expiry,
          updated_at = EXCLUDED.updated_at
        RETURNING id, user_fid, updated_at
      `;
      
      console.log('Resultado de la inserción:', {
        id: result[0]?.id,
        user_fid: result[0]?.user_fid,
        updated_at: result[0]?.updated_at
      });

      // 4. Verificar que se guardó correctamente
      const savedConnection = await sql`
        SELECT 
          id, 
          user_fid, 
          token_expiry, 
          updated_at,
          google_token IS NOT NULL as has_token
        FROM user_connections 
        WHERE user_fid = ${userFidNumber}
      `;
      
      console.log('Verificación de guardado:', savedConnection.map(conn => ({
        id: conn.id,
        user_fid: conn.user_fid,
        has_token: conn.has_token,
        token_expiry: conn.token_expiry,
        updated_at: conn.updated_at
      })));

      return NextResponse.json({ 
        success: true,
        message: 'Tokens guardados correctamente',
        data: {
          user_fid: userFidNumber,
          updated_at: result[0]?.updated_at
        }
      });

    } catch (dbError) {
      console.error('Error al guardar en la base de datos:', dbError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al guardar la conexión',
        details: dbError instanceof Error ? dbError.message : 'Error desconocido'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error general en el callback:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al procesar la autenticación',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 