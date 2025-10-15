/**
 * Mock adapters for testing
 */

import {
  HttpAdapter,
  PKCEAdapter,
  HttpResponse,
  PKCEChallenge,
  OAuthAdapters,
  TokenStorageAdapter
} from '../../src/types/OAuthTypes';

import { OAuthTokens } from '../../src/events/OAuthEvents';

export class MockStorageAdapter implements TokenStorageAdapter {
  private storage = new Map<string, string>();
  private tokenStorage = new Map<string, OAuthTokens>();

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) ?? null;
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async removeItems(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.storage.delete(key);
    }
  }

  async setTokenData(key: string, data: OAuthTokens): Promise<void> {
    this.tokenStorage.set(key, data);
  }

  async getTokenData(key: string): Promise<OAuthTokens | null> {
    return this.tokenStorage.get(key) ?? null;
  }

  async removeTokenData(key: string): Promise<void> {
    this.tokenStorage.delete(key);
  }

  // Test utilities
  clear(): void {
    this.storage.clear();
    this.tokenStorage.clear();
  }

  getAll(): Record<string, string> {
    return Object.fromEntries(this.storage.entries());
  }

  getAllTokens(): Record<string, OAuthTokens> {
    return Object.fromEntries(this.tokenStorage.entries());
  }

  size(): number {
    return this.storage.size;
  }

  tokenSize(): number {
    return this.tokenStorage.size;
  }
}

export class MockHttpAdapter implements HttpAdapter {
  private responses = new Map<string, HttpResponse>();
  private requestHistory: Array<{ url: string; data: unknown; headers?: Record<string, string> }> = [];

  async post(url: string, data: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse> {
    this.requestHistory.push({ url, data, headers });
    
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response configured for URL: ${url}`);
    }
    
    return response;
  }

  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    this.requestHistory.push({ url, data: undefined, headers });
    
    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No mock response configured for URL: ${url}`);
    }
    
    return response;
  }

  // Test utilities
  mockResponse(url: string, response: HttpResponse): void {
    this.responses.set(url, response);
  }

  getRequestHistory(): Array<{ url: string; data: unknown; headers?: Record<string, string> }> {
    return [...this.requestHistory];
  }

  clearHistory(): void {
    this.requestHistory = [];
  }

  clearMocks(): void {
    this.responses.clear();
    this.requestHistory = [];
  }
}

export class MockPKCEAdapter implements PKCEAdapter {
  private mockChallenge: PKCEChallenge = {
    codeChallenge: 'mock-code-challenge',
    codeChallengeMethod: 'S256',
    codeVerifier: 'mock-code-verifier',
  };

  private mockState = 'mock-state';

  async generateCodeChallenge(): Promise<PKCEChallenge> {
    return { ...this.mockChallenge };
  }

  async generateState(): Promise<string> {
    return this.mockState;
  }

  // Test utilities
  setMockChallenge(challenge: PKCEChallenge): void {
    this.mockChallenge = { ...challenge };
  }

  setMockState(state: string): void {
    this.mockState = state;
  }
}

export function createMockAdapters(): OAuthAdapters {
  return {
    storage: new MockStorageAdapter(),
    http: new MockHttpAdapter(),
    pkce: new MockPKCEAdapter(),
  };
}

export function createMockConfig() {
  return {
    clientId: 'test-client-id',
    endpoints: {
      authorization: 'https://auth.example.com/oauth/authorize',
      token: 'https://auth.example.com/oauth/token',
      revocation: 'https://auth.example.com/oauth/revoke',
    },
    redirectUri: 'https://app.example.com/auth/callback',
    scopes: ['read', 'write'],
  };
}
