'use client';

// Rook API service
const ROOK_API_BASE_URL = process.env.NEXT_PUBLIC_ROOK_API_URL || 'https://api.tryrook.io';
const ROOK_CLIENT_UUID = process.env.NEXT_PUBLIC_ROOK_CLIENT_UUID;
const ROOK_CLIENT_SECRET = process.env.NEXT_PUBLIC_ROOK_CLIENT_SECRET;

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

// Helper function to get the appropriate fetch implementation
const getFetch = (): FetchFunction => {
  if (typeof window !== 'undefined') {
    return window.fetch.bind(window);
  }
  // This should never happen due to 'use client', but just in case
  throw new Error('This method should only be called from the client side');
};

interface RookConfig {
  clientUUID: string;
  clientSecret: string;
}

class RookService {
  private config: RookConfig;
  private fetch: FetchFunction;

  constructor(config: RookConfig) {
    this.config = config;
    this.fetch = getFetch();
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.clientSecret}`,
      ...options.headers,
    };

    const url = `${ROOK_API_BASE_URL}${endpoint}`;
    console.log(`[Rook API] Making request to: ${url}`);
    console.log('[Rook API] Request options:', {
      ...options,
      headers: { ...headers, Authorization: '[REDACTED]' }
    });

    try {
      const response = await this.fetch(url, {
        ...options,
        headers,
      });

      let responseData;
      const textResponse = await response.text();
      try {
        responseData = textResponse ? JSON.parse(textResponse) : null;
      } catch (e) {
        console.error('[Rook API] Error parsing response:', textResponse);
        responseData = null;
      }

      console.log(`[Rook API] Response status: ${response.status}`);
      console.log('[Rook API] Response data:', responseData);

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${responseData?.message || textResponse || 'Unknown error'}`
        );
      }

      return responseData;
    } catch (error) {
      console.error('[Rook API] Request failed:', error);
      throw error;
    }
  }

  async connectAppleHealth(userId: string) {
    try {
      console.log('[Rook API] Connecting Apple Health for user:', userId);
      const response = await this.fetchWithAuth('/connect/apple-health', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
        }),
      });
      return response;
    } catch (error) {
      console.error('[Rook API] Error connecting Apple Health:', error);
      throw error;
    }
  }

  async getUserData(userId: string) {
    try {
      console.log('[Rook API] Getting user data for:', userId);
      const response = await this.fetchWithAuth(`/users/${userId}/data`);
      return response;
    } catch (error) {
      console.error('[Rook API] Error getting user data:', error);
      throw error;
    }
  }

  async revokeConnection(userId: string, dataSource: string) {
    try {
      console.log(`[Rook API] Revoking connection for user: ${userId}, source: ${dataSource}`);
      const response = await this.fetchWithAuth('/revoke-connection', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          data_source: dataSource.toLowerCase()
        }),
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to revoke connection');
      }
      
      return response;
    } catch (error) {
      console.error('[Rook API] Error revoking connection:', error);
      throw error instanceof Error 
        ? error 
        : new Error('Unknown error occurred while revoking connection');
    }
  }

  async getConnectedSources(userId: string) {
    try {
      console.log('[Rook API] Getting connected sources for user:', userId);
      const response = await this.fetchWithAuth(`/users/${userId}/connected-sources`);
      return response;
    } catch (error) {
      console.error('[Rook API] Error getting connected sources:', error);
      throw error;
    }
  }
}

// Create a singleton instance with environment variables
export const rookService = new RookService({
  clientUUID: ROOK_CLIENT_UUID || '',
  clientSecret: ROOK_CLIENT_SECRET || '',
});

export default rookService; 