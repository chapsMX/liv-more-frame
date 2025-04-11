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
    console.log('=== Generando URL de autenticación ===');
    console.log('Usando redirect URI:', process.env.GOOGLE_REDIRECT_URI);
    
    // Obtener el FID del usuario
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('user_fid');
    
    console.log('FID recibido:', userFid);
    
    if (!userFid) {
      console.error('No se proporcionó FID de usuario');
      return NextResponse.json({ error: 'No user FID provided' }, { status: 400 });
    }

    // Generar la URL de autorización
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: process.env.GOOGLE_OAUTH_SCOPES?.split(' ') || [
        'https://www.googleapis.com/auth/fitness.activity.read',
        'https://www.googleapis.com/auth/fitness.heart_rate.read',
        'https://www.googleapis.com/auth/fitness.sleep.read'
      ],
      state: userFid, // Incluir el FID en el estado
      prompt: 'consent'
    });

    console.log('URL generada:', authUrl);

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generando URL de autenticación:', error);
    return NextResponse.json({ 
      error: 'Failed to generate auth URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 