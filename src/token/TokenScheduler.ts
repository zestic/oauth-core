/**
 * Automatic token refresh scheduler
 * Manages timing for token refresh operations with configurable buffer time
 */

import type { EventEmitter } from '../events/EventEmitter';
import type { OAuthEventMap, OAuthTokens } from '../events/OAuthEvents';
import { TokenUtils } from './TokenUtils';

export interface TokenSchedulerOptions {
  /**
   * Minimum delay before refresh (in milliseconds)
   * Prevents immediate refresh scheduling for very short expirations
   */
  minRefreshDelayMs?: number;

  /**
   * Maximum delay before refresh (in milliseconds)
   * Caps the scheduling delay to prevent extremely long waits
   */
  maxRefreshDelayMs?: number;
}

/**
 * Scheduler for automatic OAuth token refresh
 * Ensures tokens are refreshed before expiration with configurable buffer time
 */
export class TokenScheduler {
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private eventEmitter?: EventEmitter<OAuthEventMap>;
  private options: Required<TokenSchedulerOptions>;

  constructor(
    eventEmitter?: EventEmitter<OAuthEventMap>,
    options: TokenSchedulerOptions = {}
  ) {
    this.eventEmitter = eventEmitter;
    this.options = {
      minRefreshDelayMs: options.minRefreshDelayMs ?? 1000, // 1 second minimum
      maxRefreshDelayMs: options.maxRefreshDelayMs ?? 86400000, // 24 hours maximum
      ...options
    };
  }

  /**
   * Schedule a token refresh operation
   * @param tokens Current OAuth tokens
   * @param bufferMs Buffer time before expiration to trigger refresh (default: 5 minutes)
   * @param callback Function to call when refresh should happen
   * @returns Function to cancel the scheduled refresh
   */
  scheduleRefresh(
    tokens: OAuthTokens,
    bufferMs: number = 300000, // 5 minutes default
    callback: () => Promise<void>
  ): () => void {
    // Cancel any existing refresh timer
    this.cancelScheduledRefresh();

    // Calculate time until refresh should happen
    const timeUntilExpiration = TokenUtils.getTimeUntilExpiration(tokens);
    const refreshDelay = Math.max(0, timeUntilExpiration - bufferMs);

    // Apply min/max bounds
    const boundedDelay = Math.max(
      this.options.minRefreshDelayMs,
      Math.min(this.options.maxRefreshDelayMs, refreshDelay)
    );

    // Don't schedule if delay is too short (token might already need refresh)
    if (refreshDelay < this.options.minRefreshDelayMs) {
      console.warn('TokenScheduler: Token refresh needed immediately or very soon, not scheduling');
      return () => {}; // Return no-op cancel function
    }

    // Calculate scheduled time for event emission
    const scheduledAt = new Date(Date.now() + boundedDelay);

    // Emit scheduling event
    this.eventEmitter?.emit('tokenRefreshScheduled', scheduledAt, bufferMs);

    console.log(`TokenScheduler: Scheduling token refresh at ${scheduledAt.toISOString()} (in ${Math.round(boundedDelay / 1000)}s)`);

    // Schedule the refresh
    this.refreshTimer = setTimeout(async () => {
      console.log('TokenScheduler: Executing scheduled token refresh');
      try {
        await callback();
      } catch (error) {
        console.error('TokenScheduler: Scheduled token refresh failed:', error);
        // Note: We don't reschedule here - let the caller handle retry logic
      } finally {
        // Clear the timer reference
        this.refreshTimer = undefined;
      }
    }, boundedDelay);

    // Return cancel function
    return () => this.cancelScheduledRefresh();
  }

  /**
   * Cancel any currently scheduled token refresh
   */
  cancelScheduledRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
      console.log('TokenScheduler: Cancelled scheduled token refresh');
    }
  }

  /**
   * Check if a refresh is currently scheduled
   */
  isRefreshScheduled(): boolean {
    return this.refreshTimer !== undefined;
  }

  /**
   * Get the time until the next scheduled refresh (in milliseconds)
   * Returns undefined if no refresh is scheduled
   */
  getTimeUntilScheduledRefresh(): number | undefined {
    if (!this.refreshTimer) {
      return undefined;
    }

    // This is a simplified implementation
    // In a real-world scenario, you'd want to track the scheduled time more accurately
    return undefined; // Not implemented for simplicity
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancelScheduledRefresh();
    this.eventEmitter = undefined;
  }
}