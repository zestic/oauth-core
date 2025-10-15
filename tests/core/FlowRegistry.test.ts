import { CallbackFlowRegistry } from '../../src/core/CallbackFlowRegistry';
import { CallbackFlowHandler } from '../../src/types/CallbackFlowTypes';
import { FlowError, OAuthError } from '../../src/errors';
import { OAuthResult } from '../../src/types/OAuthTypes';
import { createMockConfig } from '../mocks/adapters';

// Mock flow handler for testing
class MockCallbackFlowHandler implements CallbackFlowHandler {
  constructor(
    public readonly name: string,
    public readonly priority: number = 50
  ) {}

  canHandle(params: URLSearchParams): boolean {
    return params.has(this.name);
  }

  async validate(): Promise<boolean> {
    return true;
  }

  async handle(): Promise<OAuthResult> {
    return { success: true, accessToken: 'test-token' };
  }
}

describe('CallbackFlowRegistry', () => {
  let registry: CallbackFlowRegistry;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    registry = new CallbackFlowRegistry();
    mockConfig = createMockConfig();
  });

  describe('register', () => {
    it('should register a flow handler', () => {
      const handler = new MockCallbackFlowHandler('test_flow');
      
      registry.register(handler);
      
      expect(registry.hasHandler('test_flow')).toBe(true);
      expect(registry.getAllHandlers()).toHaveLength(1);
    });

    it('should register multiple handlers', () => {
      const handler1 = new MockCallbackFlowHandler('flow1', 10);
      const handler2 = new MockCallbackFlowHandler('flow2', 20);
      
      registry.register(handler1);
      registry.register(handler2);
      
      expect(registry.getAllHandlers()).toHaveLength(2);
    });

    it('should throw error when registering duplicate handler by default', () => {
      const handler1 = new MockCallbackFlowHandler('test_flow');
      const handler2 = new MockCallbackFlowHandler('test_flow');
      
      registry.register(handler1);
      
      expect(() => registry.register(handler2)).toThrow(OAuthError);
    });

    it('should allow duplicates when configured', () => {
      const registryWithDuplicates = new CallbackFlowRegistry({ allowDuplicates: true });
      const handler1 = new MockCallbackFlowHandler('test_flow');
      const handler2 = new MockCallbackFlowHandler('test_flow');

      registryWithDuplicates.register(handler1);

      // Should not throw when registering duplicate
      expect(() => registryWithDuplicates.register(handler2)).not.toThrow();

      // The second handler should replace the first one
      expect(registryWithDuplicates.getAllHandlers()).toHaveLength(1);
      expect(registryWithDuplicates.getHandler('test_flow')).toBe(handler2);
    });
  });

  describe('unregister', () => {
    it('should unregister a flow handler', () => {
      const handler = new MockCallbackFlowHandler('test_flow');
      
      registry.register(handler);
      expect(registry.hasHandler('test_flow')).toBe(true);
      
      registry.unregister('test_flow');
      expect(registry.hasHandler('test_flow')).toBe(false);
    });

    it('should not throw when unregistering non-existent handler', () => {
      expect(() => registry.unregister('non_existent')).not.toThrow();
    });
  });

  describe('getCompatibleHandlers', () => {
    it('should find compatible handlers', () => {
      const handler1 = new MockCallbackFlowHandler('flow1', 10);
      const handler2 = new MockCallbackFlowHandler('flow2', 20);
      const handler3 = new MockCallbackFlowHandler('flow3', 30);

      registry.register(handler1);
      registry.register(handler2);
      registry.register(handler3);

      const params = new URLSearchParams({ flow1: 'value', flow3: 'value' });
      const compatible = registry.getCompatibleHandlers(params, mockConfig);

      expect(compatible).toHaveLength(2);
      expect(compatible.map(h => h.name)).toContain('flow1');
      expect(compatible.map(h => h.name)).toContain('flow3');
    });

    it('should return empty array when no compatible handlers', () => {
      const handler = new MockCallbackFlowHandler('test_flow');
      registry.register(handler);

      const params = new URLSearchParams({ other_param: 'value' });
      const compatible = registry.getCompatibleHandlers(params, mockConfig);

      expect(compatible).toHaveLength(0);
    });
  });

  describe('getHandlerCount', () => {
    it('should return correct handler count', () => {
      expect(registry.getHandlerCount()).toBe(0);

      const handler1 = new MockCallbackFlowHandler('flow1');
      registry.register(handler1);
      expect(registry.getHandlerCount()).toBe(1);

      const handler2 = new MockCallbackFlowHandler('flow2');
      registry.register(handler2);
      expect(registry.getHandlerCount()).toBe(2);
    });
  });

  describe('getHandler', () => {
    it('should get handler by name', () => {
      const handler = new MockCallbackFlowHandler('test_flow');
      registry.register(handler);
      
      const retrieved = registry.getHandler('test_flow');
      expect(retrieved).toBe(handler);
    });

    it('should return undefined for non-existent handler', () => {
      const retrieved = registry.getHandler('non_existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('hasHandler', () => {
    it('should return true for existing handler', () => {
      const handler = new MockCallbackFlowHandler('test_flow');
      registry.register(handler);
      
      expect(registry.hasHandler('test_flow')).toBe(true);
    });

    it('should return false for non-existent handler', () => {
      expect(registry.hasHandler('non_existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all handlers', () => {
      const handler1 = new MockCallbackFlowHandler('flow1');
      const handler2 = new MockCallbackFlowHandler('flow2');
      
      registry.register(handler1);
      registry.register(handler2);
      
      expect(registry.getAllHandlers()).toHaveLength(2);
      
      registry.clear();
      
      expect(registry.getAllHandlers()).toHaveLength(0);
    });
  });

  describe('validateRequiredHandlers', () => {
    it('should not throw when all required handlers are present', () => {
      const handler1 = new MockCallbackFlowHandler('flow1');
      const handler2 = new MockCallbackFlowHandler('flow2');
      
      registry.register(handler1);
      registry.register(handler2);
      
      expect(() => registry.validateRequiredHandlers(['flow1', 'flow2'])).not.toThrow();
    });

    it('should throw when required handlers are missing', () => {
      const handler1 = new MockCallbackFlowHandler('flow1');
      registry.register(handler1);
      
      expect(() => registry.validateRequiredHandlers(['flow1', 'flow2', 'flow3']))
        .toThrow(FlowError);
    });
  });

  describe('registerMultiple', () => {
    it('should register multiple handlers at once', () => {
      const handlers = [
        new MockCallbackFlowHandler('flow1'),
        new MockCallbackFlowHandler('flow2'),
        new MockCallbackFlowHandler('flow3'),
      ];
      
      registry.registerMultiple(handlers);
      
      expect(registry.getAllHandlers()).toHaveLength(3);
      expect(registry.hasHandler('flow1')).toBe(true);
      expect(registry.hasHandler('flow2')).toBe(true);
      expect(registry.hasHandler('flow3')).toBe(true);
    });
  });

  describe('clone', () => {
    it('should create a copy of the registry', () => {
      const handler1 = new MockCallbackFlowHandler('flow1');
      const handler2 = new MockCallbackFlowHandler('flow2');
      
      registry.register(handler1);
      registry.register(handler2);
      
      const cloned = registry.clone();
      
      expect(cloned.getAllHandlers()).toHaveLength(2);
      expect(cloned.hasHandler('flow1')).toBe(true);
      expect(cloned.hasHandler('flow2')).toBe(true);
      
      // Verify they are independent
      cloned.unregister('flow1');
      expect(registry.hasHandler('flow1')).toBe(true);
      expect(cloned.hasHandler('flow1')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle handler validation errors gracefully', () => {
      const handler = new MockCallbackFlowHandler('test_flow');

      // Mock validate to throw an error
      handler.validate = jest.fn().mockImplementation(() => {
        throw new Error('Validation error');
      });

      registry.register(handler);

      const params = new URLSearchParams({ test_flow: 'value' });
      const compatible = registry.getCompatibleHandlers(params, mockConfig);

      // getCompatibleHandlers only checks canHandle, not validate
      // So the handler should still be included
      expect(compatible).toHaveLength(1);
      expect(compatible[0].name).toBe('test_flow');
    });

    it('should handle handler canHandle errors gracefully', () => {
      const handler = new MockCallbackFlowHandler('test_flow');

      // Mock canHandle to throw an error
      handler.canHandle = jest.fn().mockImplementation(() => {
        throw new Error('CanHandle error');
      });

      registry.register(handler);

      const params = new URLSearchParams({ test_flow: 'value' });
      const compatible = registry.getCompatibleHandlers(params, mockConfig);

      // Should handle the error and not include the handler
      expect(compatible).toHaveLength(0);
    });

    it('should handle null parameters in getCompatibleHandlers', () => {
      const handler = new MockCallbackFlowHandler('test_flow');
      registry.register(handler);

      expect(() => registry.getCompatibleHandlers(null as any, mockConfig)).not.toThrow();
      expect(() => registry.getCompatibleHandlers(undefined as any, mockConfig)).not.toThrow();
    });

    it('should handle null config in getCompatibleHandlers', () => {
      const handler = new MockCallbackFlowHandler('test_flow');
      registry.register(handler);

      const params = new URLSearchParams({ test_flow: 'value' });
      expect(() => registry.getCompatibleHandlers(params, null as any)).not.toThrow();
    });

    it('should handle handlers with very high priorities', () => {
      const handler = new MockCallbackFlowHandler('test_flow', Number.MAX_SAFE_INTEGER);

      expect(() => registry.register(handler)).not.toThrow();
      expect(registry.hasHandler('test_flow')).toBe(true);
    });

    it('should handle handlers with negative priorities', () => {
      const handler = new MockCallbackFlowHandler('test_flow', -100);

      expect(() => registry.register(handler)).not.toThrow();
      expect(registry.hasHandler('test_flow')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty handler names', () => {
      const handler = new MockCallbackFlowHandler('');

      expect(() => registry.register(handler)).not.toThrow();
      expect(registry.hasHandler('')).toBe(true);
    });

    it('should handle very long handler names', () => {
      const longName = 'a'.repeat(1000);
      const handler = new MockCallbackFlowHandler(longName);

      expect(() => registry.register(handler)).not.toThrow();
      expect(registry.hasHandler(longName)).toBe(true);
    });

    it('should handle special characters in handler names', () => {
      const specialName = 'test-flow_with.special@chars#123';
      const handler = new MockCallbackFlowHandler(specialName);

      expect(() => registry.register(handler)).not.toThrow();
      expect(registry.hasHandler(specialName)).toBe(true);
    });

    it('should handle large numbers of handlers', () => {
      const handlers = [];
      for (let i = 0; i < 50; i++) {
        const handler = new MockCallbackFlowHandler(`handler_${i}`, i);
        handlers.push(handler);
        registry.register(handler);
      }

      expect(registry.getHandlerCount()).toBe(50);

      // Test that all handlers are accessible
      for (let i = 0; i < 50; i++) {
        expect(registry.hasHandler(`handler_${i}`)).toBe(true);
      }
    });

    it('should maintain handler order by priority with many handlers', () => {
      const priorities = [50, 10, 30, 90, 20];
      const handlers = priorities.map((priority, index) => {
        const handler = new MockCallbackFlowHandler(`handler_${index}`, priority);
        registry.register(handler);
        return handler;
      });

      // All handlers should be able to handle the same params
      handlers.forEach(handler => {
        handler.canHandle = jest.fn().mockReturnValue(true);
      });

      const params = new URLSearchParams({ test: 'value' });
      const compatible = registry.getCompatibleHandlers(params, mockConfig);

      // Should be sorted by priority (descending)
      const sortedPriorities = compatible.map(h => h.priority);
      const expectedPriorities = [...priorities].sort((a, b) => b - a);

      expect(sortedPriorities).toEqual(expectedPriorities);
    });
  });

  describe('detectFlowWithConfidence', () => {
    it('should detect flow with confidence when handler can handle params', () => {
      const handler1 = new MockCallbackFlowHandler('flow1', 10);
      const handler2 = new MockCallbackFlowHandler('flow2', 50);
      registry.register(handler1);
      registry.register(handler2);

      const params = new URLSearchParams({ flow1: 'value' });
      const result = registry.detectFlowWithConfidence(params, mockConfig);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(handler1);
      expect(result?.confidence).toBe(90); // 100 - 10 = 90
      expect(result?.reason).toContain('flow1');
    });

    it('should return undefined when no handler can handle params', () => {
      const handler = new MockCallbackFlowHandler('flow1');
      registry.register(handler);

      const params = new URLSearchParams({ other_param: 'value' });
      const result = registry.detectFlowWithConfidence(params, mockConfig);

      expect(result).toBeUndefined();
    });

    it('should prefer higher priority (lower number) handlers', () => {
      const handler1 = new MockCallbackFlowHandler('flow1', 10);
      const handler2 = new MockCallbackFlowHandler('flow2', 5); // Higher priority
      registry.register(handler1);
      registry.register(handler2);

      const params = new URLSearchParams({ flow1: 'value', flow2: 'value' });
      const result = registry.detectFlowWithConfidence(params, mockConfig);

      expect(result?.handler).toBe(handler2); // Should select the higher priority handler
      expect(result?.confidence).toBe(95); // 100 - 5 = 95
    });

    it('should calculate confidence correctly for high priority numbers', () => {
      const handler = new MockCallbackFlowHandler('flow1', 80);
      registry.register(handler);

      const params = new URLSearchParams({ flow1: 'value' });
      const result = registry.detectFlowWithConfidence(params, mockConfig);

      expect(result?.confidence).toBe(20); // 100 - 80 = 20
    });

    it('should handle handlers with priority 100 (zero confidence)', () => {
      const handler = new MockCallbackFlowHandler('flow1', 100);
      registry.register(handler);

      const params = new URLSearchParams({ flow1: 'value' });
      const result = registry.detectFlowWithConfidence(params, mockConfig);

      expect(result?.confidence).toBe(0); // Math.max(0, 100 - 100) = 0
    });

    it('should handle handlers with priority greater than 100 (zero confidence)', () => {
      const handler = new MockCallbackFlowHandler('flow1', 150);
      registry.register(handler);

      const params = new URLSearchParams({ flow1: 'value' });
      const result = registry.detectFlowWithConfidence(params, mockConfig);

      expect(result?.confidence).toBe(0); // Math.max(0, 100 - 150) = 0
    });
  });
});
