import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { user_fids } = await request.json();

    if (!user_fids || !Array.isArray(user_fids) || user_fids.length === 0) {
      return NextResponse.json(
        { error: 'user_fids array is required' },
        { status: 400 }
      );
    }

    if (user_fids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 user_fids allowed per request' },
        { status: 400 }
      );
    }

    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (!neynarApiKey) {
      return NextResponse.json(
        { error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    // Call Neynar API to get user profiles
    const neynarResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${user_fids.join(',')}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api_key': neynarApiKey,
      },
    });

    if (!neynarResponse.ok) {
      console.error('❌ Neynar API error:', neynarResponse.status, neynarResponse.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch user profiles from Neynar' },
        { status: 500 }
      );
    }

    const neynarData = await neynarResponse.json();
    
    // Transform the response to include only needed fields
    const profiles = neynarData.users?.map((user: Record<string, unknown>) => ({
      fid: user.fid as number,
      username: user.username as string,
      display_name: user.display_name as string,
      pfp_url: user.pfp_url as string,
      follower_count: user.follower_count as number,
      following_count: user.following_count as number,
      verified_addresses: user.verified_addresses as Record<string, unknown>
    })) || [];

    return NextResponse.json({
      profiles,
      total_profiles: profiles.length
    });

  } catch (error) {
    console.error('❌ Error fetching user profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profiles' },
      { status: 500 }
    );
  }
} 