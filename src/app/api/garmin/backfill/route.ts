// app/api/garmin/backfill/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { userId, daysBack = 5 } = await req.json()

  // 1. Obtener credenciales del usuario desde la DB
  const result = await sql`
    SELECT 
      gc.access_token,
      gc.token_secret
    FROM "2026_garmin_connections" gc
    JOIN "2026_provider_connections" pc ON pc.id = gc.connection_id
    WHERE pc.user_id = ${userId}
      AND pc.disconnected_at IS NULL
    LIMIT 1
  `

  if (!result[0]) {
    return NextResponse.json({ error: 'No Garmin connection found' }, { status: 404 })
  }

  const { access_token, token_secret } = result[0]

  // 2. Calcular rango de tiempo
  const now = Math.floor(Date.now() / 1000)
  const startTime = now - daysBack * 24 * 60 * 60

  // 3. Construir URL
  const baseUrl = 'https://apis.garmin.com/wellness-api/rest/backfill/dailies'
  const queryParams = `summaryStartTimeInSeconds=${startTime}&summaryEndTimeInSeconds=${now}`
  const fullUrl = `${baseUrl}?${queryParams}`

  // 4. Firmar con OAuth 1.0a
  const authHeader = buildOAuthHeader({
    method: 'GET',
    url: baseUrl,
    queryParams: {
      summaryStartTimeInSeconds: String(startTime),
      summaryEndTimeInSeconds: String(now),
    },
    consumerKey: process.env.GARMIN_CONSUMER_KEY!,
    consumerSecret: process.env.GARMIN_CONSUMER_SECRET!,
    accessToken: access_token,
    tokenSecret: token_secret,
  })

  // 5. Llamar a Garmin
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: { Authorization: authHeader },
  })

  // 202 = backfill iniciado correctamente
  // Garmin enviará los datos históricos a tu webhook /api/webhooks/garmin/daily
  if (response.status === 202) {
    return NextResponse.json({
      ok: true,
      message: `Backfill iniciado para los últimos ${daysBack} días`,
    })
  }

  const error = await response.text()
  console.error('[garmin/backfill] error:', response.status, error)
  return NextResponse.json({ error }, { status: response.status })
}

// OAuth 1.0a signature — solo usa crypto de Node, sin dependencias externas
function buildOAuthHeader({
  method,
  url,
  queryParams,
  consumerKey,
  consumerSecret,
  accessToken,
  tokenSecret,
}: {
  method: string
  url: string
  queryParams: Record<string, string>
  consumerKey: string
  consumerSecret: string
  accessToken: string
  tokenSecret: string
}) {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     consumerKey,
    oauth_token:            accessToken,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_version:          '1.0',
  }

  // Combinar oauth params + query params para la firma
  const allParams = { ...oauthParams, ...queryParams }
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(k => `${encode(k)}=${encode(allParams[k])}`)
    .join('&')

  // Base string
  const baseString = [
    method.toUpperCase(),
    encode(url),
    encode(sortedParams),
  ].join('&')

  // Signing key
  const signingKey = `${encode(consumerSecret)}&${encode(tokenSecret)}`

  // Firma HMAC-SHA1
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64')

  oauthParams['oauth_signature'] = signature

  return (
    'OAuth ' +
    Object.keys(oauthParams)
      .map(k => `${encode(k)}="${encode(oauthParams[k])}"`)
      .join(', ')
  )
}

function encode(str: string) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    c => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  )
}