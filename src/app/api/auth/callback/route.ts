import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json(
        { error: `Authorization failed: ${error}` },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verificar el estado para prevenir CSRF
    const connection = await sql`
      SELECT user_fid FROM user_connections 
      WHERE state = ${state}
    `;

    if (!connection[0]?.user_fid) {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    const user_fid = connection[0].user_fid;

    // Intercambiar el código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to exchange code for tokens' },
        { status: 400 }
      );
    }

    // Guardar los tokens en la base de datos
    await sql`
      UPDATE user_connections
      SET 
        google_token = ${tokens.access_token},
        refresh_token = ${tokens.refresh_token},
        token_expiry = NOW() + INTERVAL '${tokens.expires_in} seconds',
        state = NULL
      WHERE user_fid = ${user_fid}
    `;

    // Redirigir al usuario de vuelta a la aplicación
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard`);

  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 