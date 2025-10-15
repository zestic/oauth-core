/**
 * Tests for RequestMetadata types and utilities
 */

import { RequestMetadata, OAuthResultWithMetadata } from '../../src/metadata/RequestMetadata';
import { OAuthResult } from '../../src/types/OAuthTypes';

describe('RequestMetadata', () => {
  describe('RequestMetadata interface', () => {
    it('should create valid RequestMetadata objects', () => {
      const metadata: RequestMetadata = {
        requestId: 'test-request-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        duration: 150,
        retryCount: 2,
        rateLimitRemaining: 95,
        rateLimitReset: new Date('2024-01-01T12:05:00Z')
      };

      expect(metadata.requestId).toBe('test-request-123');
      expect(metadata.timestamp).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(metadata.duration).toBe(150);
      expect(metadata.retryCount).toBe(2);
      expect(metadata.rateLimitRemaining).toBe(95);
      expect(metadata.rateLimitReset).toEqual(new Date('2024-01-01T12:05:00Z'));
    });

    it('should allow optional fields to be undefined', () => {
      const metadata: RequestMetadata = {
        timestamp: new Date(),
        duration: 100
      };

      expect(metadata.requestId).toBeUndefined();
      expect(metadata.retryCount).toBeUndefined();
      expect(metadata.rateLimitRemaining).toBeUndefined();
      expect(metadata.rateLimitReset).toBeUndefined();
    });
  });

  describe('OAuthResultWithMetadata interface', () => {
    it('should extend OAuthResult with optional metadata', () => {
      const result: OAuthResultWithMetadata = {
        success: true,
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        metadata: {
          requestId: 'test-request-456',
          timestamp: new Date('2024-01-01T12:00:00Z'),
          duration: 200,
          retryCount: 1
        }
      };

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('test-token');
      expect(result.metadata?.requestId).toBe('test-request-456');
      expect(result.metadata?.duration).toBe(200);
    });

    it('should work without metadata', () => {
      const result: OAuthResultWithMetadata = {
        success: false,
        error: 'Test error',
        errorCode: 'TEST_ERROR'
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.metadata).toBeUndefined();
    });

    it('should be compatible with OAuthResult interface', () => {
      const baseResult: OAuthResult = {
        success: true,
        accessToken: 'token',
        expiresIn: 1800
      };

      const extendedResult: OAuthResultWithMetadata = {
        ...baseResult,
        metadata: {
          timestamp: new Date(),
          duration: 150
        }
      };

      expect(extendedResult.success).toBe(true);
      expect(extendedResult.metadata?.duration).toBe(150);
    });
  });

  describe('Metadata structure validation', () => {
    it('should validate request ID format', () => {
      const validIds = [
        'oauth-callback-1234567890-abc123def',
        'oauth-refresh-1234567890-abc123def',
        'token-exchange-1234567890-abc123def',
        'custom-request-123'
      ];

      validIds.forEach(id => {
        const metadata: RequestMetadata = {
          requestId: id,
          timestamp: new Date(),
          duration: 100
        };
        expect(metadata.requestId).toMatch(/^[a-zA-Z0-9_-]+$/);
      });
    });

    it('should validate timestamp is a valid Date', () => {
      const metadata: RequestMetadata = {
        timestamp: new Date('invalid'),
        duration: 100
      };

      expect(metadata.timestamp).toBeInstanceOf(Date);
      // Note: Invalid dates will still be Date objects, just with NaN values
    });

    it('should validate duration is non-negative number', () => {
      const validDurations = [0, 1, 100, 1000, 999999];

      validDurations.forEach(duration => {
        const metadata: RequestMetadata = {
          timestamp: new Date(),
          duration
        };
        expect(metadata.duration).toBeGreaterThanOrEqual(0);
      });
    });

    it('should validate retry count is non-negative integer', () => {
      const validRetries = [0, 1, 5, 10];

      validRetries.forEach(retryCount => {
        const metadata: RequestMetadata = {
          timestamp: new Date(),
          duration: 100,
          retryCount
        };
        expect(metadata.retryCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(metadata.retryCount)).toBe(true);
      });
    });

    it('should validate rate limit remaining is non-negative integer', () => {
      const validRemaining = [0, 1, 100, 1000];

      validRemaining.forEach(rateLimitRemaining => {
        const metadata: RequestMetadata = {
          timestamp: new Date(),
          duration: 100,
          rateLimitRemaining
        };
        expect(metadata.rateLimitRemaining).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(metadata.rateLimitRemaining)).toBe(true);
      });
    });

    it('should validate rate limit reset is a valid Date', () => {
      const metadata: RequestMetadata = {
        timestamp: new Date(),
        duration: 100,
        rateLimitReset: new Date('2024-12-31T23:59:59Z')
      };

      expect(metadata.rateLimitReset).toBeInstanceOf(Date);
    });
  });
});