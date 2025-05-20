import { NextResponse } from 'next/server';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const client = new NeynarAPIClient({
  apiKey: process.env.NEYNAR_API_KEY || ''
});

export async function POST(request: Request) {
  try {
    const { challenge_id, inviter_fid, invitee_fids } = await request.json();
    if (!challenge_id || !inviter_fid || !invitee_fids || !Array.isArray(invitee_fids)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

/*     const message = `You've been invited to join the challenge "${challenge_title}"!`; */

    for (const fid of invitee_fids) {
      await client.publishWebhook({
        name: `invite-challenge-${challenge_id}-${fid}`,
        url: 'https://api.neynar.com/f/app/51d0a8b5-4c69-4215-b709-ca9f4b8e7948/event',
        subscription: {}
      });
      console.log(`Webhook published for FID ${fid} to challenge ${challenge_id}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending invites:', error);
    return NextResponse.json({ error: 'Error sending invites' }, { status: 500 });
  }
}