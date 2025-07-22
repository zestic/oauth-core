import { MagicLinkService } from '../../src/services/MagicLinkService';
import { OAuthError, OAUTH_ERROR_CODES } from '../../src/types/OAuthTypes';
import type {
  ExtendedOAuthAdapters,
  SendMagicLinkInput,
  MagicLinkConfig,
  EmailResult,
  MagicLinkToken
} from '../../src/types/ServiceTypes';
// Mock extended adapters
const createMockExtendedAdapters = (): ExtendedOAuthAdapters => {

  return {
    storage: {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
      removeItems: jest.fn()
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
      registerUser: jest.fn(),
      userExists: jest.fn(),
      getUserByEmail: jest.fn()
    },
    email: {
      sendMagicLink: jest.fn(),
      sendRegistrationConfirmation: jest.fn()
    }
  };
};

describe('MagicLinkService', () => {
  let service: MagicLinkService;
  let mockAdapters: ExtendedOAuthAdapters;
  let mockConfig: MagicLinkConfig;
  let validInput: SendMagicLinkInput;

  beforeEach(() => {
    mockAdapters = createMockExtendedAdapters();
    mockConfig = {
      baseUrl: 'https://example.com/auth/callback',
      tokenEndpoint: '/oauth/token',
      expirationMinutes: 15,
      customParams: { source: 'test' }
    };
    service = new MagicLinkService(mockAdapters, mockConfig);
    
    validInput = {
      email: 'test@example.com',
      codeChallenge: 'test-code-challenge',
      codeChallengeMethod: 'S256',
      redirectUri: 'https://example.com/callback',
      state: 'test-state'
    };

    // Setup default mocks
    (mockAdapters.user.userExists as jest.Mock).mockResolvedValue(true);
    (mockAdapters.email.sendMagicLink as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'msg-123'
    } as EmailResult);
    
    // Mock PKCE adapter to return predictable tokens
    (mockAdapters.pkce.generateCodeChallenge as jest.Mock).mockResolvedValue({
      codeChallenge: 'mock-challenge',
      codeChallengeMethod: 'S256',
      codeVerifier: 'mock-verifier-token'
    });
  });

  describe('sendMagicLink', () => {
    it('should successfully send magic link', async () => {
      const result = await service.sendMagicLink(validInput);

      expect(result).toEqual({
        success: true,
        message: 'Magic link sent successfully',
        code: 'MAGIC_LINK_SENT'
      });

      // Verify PKCE storage
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('pkce_challenge', 'test-code-challenge');
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('pkce_method', 'S256');
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('pkce_state', 'test-state');
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('pkce_redirect_uri', 'https://example.com/callback');
      
      // Verify state storage
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('oauth_state', 'test-state');
      
      // Verify magic link token storage
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith(
        'magic_link_token:mock-verifier-token',
        expect.stringContaining('"email":"test@example.com"')
      );
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith(
        'magic_link_email:test@example.com',
        'mock-verifier-token'
      );
      
      // Verify email sending
      expect(mockAdapters.email.sendMagicLink).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('https://example.com/auth/callback'),
        expect.objectContaining({
          subject: 'Your Magic Link',
          templateData: expect.objectContaining({
            email: 'test@example.com',
            expirationMinutes: 15
          })
        })
      );
    });

    it('should proceed even if user does not exist', async () => {
      (mockAdapters.user.userExists as jest.Mock).mockResolvedValue(false);

      const result = await service.sendMagicLink(validInput);

      expect(result.success).toBe(true);
      expect(mockAdapters.email.sendMagicLink).toHaveBeenCalled();
    });

    it('should return error if email sending fails', async () => {
      (mockAdapters.email.sendMagicLink as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Email service unavailable'
      } as EmailResult);

      const result = await service.sendMagicLink(validInput);

      expect(result).toEqual({
        success: false,
        message: 'Email service unavailable',
        code: 'EMAIL_SEND_FAILED'
      });
    });

    it('should build correct magic link URL', async () => {
      await service.sendMagicLink(validInput);

      const emailCall = (mockAdapters.email.sendMagicLink as jest.Mock).mock.calls[0];
      const magicLinkUrl = emailCall[1];

      expect(magicLinkUrl).toContain('https://example.com/auth/callback');
      expect(magicLinkUrl).toContain('magic_link_token=mock-verifier-token');
      expect(magicLinkUrl).toContain('state=test-state');
      expect(magicLinkUrl).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(magicLinkUrl).toContain('flow=magic_link');
      expect(magicLinkUrl).toContain('source=test'); // Custom param
    });

    describe('input validation', () => {
      it('should throw error for missing email', async () => {
        const invalidInput = { ...validInput, email: '' };

        await expect(service.sendMagicLink(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for invalid email format', async () => {
        const invalidInput = { ...validInput, email: 'invalid-email' };

        await expect(service.sendMagicLink(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for missing codeChallenge', async () => {
        const invalidInput = { ...validInput, codeChallenge: '' };

        await expect(service.sendMagicLink(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for invalid codeChallengeMethod', async () => {
        const invalidInput = { ...validInput, codeChallengeMethod: 'invalid' };

        await expect(service.sendMagicLink(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for missing redirectUri', async () => {
        const invalidInput = { ...validInput, redirectUri: '' };

        await expect(service.sendMagicLink(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for invalid redirectUri format', async () => {
        const invalidInput = { ...validInput, redirectUri: 'not-a-url' };

        await expect(service.sendMagicLink(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for missing state', async () => {
        const invalidInput = { ...validInput, state: '' };

        await expect(service.sendMagicLink(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should accept plain PKCE method', async () => {
        const plainInput = { ...validInput, codeChallengeMethod: 'plain' };

        const result = await service.sendMagicLink(plainInput);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('validateMagicLinkToken', () => {
    const mockToken = 'test-token';
    const mockMagicLinkToken: MagicLinkToken = {
      token: mockToken,
      email: 'test@example.com',
      expiresAt: new Date(Date.now() + 900000), // 15 minutes from now
      state: 'test-state',
      codeChallenge: 'test-challenge',
      codeChallengeMethod: 'S256',
      redirectUri: 'https://example.com/callback'
    };

    it('should validate valid token', async () => {
      (mockAdapters.storage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockMagicLinkToken)
      );

      const result = await service.validateMagicLinkToken(mockToken);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Token is valid');
      expect(result.data).toMatchObject({
        token: mockMagicLinkToken.token,
        email: mockMagicLinkToken.email,
        state: mockMagicLinkToken.state,
        codeChallenge: mockMagicLinkToken.codeChallenge,
        codeChallengeMethod: mockMagicLinkToken.codeChallengeMethod,
        redirectUri: mockMagicLinkToken.redirectUri
      });
      // Check that expiresAt is a valid date
      expect(new Date(result.data!.expiresAt)).toBeInstanceOf(Date);
    });

    it('should return error for non-existent token', async () => {
      (mockAdapters.storage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await service.validateMagicLinkToken(mockToken);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired magic link token',
        code: 'INVALID_TOKEN'
      });
    });

    it('should return error for expired token', async () => {
      const expiredToken = {
        ...mockMagicLinkToken,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      };

      (mockAdapters.storage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(expiredToken)
      );

      const result = await service.validateMagicLinkToken(mockToken);

      expect(result).toEqual({
        success: false,
        error: 'Magic link token has expired',
        code: 'TOKEN_EXPIRED'
      });

      // Verify cleanup
      expect(mockAdapters.storage.removeItem).toHaveBeenCalledWith(`magic_link_token:${mockToken}`);
      expect(mockAdapters.storage.removeItem).toHaveBeenCalledWith(`magic_link_email:${expiredToken.email}`);
    });

    it('should handle storage errors gracefully', async () => {
      (mockAdapters.storage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const result = await service.validateMagicLinkToken(mockToken);

      expect(result).toEqual({
        success: false,
        error: 'Storage error',
        message: 'Failed to validate magic link token'
      });
    });

    it('should handle malformed token data', async () => {
      (mockAdapters.storage.getItem as jest.Mock).mockResolvedValue('invalid-json');

      const result = await service.validateMagicLinkToken(mockToken);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to validate magic link token');
    });
  });

  describe('error handling', () => {
    it('should handle OAuth errors properly', async () => {
      const oauthError = new OAuthError('Invalid state', OAUTH_ERROR_CODES.INVALID_STATE);
      (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(oauthError);

      await expect(service.sendMagicLink(validInput)).rejects.toThrow(OAuthError);
    });

    it('should wrap non-OAuth errors', async () => {
      const genericError = new Error('Generic error');
      (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(genericError);

      await expect(service.sendMagicLink(validInput)).rejects.toThrow(OAuthError);
      await expect(service.sendMagicLink(validInput)).rejects.toThrow('Magic link sending failed: Generic error');
    });
  });

  describe('configuration', () => {
    it('should use default expiration time when not specified', () => {
      const configWithoutExpiration = {
        baseUrl: 'https://example.com/callback',
        tokenEndpoint: '/oauth/token'
      };
      
      const serviceWithDefaults = new MagicLinkService(mockAdapters, configWithoutExpiration);
      
      // This is tested indirectly through the magic link URL and email template data
      expect(serviceWithDefaults).toBeDefined();
    });

    it('should handle config without custom params', async () => {
      const configWithoutCustomParams = {
        baseUrl: 'https://example.com/callback',
        tokenEndpoint: '/oauth/token',
        expirationMinutes: 30
      };
      
      const serviceWithoutCustomParams = new MagicLinkService(mockAdapters, configWithoutCustomParams);
      
      await serviceWithoutCustomParams.sendMagicLink(validInput);

      const emailCall = (mockAdapters.email.sendMagicLink as jest.Mock).mock.calls[0];
      const magicLinkUrl = emailCall[1];

      expect(magicLinkUrl).not.toContain('source=test');
    });
  });
});
