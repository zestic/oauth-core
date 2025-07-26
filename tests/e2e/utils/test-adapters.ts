/**
 * Shared test utilities for e2e tests
 * Provides mock adapters and common test setup functions
 */

import type { ExtendedOAuthAdapters } from '../../../src/types/ServiceTypes';

/**
 * Creates mock extended adapters with in-memory storage for e2e tests
 * This provides a consistent testing environment across all e2e test files
 */
export const createE2EAdapters = (): ExtendedOAuthAdapters => {
  const storage = new Map<string, string>();

  return {
    storage: {
      setItem: jest.fn().mockImplementation(async (key: string, value: string) => {
        storage.set(key, value);
      }),
      getItem: jest.fn().mockImplementation(async (key: string) => {
        return storage.get(key) || null;
      }),
      removeItem: jest.fn().mockImplementation(async (key: string) => {
        storage.delete(key);
      }),
      removeItems: jest.fn().mockImplementation(async (keys: string[]) => {
        keys.forEach(key => storage.delete(key));
      })
    },
    http: {
      post: jest.fn(),
      get: jest.fn()
    },
    pkce: {
      generateCodeChallenge: jest.fn(),
      generateState: jest.fn()
    },
    user: {
      registerUser: jest.fn().mockResolvedValue({
        success: true,
        userId: 'user-123',
        message: 'User registered successfully'
      }),
      userExists: jest.fn().mockResolvedValue(false),
      getUserByEmail: jest.fn().mockResolvedValue(null)
    },
    email: {
      sendMagicLink: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'msg-123'
      }),
      sendRegistrationConfirmation: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'msg-456'
      })
    }
  };
};

/**
 * Mock HTTP adapter for testing HTTP requests
 * Provides utilities for mocking different response scenarios
 */
export class MockHttpAdapter {
  private responses = new Map<string, any>();

  mockResponse(url: string, response: any) {
    this.responses.set(url, response);
  }

  async post(url: string, _data: string, _headers?: Record<string, string>) {
    const mockResponse = this.responses.get(url);
    if (mockResponse) {
      return mockResponse;
    }
    
    // Default successful response for unmocked URLs
    return {
      status: 200,
      data: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      },
      headers: {}
    };
  }

  async get(url: string, _headers?: Record<string, string>) {
    const mockResponse = this.responses.get(url);
    if (mockResponse) {
      return mockResponse;
    }
    
    return {
      status: 200,
      data: {},
      headers: {}
    };
  }

  clearMocks() {
    this.responses.clear();
  }
}

/**
 * Creates a mock HTTP adapter instance for e2e tests
 */
export const createMockHttpAdapter = (): MockHttpAdapter => {
  return new MockHttpAdapter();
};

/**
 * Common test configuration objects for e2e tests
 */
export const createTestOAuthConfig = () => ({
  clientId: 'test-client-id',
  endpoints: {
    authorization: 'https://auth.example.com/authorize',
    token: 'https://auth.example.com/token',
    revocation: 'https://auth.example.com/revoke'
  },
  redirectUri: 'https://app.example.com/callback',
  scopes: ['read', 'write']
});

export const createTestMagicLinkConfig = () => ({
  baseUrl: 'https://app.example.com/auth/callback',
  tokenEndpoint: '/oauth/token',
  expirationMinutes: 15
});

/**
 * Sets up common mock implementations for PKCE and state generation
 */
export const setupCommonMocks = (adapters: ExtendedOAuthAdapters) => {
  // Mock PKCE generation
  (adapters.pkce.generateCodeChallenge as jest.Mock).mockResolvedValue({
    codeChallenge: 'test-challenge',
    codeChallengeMethod: 'S256',
    codeVerifier: 'test-verifier'
  });
  
  // Mock state generation
  (adapters.pkce.generateState as jest.Mock).mockResolvedValue('test-oauth-state');
};

/**
 * Utility to clear all mocks in the adapters
 */
export const clearAdapterMocks = (adapters: ExtendedOAuthAdapters) => {
  jest.clearAllMocks();
  
  // Clear storage
  const storage = (adapters.storage.setItem as jest.Mock).mock.calls;
  if (storage.length > 0) {
    // Reset the internal storage map
    const storageMap = new Map<string, string>();
    (adapters.storage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
      storageMap.set(key, value);
    });
    (adapters.storage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      return storageMap.get(key) || null;
    });
    (adapters.storage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
      storageMap.delete(key);
    });
    (adapters.storage.removeItems as jest.Mock).mockImplementation(async (keys: string[]) => {
      keys.forEach(key => storageMap.delete(key));
    });
  }
};
