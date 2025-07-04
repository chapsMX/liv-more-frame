import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('userFid');
    const metricType = searchParams.get('metricType');

    if (!userFid) {
      return NextResponse.json(
        { error: 'User FID is required' },
        { status: 400 }
      );
    }

    console.log('Fetching attestations for user:', userFid, 'metric:', metricType);

    let result;
    
    if (metricType && metricType !== 'all') {
      result = await sql`
        SELECT 
          id,
          name,
          display_name,
          wallet,
          metric_type,
          goal_value,
          actual_value,
          timestamp,
          challenge_id,
          title,
          description,
          image_url,
          attestation_uid,
          created_at
        FROM user_attestations
        WHERE user_fid = ${userFid} AND metric_type = ${metricType}
        ORDER BY created_at DESC
      `;
    } else {
      result = await sql`
        SELECT 
          id,
          name,
          display_name,
          wallet,
          metric_type,
          goal_value,
          actual_value,
          timestamp,
          challenge_id,
          title,
          description,
          image_url,
          attestation_uid,
          created_at
        FROM user_attestations
        WHERE user_fid = ${userFid}
        ORDER BY created_at DESC
      `;
    }
    console.log('Query result:', result);

    if (!result || result.length === 0) {
      return NextResponse.json({ attestations: [] }, { status: 200 });
    }

    return NextResponse.json({ attestations: result }, { status: 200 });
  } catch (error) {
    console.error('Error fetching attestations:', error);
    return NextResponse.json(
      { error: 'Error fetching attestations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 