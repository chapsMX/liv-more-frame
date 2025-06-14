import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fid = searchParams.get('fid');
  const limit = searchParams.get('limit') || '10';
  if (!fid) {
    return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
  }
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing NEYNAR_API_KEY' }, { status: 500 });
  }
  const url = `https://api.neynar.com/v2/farcaster/feed/user/replies_and_recasts?fid=${fid}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from Neynar' }, { status: 500 });
  }
} 