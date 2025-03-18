import { NextResponse } from 'next/server';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const client = new NeynarAPIClient({
  apiKey: process.env.NEYNAR_API_KEY || ''
});

async function getUserInfo(fid: string) {
  try {
    const response = await client.fetchBulkUsers({
      fids: [parseInt(fid)]
    });
    
    if (response.users[0]) {
      return {
        success: true,
        user: {
          fid: response.users[0].fid,
          username: response.users[0].username,
          display_name: response.users[0].display_name,
          custody_address: response.users[0].custody_address
        }
      };
    }
    return { success: false, error: 'User not found' };
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({ success: false, error: 'FID is required' });
    }

    const userData = await getUserInfo(fid);
    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' });
  }
} 