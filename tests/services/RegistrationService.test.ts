import { RegistrationService } from '../../src/services/RegistrationService';
import { OAuthError, OAUTH_ERROR_CODES } from '../../src/types/OAuthTypes';
import type {
  ExtendedOAuthAdapters,
  RegistrationInput,
  UserRegistrationResult,
  GraphQLResult
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

describe('RegistrationService', () => {
  let service: RegistrationService;
  let mockAdapters: ExtendedOAuthAdapters;
  let validInput: RegistrationInput;

  beforeEach(() => {
    mockAdapters = createMockExtendedAdapters();
    service = new RegistrationService(mockAdapters);
    
    validInput = {
      email: 'test@example.com',
      additionalData: { firstName: 'John', lastName: 'Doe' },
      codeChallenge: 'test-code-challenge',
      codeChallengeMethod: 'S256',
      redirectUri: 'https://example.com/callback',
      state: 'test-state'
    };

    // Setup default mocks
    (mockAdapters.user.userExists as jest.Mock).mockResolvedValue(false);
    (mockAdapters.user.registerUser as jest.Mock).mockResolvedValue({
      success: true,
      userId: 'user-123',
      message: 'User registered successfully'
    } as UserRegistrationResult);
    (mockAdapters.graphql.sendRegistrationConfirmationMutation as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'msg-123'
    } as GraphQLResult);
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const result = await service.register(validInput);

      expect(result).toEqual({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      });

      // Verify user existence check
      expect(mockAdapters.user.userExists).toHaveBeenCalledWith('test@example.com');
      
      // Verify PKCE storage
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('pkce_challenge', 'test-code-challenge');
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('pkce_method', 'S256');
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('pkce_state', 'test-state');
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('pkce_redirect_uri', 'https://example.com/callback');
      
      // Verify state storage
      expect(mockAdapters.storage.setItem).toHaveBeenCalledWith('oauth_state', 'test-state');
      
      // Verify user registration
      expect(mockAdapters.user.registerUser).toHaveBeenCalledWith(
        'test@example.com',
        { firstName: 'John', lastName: 'Doe' }
      );
      
      // Verify confirmation GraphQL mutation
      expect(mockAdapters.graphql.sendRegistrationConfirmationMutation).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          subject: 'Registration Successful',
          templateData: expect.objectContaining({
            email: 'test@example.com',
            redirectUri: 'https://example.com/callback'
          })
        })
      );
    });

    it('should return error if user already exists', async () => {
      (mockAdapters.user.userExists as jest.Mock).mockResolvedValue(true);

      const result = await service.register(validInput);

      expect(result).toEqual({
        success: false,
        message: 'User already exists with this email address',
        code: 'USER_EXISTS'
      });

      expect(mockAdapters.user.registerUser).not.toHaveBeenCalled();
    });

    it('should return error if user registration fails', async () => {
      (mockAdapters.user.registerUser as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Database error'
      } as UserRegistrationResult);

      const result = await service.register(validInput);

      expect(result).toEqual({
        success: false,
        message: 'Database error',
        code: 'REGISTRATION_FAILED'
      });
    });

    it('should continue registration even if confirmation GraphQL mutation fails', async () => {
      (mockAdapters.graphql.sendRegistrationConfirmationMutation as jest.Mock).mockRejectedValue(
        new Error('GraphQL service unavailable')
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.register(validInput);

      expect(result).toEqual({
        success: true,
        message: 'User registered successfully',
        code: 'REGISTRATION_SUCCESS'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to trigger registration confirmation:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    describe('input validation', () => {
      it('should throw error for missing email', async () => {
        const invalidInput = { ...validInput, email: '' };

        await expect(service.register(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for invalid email format', async () => {
        const invalidInput = { ...validInput, email: 'invalid-email' };

        await expect(service.register(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for missing codeChallenge', async () => {
        const invalidInput = { ...validInput, codeChallenge: '' };

        await expect(service.register(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for invalid codeChallengeMethod', async () => {
        const invalidInput = { ...validInput, codeChallengeMethod: 'invalid' };

        await expect(service.register(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for missing redirectUri', async () => {
        const invalidInput = { ...validInput, redirectUri: '' };

        await expect(service.register(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for invalid redirectUri format', async () => {
        const invalidInput = { ...validInput, redirectUri: 'not-a-url' };

        await expect(service.register(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for missing state', async () => {
        const invalidInput = { ...validInput, state: '' };

        await expect(service.register(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should throw error for missing additionalData', async () => {
        const invalidInput = { ...validInput, additionalData: null as any };

        await expect(service.register(invalidInput)).rejects.toThrow(OAuthError);
      });

      it('should accept plain PKCE method', async () => {
        const plainInput = { ...validInput, codeChallengeMethod: 'plain' };

        const result = await service.register(plainInput);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('getRegistrationStatus', () => {
    it('should return user exists with user data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        additionalData: { firstName: 'John' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (mockAdapters.user.userExists as jest.Mock).mockResolvedValue(true);
      (mockAdapters.user.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getRegistrationStatus('test@example.com');

      expect(result).toEqual({
        success: true,
        data: { exists: true, user: mockUser },
        message: 'User found'
      });
    });

    it('should return user does not exist', async () => {
      (mockAdapters.user.userExists as jest.Mock).mockResolvedValue(false);

      const result = await service.getRegistrationStatus('test@example.com');

      expect(result).toEqual({
        success: true,
        data: { exists: false },
        message: 'User not found'
      });
    });

    it('should handle errors gracefully', async () => {
      (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await service.getRegistrationStatus('test@example.com');

      expect(result).toEqual({
        success: false,
        error: 'Database connection failed',
        message: 'Failed to check registration status'
      });
    });
  });

  describe('error handling', () => {
    it('should handle OAuth errors properly', async () => {
      const oauthError = new OAuthError('Invalid state', OAUTH_ERROR_CODES.INVALID_STATE);
      (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(oauthError);

      await expect(service.register(validInput)).rejects.toThrow(OAuthError);
    });

    it('should wrap non-OAuth errors', async () => {
      const genericError = new Error('Generic error');
      (mockAdapters.user.userExists as jest.Mock).mockRejectedValue(genericError);

      await expect(service.register(validInput)).rejects.toThrow(OAuthError);
      await expect(service.register(validInput)).rejects.toThrow('Registration failed: Generic error');
    });
  });
});
