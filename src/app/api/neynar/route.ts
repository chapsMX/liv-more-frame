import { NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const client = new NeynarAPIClient({
  apiKey: process.env.NEYNAR_API_KEY!
});

async function getUserByFid(fid: string) {
  try {
    const response = await client.fetchBulkUsers({
      fids: [parseInt(fid)]
    });

    if (!response.users || response.users.length === 0) {
      throw new Error('User not found');
    }

    return response.users[0];
  } catch (error) {
    console.error('Error getting user by FID:', error);
    throw new Error('User not found');
  }
}

async function getUserByUsername(username: string) {
  try {
    const searchResponse = await client.searchUser({
      q: username,
      limit: 1
    });
    console.log('Search result:', searchResponse);

    if (!searchResponse.result || searchResponse.result.users.length === 0) {
      throw new Error('User not found');
    }

    // Get complete user info using FID
    const user = searchResponse.result.users[0];
    const response = await client.fetchBulkUsers({
      fids: [user.fid]
    });

    if (!response.users || response.users.length === 0) {
      throw new Error('User not found');
    }

    return response.users[0];
  } catch (error) {
    console.error('Error searching user:', error);
    throw new Error('User not found');
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const username = searchParams.get('username');

    if (!fid && !username) {
      return NextResponse.json({
        success: false,
        error: 'Missing fid or username parameter'
      }, { status: 400 });
    }

    let user;
    if (fid) {
      console.log('Looking up user by FID:', fid);
      user = await getUserByFid(fid);
    } else {
      console.log('Looking up user by username:', username);
      user = await getUserByUsername(username!);
    }

    return NextResponse.json({
      success: true,
      user: {
        fid: user.fid,
        username: user.username,
        display_name: user.display_name,
        custody_address: user.custody_address,
        pfp_url: user.pfp_url
      }
    });

  } catch (error) {
    console.error('Error getting user info:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
} 