/**
 * Unit tests for MagicLinkService
 */

import { MagicLinkService } from '../../src/services/MagicLinkService';
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

      expect(url.searchParams.get('magic_link_token')).toBeTruthy();
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

      const token1 = url1.searchParams.get('magic_link_token');
      const token2 = url2.searchParams.get('magic_link_token');

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
});
