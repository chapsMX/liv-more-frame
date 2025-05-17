// URLs base para diferentes entornos
export const ROOK_URLS = {
  SANDBOX: {
    CONNECTIONS: 'https://connections.rook-connect.review',
    API: 'https://api.rook-connect.review'
  },
  PRODUCTION: {
    CONNECTIONS: 'https://connections.rook-connect.com',
    API: 'https://api.rook-connect.com'
  }
} as const;

// Configuración actual (cambia según el entorno)
export const CURRENT_ENV = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';

export const ROOK_CONFIG = {
  CLIENT_UUID: '88616d20-da51-4d31-b9a8-436f02e3ca98',
  CONNECTIONS_URL: ROOK_URLS[CURRENT_ENV].CONNECTIONS,
  API_URL: ROOK_URLS[CURRENT_ENV].API,
  // URL base de la aplicación (se configura dinámicamente en el cliente)
  getAppBaseUrl: () => {
    if (typeof window === 'undefined') return 'https://app.livmore.life';
    return `${window.location.protocol}//${window.location.host}`;
  },
  // URL de redirección para el callback de Rook
  getRedirectUrl: () => {
    const baseUrl = ROOK_CONFIG.getAppBaseUrl();
    return `${baseUrl}/connect-device`;
  }
} as const;

// Tipos de dispositivos soportados
export const SUPPORTED_DEVICES = [
  'Garmin',
  'Oura',
  'Polar',
  'Fitbit',
  'Withings',
  'Whoop',
  'Dexcom'
] as const;

// Tipos para TypeScript
export type RookEnvironment = keyof typeof ROOK_URLS;
export type SupportedDevice = typeof SUPPORTED_DEVICES[number]; 