import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_fid,
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
      date
    } = body;

    // Validate required fields
    if (!user_fid || !attestation_uid || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert the attestation into the database
    const result = await sql`
      INSERT INTO user_attestations (
        user_fid,
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
        date
      ) VALUES (
        ${user_fid},
        ${name},
        ${display_name},
        ${wallet},
        ${metric_type},
        ${goal_value},
        ${actual_value},
        ${timestamp},
        ${challenge_id},
        ${title},
        ${description},
        ${image_url},
        ${attestation_uid},
        ${date}
      )
      RETURNING id;
    `;

    return NextResponse.json({
      success: true,
      attestation_id: result[0].id
    });

  } catch (error) {
    console.error('Error saving attestation:', error);
    return NextResponse.json(
      { error: 'Failed to save attestation' },
      { status: 500 }
    );
  }
} 