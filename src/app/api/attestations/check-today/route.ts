import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    const date = searchParams.get('date');

    if (!user_fid || !date) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Query to check attestations for today
    const result = await sql`
      SELECT metric_type
      FROM user_attestations
      WHERE user_fid = ${user_fid}
      AND date = ${date}
    `;

    // Convert the result to a boolean map
    const attestations = {
      steps: false,
      calories: false,
      sleep: false
    };

    result.forEach(row => {
      attestations[row.metric_type as keyof typeof attestations] = true;
    });

    return NextResponse.json({ attestations });

  } catch (error) {
    console.error('Error checking attestations:', error);
    return NextResponse.json(
      { error: 'Failed to check attestations' },
      { status: 500 }
    );
  }
} 