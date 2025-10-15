/**
 * Tests for TokenScheduler class
 */

import { TokenScheduler } from '../../src/token/TokenScheduler';
import type { OAuthTokens, OAuthEventMap } from '../../src/events/OAuthEvents';
import { EventEmitter } from '../../src/events/EventEmitter';

describe('TokenScheduler', () => {
  let scheduler: TokenScheduler;
  let mockEventEmitter: EventEmitter<OAuthEventMap>;
  let mockTokens: OAuthTokens;
  let mockCallback: jest.MockedFunction<() => Promise<void>>;

  beforeEach(() => {
    mockEventEmitter = new EventEmitter<OAuthEventMap>();
    scheduler = new TokenScheduler(mockEventEmitter);
    mockTokens = {
      accessToken: 'test-token',
      expiresIn: 3600, // 1 hour
      tokenType: 'Bearer'
    };
    mockCallback = jest.fn().mockResolvedValue(undefined);

    // Mock console methods to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    scheduler.destroy();
    jest.restoreAllMocks();
  });

  describe('scheduleRefresh', () => {
    it('should schedule refresh with default buffer', () => {
      const cancelFn = scheduler.scheduleRefresh(mockTokens, undefined, mockCallback);

      expect(scheduler.isRefreshScheduled()).toBe(true);
      expect(typeof cancelFn).toBe('function');

      // Clean up
      cancelFn();
      expect(scheduler.isRefreshScheduled()).toBe(false);
    });

    it('should schedule refresh with custom buffer', () => {
      const bufferMs = 600000; // 10 minutes
      const cancelFn = scheduler.scheduleRefresh(mockTokens, bufferMs, mockCallback);

      expect(scheduler.isRefreshScheduled()).toBe(true);

      cancelFn();
    });

    it('should emit tokenRefreshScheduled event', () => {
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

      scheduler.scheduleRefresh(mockTokens, 300000, mockCallback);

      expect(emitSpy).toHaveBeenCalledWith('tokenRefreshScheduled', expect.any(Date), 300000);
    });

    it('should replace previous timer when scheduling new refresh', () => {
      scheduler.scheduleRefresh(mockTokens, 300000, mockCallback);
      expect(scheduler.isRefreshScheduled()).toBe(true);

      // Schedule a new refresh - this should replace the previous timer
      const cancelFn2 = scheduler.scheduleRefresh(mockTokens, 600000, mockCallback);
      expect(scheduler.isRefreshScheduled()).toBe(true);

      // Cancel the current timer
      cancelFn2();
      expect(scheduler.isRefreshScheduled()).toBe(false);
    });

    it('should not schedule refresh if delay is below minimum', () => {
      // Create tokens that expire very soon (less than min delay)
      const soonExpiringTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 1 // 1 second
      };

      const cancelFn = scheduler.scheduleRefresh(soonExpiringTokens, 500, mockCallback); // 0.5 second buffer

      expect(scheduler.isRefreshScheduled()).toBe(false);
      expect(cancelFn).toBeDefined(); // Should return a function, but it's a no-op

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Token refresh needed immediately')
      );
    });

    it('should apply maximum delay bound', () => {
      // Create tokens that expire very far in the future
      const longExpiringTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 86400 * 30 // 30 days
      };

      const cancelFn = scheduler.scheduleRefresh(longExpiringTokens, 0, mockCallback);

      // Should be scheduled (within max bounds)
      expect(scheduler.isRefreshScheduled()).toBe(true);

      cancelFn();
    });
  });

  describe('cancelScheduledRefresh', () => {
    it('should cancel scheduled refresh', () => {
      scheduler.scheduleRefresh(mockTokens, 300000, mockCallback);
      expect(scheduler.isRefreshScheduled()).toBe(true);

      scheduler.cancelScheduledRefresh();
      expect(scheduler.isRefreshScheduled()).toBe(false);
    });

    it('should handle canceling when no refresh is scheduled', () => {
      expect(scheduler.isRefreshScheduled()).toBe(false);
      expect(() => scheduler.cancelScheduledRefresh()).not.toThrow();
    });
  });

  describe('isRefreshScheduled', () => {
    it('should return false when no refresh is scheduled', () => {
      expect(scheduler.isRefreshScheduled()).toBe(false);
    });

    it('should return true when refresh is scheduled', () => {
      scheduler.scheduleRefresh(mockTokens, 300000, mockCallback);
      expect(scheduler.isRefreshScheduled()).toBe(true);
    });
  });

  describe('automatic execution', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should execute callback when timer fires', async () => {
      // Schedule refresh with very short delay for testing
      const shortTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 10 // 10 seconds
      };

      scheduler.scheduleRefresh(shortTokens, 5000, mockCallback); // 5 second buffer

      // Fast-forward time
      await jest.advanceTimersByTimeAsync(6000); // 6 seconds

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(scheduler.isRefreshScheduled()).toBe(false); // Timer should be cleared
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = jest.fn().mockRejectedValue(new Error('Refresh failed'));
      const shortTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 10
      };

      scheduler.scheduleRefresh(shortTokens, 5000, errorCallback);

      // Fast-forward time
      await jest.advanceTimersByTimeAsync(6000);

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        'TokenScheduler: Scheduled token refresh failed:',
        expect.any(Error)
      );
    });

    it('should clear timer after execution', async () => {
      const shortTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 10
      };

      scheduler.scheduleRefresh(shortTokens, 5000, mockCallback);

      await jest.advanceTimersByTimeAsync(6000);

      expect(scheduler.isRefreshScheduled()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should cancel any scheduled refresh and clean up resources', () => {
      scheduler.scheduleRefresh(mockTokens, 300000, mockCallback);
      expect(scheduler.isRefreshScheduled()).toBe(true);

      scheduler.destroy();

      expect(scheduler.isRefreshScheduled()).toBe(false);
    });
  });

  describe('options', () => {
    it('should apply custom minimum refresh delay', () => {
      const customScheduler = new TokenScheduler(mockEventEmitter, {
        minRefreshDelayMs: 5000 // 5 seconds
      });

      const soonExpiringTokens: OAuthTokens = {
        ...mockTokens,
        expiresIn: 3 // 3 seconds - below minimum
      };

      customScheduler.scheduleRefresh(soonExpiringTokens, 0, mockCallback);

      expect(customScheduler.isRefreshScheduled()).toBe(false);

      customScheduler.destroy();
    });

    it('should work without event emitter', () => {
      const schedulerNoEvents = new TokenScheduler();

      const cancelFn = schedulerNoEvents.scheduleRefresh(mockTokens, 300000, mockCallback);

      expect(schedulerNoEvents.isRefreshScheduled()).toBe(true);

      cancelFn();
      expect(schedulerNoEvents.isRefreshScheduled()).toBe(false);

      schedulerNoEvents.destroy();
    });
  });
});