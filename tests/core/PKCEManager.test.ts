import { PKCEManager } from '../../src/core/PKCEManager';
import { OAuthError } from '../../src/types/OAuthTypes';
import { createMockAdapters } from '../mocks/adapters';

describe('PKCEManager', () => {
  let pkceManager: PKCEManager;
  let mockAdapters: ReturnType<typeof createMockAdapters>;

  beforeEach(() => {
    mockAdapters = createMockAdapters();
    pkceManager = new PKCEManager(mockAdapters.pkce, mockAdapters.storage);
  });

  describe('generateChallenge', () => {
    it('should generate and store PKCE challenge', async () => {
      const challenge = await pkceManager.generateChallenge();

      expect(challenge.codeChallenge).toBe('mock-code-challenge');
      expect(challenge.codeVerifier).toBe('mock-code-verifier');
      expect(challenge.codeChallengeMethod).toBe('S256');

      // Verify storage
      expect(await mockAdapters.storage.getItem('pkce_code_verifier')).toBe('mock-code-verifier');
      expect(await mockAdapters.storage.getItem('pkce_code_challenge')).toBe('mock-code-challenge');
      expect(await mockAdapters.storage.getItem('pkce_code_challenge_method')).toBe('S256');
    });

    it('should throw error when PKCE adapter fails', async () => {
      mockAdapters.pkce.generateCodeChallenge = jest.fn().mockRejectedValue(new Error('PKCE generation failed'));

      await expect(pkceManager.generateChallenge()).rejects.toThrow(OAuthError);
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.setItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(pkceManager.generateChallenge()).rejects.toThrow(OAuthError);
    });
  });

  describe('generateState', () => {
    it('should generate and store state', async () => {
      const state = await pkceManager.generateState();

      expect(state).toBe('mock-state');
      expect(await mockAdapters.storage.getItem('oauth_state')).toBe('mock-state');
    });

    it('should throw error when state generation fails', async () => {
      mockAdapters.pkce.generateState = jest.fn().mockRejectedValue(new Error('State generation failed'));

      await expect(pkceManager.generateState()).rejects.toThrow(OAuthError);
    });
  });

  describe('getCodeVerifier', () => {
    it('should retrieve stored code verifier', async () => {
      await mockAdapters.storage.setItem('pkce_code_verifier', 'test-verifier');

      const verifier = await pkceManager.getCodeVerifier();
      expect(verifier).toBe('test-verifier');
    });

    it('should return null when no code verifier stored', async () => {
      const verifier = await pkceManager.getCodeVerifier();
      expect(verifier).toBeNull();
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(pkceManager.getCodeVerifier()).rejects.toThrow(OAuthError);
    });
  });

  describe('getCodeChallenge', () => {
    it('should retrieve stored code challenge', async () => {
      await mockAdapters.storage.setItem('pkce_code_challenge', 'test-challenge');

      const challenge = await pkceManager.getCodeChallenge();
      expect(challenge).toBe('test-challenge');
    });

    it('should return null when no code challenge stored', async () => {
      const challenge = await pkceManager.getCodeChallenge();
      expect(challenge).toBeNull();
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(pkceManager.getCodeChallenge()).rejects.toThrow(OAuthError);
    });
  });

  describe('getStoredState', () => {
    it('should retrieve stored state', async () => {
      await mockAdapters.storage.setItem('oauth_state', 'test-state');

      const state = await pkceManager.getStoredState();
      expect(state).toBe('test-state');
    });

    it('should return null when no state stored', async () => {
      const state = await pkceManager.getStoredState();
      expect(state).toBeNull();
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(pkceManager.getStoredState()).rejects.toThrow(OAuthError);
    });
  });

  describe('clearPKCEData', () => {
    it('should clear all PKCE data', async () => {
      // Store some data first
      await mockAdapters.storage.setItem('pkce_code_verifier', 'test-verifier');
      await mockAdapters.storage.setItem('pkce_code_challenge', 'test-challenge');
      await mockAdapters.storage.setItem('pkce_code_challenge_method', 'S256');

      await pkceManager.clearPKCEData();

      expect(await mockAdapters.storage.getItem('pkce_code_verifier')).toBeNull();
      expect(await mockAdapters.storage.getItem('pkce_code_challenge')).toBeNull();
      expect(await mockAdapters.storage.getItem('pkce_code_challenge_method')).toBeNull();
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.removeItems = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(pkceManager.clearPKCEData()).rejects.toThrow(OAuthError);
    });
  });



  describe('getAllPKCEData', () => {
    it('should retrieve all PKCE data', async () => {
      await mockAdapters.storage.setItem('pkce_code_verifier', 'test-verifier');
      await mockAdapters.storage.setItem('pkce_code_challenge', 'test-challenge');
      await mockAdapters.storage.setItem('pkce_code_challenge_method', 'S256');
      await mockAdapters.storage.setItem('oauth_state', 'test-state');

      const data = await pkceManager.getAllPKCEData();

      expect(data.codeVerifier).toBe('test-verifier');
      expect(data.codeChallenge).toBe('test-challenge');
      expect(data.codeChallengeMethod).toBe('S256');
      expect(data.state).toBe('test-state');
    });

    it('should return null values when no data stored', async () => {
      const data = await pkceManager.getAllPKCEData();

      expect(data.codeVerifier).toBeNull();
      expect(data.codeChallenge).toBeNull();
      expect(data.codeChallengeMethod).toBeNull();
      expect(data.state).toBeNull();
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(pkceManager.getAllPKCEData()).rejects.toThrow(OAuthError);
    });
  });

  describe('hasPKCEData', () => {
    it('should return true when PKCE data exists', async () => {
      await mockAdapters.storage.setItem('pkce_code_verifier', 'test-verifier');

      const hasData = await pkceManager.hasPKCEData();
      expect(hasData).toBe(true);
    });

    it('should return false when no PKCE data exists', async () => {
      const hasData = await pkceManager.hasPKCEData();
      expect(hasData).toBe(false);
    });
  });

  describe('validateState', () => {
    it('should return true when state matches', async () => {
      await mockAdapters.storage.setItem('oauth_state', 'test-state');

      const isValid = await pkceManager.validateState('test-state');
      expect(isValid).toBe(true);
    });

    it('should return false when state does not match', async () => {
      await mockAdapters.storage.setItem('oauth_state', 'test-state');

      const isValid = await pkceManager.validateState('wrong-state');
      expect(isValid).toBe(false);
    });

    it('should return false when no stored state', async () => {
      const isValid = await pkceManager.validateState('any-state');
      expect(isValid).toBe(false);
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(pkceManager.validateState('test-state')).rejects.toThrow(OAuthError);
    });
  });

  describe('hasPKCEData error handling', () => {
    it('should return false when getCodeVerifier throws error', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      const hasData = await pkceManager.hasPKCEData();
      expect(hasData).toBe(false);
    });
  });

  describe('error handling with non-Error objects', () => {
    it('should handle non-Error objects in generateChallenge', async () => {
      mockAdapters.pkce.generateCodeChallenge = jest.fn().mockRejectedValue('string error');

      await expect(pkceManager.generateChallenge()).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error objects in generateState', async () => {
      mockAdapters.storage.setItem = jest.fn().mockRejectedValue('string error');

      await expect(pkceManager.generateState()).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error objects in getCodeVerifier', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue('string error');

      await expect(pkceManager.getCodeVerifier()).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error objects in clearPKCEData', async () => {
      mockAdapters.storage.removeItems = jest.fn().mockRejectedValue('string error');

      await expect(pkceManager.clearPKCEData()).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error objects in getAllPKCEData', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue('string error');

      await expect(pkceManager.getAllPKCEData()).rejects.toThrow(OAuthError);
    });
  });
});
