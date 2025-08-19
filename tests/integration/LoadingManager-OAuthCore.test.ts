/**
 * Integration tests for LoadingManager with OAuthCore
 * Tests that loading state management works correctly with all OAuth operations
 */

import { OAuthCore } from '../../src/core/OAuthCore';
import { LoadingContext, OAUTH_OPERATIONS } from '../../src/events/OAuthEvents';
import { createMockAdapters } from '../mocks/adapters';
import { OAuthConfig, OAuthAdapters, OAuthResult } from '../../src/types/OAuthTypes';
import { CallbackFlowHandler } from '../../src/types/CallbackFlowTypes';

// Mock flow handler for testing
class MockFlowHandler implements CallbackFlowHandler {
  readonly name = 'mock-flow';
  readonly priority = 10;

  canHandle(params: URLSearchParams, _config: OAuthConfig): boolean {
    return params.has('code') || params.has('token');
  }

  async validate(_params: URLSearchParams, _config: OAuthConfig): Promise<boolean> {
    return true; // Always valid for testing
  }

  async handle(params: URLSearchParams, _adapters: OAuthAdapters, _config: OAuthConfig): Promise<OAuthResult> {
    if (params.has('error')) {
      throw new Error(params.get('error_description') || 'OAuth error');
    }

    return {
      success: true,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600
    };
  }
}

describe('LoadingManager Integration with OAuthCore', () => {
  let oauthCore: OAuthCore;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  let config: OAuthConfig;
  let loadingEvents: Array<{ event: string; context: LoadingContext }>;

  beforeEach(() => {
    mockAdapters = createMockAdapters();

    config = {
      clientId: 'test-client-id',
      redirectUri: 'http://localhost:3000/callback',
      endpoints: {
        authorization: 'https://auth.example.com/authorize',
        token: 'https://auth.example.com/token',
        revocation: 'https://auth.example.com/revoke'
      },
      scopes: ['read', 'write']
    };

    oauthCore = new OAuthCore(config, mockAdapters);

    // Register a mock flow handler
    oauthCore.registerFlow(new MockFlowHandler());

    loadingEvents = [];

    // Track loading events
    oauthCore.on('loadingStart', (context) => {
      loadingEvents.push({ event: 'loadingStart', context });
    });

    oauthCore.on('loadingEnd', (context) => {
      loadingEvents.push({ event: 'loadingEnd', context });
    });
  });

  afterEach(() => {
    oauthCore.destroy();
  });



  describe('Basic Loading State Integration', () => {
    it('should track loading state during URL generation', async () => {
      expect(oauthCore.isLoading).toBe(false);

      const urlPromise = oauthCore.generateAuthorizationUrl();
      expect(oauthCore.isLoading).toBe(true);
      expect(oauthCore.isOperationActive(OAUTH_OPERATIONS.GENERATE_AUTH_URL)).toBe(true);

      const result = await urlPromise;
      expect(oauthCore.isLoading).toBe(false);
      expect(oauthCore.isOperationActive(OAUTH_OPERATIONS.GENERATE_AUTH_URL)).toBe(false);

      expect(result.url).toBeDefined();
      expect(result.state).toBeDefined();

      // Check events
      expect(loadingEvents).toHaveLength(2);
      expect(loadingEvents[0].event).toBe('loadingStart');
      expect(loadingEvents[0].context.operation).toBe(OAUTH_OPERATIONS.GENERATE_AUTH_URL);
      expect(loadingEvents[1].event).toBe('loadingEnd');
      expect(loadingEvents[1].context.operation).toBe(OAUTH_OPERATIONS.GENERATE_AUTH_URL);
    });

    it('should provide access to loading statistics', async () => {
      const urlPromise = oauthCore.generateAuthorizationUrl();

      // While operation is running
      const stats = oauthCore.getLoadingStatistics();
      expect(stats.activeCount).toBe(1);
      expect(stats.longestRunningOperation).toBeDefined();
      expect(stats.longestRunningOperation!.operation).toBe(OAUTH_OPERATIONS.GENERATE_AUTH_URL);

      await urlPromise;

      const finalStats = oauthCore.getLoadingStatistics();
      expect(finalStats.activeCount).toBe(0);
      expect(finalStats.completedCount).toBe(1);
    });

    it('should allow checking specific operation status', async () => {
      expect(oauthCore.isOperationActive(OAUTH_OPERATIONS.GENERATE_AUTH_URL)).toBe(false);

      const urlPromise = oauthCore.generateAuthorizationUrl();
      expect(oauthCore.isOperationActive(OAUTH_OPERATIONS.GENERATE_AUTH_URL)).toBe(true);

      const context = oauthCore.getOperationContext(OAUTH_OPERATIONS.GENERATE_AUTH_URL);
      expect(context).toBeDefined();
      expect(context!.operation).toBe(OAUTH_OPERATIONS.GENERATE_AUTH_URL);

      await urlPromise;
      expect(oauthCore.isOperationActive(OAUTH_OPERATIONS.GENERATE_AUTH_URL)).toBe(false);
    });

    it('should handle cleanup on destroy', () => {
      // Start some operations
      oauthCore.generateAuthorizationUrl();
      expect(oauthCore.isLoading).toBe(true);

      // Destroy should cleanup everything
      oauthCore.destroy();
      expect(oauthCore.isLoading).toBe(false);
    });
  });


});
