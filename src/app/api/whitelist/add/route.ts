import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(request: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const { user_fid, username, eth_address, display_name } = await request.json();

    if (!user_fid || !username || !eth_address) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Insertar en la base de datos
    await sql(
      'INSERT INTO whitelist_users (user_fid, username, eth_address, display_name, is_whitelisted) VALUES ($1, $2, $3, $4, $5)',
      [user_fid, username, eth_address, display_name, true]
    );

    return NextResponse.json({ 
      success: true,
      message: 'User added to whitelist successfully' 
    });

  } catch (error) {
    console.error('Error adding user to whitelist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 