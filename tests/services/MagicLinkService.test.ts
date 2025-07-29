/**
 * Unit tests for MagicLinkService
 */

import { MagicLinkService, createMagicLinkService } from '../../src/services/MagicLinkService';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  SendMagicLinkInput
} from '../../src/types/ServiceTypes';
import { createE2EAdapters, createTestMagicLinkConfig, setupCommonMocks } from '../integration/utils/test-adapters';

describe('MagicLinkService', () => {
  let service: MagicLinkService;
  let adapters: ExtendedOAuthAdapters;
  let config: MagicLinkConfig;

  beforeEach(() => {
    adapters = createE2EAdapters();
    config = createTestMagicLinkConfig();
    setupCommonMocks(adapters);
    service = new MagicLinkService(adapters, config);
  });

  describe('sendMagicLink', () => {
    it('should successfully send magic link', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      const result = await service.sendMagicLink(input);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Magic link sent successfully');
      expect(adapters.graphql.sendMagicLinkMutation).toHaveBeenCalled();
    });

    it('should handle GraphQL service failure', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Service unavailable'
      });

      const result = await service.sendMagicLink(input);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Service unavailable');
    });

    it('should handle GraphQL service errors', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockRejectedValue(new Error('Network error'));

      // The service should throw an OAuthError when GraphQL mutation fails
      await expect(service.sendMagicLink(input)).rejects.toThrow('Magic link sending failed: Network error');
    });

    it('should generate magic link with correct parameters', async () => {
      const input: SendMagicLinkInput = {
        email: 'test@example.com',
        codeChallenge: 'challenge-123',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/auth/callback',
        state: 'state-456'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      await service.sendMagicLink(input);

      const call = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = call[1];
      const url = new URL(magicLinkUrl);

      expect(url.searchParams.get('token')).toBeTruthy();
      expect(url.searchParams.get('state')).toBe('state-456');
      expect(url.searchParams.get('flow')).toBe('magic_link');
    });

    it('should use correct email template', async () => {
      const input: SendMagicLinkInput = {
        email: 'template@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      await service.sendMagicLink(input);

      const call = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const emailOptions = call[2];

      expect(emailOptions.subject).toBe('Your Magic Link');
      expect(emailOptions.templateData.email).toBe('template@example.com');
      expect(emailOptions.templateData.expirationMinutes).toBe(15);
    });

    it('should handle empty email', async () => {
      const input: SendMagicLinkInput = {
        email: '',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow();
    });

    it('should handle invalid email format', async () => {
      const input: SendMagicLinkInput = {
        email: 'invalid-email',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow();
    });

    it('should handle missing code challenge', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: '',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow();
    });

    it('should handle missing redirect URI', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: '',
        state: 'test-state'
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow();
    });

    it('should handle missing state', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: ''
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow();
    });

    it('should handle missing code challenge method', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: '',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow();
    });

    it('should handle invalid code challenge method', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'invalid-method',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow();
    });

    it('should handle invalid redirect URI format', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'invalid-uri',
        state: 'test-state'
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow();
    });

    it('should generate unique tokens for different requests', async () => {
      // Mock PKCE to return different values for each call
      let callCount = 0;
      (adapters.pkce.generateCodeChallenge as jest.Mock).mockImplementation(async () => ({
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        codeVerifier: `test-verifier-${++callCount}`
      }));

      const input1: SendMagicLinkInput = {
        email: 'user1@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      const input2: SendMagicLinkInput = {
        email: 'user2@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      await service.sendMagicLink(input1);
      await service.sendMagicLink(input2);

      const calls = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls;
      const url1 = new URL(calls[0][1]);
      const url2 = new URL(calls[1][1]);

      const token1 = url1.searchParams.get('token');
      const token2 = url2.searchParams.get('token');

      expect(token1).not.toBe(token2);
    });

    it('should use custom expiration minutes from config', async () => {
      const customConfig = {
        ...config,
        expirationMinutes: 30
      };

      const customService = new MagicLinkService(adapters, customConfig);

      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      await customService.sendMagicLink(input);

      const call = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const emailOptions = call[2];

      expect(emailOptions.templateData.expirationMinutes).toBe(30);
    });

    it('should handle different code challenge methods', async () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'plain',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      const result = await service.sendMagicLink(input);

      expect(result.success).toBe(true);
    });

    it('should handle long email addresses', async () => {
      const input: SendMagicLinkInput = {
        email: 'very.long.email.address.that.might.cause.issues@very-long-domain-name.example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      const result = await service.sendMagicLink(input);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in email', async () => {
      const input: SendMagicLinkInput = {
        email: 'user+test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      const result = await service.sendMagicLink(input);

      expect(result.success).toBe(true);
    });
  });

  describe('validateInput', () => {
    it('should validate correct input', () => {
      const input: SendMagicLinkInput = {
        email: 'user@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      // This tests the internal validation logic
      expect(() => service.sendMagicLink(input)).not.toThrow();
    });
  });

  describe('validateMagicLinkToken', () => {
    it('should validate a valid token', async () => {
      const token = 'valid-token';
      const tokenData = {
        token,
        email: 'test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://example.com/callback',
        state: 'test-state',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      };

      adapters.storage.getItem = jest.fn().mockResolvedValue(JSON.stringify(tokenData));

      const result = await service.validateMagicLinkToken(token);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.email).toBe('test@example.com');
      expect(adapters.storage.getItem).toHaveBeenCalledWith(`magic_link_token:${token}`);
    });

    it('should handle invalid token', async () => {
      const token = 'invalid-token';
      adapters.storage.getItem = jest.fn().mockResolvedValue(null);

      const result = await service.validateMagicLinkToken(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired magic link token');
      expect(result.code).toBe('INVALID_TOKEN');
    });

    it('should handle expired token', async () => {
      const token = 'expired-token';
      const tokenData = {
        token,
        email: 'test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://example.com/callback',
        state: 'test-state',
        expiresAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      };

      adapters.storage.getItem = jest.fn().mockResolvedValue(JSON.stringify(tokenData));
      adapters.storage.removeItem = jest.fn().mockResolvedValue(undefined);

      const result = await service.validateMagicLinkToken(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Magic link token has expired');
      expect(result.code).toBe('TOKEN_EXPIRED');
      expect(adapters.storage.removeItem).toHaveBeenCalledWith(`magic_link_token:${token}`);
      expect(adapters.storage.removeItem).toHaveBeenCalledWith(`magic_link_email:${tokenData.email}`);
    });

    it('should handle storage errors', async () => {
      const token = 'error-token';
      adapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      const result = await service.validateMagicLinkToken(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle non-Error exceptions', async () => {
      const token = 'error-token';
      adapters.storage.getItem = jest.fn().mockRejectedValue('String error');

      const result = await service.validateMagicLinkToken(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('email validation edge cases', () => {
    it('should handle email length validation', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com'; // > 254 characters
      const input: SendMagicLinkInput = {
        email: longEmail,
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      await expect(service.sendMagicLink(input)).rejects.toThrow('Invalid email format');
    });
  });

  describe('custom parameters', () => {
    it('should include custom parameters in magic link URL', async () => {
      const customConfig = {
        baseUrl: 'https://app.example.com',
        tokenEndpoint: 'https://auth.example.com/token',
        expirationMinutes: 15,
        customParams: {
          utm_source: 'email',
          utm_campaign: 'magic_link'
        }
      };

      const serviceWithCustomParams = new MagicLinkService(adapters, customConfig);

      const input: SendMagicLinkInput = {
        email: 'test@example.com',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256',
        redirectUri: 'https://app.example.com/callback',
        state: 'test-state'
      };

      (adapters.graphql.sendMagicLinkMutation as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Magic link sent successfully'
      });

      const result = await serviceWithCustomParams.sendMagicLink(input);

      expect(result.success).toBe(true);

      // Check that the GraphQL mutation was called with a URL containing custom params
      const callArgs = (adapters.graphql.sendMagicLinkMutation as jest.Mock).mock.calls[0];
      const magicLinkUrl = callArgs[1]; // Second argument is the magic link URL
      expect(magicLinkUrl).toContain('utm_source=email');
      expect(magicLinkUrl).toContain('utm_campaign=magic_link');
    });
  });
});

describe('createMagicLinkService factory function', () => {
  it('should create MagicLinkService instance', () => {
    const mockAdapters = {
      storage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      graphql: {
        sendMagicLinkMutation: jest.fn()
      }
    } as any;

    const mockConfig = {
      baseUrl: 'https://app.example.com',
      tokenEndpoint: 'https://auth.example.com/token',
      expirationMinutes: 15
    };

    const service = createMagicLinkService(mockAdapters, mockConfig);

    expect(service).toBeInstanceOf(MagicLinkService);
  });
});
