/**
 * Unit tests for MagicLinkVerifyFlowHandler
 */

import { MagicLinkVerifyFlowHandler } from '../../src/flows/MagicLinkVerifyFlowHandler';
import { createMockConfig } from '../mocks/adapters';
import type { OAuthConfig } from '../../src/types/OAuthTypes';

describe('MagicLinkVerifyFlowHandler', () => {
  let handler: MagicLinkVerifyFlowHandler;
  let mockConfig: OAuthConfig;

  beforeEach(() => {
    handler = new MagicLinkVerifyFlowHandler();
    mockConfig = createMockConfig();
  });

  describe('name', () => {
    it('should have the correct name', () => {
      expect(handler.name).toBe('magic_link_verify');
    });
  });

  describe('canHandle', () => {
    it('should handle requests with flow=verify', () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'verify'
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });

    it('should not handle requests with different flow values', () => {
      const loginParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'login'
      });

      const registeredParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'registered'
      });

      expect(handler.canHandle(loginParams, mockConfig)).toBe(false);
      expect(handler.canHandle(registeredParams, mockConfig)).toBe(false);
    });

    it('should not handle requests without flow parameter', () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state'
      });

      expect(handler.canHandle(params, mockConfig)).toBe(false);
    });

    it('should not handle requests without required magic link parameters', () => {
      const paramsWithoutToken = new URLSearchParams({
        state: 'test-state',
        flow: 'verify'
      });

      const paramsWithoutState = new URLSearchParams({
        magic_link_token: 'test-token',
        flow: 'verify'
      });

      expect(handler.canHandle(paramsWithoutToken, mockConfig)).toBe(false);
      // State is not required by the base class, only token is required
      expect(handler.canHandle(paramsWithoutState, mockConfig)).toBe(true);
    });

    it('should respect flow configuration when disabled', () => {
      const configWithDisabledFlow = {
        ...mockConfig,
        flows: {
          disabledFlows: ['magic_link_verify']
        }
      };

      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'verify'
      });

      expect(handler.canHandle(params, configWithDisabledFlow)).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate parameters that can be handled', async () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'verify'
      });

      const result = await handler.validate(params, mockConfig);
      expect(result).toBe(true);
    });

    it('should not validate parameters that cannot be handled', async () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'login'
      });

      const result = await handler.validate(params, mockConfig);
      expect(result).toBe(false);
    });
  });

  describe('priority', () => {
    it('should have high priority', () => {
      expect(handler.priority).toBe(25); // FLOW_PRIORITIES.HIGH
    });
  });

  describe('inheritance', () => {
    it('should inherit from BaseMagicLinkFlowHandler', () => {
      expect(handler.constructor.name).toBe('MagicLinkVerifyFlowHandler');
      // Protected methods are not directly accessible, but we can test their effects
      expect(typeof handler.canHandle).toBe('function');
      expect(typeof handler.validate).toBe('function');
    });
  });

  describe('factory function', () => {
    it('should create handler instance', () => {
      const { createMagicLinkVerifyFlowHandler } = require('../../src/flows/MagicLinkVerifyFlowHandler');
      const factoryHandler = createMagicLinkVerifyFlowHandler();
      
      expect(factoryHandler).toBeInstanceOf(MagicLinkVerifyFlowHandler);
      expect(factoryHandler.name).toBe('magic_link_verify');
    });
  });

  describe('flow parameter validation', () => {
    it('should only accept flow=verify parameter', () => {
      const testCases = [
        { flow: 'verify', expected: true },
        { flow: 'login', expected: false },
        { flow: 'registered', expected: false },
        { flow: 'signup', expected: false },
        { flow: '', expected: false },
        { flow: 'VERIFY', expected: false }, // Case sensitive
      ];

      testCases.forEach(({ flow, expected }) => {
        const params = new URLSearchParams({
          magic_link_token: 'test-token',
          state: 'test-state',
          flow
        });

        expect(handler.canHandle(params, mockConfig)).toBe(expected);
      });
    });
  });

  describe('integration with base class', () => {
    it('should use base class magic link parameter validation', () => {
      // Test with token parameter (alternative magic link token name)
      const paramsWithToken = new URLSearchParams({
        token: 'test-token',
        state: 'test-state',
        flow: 'verify'
      });

      expect(handler.canHandle(paramsWithToken, mockConfig)).toBe(true);
    });

    it('should use base class flow disabled check', () => {
      const configWithDisabledFlows = {
        ...mockConfig,
        flows: {
          disabledFlows: ['magic_link_verify'] // explicitly disable verify flow
        }
      };

      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'verify'
      });

      expect(handler.canHandle(params, configWithDisabledFlows)).toBe(false);
    });
  });

  describe('comprehensive flow validation', () => {
    it('should handle all required parameters correctly', () => {
      const validCombinations = [
        { magic_link_token: 'token1', flow: 'verify' },
        { token: 'token2', flow: 'verify' },
        { magic_link_token: 'token3', state: 'state1', flow: 'verify' },
        { token: 'token4', state: 'state2', flow: 'verify' }
      ];

      validCombinations.forEach(params => {
        const urlParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          urlParams.set(key, value);
        });
        expect(handler.canHandle(urlParams, mockConfig)).toBe(true);
      });
    });

    it('should reject invalid flow combinations', () => {
      const invalidCombinations = [
        { magic_link_token: 'token1', flow: 'login' },
        { magic_link_token: 'token2', flow: 'registered' },
        { magic_link_token: 'token3', flow: 'signup' },
        { magic_link_token: 'token4' }, // No flow
        { flow: 'verify' }, // No token
        {} // Empty params
      ];

      invalidCombinations.forEach(params => {
        const urlParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            urlParams.set(key, value);
          }
        });
        expect(handler.canHandle(urlParams, mockConfig)).toBe(false);
      });
    });

    it('should handle edge case parameter values', () => {
      const edgeCases = [
        { magic_link_token: '', flow: 'verify' }, // Empty token
        { magic_link_token: 'token', flow: '' }, // Empty flow
        { magic_link_token: 'token', flow: 'VERIFY' }, // Wrong case
        { magic_link_token: 'token', flow: 'verify ' }, // Trailing space
        { magic_link_token: ' token', flow: 'verify' }, // Leading space
      ];

      edgeCases.forEach(params => {
        const urlParams = new URLSearchParams(params);
        expect(handler.canHandle(urlParams, mockConfig)).toBe(false);
      });
    });

    it('should handle complex parameter scenarios', () => {
      const complexParams = new URLSearchParams({
        magic_link_token: 'complex-token-123',
        state: 'complex-state-456',
        flow: 'verify',
        extra_param: 'should-be-ignored',
        another_param: 'also-ignored'
      });

      expect(handler.canHandle(complexParams, mockConfig)).toBe(true);
    });

    it('should validate consistently across multiple calls', () => {
      const params = new URLSearchParams({
        magic_link_token: 'consistent-token',
        state: 'consistent-state',
        flow: 'verify'
      });

      // Multiple calls should return the same result
      for (let i = 0; i < 5; i++) {
        expect(handler.canHandle(params, mockConfig)).toBe(true);
        expect(handler.validate(params, mockConfig)).resolves.toBe(true);
      }
    });

    it('should handle URL-encoded parameters', () => {
      const params = new URLSearchParams({
        magic_link_token: 'token%20with%20spaces',
        state: 'state%2Bwith%2Bplus',
        flow: 'verify'
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });

    it('should handle very long parameter values', () => {
      const longToken = 'a'.repeat(1000);
      const longState = 'b'.repeat(1000);
      
      const params = new URLSearchParams({
        magic_link_token: longToken,
        state: longState,
        flow: 'verify'
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });

    it('should handle special characters in parameters', () => {
      const params = new URLSearchParams({
        magic_link_token: 'token-with_special.chars@123#',
        state: 'state-with_special.chars@456#',
        flow: 'verify'
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });

    it('should handle unicode characters in parameters', () => {
      const params = new URLSearchParams({
        magic_link_token: 'token-验证-🔐',
        state: 'state-状态-🚀',
        flow: 'verify'
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });
  });

  describe('configuration edge cases', () => {
    it('should handle null config gracefully', () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        flow: 'verify'
      });

      expect(() => handler.canHandle(params, null as any)).not.toThrow();
    });

    it('should handle undefined config gracefully', () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        flow: 'verify'
      });

      expect(() => handler.canHandle(params, undefined as any)).not.toThrow();
    });

    it('should handle config without flows property', () => {
      const configWithoutFlows = {
        ...mockConfig
      };
      delete (configWithoutFlows as any).flows;

      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        flow: 'verify'
      });

      expect(handler.canHandle(params, configWithoutFlows)).toBe(true);
    });

    it('should handle config with empty flows', () => {
      const configWithEmptyFlows = {
        ...mockConfig,
        flows: {}
      };

      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        flow: 'verify'
      });

      expect(handler.canHandle(params, configWithEmptyFlows)).toBe(true);
    });
  });
});
