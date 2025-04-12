import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { user_fid } = await request.json();

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid es requerido' }, { status: 400 });
    }

    // Eliminar la conexión de Google
    await sql`
      DELETE FROM user_connections 
      WHERE user_fid = ${user_fid} AND provider = 'google'
    `;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error al desconectar Google Fit:', error);
    return NextResponse.json(
      { error: 'Error al desconectar Google Fit' },
      { status: 500 }
    );
  }
} 