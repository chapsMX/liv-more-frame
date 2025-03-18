import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(req: Request) {
  try {
    const { user_fid } = await req.json();

    if (!user_fid) {
      return NextResponse.json({ success: false, error: 'User FID is required' });
    }

    const sql = neon(process.env.DATABASE_URL!);
    
    await sql`
      UPDATE whitelist_users 
      SET is_whitelisted = false, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE user_fid = ${user_fid}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing from whitelist:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove from whitelist' });
  }
} 