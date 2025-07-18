/**
 * CSRF state validation for OAuth flows
 */

import { StorageAdapter, OAUTH_ERROR_CODES } from '../types/OAuthTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export class StateValidator {
  private static readonly STATE_STORAGE_KEY = 'oauth_state';
  private static readonly STATE_EXPIRY_KEY = 'oauth_state_expiry';
  private static readonly DEFAULT_STATE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor(
    private storageAdapter: StorageAdapter,
    private stateTTL: number = StateValidator.DEFAULT_STATE_TTL
  ) {}

  /**
   * Store state with expiry time
   */
  async storeState(state: string): Promise<void> {
    try {
      const expiryTime = Date.now() + this.stateTTL;
      
      await Promise.all([
        this.storageAdapter.setItem(StateValidator.STATE_STORAGE_KEY, state),
        this.storageAdapter.setItem(StateValidator.STATE_EXPIRY_KEY, expiryTime.toString()),
      ]);
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to store OAuth state',
        OAUTH_ERROR_CODES.INVALID_STATE,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Retrieve stored state
   */
  async getStoredState(): Promise<string | null> {
    try {
      return await this.storageAdapter.getItem(StateValidator.STATE_STORAGE_KEY);
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to retrieve stored state',
        OAUTH_ERROR_CODES.INVALID_STATE,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if stored state is expired
   */
  async isStateExpired(): Promise<boolean> {
    try {
      const expiryTimeStr = await this.storageAdapter.getItem(StateValidator.STATE_EXPIRY_KEY);
      
      if (!expiryTimeStr) {
        return true; // No expiry time means expired
      }

      const expiryTime = parseInt(expiryTimeStr, 10);
      return Date.now() >= expiryTime;
    } catch {
      return true; // Error retrieving expiry means expired
    }
  }

  /**
   * Validate received state against stored state
   */
  async validateState(receivedState: string): Promise<boolean> {
    try {
      // Check if state is expired first
      if (await this.isStateExpired()) {
        await this.clearState(); // Clean up expired state
        return false;
      }

      const storedState = await this.getStoredState();
      
      if (!storedState) {
        return false;
      }

      const isValid = storedState === receivedState;
      
      // Clear state after validation (one-time use)
      if (isValid) {
        await this.clearState();
      }

      return isValid;
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to validate state parameter',
        OAUTH_ERROR_CODES.INVALID_STATE,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate state and throw error if invalid
   */
  async validateStateOrThrow(receivedState: string): Promise<void> {
    const isValid = await this.validateState(receivedState);
    
    if (!isValid) {
      const storedState = await this.getStoredState();
      throw ErrorHandler.handleInvalidState(storedState ?? undefined, receivedState);
    }
  }

  /**
   * Clear stored state
   */
  async clearState(): Promise<void> {
    try {
      await this.storageAdapter.removeItems([
        StateValidator.STATE_STORAGE_KEY,
        StateValidator.STATE_EXPIRY_KEY,
      ]);
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to clear OAuth state',
        OAUTH_ERROR_CODES.INVALID_STATE,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if state exists in storage
   */
  async hasStoredState(): Promise<boolean> {
    try {
      const state = await this.getStoredState();
      return state !== null && !(await this.isStateExpired());
    } catch {
      return false;
    }
  }

  /**
   * Get remaining TTL for stored state
   */
  async getStateRemainingTTL(): Promise<number> {
    try {
      const expiryTimeStr = await this.storageAdapter.getItem(StateValidator.STATE_EXPIRY_KEY);
      
      if (!expiryTimeStr) {
        return 0;
      }

      const expiryTime = parseInt(expiryTimeStr, 10);
      const remaining = expiryTime - Date.now();
      
      return Math.max(0, remaining);
    } catch {
      return 0;
    }
  }

  /**
   * Extend state expiry time
   */
  async extendStateExpiry(additionalTime?: number): Promise<void> {
    try {
      const extension = additionalTime ?? this.stateTTL;
      const newExpiryTime = Date.now() + extension;
      
      await this.storageAdapter.setItem(
        StateValidator.STATE_EXPIRY_KEY,
        newExpiryTime.toString()
      );
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to extend state expiry',
        OAUTH_ERROR_CODES.INVALID_STATE,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Cleanup expired state (can be called periodically)
   */
  async cleanupExpiredState(): Promise<void> {
    if (await this.isStateExpired()) {
      await this.clearState();
    }
  }
}
