import { DEFAULT_CONFIG } from '../../src/types/ConfigTypes';

describe('ConfigTypes', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have default timeout value', () => {
      expect(DEFAULT_CONFIG.timeout).toBe(30000);
    });

    it('should have default retry attempts', () => {
      expect(DEFAULT_CONFIG.retryAttempts).toBe(3);
    });

    it('should have default flow detection strategy', () => {
      expect(DEFAULT_CONFIG.flows?.detectionStrategy).toBe('auto');
    });

    it('should be a valid partial config object', () => {
      expect(typeof DEFAULT_CONFIG).toBe('object');
      expect(DEFAULT_CONFIG).not.toBeNull();
    });
  });
});
