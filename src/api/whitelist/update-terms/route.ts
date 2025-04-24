import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const { user_fid, accepted_tos, accepted_privacy_policy } = await request.json();

    if (!user_fid) {
      return NextResponse.json(
        { success: false, error: 'User FID is required' },
        { status: 400 }
      );
    }

    // Actualizar los campos en la tabla whitelist_users
    const result = await sql`
      UPDATE whitelist_users
      SET 
        accepted_tos = ${accepted_tos},
        accepted_privacy_policy = ${accepted_privacy_policy},
        updated_at = NOW()
      WHERE user_fid = ${user_fid}
      RETURNING user_fid
    `;

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating terms:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 