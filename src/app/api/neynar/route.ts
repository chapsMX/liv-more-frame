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
          pfp_url: response.users[0].pfp_url,
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

async function getBulkUsers(fids: string[]) {
  try {
    const intFids = fids.map(fid => parseInt(fid));
    const response = await client.fetchBulkUsers({ fids: intFids });
    return {
      success: true,
      users: response.users.map(u => ({
        fid: u.fid,
        username: u.username,
        display_name: u.display_name,
        pfp_url: u.pfp_url,
        custody_address: u.custody_address
      }))
    };
  } catch (error) {
    console.error('Error fetching bulk users:', error);
    return { success: false, error: 'Bulk fetch failed' };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const fids = searchParams.get('fids');

    if (fids) {
      const fidList = fids.split(',').map(f => f.trim()).filter(Boolean);
      const usersData = await getBulkUsers(fidList);
      return NextResponse.json(usersData);
    }

    if (fid) {
      const userData = await getUserInfo(fid);
      return NextResponse.json(userData);
    }

    return NextResponse.json({ success: false, error: 'FID or FIDs is required' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' });
  }
} 