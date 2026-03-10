// scripts/register-polar-webhook.ts
async function register() {
  const CLIENT_ID     = '789e1e10-519d-4e86-acfc-195f52da594f'
  const CLIENT_SECRET = '6d412abc-00e7-43ab-85eb-71405d2f8c92'
  const SECRET_KEY    = 'b10504f1bb4fc1fe712bb2cf06d9df2378414ca9e652d152bd221a6a5679f062'

  const res = await fetch('https://www.polaraccesslink.com/v3/webhooks', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: JSON.stringify({
      events:     ['ACTIVITY_SUMMARY'],
      url:        'https://app.livmore.life/api/webhooks/polar/activity',
      secret_key: SECRET_KEY,
    }),
  })

  const data = await res.json()
  console.log('Status:', res.status)
  console.log('Response:', JSON.stringify(data, null, 2))
}

register()