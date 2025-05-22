import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Configuración de la conexión a Neon
const sql = neon(process.env.DATABASE_URL!);

// GET /api/badges/[id]
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await params;
    const badgeId = parseInt(id);
    if (isNaN(badgeId)) {
      return NextResponse.json(
        { error: 'Invalid badge ID' },
        { status: 400 }
      );
    }

    const badge = await sql`
      SELECT 
        b.*,
        COUNT(ub.id) as total_earned
      FROM badges b
      LEFT JOIN user_badges ub ON b.id = ub.badge_id
      WHERE b.id = ${badgeId}
      GROUP BY b.id
    `;

    if (!badge || badge.length === 0) {
      return NextResponse.json(
        { error: 'Badge not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ badge: badge[0] });
  } catch (error) {
    console.error('Error fetching badge:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 