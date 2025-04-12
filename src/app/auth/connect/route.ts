import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

// Asegurarnos de que tenemos todas las variables de entorno necesarias
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
  throw new Error('Faltan variables de entorno necesarias para Google OAuth');
}

const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid es requerido' }, { status: 400 });
    }

    const scopes = [
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.sleep.read'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: user_fid,
      prompt: 'consent'
    });

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error al generar URL de autorización:', error);
    return NextResponse.json(
      { error: 'Error al obtener la URL de autorización' },
      { status: 500 }
    );
  }
} 