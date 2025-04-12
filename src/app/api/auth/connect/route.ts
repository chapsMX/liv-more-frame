import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { google } from 'googleapis';
import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid is required' }, { status: 400 });
    }

    // Generar un estado único para la solicitud
    const state = crypto.randomBytes(32).toString('hex');

    // Configurar el cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Generar la URL de autorización
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: process.env.GOOGLE_OAUTH_SCOPES?.split(' '),
      state: state,
      prompt: 'consent'
    });

    // Guardar el estado en la base de datos
    await sql`
      INSERT INTO user_connections (user_fid, provider, created_at, updated_at)
      VALUES (${user_fid}, 'google', NOW(), NOW())
      ON CONFLICT (user_fid, provider) 
      DO UPDATE SET updated_at = NOW()
    `;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error initiating Google auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google authentication' },
      { status: 500 }
    );
  }
} 