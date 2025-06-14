import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerFid = searchParams.get('viewer_fid');
    if (!viewerFid) {
      return NextResponse.json({ success: false, error: 'viewer_fid is required' });
    }
    const targetFid = '343393'; // hardcoded target_fid
    const url = `https://api.neynar.com/v2/farcaster/followers/relevant?target_fid=${targetFid}&viewer_fid=${viewerFid}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': process.env.NEYNAR_API_KEY || '',
        'x-neynar-experimental': 'true'
      }
    });
    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.statusText}`);
    }
    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching relevant followers:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' });
  }
} 