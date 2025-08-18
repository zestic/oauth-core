/**
 * Tests for NetworkError class
 */

import { NetworkError } from '../../src/errors/NetworkError';
import { OAuthError } from '../../src/errors/OAuthError';

describe('NetworkError', () => {
  describe('Basic functionality', () => {
    it('should create a NetworkError with status code', () => {
      const error = new NetworkError('Network failed', 500);

      expect(error.message).toBe('Network failed');
      expect(error.statusCode).toBe(500);
      expect(error.type).toBe('network');
      expect(error.name).toBe('NetworkError');
      expect(error).toBeInstanceOf(OAuthError);
      expect(error).toBeInstanceOf(NetworkError);
    });

    it('should create a NetworkError without status code', () => {
      const error = new NetworkError('Connection failed');

      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBeUndefined();
      expect(error.code).toBe('NETWORK_CONNECTION_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should set correct error codes based on status code', () => {
      const serverError = new NetworkError('Server error', 500);
      const rateLimitError = new NetworkError('Rate limited', 429);
      const timeoutError = new NetworkError('Timeout', 408);
      const clientError = new NetworkError('Client error', 400);

      expect(serverError.code).toBe('NETWORK_SERVER_ERROR');
      expect(rateLimitError.code).toBe('NETWORK_RATE_LIMITED');
      expect(timeoutError.code).toBe('NETWORK_TIMEOUT');
      expect(clientError.code).toBe('NETWORK_CLIENT_ERROR');
    });

    it('should set correct retryable status based on status code', () => {
      const serverError = new NetworkError('Server error', 500);
      const rateLimitError = new NetworkError('Rate limited', 429);
      const clientError = new NetworkError('Client error', 400);
      const connectionError = new NetworkError('Connection failed');

      expect(serverError.retryable).toBe(true);
      expect(rateLimitError.retryable).toBe(true);
      expect(clientError.retryable).toBe(false);
      expect(connectionError.retryable).toBe(true);
    });
  });

  describe('Error type checking', () => {
    it('should identify timeout errors', () => {
      const timeout408 = new NetworkError('Timeout', 408);
      const timeout504 = new NetworkError('Gateway timeout', 504);
      const timeoutByCode = new NetworkError('Timeout', undefined, { timeout: 5000 });

      expect(timeout408.isTimeout()).toBe(true);
      expect(timeout504.isTimeout()).toBe(true);
      expect(timeoutByCode.isTimeout()).toBe(false); // Only checks status code
    });

    it('should identify rate limit errors', () => {
      const rateLimitError = new NetworkError('Rate limited', 429);
      const normalError = new NetworkError('Server error', 500);

      expect(rateLimitError.isRateLimited()).toBe(true);
      expect(normalError.isRateLimited()).toBe(false);
    });

    it('should identify server errors', () => {
      const serverError = new NetworkError('Server error', 500);
      const badGateway = new NetworkError('Bad gateway', 502);
      const clientError = new NetworkError('Client error', 400);

      expect(serverError.isServerError()).toBe(true);
      expect(badGateway.isServerError()).toBe(true);
      expect(clientError.isServerError()).toBe(false);
    });

    it('should identify connection errors', () => {
      const connectionError = new NetworkError('Connection failed');
      const connectionErrorWithFlag = new NetworkError('Failed', undefined, { connectionError: true });
      const httpError = new NetworkError('HTTP error', 500);

      expect(connectionError.isConnectionError()).toBe(true);
      expect(connectionErrorWithFlag.isConnectionError()).toBe(true);
      expect(httpError.isConnectionError()).toBe(false);
    });
  });

  describe('Retry delay calculation', () => {
    it('should use rate limit reset time when available', () => {
      const resetTime = new Date(Date.now() + 10000); // 10 seconds from now
      const error = new NetworkError('Rate limited', 429, {
        rateLimitReset: resetTime
      });

      const delay = error.getRetryDelay();
      expect(delay).toBeGreaterThan(9000);
      expect(delay).toBeLessThan(11000);
    });

    it('should cap rate limit delay at 5 minutes', () => {
      const resetTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const error = new NetworkError('Rate limited', 429, {
        rateLimitReset: resetTime
      });

      const delay = error.getRetryDelay();
      expect(delay).toBe(5 * 60 * 1000); // Capped at 5 minutes
    });

    it('should use longer delay for 429 errors without reset time', () => {
      const error = new NetworkError('Rate limited', 429);
      const delay = error.getRetryDelay();
      expect(delay).toBe(5000); // 5 seconds for first retry
    });

    it('should use exponential backoff for other retryable errors', () => {
      const error = new NetworkError('Server error', 500);
      const delay = error.getRetryDelay();
      expect(delay).toBe(1000); // Default exponential backoff
    });
  });

  describe('User messages', () => {
    it('should return appropriate messages for different error types', () => {
      const rateLimitError = new NetworkError('Rate limited', 429);
      const timeoutError = new NetworkError('Timeout', 408);
      const serverError = new NetworkError('Server error', 500);
      const connectionError = new NetworkError('Connection failed');

      expect(rateLimitError.getUserMessage()).toContain('Too many requests');
      expect(timeoutError.getUserMessage()).toContain('timed out');
      expect(serverError.getUserMessage()).toContain('Server error');
      expect(connectionError.getUserMessage()).toContain('Unable to connect');
    });
  });

  describe('Static factory methods', () => {
    it('should create NetworkError from HTTP response', () => {
      const responseBody = {
        error: 'invalid_request',
        error_description: 'The request is invalid'
      };

      const error = NetworkError.fromHttpResponse(
        400,
        responseBody,
        'https://api.example.com/token',
        'POST',
        { 'Content-Type': 'application/json' },
        { 'x-ratelimit-remaining': '10' }
      );

      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('The request is invalid');
      expect((error.metadata as any).url).toBe('https://api.example.com/token');
      expect((error.metadata as any).method).toBe('POST');
      expect((error.metadata as any).rateLimitRemaining).toBe(10);
    });

    it('should create NetworkError from connection error', () => {
      const originalError = new Error('Connection refused');
      const error = NetworkError.fromConnectionError(
        originalError,
        'https://api.example.com/token',
        'POST'
      );

      expect(error.message).toContain('Connection failed');
      expect(error.message).toContain('Connection refused');
      expect(error.statusCode).toBeUndefined();
      expect((error.metadata as any).connectionError).toBe(true);
      expect(error.metadata.originalError).toBe(originalError);
    });

    it('should create NetworkError from timeout', () => {
      const error = NetworkError.fromTimeout(
        5000,
        'https://api.example.com/token',
        'POST'
      );

      expect(error.message).toContain('timed out after 5000ms');
      expect(error.statusCode).toBe(408);
      expect((error.metadata as any).timeout).toBe(5000);
      expect(error.isTimeout()).toBe(true);
    });
  });

  describe('Rate limit handling', () => {
    it('should parse rate limit headers correctly', () => {
      const error = NetworkError.fromHttpResponse(
        429,
        { error: 'rate_limit_exceeded' },
        'https://api.example.com/token',
        'POST',
        {},
        {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60)
        }
      );

      expect(error.metadata.rateLimitRemaining).toBe(0);
      expect(error.metadata.rateLimitReset).toBeInstanceOf(Date);
      expect(error.isRateLimited()).toBe(true);
    });
  });

  describe('Error message extraction', () => {
    it('should extract error from response body', () => {
      const testCases = [
        {
          body: { error_description: 'Invalid client' },
          expected: 'Invalid client'
        },
        {
          body: { error: 'invalid_client' },
          expected: 'invalid_client'
        },
        {
          body: { message: 'Something went wrong' },
          expected: 'Something went wrong'
        },
        {
          body: 'Plain string error',
          expected: 'HTTP 400'
        }
      ];

      testCases.forEach(({ body, expected }) => {
        const error = NetworkError.fromHttpResponse(400, body);
        expect(error.message).toContain(expected);
      });
    });
  });
});
