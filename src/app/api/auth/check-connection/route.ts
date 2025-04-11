import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('user_fid');

    if (!userFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing user_fid parameter' 
      }, { status: 400 });
    }

    console.log('Checking connection for FID:', userFid);
    console.log('Querying database...');

    const connection = await sql`
      SELECT 
        id, 
        user_fid, 
        token_expiry,
        updated_at,
        google_token IS NOT NULL as has_token
      FROM user_connections 
      WHERE user_fid = ${parseInt(userFid)}
    `;

    // Log sanitized results
    const sanitizedResults = connection.map(conn => ({
      id: conn.id,
      user_fid: conn.user_fid,
      has_token: conn.has_token,
      token_expiry: conn.token_expiry,
      updated_at: conn.updated_at
    }));
    console.log('Query results:', sanitizedResults);

    const isConnected = connection.length > 0 && connection[0].has_token;
    const connectionStatus = {
      isConnected,
      connection: isConnected ? {
        hasToken: true,
        tokenExpiry: connection[0].token_expiry,
        updatedAt: connection[0].updated_at
      } : null
    };

    console.log('Connection status:', {
      isConnected,
      connection: connectionStatus.connection
    });

    return NextResponse.json(connectionStatus);
  } catch (error) {
    console.error('Error checking connection:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error checking connection status' 
    }, { status: 500 });
  }
} 