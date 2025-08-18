/**
 * PKCE (Proof Key for Code Exchange) management
 */

import { PKCEAdapter, PKCEChallenge, StorageAdapter } from '../types/OAuthTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export class PKCEManager {
  private static readonly STORAGE_KEYS = {
    CODE_VERIFIER: 'pkce_code_verifier',
    CODE_CHALLENGE: 'pkce_code_challenge',
    CODE_CHALLENGE_METHOD: 'pkce_code_challenge_method',
    STATE: 'oauth_state',
  };

  constructor(
    private pkceAdapter: PKCEAdapter,
    private storageAdapter: StorageAdapter
  ) {}

  /**
   * Generate PKCE challenge and store code verifier
   */
  async generateChallenge(): Promise<PKCEChallenge> {
    try {
      const challenge = await this.pkceAdapter.generateCodeChallenge();
      
      // Store the code verifier for later use
      await this.storageAdapter.setItem(
        PKCEManager.STORAGE_KEYS.CODE_VERIFIER,
        challenge.codeVerifier
      );
      
      await this.storageAdapter.setItem(
        PKCEManager.STORAGE_KEYS.CODE_CHALLENGE,
        challenge.codeChallenge
      );
      
      await this.storageAdapter.setItem(
        PKCEManager.STORAGE_KEYS.CODE_CHALLENGE_METHOD,
        challenge.codeChallengeMethod
      );

      return challenge;
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to generate PKCE challenge',
        'PKCE_GENERATION_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Generate and store OAuth state parameter
   */
  async generateState(): Promise<string> {
    try {
      const state = await this.pkceAdapter.generateState();
      
      await this.storageAdapter.setItem(
        PKCEManager.STORAGE_KEYS.STATE,
        state
      );
      
      return state;
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to generate OAuth state',
        'STATE_GENERATION_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Retrieve stored code verifier
   */
  async getCodeVerifier(): Promise<string | null> {
    try {
      return await this.storageAdapter.getItem(PKCEManager.STORAGE_KEYS.CODE_VERIFIER);
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to retrieve code verifier',
        'PKCE_RETRIEVAL_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Retrieve stored code challenge
   */
  async getCodeChallenge(): Promise<string | null> {
    try {
      return await this.storageAdapter.getItem(PKCEManager.STORAGE_KEYS.CODE_CHALLENGE);
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to retrieve code challenge',
        'PKCE_RETRIEVAL_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Retrieve stored state
   */
  async getStoredState(): Promise<string | null> {
    try {
      return await this.storageAdapter.getItem(PKCEManager.STORAGE_KEYS.STATE);
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to retrieve stored state',
        'STATE_RETRIEVAL_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate state parameter against stored value
   */
  async validateState(receivedState: string): Promise<boolean> {
    try {
      const storedState = await this.getStoredState();
      
      if (!storedState) {
        return false;
      }
      
      return storedState === receivedState;
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to validate state parameter',
        'STATE_VALIDATION_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Clear all stored PKCE data
   */
  async clearPKCEData(): Promise<void> {
    try {
      const keys = Object.values(PKCEManager.STORAGE_KEYS);
      await this.storageAdapter.removeItems(keys);
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to clear PKCE data',
        'STORAGE_CLEAR_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if PKCE data exists in storage
   */
  async hasPKCEData(): Promise<boolean> {
    try {
      const codeVerifier = await this.getCodeVerifier();
      return codeVerifier !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get all stored PKCE data
   */
  async getAllPKCEData(): Promise<{
    codeVerifier: string | null;
    codeChallenge: string | null;
    codeChallengeMethod: string | null;
    state: string | null;
  }> {
    try {
      const [codeVerifier, codeChallenge, codeChallengeMethod, state] = await Promise.all([
        this.getCodeVerifier(),
        this.getCodeChallenge(),
        this.storageAdapter.getItem(PKCEManager.STORAGE_KEYS.CODE_CHALLENGE_METHOD),
        this.getStoredState(),
      ]);

      return {
        codeVerifier,
        codeChallenge,
        codeChallengeMethod,
        state,
      };
    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to retrieve PKCE data',
        'PKCE_RETRIEVAL_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
