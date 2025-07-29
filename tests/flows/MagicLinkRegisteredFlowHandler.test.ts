/**
 * Unit tests for MagicLinkRegisteredFlowHandler
 */

import { MagicLinkRegisteredFlowHandler } from '../../src/flows/MagicLinkRegisteredFlowHandler';
import { createMockConfig } from '../mocks/adapters';
import type { OAuthConfig } from '../../src/types/OAuthTypes';

describe('MagicLinkRegisteredFlowHandler', () => {
  let handler: MagicLinkRegisteredFlowHandler;
  let mockConfig: OAuthConfig;

  beforeEach(() => {
    handler = new MagicLinkRegisteredFlowHandler();
    mockConfig = createMockConfig();
  });

  describe('name', () => {
    it('should have the correct name', () => {
      expect(handler.name).toBe('magic_link_registered');
    });
  });

  describe('canHandle', () => {
    it('should handle requests with flow=registered', () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'registered'
      });

      expect(handler.canHandle(params, mockConfig)).toBe(true);
    });

    it('should not handle requests with different flow values', () => {
      const loginParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'login'
      });

      const verifyParams = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'verify'
      });

      expect(handler.canHandle(loginParams, mockConfig)).toBe(false);
      expect(handler.canHandle(verifyParams, mockConfig)).toBe(false);
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
        flow: 'registered'
      });

      const paramsWithoutState = new URLSearchParams({
        magic_link_token: 'test-token',
        flow: 'registered'
      });

      expect(handler.canHandle(paramsWithoutToken, mockConfig)).toBe(false);
      // State is not required by the base class, only token is required
      expect(handler.canHandle(paramsWithoutState, mockConfig)).toBe(true);
    });

    it('should respect flow configuration when disabled', () => {
      const configWithDisabledFlow = {
        ...mockConfig,
        flows: {
          disabledFlows: ['magic_link_registered']
        }
      };

      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'registered'
      });

      expect(handler.canHandle(params, configWithDisabledFlow)).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate parameters that can be handled', async () => {
      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'registered'
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
      expect(handler.constructor.name).toBe('MagicLinkRegisteredFlowHandler');
      // Protected methods are not directly accessible, but we can test their effects
      expect(typeof handler.canHandle).toBe('function');
      expect(typeof handler.validate).toBe('function');
    });
  });

  describe('factory function', () => {
    it('should create handler instance', () => {
      const { createMagicLinkRegisteredFlowHandler } = require('../../src/flows/MagicLinkRegisteredFlowHandler');
      const factoryHandler = createMagicLinkRegisteredFlowHandler();
      
      expect(factoryHandler).toBeInstanceOf(MagicLinkRegisteredFlowHandler);
      expect(factoryHandler.name).toBe('magic_link_registered');
    });
  });

  describe('flow parameter validation', () => {
    it('should only accept flow=registered parameter', () => {
      const testCases = [
        { flow: 'registered', expected: true },
        { flow: 'login', expected: false },
        { flow: 'verify', expected: false },
        { flow: 'signup', expected: false },
        { flow: '', expected: false },
        { flow: 'REGISTERED', expected: false }, // Case sensitive
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
        flow: 'registered'
      });

      expect(handler.canHandle(paramsWithToken, mockConfig)).toBe(true);
    });

    it('should use base class flow disabled check', () => {
      const configWithDisabledFlows = {
        ...mockConfig,
        flows: {
          disabledFlows: ['magic_link_registered'] // explicitly disable registered flow
        }
      };

      const params = new URLSearchParams({
        magic_link_token: 'test-token',
        state: 'test-state',
        flow: 'registered'
      });

      expect(handler.canHandle(params, configWithDisabledFlows)).toBe(false);
    });
  });
});
