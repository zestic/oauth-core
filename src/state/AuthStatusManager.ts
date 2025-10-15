/**
 * Centralized authentication status tracking and management
 * Provides reactive auth status updates with granular state transitions
 */

import type { EventEmitter } from '../events/EventEmitter';
import type { OAuthEventMap, AuthStatus } from '../events/OAuthEvents';

export interface AuthStatusManagerOptions {
  /**
   * Whether to emit status change events
   */
  emitEvents?: boolean;

  /**
   * Initial authentication status
   */
  initialStatus?: AuthStatus;
}

/**
 * Manages authentication status with reactive updates
 * Provides centralized tracking of auth state transitions
 */
export class AuthStatusManager {
  private _currentStatus: AuthStatus;
  private eventEmitter?: EventEmitter<OAuthEventMap>;
  private emitEvents: boolean;

  constructor(
    eventEmitter?: EventEmitter<OAuthEventMap>,
    options: AuthStatusManagerOptions = {}
  ) {
    this.eventEmitter = eventEmitter;
    this.emitEvents = options.emitEvents ?? true;
    this._currentStatus = options.initialStatus ?? 'unauthenticated';
  }

  /**
   * Get the current authentication status
   */
  get status(): AuthStatus {
    return this._currentStatus;
  }

  /**
   * Check if user is currently authenticated
   */
  get isAuthenticated(): boolean {
    return this._currentStatus === 'authenticated';
  }

  /**
   * Check if authentication is in progress
   */
  get isAuthenticating(): boolean {
    return this._currentStatus === 'authenticating';
  }

  /**
   * Check if authentication status indicates an error state
   */
  get hasError(): boolean {
    return this._currentStatus === 'error';
  }

  /**
   * Check if tokens are expired
   */
  get isExpired(): boolean {
    return this._currentStatus === 'expired';
  }

  /**
   * Check if tokens are currently being refreshed
   */
  get isRefreshing(): boolean {
    return this._currentStatus === 'refreshing';
  }

  /**
   * Check if user is unauthenticated
   */
  get isUnauthenticated(): boolean {
    return this._currentStatus === 'unauthenticated';
  }

  /**
   * Set the authentication status
   * Emits authStatusChange event if status actually changed
   */
  setStatus(status: AuthStatus): void {
    const previousStatus = this._currentStatus;

    if (previousStatus === status) {
      return; // No change, don't emit
    }

    this._currentStatus = status;

    // Emit status change event if enabled
    if (this.emitEvents && this.eventEmitter) {
      this.eventEmitter.emit('authStatusChange', status, previousStatus);
    }
  }

  /**
   * Transition to authenticating status
   */
  startAuthenticating(): void {
    this.setStatus('authenticating');
  }

  /**
   * Transition to authenticated status
   */
  setAuthenticated(): void {
    this.setStatus('authenticated');
  }

  /**
   * Transition to unauthenticated status
   */
  setUnauthenticated(): void {
    this.setStatus('unauthenticated');
  }

  /**
   * Transition to error status
   */
  setError(): void {
    this.setStatus('error');
  }

  /**
   * Transition to expired status
   */
  setExpired(): void {
    this.setStatus('expired');
  }

  /**
   * Transition to refreshing status
   */
  startRefreshing(): void {
    this.setStatus('refreshing');
  }

  /**
   * Get a human-readable description of the current status
   */
  getStatusDescription(): string {
    switch (this._currentStatus) {
      case 'unauthenticated':
        return 'Not authenticated';
      case 'authenticating':
        return 'Authentication in progress';
      case 'authenticated':
        return 'Successfully authenticated';
      case 'refreshing':
        return 'Refreshing authentication tokens';
      case 'expired':
        return 'Authentication tokens have expired';
      case 'error':
        return 'Authentication error occurred';
      default:
        return 'Unknown authentication status';
    }
  }

  /**
   * Check if the current status allows certain operations
   */
  canPerformOperation(operation: 'login' | 'logout' | 'refresh'): boolean {
    switch (operation) {
      case 'login':
        return this._currentStatus === 'unauthenticated' || this._currentStatus === 'error';
      case 'logout':
        return this._currentStatus === 'authenticated' || this._currentStatus === 'expired';
      case 'refresh':
        return this._currentStatus === 'authenticated' || this._currentStatus === 'expired';
      default:
        return false;
    }
  }

  /**
   * Reset to initial unauthenticated state
   */
  reset(): void {
    this.setStatus('unauthenticated');
  }

  /**
   * Get the status transition history (for debugging)
   * Note: This is a simplified implementation - in production you'd want
   * proper logging/metrics collection
   */
  getTransitionInfo(): { from: AuthStatus; to: AuthStatus; timestamp: Date } | null {
    // This would need proper implementation in a real system
    return null;
  }
}