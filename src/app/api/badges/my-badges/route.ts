import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Configuración de la conexión a Neon
const sql = neon(process.env.DATABASE_URL!);

// GET /api/badges/my-badges
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('userFid');

    if (!userFid) {
      return NextResponse.json(
        { error: 'User FID is required' },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT 
        b.id,
        b.name,
        b.badge_type,
        b.total_supply,
        b.category,
        b.image_url,
        b.description,
        b.metadata,
        b.created_at,
        ub.earned_at
      FROM badges b
      INNER JOIN user_badges ub ON b.id = ub.badge_id
      WHERE ub.user_fid = ${userFid}
      ORDER BY ub.earned_at DESC
    `;

    return NextResponse.json({ badges: result }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    return NextResponse.json(
      { error: 'Error fetching user badges' },
      { status: 500 }
    );
  }
} 