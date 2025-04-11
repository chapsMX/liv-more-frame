import { NextResponse } from 'next/server';
import { getTokens } from '@/services/google/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}?error=${error}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}?error=no_code`
      );
    }

    // Obtener tokens de Google
    const tokens = await getTokens(code);

    // Guardar tokens en la base de datos
    // Asumimos que el state contiene el user_fid
    if (state) {
      await sql`
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
      `;
    }

    // Redirigir al usuario de vuelta a la aplicación
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}?success=true`
    );
  } catch (error) {
    console.error('Error in Google callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}?error=callback_failed`
    );
  }
} 