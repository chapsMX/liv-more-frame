import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);


export async function POST(request: Request) {
  try {
    const { user_fid, timezone } = await request.json();
    if (!user_fid || !timezone) {
      return NextResponse.json({ error: 'Missing user_fid or timezone' }, { status: 400 });
    }
    // Validación simple de zona horaria
    if (typeof timezone !== 'string' || timezone.length < 3 || timezone.length > 50) {
      return NextResponse.json({ error: 'Invalid timezone format' }, { status: 400 });
    }
    // (Opcional) Validar contra lista
    // if (!VALID_TIMEZONES.includes(timezone)) {
    //   return NextResponse.json({ error: 'Unsupported timezone' }, { status: 400 });
    // }
    // Verificar que el usuario existe
    const exists = await sql`SELECT id FROM user_goals WHERE user_fid = ${user_fid}`;
    if (exists.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // Actualizar zona horaria
    await sql`
      UPDATE user_goals
      SET timezone = ${timezone}, updated_at = CURRENT_TIMESTAMP
      WHERE user_fid = ${user_fid}
    `;
    return NextResponse.json({ success: true, timezone });
  } catch (error) {
    console.error('Error updating timezone:', error);
    return NextResponse.json({ error: 'Error updating timezone' }, { status: 500 });
  }
} 