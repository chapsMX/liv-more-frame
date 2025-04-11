import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/services/google/auth';

export async function GET() {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
} 