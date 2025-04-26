// Validar variables de entorno requeridas
if (!process.env.GARMIN_CONSUMER_KEY || !process.env.GARMIN_CONSUMER_SECRET) {
  throw new Error('Las variables de entorno GARMIN_CONSUMER_KEY y GARMIN_CONSUMER_SECRET son requeridas');
}

export const GARMIN_CONFIG = {
  REQUEST_TOKEN_URL: 'https://connectapi.garmin.com/oauth-service/oauth/request_token',
  ACCESS_TOKEN_URL: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
  AUTHORIZE_URL: 'https://connect.garmin.com/oauthConfirm',
  CONSUMER_KEY: process.env.GARMIN_CONSUMER_KEY,
  CONSUMER_SECRET: process.env.GARMIN_CONSUMER_SECRET,
  CALLBACK_URL: `${process.env.NEXT_PUBLIC_URL}/auth/garmin/callback`,
  API_ENDPOINTS: {
    DAILY_SUMMARY: 'https://apis.garmin.com/wellness-api/rest/dailies',
    ACTIVITIES: 'https://apis.garmin.com/wellness-api/rest/activities',
    SLEEP: 'https://apis.garmin.com/wellness-api/rest/sleeps'
  }
}; 