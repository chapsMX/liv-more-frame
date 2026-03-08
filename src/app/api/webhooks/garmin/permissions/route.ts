import { NextRequest, NextResponse } from 'next/server'

type PermissionsPayload = {
  userPermissionsChange?: {
    userId: string
    permissions: string[]
  }[]
}

export async function POST(req: NextRequest) {
  let body: PermissionsPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[webhooks/garmin/permissions]', JSON.stringify(body))

  return NextResponse.json({ ok: true }, { status: 200 })
}
