import { ErrorHandler } from '../../src/utils/ErrorHandler';
import { OAuthError, TokenError, ValidationError, ConfigError, FlowError } from '../../src/errors';

describe('ErrorHandler', () => {
  describe('createError', () => {
    it('should create OAuthError with message and code', () => {
      const error = ErrorHandler.createError('Test message', 'TOKEN_INVALID_GRANT');

      expect(error).toBeInstanceOf(OAuthError);
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TOKEN_INVALID_GRANT');
    });

    it('should create OAuthError with original error', () => {
      const originalError = new Error('Original error');
      const error = ErrorHandler.createError('Test message', 'TOKEN_INVALID_GRANT', originalError);
      
      expect(error.metadata?.originalError).toBe(originalError);
    });
  });

  describe('handleNetworkError', () => {
    it('should create network error with proper message', () => {
      const originalError = new Error('Connection failed');
      const error = ErrorHandler.handleNetworkError(originalError);
      
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.metadata?.originalError).toBe(originalError);
    });
  });

  describe('handleTokenExchangeError', () => {
    it('should create token exchange error with default message', () => {
      const originalError = new Error('HTTP 400');
      const error = ErrorHandler.handleTokenExchangeError(originalError);

      expect(error).toBeInstanceOf(TokenError);
      expect(error.message).toBe('Token exchange failed');
      expect(error.code).toBe('TOKEN_ERROR');
      expect(error.metadata?.originalError).toBe(originalError);
    });

    it('should use error_description from response', () => {
      const originalError = new Error('HTTP 400');
      const response = { error_description: 'Invalid client credentials' };
      const error = ErrorHandler.handleTokenExchangeError(originalError, response);
      
      expect(error.message).toBe('Token exchange failed: Invalid client credentials');
    });

    it('should use error from response when no error_description', () => {
      const originalError = new Error('HTTP 400');
      const response = { error: 'invalid_client' };
      const error = ErrorHandler.handleTokenExchangeError(originalError, response);
      
      expect(error.message).toBe('Token exchange failed: invalid_client');
    });

    it('should handle null response', () => {
      const originalError = new Error('HTTP 400');
      const error = ErrorHandler.handleTokenExchangeError(originalError, null);
      
      expect(error.message).toBe('Token exchange failed');
    });

    it('should handle non-object response', () => {
      const originalError = new Error('HTTP 400');
      const error = ErrorHandler.handleTokenExchangeError(originalError, 'string response');
      
      expect(error.message).toBe('Token exchange failed');
    });
  });

  describe('handleInvalidState', () => {
    it('should create error with both expected and received state', () => {
      const error = ErrorHandler.handleInvalidState('expected-state', 'received-state');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid state parameter. Expected: expected-state, Received: received-state');
      expect(error.code).toBe('VALIDATION_INVALID_STATE');
    });

    it('should create error with default message when states not provided', () => {
      const error = ErrorHandler.handleInvalidState();
      
      expect(error.message).toBe('Invalid or missing state parameter');
      expect(error.code).toBe('VALIDATION_INVALID_STATE');
    });

    it('should create error with default message when only one state provided', () => {
      const error = ErrorHandler.handleInvalidState('expected-state');
      
      expect(error.message).toBe('Invalid or missing state parameter');
    });
  });

  describe('handleMissingParameter', () => {
    it('should create error for missing parameter', () => {
      const error = ErrorHandler.handleMissingParameter('client_id');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Missing required parameter: client_id');
      expect(error.code).toBe('VALIDATION_MISSING_PARAMETER');
    });
  });

  describe('handleInvalidConfiguration', () => {
    it('should create error for invalid configuration', () => {
      const error = ErrorHandler.handleInvalidConfiguration('Missing redirect URI');

      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Invalid configuration: Missing redirect URI');
      expect(error.code).toBe('CONFIG_ERROR');
    });
  });

  describe('handleUnknownFlow', () => {
    it('should create error for unknown flow', () => {
      const error = ErrorHandler.handleUnknownFlow('unknown_flow');

      expect(error).toBeInstanceOf(FlowError);
      expect(error.message).toBe('Unknown flow: unknown_flow');
      expect(error.code).toBe('FLOW_UNKNOWN');
    });
  });

  describe('handleNoFlowHandler', () => {
    it('should create error when no flow handler found', () => {
      const error = ErrorHandler.handleNoFlowHandler();

      expect(error).toBeInstanceOf(FlowError);
      expect(error.message).toBe('No suitable flow handler found for the provided parameters');
      expect(error.code).toBe('FLOW_NO_HANDLER_FOUND');
    });
  });

  describe('handleFlowValidationFailed', () => {
    it('should create error with flow name only', () => {
      const error = ErrorHandler.handleFlowValidationFailed('authorization_code');

      expect(error).toBeInstanceOf(FlowError);
      expect(error.message).toBe('Flow validation failed for authorization_code');
      expect(error.code).toBe('FLOW_VALIDATION_FAILED');
    });

    it('should create error with flow name and reason', () => {
      const error = ErrorHandler.handleFlowValidationFailed('authorization_code', 'Missing state parameter');
      
      expect(error.message).toBe('Flow validation failed for authorization_code: Missing state parameter');
      expect(error.code).toBe('FLOW_VALIDATION_FAILED');
    });
  });

  describe('isOAuthError', () => {
    it('should return true for OAuthError instances', () => {
      const error = new OAuthError('Test', 'TOKEN_INVALID_GRANT', 'auth');
      
      expect(ErrorHandler.isOAuthError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Test');
      
      expect(ErrorHandler.isOAuthError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(ErrorHandler.isOAuthError('string')).toBe(false);
      expect(ErrorHandler.isOAuthError(null)).toBe(false);
      expect(ErrorHandler.isOAuthError(undefined)).toBe(false);
      expect(ErrorHandler.isOAuthError({})).toBe(false);
    });
  });

  describe('getErrorCode', () => {
    it('should return code for OAuthError', () => {
      const error = new OAuthError('Test', 'TOKEN_INVALID_GRANT', 'auth');

      expect(ErrorHandler.getErrorCode(error)).toBe('TOKEN_INVALID_GRANT');
    });

    it('should return undefined for non-OAuthError', () => {
      const error = new Error('Test');
      
      expect(ErrorHandler.getErrorCode(error)).toBeUndefined();
    });

    it('should return undefined for non-error objects', () => {
      expect(ErrorHandler.getErrorCode('string')).toBeUndefined();
      expect(ErrorHandler.getErrorCode(null)).toBeUndefined();
    });
  });

  describe('formatError', () => {
    it('should format OAuthError with code and message', () => {
      const error = new OAuthError('Test message', 'TOKEN_INVALID_GRANT', 'auth');

      expect(ErrorHandler.formatError(error)).toBe('[TOKEN_INVALID_GRANT] Test message');
    });

    it('should format regular Error with message only', () => {
      const error = new Error('Test message');
      
      expect(ErrorHandler.formatError(error)).toBe('Test message');
    });

    it('should format non-error objects as string', () => {
      expect(ErrorHandler.formatError('string error')).toBe('string error');
      expect(ErrorHandler.formatError(null)).toBe('null');
      expect(ErrorHandler.formatError(undefined)).toBe('undefined');
      expect(ErrorHandler.formatError(123)).toBe('123');
    });
  });

  describe('logError', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log error without context', () => {
      const error = new Error('Test error');
      
      ErrorHandler.logError(error);
      
      expect(consoleSpy).toHaveBeenCalledWith('Test error');
    });

    it('should log error with context', () => {
      const error = new Error('Test error');
      
      ErrorHandler.logError(error, 'Authentication');
      
      expect(consoleSpy).toHaveBeenCalledWith('Authentication: Test error');
    });

    it('should log OAuthError and original error', () => {
      const originalError = new Error('Original error');
      const oauthError = new OAuthError('OAuth error', 'TOKEN_INVALID_GRANT', 'auth', false, undefined, { originalError });

      ErrorHandler.logError(oauthError);

      expect(consoleSpy).toHaveBeenCalledWith('[TOKEN_INVALID_GRANT] OAuth error');
      expect(consoleSpy).toHaveBeenCalledWith('Original error:', originalError);
    });

    it('should log OAuthError without original error', () => {
      const oauthError = new OAuthError('OAuth error', 'TOKEN_INVALID_GRANT', 'auth');

      ErrorHandler.logError(oauthError);

      expect(consoleSpy).toHaveBeenCalledWith('[TOKEN_INVALID_GRANT] OAuth error');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });
  });
});
