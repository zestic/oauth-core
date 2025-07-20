import { StateValidator } from '../../src/core/StateValidator';
import { OAuthError } from '../../src/types/OAuthTypes';
import { createMockAdapters } from '../mocks/adapters';

describe('StateValidator', () => {
  let stateValidator: StateValidator;
  let mockAdapters: ReturnType<typeof createMockAdapters>;
  const customTTL = 5 * 60 * 1000; // 5 minutes

  beforeEach(() => {
    mockAdapters = createMockAdapters();
    stateValidator = new StateValidator(mockAdapters.storage);
  });

  describe('constructor', () => {
    it('should initialize with default TTL', () => {
      const validator = new StateValidator(mockAdapters.storage);
      expect(validator).toBeInstanceOf(StateValidator);
    });

    it('should initialize with custom TTL', () => {
      const validator = new StateValidator(mockAdapters.storage, customTTL);
      expect(validator).toBeInstanceOf(StateValidator);
    });
  });

  describe('storeState', () => {
    it('should store state with expiry time', async () => {
      const state = 'test-state-123';
      const beforeTime = Date.now();

      await stateValidator.storeState(state);

      expect(await mockAdapters.storage.getItem('oauth_state')).toBe(state);
      
      const expiryStr = await mockAdapters.storage.getItem('oauth_state_expiry');
      expect(expiryStr).toBeTruthy();
      
      const expiryTime = parseInt(expiryStr!, 10);
      expect(expiryTime).toBeGreaterThan(beforeTime);
      expect(expiryTime).toBeLessThanOrEqual(beforeTime + 10 * 60 * 1000 + 100); // Allow small margin
    });

    it('should store state with custom TTL', async () => {
      const customValidator = new StateValidator(mockAdapters.storage, customTTL);
      const state = 'test-state-custom';
      const beforeTime = Date.now();

      await customValidator.storeState(state);

      const expiryStr = await mockAdapters.storage.getItem('oauth_state_expiry');
      const expiryTime = parseInt(expiryStr!, 10);
      expect(expiryTime).toBeLessThanOrEqual(beforeTime + customTTL + 100);
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.setItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(stateValidator.storeState('test-state')).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error exceptions', async () => {
      mockAdapters.storage.setItem = jest.fn().mockRejectedValue('String error');

      await expect(stateValidator.storeState('test-state')).rejects.toThrow(OAuthError);
    });
  });

  describe('getStoredState', () => {
    it('should retrieve stored state', async () => {
      const state = 'test-state-retrieve';
      await mockAdapters.storage.setItem('oauth_state', state);

      const retrieved = await stateValidator.getStoredState();
      expect(retrieved).toBe(state);
    });

    it('should return null when no state stored', async () => {
      const retrieved = await stateValidator.getStoredState();
      expect(retrieved).toBeNull();
    });

    it('should throw error when storage fails', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      await expect(stateValidator.getStoredState()).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error exceptions', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue('String error');

      await expect(stateValidator.getStoredState()).rejects.toThrow(OAuthError);
    });
  });

  describe('isStateExpired', () => {
    it('should return false for non-expired state', async () => {
      const futureTime = Date.now() + 5 * 60 * 1000; // 5 minutes in future
      await mockAdapters.storage.setItem('oauth_state_expiry', futureTime.toString());

      const isExpired = await stateValidator.isStateExpired();
      expect(isExpired).toBe(false);
    });

    it('should return true for expired state', async () => {
      const pastTime = Date.now() - 5 * 60 * 1000; // 5 minutes in past
      await mockAdapters.storage.setItem('oauth_state_expiry', pastTime.toString());

      const isExpired = await stateValidator.isStateExpired();
      expect(isExpired).toBe(true);
    });

    it('should return true when no expiry time stored', async () => {
      const isExpired = await stateValidator.isStateExpired();
      expect(isExpired).toBe(true);
    });

    it('should return true when storage throws error', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      const isExpired = await stateValidator.isStateExpired();
      expect(isExpired).toBe(true);
    });

    it('should handle exactly expired state', async () => {
      const exactTime = Date.now();
      await mockAdapters.storage.setItem('oauth_state_expiry', exactTime.toString());

      const isExpired = await stateValidator.isStateExpired();
      expect(isExpired).toBe(true); // >= means expired
    });
  });

  describe('validateState', () => {
    it('should validate matching non-expired state', async () => {
      const state = 'valid-state-123';
      await stateValidator.storeState(state);

      const isValid = await stateValidator.validateState(state);
      expect(isValid).toBe(true);

      // State should be cleared after successful validation
      expect(await mockAdapters.storage.getItem('oauth_state')).toBeNull();
      expect(await mockAdapters.storage.getItem('oauth_state_expiry')).toBeNull();
    });

    it('should reject non-matching state', async () => {
      const storedState = 'stored-state';
      const receivedState = 'different-state';
      await stateValidator.storeState(storedState);

      const isValid = await stateValidator.validateState(receivedState);
      expect(isValid).toBe(false);

      // State should not be cleared for invalid validation
      expect(await mockAdapters.storage.getItem('oauth_state')).toBe(storedState);
    });

    it('should reject expired state and clear it', async () => {
      const state = 'expired-state';
      const pastTime = Date.now() - 5 * 60 * 1000;
      await mockAdapters.storage.setItem('oauth_state', state);
      await mockAdapters.storage.setItem('oauth_state_expiry', pastTime.toString());

      const isValid = await stateValidator.validateState(state);
      expect(isValid).toBe(false);

      // Expired state should be cleared
      expect(await mockAdapters.storage.getItem('oauth_state')).toBeNull();
    });

    it('should return false when no stored state', async () => {
      const isValid = await stateValidator.validateState('any-state');
      expect(isValid).toBe(false);
    });

    it('should throw error when validation fails', async () => {
      await stateValidator.storeState('test-state');

      // Mock getStoredState to fail after isStateExpired check passes
      const originalGetItem = mockAdapters.storage.getItem;
      mockAdapters.storage.getItem = jest.fn().mockImplementation((key: string) => {
        if (key === 'oauth_state_expiry') {
          // Return future time so isStateExpired returns false
          return Promise.resolve((Date.now() + 300000).toString());
        }
        if (key === 'oauth_state') {
          // Fail when trying to get the actual state
          return Promise.reject(new Error('Storage failed'));
        }
        return originalGetItem(key);
      });

      await expect(stateValidator.validateState('test-state')).rejects.toThrow(OAuthError);
    });
  });

  describe('validateStateOrThrow', () => {
    it('should not throw for valid state', async () => {
      const state = 'valid-state';
      await stateValidator.storeState(state);

      await expect(stateValidator.validateStateOrThrow(state)).resolves.not.toThrow();
    });

    it('should throw for invalid state', async () => {
      const storedState = 'stored-state';
      const receivedState = 'invalid-state';
      await stateValidator.storeState(storedState);

      await expect(stateValidator.validateStateOrThrow(receivedState)).rejects.toThrow(OAuthError);
    });

    it('should throw for missing state', async () => {
      await expect(stateValidator.validateStateOrThrow('any-state')).rejects.toThrow(OAuthError);
    });
  });

  describe('clearState', () => {
    it('should clear both state and expiry', async () => {
      await stateValidator.storeState('test-state');
      
      await stateValidator.clearState();

      expect(await mockAdapters.storage.getItem('oauth_state')).toBeNull();
      expect(await mockAdapters.storage.getItem('oauth_state_expiry')).toBeNull();
    });

    it('should throw error when clearing fails', async () => {
      mockAdapters.storage.removeItems = jest.fn().mockRejectedValue(new Error('Clear failed'));

      await expect(stateValidator.clearState()).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error exceptions', async () => {
      mockAdapters.storage.removeItems = jest.fn().mockRejectedValue('String error');

      await expect(stateValidator.clearState()).rejects.toThrow(OAuthError);
    });
  });

  describe('hasStoredState', () => {
    it('should return true for valid non-expired state', async () => {
      await stateValidator.storeState('test-state');

      const hasState = await stateValidator.hasStoredState();
      expect(hasState).toBe(true);
    });

    it('should return false for expired state', async () => {
      const pastTime = Date.now() - 5 * 60 * 1000;
      await mockAdapters.storage.setItem('oauth_state', 'test-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', pastTime.toString());

      const hasState = await stateValidator.hasStoredState();
      expect(hasState).toBe(false);
    });

    it('should return false when no state stored', async () => {
      const hasState = await stateValidator.hasStoredState();
      expect(hasState).toBe(false);
    });

    it('should return false when storage throws error', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      const hasState = await stateValidator.hasStoredState();
      expect(hasState).toBe(false);
    });
  });

  describe('getStateRemainingTTL', () => {
    it('should return remaining TTL for valid state', async () => {
      const futureTime = Date.now() + 5 * 60 * 1000; // 5 minutes
      await mockAdapters.storage.setItem('oauth_state_expiry', futureTime.toString());

      const remaining = await stateValidator.getStateRemainingTTL();
      expect(remaining).toBeGreaterThan(4 * 60 * 1000); // At least 4 minutes
      expect(remaining).toBeLessThanOrEqual(5 * 60 * 1000); // At most 5 minutes
    });

    it('should return 0 for expired state', async () => {
      const pastTime = Date.now() - 5 * 60 * 1000;
      await mockAdapters.storage.setItem('oauth_state_expiry', pastTime.toString());

      const remaining = await stateValidator.getStateRemainingTTL();
      expect(remaining).toBe(0);
    });

    it('should return 0 when no expiry stored', async () => {
      const remaining = await stateValidator.getStateRemainingTTL();
      expect(remaining).toBe(0);
    });

    it('should return 0 when storage throws error', async () => {
      mockAdapters.storage.getItem = jest.fn().mockRejectedValue(new Error('Storage failed'));

      const remaining = await stateValidator.getStateRemainingTTL();
      expect(remaining).toBe(0);
    });
  });

  describe('extendStateExpiry', () => {
    it('should extend state expiry with default TTL', async () => {
      await stateValidator.storeState('test-state');
      const beforeExtension = Date.now();

      await stateValidator.extendStateExpiry();

      const expiryStr = await mockAdapters.storage.getItem('oauth_state_expiry');
      const expiryTime = parseInt(expiryStr!, 10);
      expect(expiryTime).toBeGreaterThan(beforeExtension + 9 * 60 * 1000); // At least 9 minutes from now
    });

    it('should extend state expiry with custom time', async () => {
      await stateValidator.storeState('test-state');
      const customExtension = 15 * 60 * 1000; // 15 minutes
      const beforeExtension = Date.now();

      await stateValidator.extendStateExpiry(customExtension);

      const expiryStr = await mockAdapters.storage.getItem('oauth_state_expiry');
      const expiryTime = parseInt(expiryStr!, 10);
      expect(expiryTime).toBeGreaterThan(beforeExtension + 14 * 60 * 1000); // At least 14 minutes from now
    });

    it('should throw error when extension fails', async () => {
      mockAdapters.storage.setItem = jest.fn().mockRejectedValue(new Error('Extension failed'));

      await expect(stateValidator.extendStateExpiry()).rejects.toThrow(OAuthError);
    });

    it('should handle non-Error exceptions', async () => {
      mockAdapters.storage.setItem = jest.fn().mockRejectedValue('String error');

      await expect(stateValidator.extendStateExpiry()).rejects.toThrow(OAuthError);
    });
  });

  describe('cleanupExpiredState', () => {
    it('should cleanup expired state', async () => {
      const pastTime = Date.now() - 5 * 60 * 1000;
      await mockAdapters.storage.setItem('oauth_state', 'expired-state');
      await mockAdapters.storage.setItem('oauth_state_expiry', pastTime.toString());

      await stateValidator.cleanupExpiredState();

      expect(await mockAdapters.storage.getItem('oauth_state')).toBeNull();
      expect(await mockAdapters.storage.getItem('oauth_state_expiry')).toBeNull();
    });

    it('should not cleanup non-expired state', async () => {
      await stateValidator.storeState('valid-state');

      await stateValidator.cleanupExpiredState();

      expect(await mockAdapters.storage.getItem('oauth_state')).toBe('valid-state');
      expect(await mockAdapters.storage.getItem('oauth_state_expiry')).toBeTruthy();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete state lifecycle', async () => {
      const state = 'lifecycle-test-state';

      // Store state
      await stateValidator.storeState(state);
      expect(await stateValidator.hasStoredState()).toBe(true);

      // Validate state
      const isValid = await stateValidator.validateState(state);
      expect(isValid).toBe(true);

      // State should be cleared after validation
      expect(await stateValidator.hasStoredState()).toBe(false);
    });

    it('should handle state expiry and cleanup', async () => {
      const customValidator = new StateValidator(mockAdapters.storage, 100); // 100ms TTL
      await customValidator.storeState('short-lived-state');

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(await customValidator.isStateExpired()).toBe(true);
      await customValidator.cleanupExpiredState();
      expect(await customValidator.hasStoredState()).toBe(false);
    });

    it('should handle state extension', async () => {
      const customValidator = new StateValidator(mockAdapters.storage, 200); // 200ms TTL
      await customValidator.storeState('extendable-state');

      // Wait half the TTL
      await new Promise(resolve => setTimeout(resolve, 100));

      // Extend the state
      await customValidator.extendStateExpiry(300); // Extend by 300ms

      // Should still be valid after original TTL
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(await customValidator.isStateExpired()).toBe(false);
    });
  });
});
