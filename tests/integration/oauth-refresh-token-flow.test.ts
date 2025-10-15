/**
 * End-to-end tests for OAuth Refresh Token Grant Flow
 * Tests the complete token lifecycle including refresh token usage
 */

import { OAuthCore } from '../../src/core/OAuthCore';
import type {
  ExtendedOAuthAdapters
} from '../../src/types/ServiceTypes';
import type { OAuthConfig } from '../../src/types/OAuthTypes';
import {
  createE2EAdapters,
  createTestOAuthConfig,
  setupCommonMocks,
  clearAdapterMocks
} from './utils/test-adapters';

describe('OAuth Refresh Token Grant Flow End-to-End', () => {
  let adapters: ExtendedOAuthAdapters;
  let oauthConfig: OAuthConfig;
  let oauthCore: OAuthCore;

  beforeEach(() => {
    adapters = createE2EAdapters();
    oauthConfig = createTestOAuthConfig();

    oauthCore = new OAuthCore(oauthConfig, adapters);

    // Setup common mocks
    setupCommonMocks(adapters);
  });

  afterEach(() => {
    clearAdapterMocks(adapters);
  });

  describe('Automatic Token Refresh Scenarios', () => {
    it('should automatically refresh tokens during API operations', async () => {
      // Step 1: Setup initial authentication state with expired access token
      await adapters.storage.setItem('access_token', 'expired-access-token');
      await adapters.storage.setItem('refresh_token', 'valid-refresh-token');

      // Set token as expired (1 second ago)
      const pastTime = Date.now() - 1000;
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Step 2: Verify initial state - token is expired
      const currentToken = await oauthCore.getAccessToken();
      expect(currentToken).toBe('expired-access-token');

      const isExpired = await oauthCore.isTokenExpired();
      expect(isExpired).toBe(true);

      // Step 3: Mock refresh token exchange for automatic refresh
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          access_token: 'auto-refreshed-access-token',
          refresh_token: 'new-auto-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        },
        headers: {}
      });

      // Step 4: Simulate automatic refresh (what middleware would do)
      const refreshResult = await oauthCore.refreshAccessToken();

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.accessToken).toBe('auto-refreshed-access-token');
      expect(refreshResult.refreshToken).toBe('new-auto-refresh-token');
      expect(refreshResult.expiresIn).toBe(3600);
      expect(refreshResult.metadata).toBeDefined();
      expect(refreshResult.metadata?.requestId).toBeDefined();
      expect(refreshResult.metadata?.duration).toBeDefined();

      // Step 5: Verify the new token is now available for API operations
      const newToken = await oauthCore.getAccessToken();
      expect(newToken).toBe('auto-refreshed-access-token');

      const isStillExpired = await oauthCore.isTokenExpired();
      expect(isStillExpired).toBe(false);

      // Step 6: Verify refresh token was rotated
      const newRefreshToken = await oauthCore.getRefreshToken();
      expect(newRefreshToken).toBe('new-auto-refresh-token');

      // Step 7: Verify the HTTP request used correct refresh token grant
      const refreshTokenCall = (adapters.http.post as jest.Mock).mock.calls[0];
      const requestBody = refreshTokenCall[1];
      expect(requestBody.grant_type).toBe('refresh_token');
      expect(requestBody.refresh_token).toBe('valid-refresh-token');
      expect(requestBody.client_id).toBe('test-client-id');
    });

    it('should handle refresh token failure gracefully', async () => {
      // Step 1: Setup expired tokens with invalid refresh token
      await adapters.storage.setItem('access_token', 'expired-access-token');
      await adapters.storage.setItem('refresh_token', 'invalid-refresh-token');

      const pastTime = Date.now() - 1000;
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Step 2: Mock refresh token failure response
      (adapters.http.post as jest.Mock).mockResolvedValueOnce({
        status: 400,
        data: {
          error: 'invalid_grant',
          error_description: 'The provided refresh token is invalid'
        },
        headers: {}
      });

      // Step 3: Attempt to refresh token - should fail gracefully
      try {
        await oauthCore.refreshAccessToken();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('The provided refresh token is invalid');
      }

      // Step 4: Verify original tokens are still in storage (not cleared on failure)
      const accessToken = await oauthCore.getAccessToken();
      expect(accessToken).toBe('expired-access-token');

      const refreshToken = await oauthCore.getRefreshToken();
      expect(refreshToken).toBe('invalid-refresh-token');

      // Step 5: Verify token is still expired
      const isExpired = await oauthCore.isTokenExpired();
      expect(isExpired).toBe(true);
    });

    it('should handle missing refresh token scenario', async () => {
      // Step 1: Setup access token but no refresh token
      await adapters.storage.setItem('access_token', 'access-token-without-refresh');
      await adapters.storage.removeItem('refresh_token');

      const pastTime = Date.now() - 1000;
      await adapters.storage.setItem('token_expiry', pastTime.toString());

      // Step 2: Attempt to refresh token - should fail due to missing refresh token
      try {
        await oauthCore.refreshAccessToken();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Refresh token is missing');
      }

      // Step 3: Verify access token is still available
      const accessToken = await oauthCore.getAccessToken();
      expect(accessToken).toBe('access-token-without-refresh');

      // Step 4: Verify no refresh token exists
      const refreshToken = await oauthCore.getRefreshToken();
      expect(refreshToken).toBeNull();
    });
  });
});
