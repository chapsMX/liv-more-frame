import { NextResponse } from 'next/server';
import { getTokens } from '@/services/google/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { code, state } = await request.json();
    console.log('Procesando callback de Google:', { state });

    if (!code) {
      console.error('No se recibió código de autorización');
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      );
    }

    // Obtener tokens de Google
    console.log('Obteniendo tokens de Google...');
    const tokens = await getTokens(code);
    console.log('Tokens obtenidos:', { 
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date 
    });

    // Guardar tokens en la base de datos
    if (state) {
      console.log('Guardando tokens en la base de datos para user_fid:', state);
      const result = await sql`
        INSERT INTO user_connections (
          user_fid,
          google_token,
          token_expiry
        ) VALUES (
          ${state},
          ${tokens.refresh_token},
          ${new Date(Date.now() + (tokens.expiry_date || 0))}
        )
        ON CONFLICT (user_fid) 
        DO UPDATE SET 
          google_token = ${tokens.refresh_token},
          token_expiry = ${new Date(Date.now() + (tokens.expiry_date || 0))},
          updated_at = CURRENT_TIMESTAMP
        RETURNING user_fid
      `;
      console.log('Tokens guardados exitosamente:', result);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en process-callback:', error);
    return NextResponse.json(
      { error: 'Failed to process authentication' },
      { status: 500 }
    );
  }
} 