/**
 * Tests for ErrorFactory utility class
 */

import { ErrorFactory, OAUTH_ERROR_CODES } from '../../src/errors';
import { NetworkError } from '../../src/errors/NetworkError';
import { TokenError } from '../../src/errors/TokenError';
import { ConfigError } from '../../src/errors/ConfigError';
import { ValidationError } from '../../src/errors/ValidationError';
import { FlowError } from '../../src/errors/FlowError';
import { OAuthError } from '../../src/errors/OAuthError';

describe('ErrorFactory', () => {
  describe('Network error factories', () => {
    it('should create network error from status code', () => {
      const error = ErrorFactory.networkError(500, { error: 'server_error' }, 'https://api.example.com', 'POST');

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.statusCode).toBe(500);
      expect((error.metadata as any).url).toBe('https://api.example.com');
      expect((error.metadata as any).method).toBe('POST');
    });

    it('should create connection error', () => {
      const originalError = new Error('Connection refused');
      const error = ErrorFactory.connectionError(originalError, 'https://api.example.com', 'GET');

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.isConnectionError()).toBe(true);
      expect(error.metadata.originalError).toBe(originalError);
    });
  });

  describe('Token error factories', () => {
    it('should create token expired errors', () => {
      const accessExpired = ErrorFactory.tokenExpired('access');
      const refreshExpired = ErrorFactory.tokenExpired('refresh');

      expect(accessExpired).toBeInstanceOf(TokenError);
      expect(accessExpired.code).toBe('ACCESS_TOKEN_EXPIRED');
      expect(refreshExpired.code).toBe('REFRESH_TOKEN_EXPIRED');
    });

    it('should create token invalid errors', () => {
      const accessInvalid = ErrorFactory.tokenInvalid('access', '...abc123');
      const refreshInvalid = ErrorFactory.tokenInvalid('refresh', '...def456');

      expect(accessInvalid).toBeInstanceOf(TokenError);
      expect(accessInvalid.code).toBe('ACCESS_TOKEN_INVALID');
      expect((accessInvalid.metadata as any).tokenHint).toBe('...abc123');
      expect(refreshInvalid.code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('should create token missing errors', () => {
      const accessMissing = ErrorFactory.tokenMissing('access');
      const refreshMissing = ErrorFactory.tokenMissing('refresh');

      expect(accessMissing).toBeInstanceOf(TokenError);
      expect(accessMissing.code).toBe('ACCESS_TOKEN_MISSING');
      expect(refreshMissing.code).toBe('REFRESH_TOKEN_MISSING');
    });
  });

  describe('Config error factories', () => {
    it('should create config missing field error', () => {
      const error = ErrorFactory.configMissingField('clientId', 'config.clientId');

      expect(error).toBeInstanceOf(ConfigError);
      expect(error.code).toBe('CONFIG_REQUIRED_FIELD_MISSING');
      expect(error.getConfigField()).toBe('clientId');
      expect(error.getConfigPath()).toBe('config.clientId');
    });

    it('should create config invalid value error', () => {
      const error = ErrorFactory.configInvalidValue('grantType', 'invalid', ['authorization_code', 'refresh_token']);

      expect(error).toBeInstanceOf(ConfigError);
      expect(error.code).toBe('CONFIG_INVALID_VALUE');
      expect((error.metadata as any).validValues).toEqual(['authorization_code', 'refresh_token']);
    });
  });

  describe('Validation error factories', () => {
    it('should create validation missing parameter error', () => {
      const error = ErrorFactory.validationMissingParameter('code');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('VALIDATION_REQUIRED_PARAMETER_MISSING');
      expect(error.getParameterName()).toBe('code');
    });

    it('should create validation invalid parameter error', () => {
      const error = ErrorFactory.validationInvalidParameter('response_type', 'invalid', ['code', 'token']);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('VALIDATION_INVALID_VALUE');
      expect((error.metadata as any).allowedValues).toEqual(['code', 'token']);
    });
  });

  describe('Flow error factories', () => {
    it('should create flow no handler error', () => {
      const error = ErrorFactory.flowNoHandler(['login', 'register']);

      expect(error).toBeInstanceOf(FlowError);
      expect(error.code).toBe('FLOW_NO_HANDLER_FOUND');
      expect(error.getAvailableFlows()).toEqual(['login', 'register']);
    });

    it('should create flow validation failed error', () => {
      const error = ErrorFactory.flowValidationFailed('magic_link', 'Missing token parameter', ['token']);

      expect(error).toBeInstanceOf(FlowError);
      expect(error.code).toBe('FLOW_VALIDATION_FAILED');
      expect(error.getFlowName()).toBe('magic_link');
      expect((error.metadata as any).missingParameters).toEqual(['token']);
    });
  });

  describe('Generic error conversion', () => {
    it('should convert generic Error to OAuthError', () => {
      const originalError = new Error('Something went wrong');
      const oauthError = ErrorFactory.fromError(originalError, 'network', 'CUSTOM_CODE', true);

      expect(oauthError).toBeInstanceOf(OAuthError);
      expect(oauthError.type).toBe('network');
      expect(oauthError.code).toBe('CUSTOM_CODE');
      expect(oauthError.retryable).toBe(true);
      expect(oauthError.metadata.originalError).toBe(originalError);
    });

    it('should use default parameters', () => {
      const originalError = new Error('Something went wrong');
      const oauthError = ErrorFactory.fromError(originalError);

      expect(oauthError.type).toBe('auth');
      expect(oauthError.code).toBe('TOKEN_ERROR');
      expect(oauthError.retryable).toBe(false);
    });
  });

  describe('Error type detection', () => {
    it('should identify OAuth errors', () => {
      const oauthError = new OAuthError('Test', 'TEST', 'auth');
      const regularError = new Error('Test');

      expect(ErrorFactory.isOAuthError(oauthError)).toBe(true);
      expect(ErrorFactory.isOAuthError(regularError)).toBe(false);
    });

    it('should get error type from code', () => {
      expect(ErrorFactory.getErrorType('NETWORK_ERROR')).toBe('network');
      expect(ErrorFactory.getErrorType('TOKEN_EXPIRED')).toBe('token');
      expect(ErrorFactory.getErrorType('CONFIG_MISSING')).toBe('config');
      expect(ErrorFactory.getErrorType('VALIDATION_FAILED')).toBe('validation');
      expect(ErrorFactory.getErrorType('FLOW_ERROR')).toBe('flow');
      expect(ErrorFactory.getErrorType('UNKNOWN_CODE')).toBe('auth');
    });
  });

  describe('Error code constants', () => {
    it('should have all required error codes', () => {
      // Pre-1.0: Error codes are now string literals in the OAUTH_ERROR_CODES constant
      expect(OAUTH_ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(OAUTH_ERROR_CODES.NETWORK_CONNECTION_ERROR).toBe('NETWORK_CONNECTION_ERROR');
      expect(OAUTH_ERROR_CODES.NETWORK_SERVER_ERROR).toBe('NETWORK_SERVER_ERROR');
      expect(OAUTH_ERROR_CODES.NETWORK_RATE_LIMITED).toBe('NETWORK_RATE_LIMITED');

      expect(OAUTH_ERROR_CODES.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
      expect(OAUTH_ERROR_CODES.TOKEN_INVALID).toBe('TOKEN_INVALID');
      expect(OAUTH_ERROR_CODES.TOKEN_MISSING).toBe('TOKEN_MISSING');
      expect(OAUTH_ERROR_CODES.ACCESS_TOKEN_EXPIRED).toBe('ACCESS_TOKEN_EXPIRED');
      expect(OAUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED).toBe('REFRESH_TOKEN_EXPIRED');

      expect(OAUTH_ERROR_CODES.CONFIG_MISSING_FIELD).toBe('CONFIG_MISSING_FIELD');
      expect(OAUTH_ERROR_CODES.CONFIG_INVALID_VALUE).toBe('CONFIG_INVALID_VALUE');
      expect(OAUTH_ERROR_CODES.CONFIG_VALIDATION_FAILED).toBe('CONFIG_VALIDATION_FAILED');

      expect(OAUTH_ERROR_CODES.VALIDATION_MISSING_PARAMETER).toBe('VALIDATION_MISSING_PARAMETER');
      expect(OAUTH_ERROR_CODES.VALIDATION_INVALID_VALUE).toBe('VALIDATION_INVALID_VALUE');
      expect(OAUTH_ERROR_CODES.VALIDATION_STATE_MISMATCH).toBe('VALIDATION_STATE_MISMATCH');

      expect(OAUTH_ERROR_CODES.FLOW_NO_HANDLER_FOUND).toBe('FLOW_NO_HANDLER_FOUND');
      expect(OAUTH_ERROR_CODES.FLOW_VALIDATION_FAILED).toBe('FLOW_VALIDATION_FAILED');
      expect(OAUTH_ERROR_CODES.FLOW_EXECUTION_FAILED).toBe('FLOW_EXECUTION_FAILED');
    });
  });

  describe('Factory method consistency', () => {
    it('should create errors with consistent properties', () => {
      const networkError = ErrorFactory.networkError(500);
      const tokenError = ErrorFactory.tokenExpired();
      const configError = ErrorFactory.configMissingField('clientId');
      const validationError = ErrorFactory.validationMissingParameter('code');
      const flowError = ErrorFactory.flowNoHandler();

      const errors = [networkError, tokenError, configError, validationError, flowError];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(OAuthError);
        expect(error.timestamp).toBeInstanceOf(Date);
        expect(error.isOAuthError).toBe(true);
        expect(typeof error.code).toBe('string');
        expect(typeof error.type).toBe('string');
        expect(typeof error.retryable).toBe('boolean');
      });
    });
  });
});
