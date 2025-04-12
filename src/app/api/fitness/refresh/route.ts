import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { google } from 'googleapis';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid es requerido' }, { status: 400 });
    }

    // Obtener el refresh token del usuario
    const connection = await sql`
      SELECT google_token, refresh_token, token_expiry 
      FROM user_connections 
      WHERE user_fid = ${user_fid} AND provider = 'google'
    `;

    if (!connection[0]) {
      return NextResponse.json({ error: 'Usuario no conectado a Google Fit' }, { status: 404 });
    }

    const { refresh_token } = connection[0];

    // Configurar el cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Refrescar el token
    await oauth2Client.refreshAccessToken(refresh_token);
    const { credentials } = oauth2Client;
    
    if (!credentials.access_token) {
      throw new Error('No se pudo refrescar el token');
    }

    // Actualizar los tokens en la base de datos
    await sql`
      UPDATE user_connections 
      SET 
        google_token = ${credentials.access_token},
        token_expiry = NOW() + INTERVAL '1 hour',
        updated_at = NOW()
      WHERE user_fid = ${user_fid} AND provider = 'google'
    `;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error al refrescar el token:', error);
    return NextResponse.json(
      { error: 'Error al refrescar el token' },
      { status: 500 }
    );
  }
} 