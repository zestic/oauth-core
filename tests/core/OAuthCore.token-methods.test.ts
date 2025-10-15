/**
 * Tests for OAuthCore token utility methods
 */

import { OAuthCore } from '../../src/core/OAuthCore';
import type { OAuthConfig, OAuthAdapters } from '../../src/types/OAuthTypes';

// Mock adapters - simplified to avoid hanging
const mockStorage = {
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  removeItems: jest.fn(),
  setTokenData: jest.fn(),
  getTokenData: jest.fn(),
  removeTokenData: jest.fn(),
};

const mockHttp = {
  post: jest.fn(),
  get: jest.fn(),
};

const mockPkce = {
  generateCodeChallenge: jest.fn(),
  generateState: jest.fn(),
};

const testConfig: OAuthConfig = {
  clientId: 'test-client',
  endpoints: {
    authorization: 'https://auth.example.com/authorize',
    token: 'https://auth.example.com/token',
    revocation: 'https://auth.example.com/revoke',
  },
  redirectUri: 'https://app.example.com/callback',
  scopes: ['read', 'write'],
};

const mockAdapters: OAuthAdapters = {
  storage: mockStorage,
  http: mockHttp,
  pkce: mockPkce,
};

describe('OAuthCore Token Utility Methods', () => {
  let oauthCore: OAuthCore;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup default mock behaviors
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockResolvedValue(undefined);
    mockStorage.removeItem.mockResolvedValue(undefined);
    mockStorage.removeItems.mockResolvedValue(undefined);

    // Create OAuthCore instance
    oauthCore = new OAuthCore(testConfig, mockAdapters);
  });

  afterEach(() => {
    // Clean up
    oauthCore.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('getTokenExpirationTime', () => {
    it('should return null (placeholder implementation)', async () => {
      const result = await oauthCore.getTokenExpirationTime();
      expect(result).toBeNull();
    });
  });

  describe('getTimeUntilTokenExpiration', () => {
    it('should return MAX_SAFE_INTEGER for placeholder implementation', async () => {
      const result = await oauthCore.getTimeUntilTokenExpiration();
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('scheduleTokenRefresh', () => {
    it('should return a function (placeholder implementation)', async () => {
      const cancelFn = await oauthCore.scheduleTokenRefresh();
      expect(typeof cancelFn).toBe('function');
      expect(() => cancelFn()).not.toThrow();
    });

    it('should log warning when no token data available', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await oauthCore.scheduleTokenRefresh();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No token data available')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('isTokenRefreshScheduled', () => {
    it('should return false (no scheduling implemented yet)', () => {
      const result = oauthCore.isTokenRefreshScheduled();
      expect(result).toBe(false);
    });
  });

  describe('existing token methods', () => {
    it('should provide access to core token functionality', async () => {
      mockStorage.getItem.mockResolvedValue('test-token');

      const accessToken = await oauthCore.getAccessToken();
      expect(accessToken).toBe('test-token');
    });
  });
});