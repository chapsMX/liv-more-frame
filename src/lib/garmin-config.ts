export const GARMIN_CONFIG = {
  OAUTH_URL: 'https://connect.garmin.com/oauthConfirm',
  TOKEN_URL: 'https://connect.garmin.com/oauth-service/oauth/access_token',
  REQUEST_TOKEN_URL: 'https://connect.garmin.com/oauth-service/oauth/request_token',
  AUTHORIZE_URL: 'https://connect.garmin.com/oauthConfirm',
  CONSUMER_KEY: process.env.GARMIN_CONSUMER_KEY!,
  CONSUMER_SECRET: process.env.GARMIN_CONSUMER_SECRET!,
  CALLBACK_URL: `${process.env.NEXT_PUBLIC_URL}/auth/garmin/callback`,
  SCOPE: 'activity,health,location,profile,settings,social',
}; 