/**
 * Tests for OAuthError base class
 */

import { OAuthError, OAuthErrorType, OAuthErrorMetadata } from '../../src/errors/OAuthError';

describe('OAuthError', () => {
  describe('Basic functionality', () => {
    it('should create an OAuthError with required parameters', () => {
      const error = new OAuthError('Test message', 'TEST_CODE', 'auth');

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.type).toBe('auth');
      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBeUndefined();
      expect(error.name).toBe('OAuthError');
      expect(error.isOAuthError).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create an OAuthError with all parameters', () => {
      const metadata: OAuthErrorMetadata = {
        operation: 'test_operation',
        retryCount: 2,
        context: { key: 'value' }
      };

      const error = new OAuthError(
        'Test message',
        'TEST_CODE',
        'network',
        true,
        500,
        metadata
      );

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.type).toBe('network');
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(500);
      expect(error.metadata).toEqual(expect.objectContaining(metadata));
      expect(error.metadata.timestamp).toBeInstanceOf(Date);
    });

    it('should be an instance of Error', () => {
      const error = new OAuthError('Test', 'TEST', 'auth');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OAuthError);
    });

    it('should preserve original error stack', () => {
      const originalError = new Error('Original error');
      const error = new OAuthError('Test', 'TEST', 'auth', false, undefined, {
        originalError
      });

      expect(error.stack).toContain('Caused by:');
      expect(error.stack).toContain(originalError.stack);
    });
  });

  describe('Retry functionality', () => {
    it('should return correct retry status', () => {
      const retryableError = new OAuthError('Test', 'TEST', 'auth', true);
      const nonRetryableError = new OAuthError('Test', 'TEST', 'auth', false);

      expect(retryableError.canRetry()).toBe(true);
      expect(nonRetryableError.canRetry()).toBe(false);
    });

    it('should calculate retry delay with exponential backoff', () => {
      const error = new OAuthError('Test', 'TEST', 'auth', true);

      // No retry count - should be 1000ms
      expect(error.getRetryDelay()).toBe(1000);

      // With retry count
      const errorWithRetry = error.withRetry(2);
      expect(errorWithRetry.getRetryDelay()).toBe(4000); // 1000 * 2^2

      // Max delay should be capped at 30s
      const errorWithHighRetry = error.withRetry(10);
      expect(errorWithHighRetry.getRetryDelay()).toBe(30000);
    });

    it('should return 0 delay for non-retryable errors', () => {
      const error = new OAuthError('Test', 'TEST', 'auth', false);
      expect(error.getRetryDelay()).toBe(0);
    });

    it('should create new error with incremented retry count', () => {
      const originalError = new OAuthError('Test', 'TEST', 'auth', true);
      const retriedError = originalError.withRetry(3);

      expect(retriedError.metadata.retryCount).toBe(3);
      expect(retriedError.message).toBe(originalError.message);
      expect(retriedError.code).toBe(originalError.code);
      expect(retriedError).not.toBe(originalError); // Should be a new instance
    });
  });

  describe('Context functionality', () => {
    it('should add context to error', () => {
      const error = new OAuthError('Test', 'TEST', 'auth');
      const contextError = error.withContext({ key: 'value', number: 42 });

      expect(contextError.metadata.context).toEqual({ key: 'value', number: 42 });
      expect(contextError).not.toBe(error); // Should be a new instance
    });

    it('should merge context with existing context', () => {
      const error = new OAuthError('Test', 'TEST', 'auth', false, undefined, {
        context: { existing: 'value' }
      });

      const contextError = error.withContext({ new: 'value' });

      expect(contextError.metadata.context).toEqual({
        existing: 'value',
        new: 'value'
      });
    });
  });

  describe('Type checking', () => {
    it('should check error type correctly', () => {
      const networkError = new OAuthError('Test', 'TEST', 'network');
      const authError = new OAuthError('Test', 'TEST', 'auth');

      expect(networkError.isType('network')).toBe(true);
      expect(networkError.isType('auth')).toBe(false);
      expect(authError.isType('auth')).toBe(true);
      expect(authError.isType('network')).toBe(false);
    });

    it('should check error code correctly', () => {
      const error = new OAuthError('Test', 'SPECIFIC_CODE', 'auth');

      expect(error.hasCode('SPECIFIC_CODE')).toBe(true);
      expect(error.hasCode('OTHER_CODE')).toBe(false);
    });
  });

  describe('User messages', () => {
    it('should return appropriate user messages for each type', () => {
      const types: OAuthErrorType[] = ['network', 'auth', 'token', 'config', 'validation', 'flow'];
      
      types.forEach(type => {
        const error = new OAuthError('Test', 'TEST', type);
        const userMessage = error.getUserMessage();
        
        expect(userMessage).toBeTruthy();
        expect(typeof userMessage).toBe('string');
        expect(userMessage.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const metadata: OAuthErrorMetadata = {
        operation: 'test',
        retryCount: 1,
        context: { key: 'value' }
      };

      const error = new OAuthError('Test message', 'TEST_CODE', 'auth', true, 400, metadata);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'OAuthError',
        message: 'Test message',
        code: 'TEST_CODE',
        type: 'auth',
        retryable: true,
        statusCode: 400,
        timestamp: error.timestamp.toISOString(),
        metadata,
        stack: error.stack
      });
    });
  });

  describe('Static methods', () => {
    it('should identify OAuthError instances', () => {
      const oauthError = new OAuthError('Test', 'TEST', 'auth');
      const regularError = new Error('Test');
      const objectWithFlag = { isOAuthError: true };

      expect(OAuthError.isOAuthError(oauthError)).toBe(true);
      expect(OAuthError.isOAuthError(regularError)).toBe(false);
      expect(OAuthError.isOAuthError(objectWithFlag)).toBe(true);
      expect(OAuthError.isOAuthError(null)).toBe(false);
      expect(OAuthError.isOAuthError(undefined)).toBe(false);
      expect(OAuthError.isOAuthError('string')).toBe(false);
    });

    it('should create OAuthError from generic Error', () => {
      const originalError = new Error('Original message');
      const oauthError = OAuthError.fromError(originalError, 'TEST_CODE', 'network', true);

      expect(oauthError.message).toBe('Original message');
      expect(oauthError.code).toBe('TEST_CODE');
      expect(oauthError.type).toBe('network');
      expect(oauthError.retryable).toBe(true);
      expect(oauthError.metadata.originalError).toBe(originalError);
    });
  });

  describe('Error inheritance', () => {
    it('should work with instanceof checks', () => {
      const error = new OAuthError('Test', 'TEST', 'auth');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof OAuthError).toBe(true);
    });

    it('should work with try-catch blocks', () => {
      expect(() => {
        throw new OAuthError('Test', 'TEST', 'auth');
      }).toThrow(OAuthError);

      expect(() => {
        throw new OAuthError('Test', 'TEST', 'auth');
      }).toThrow(Error);
    });
  });
});
