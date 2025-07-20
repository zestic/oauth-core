import { FlowRegistry } from '../../src/core/FlowRegistry';
import { FlowHandler } from '../../src/types/FlowTypes';
import { OAuthError, OAuthResult } from '../../src/types/OAuthTypes';
import { createMockConfig } from '../mocks/adapters';

// Mock flow handler for testing
class MockFlowHandler implements FlowHandler {
  constructor(
    public readonly name: string,
    public readonly priority: number = 50
  ) {}

  canHandle(params: URLSearchParams): boolean {
    return params.has(this.name);
  }

  async handle(): Promise<OAuthResult> {
    return { success: true, accessToken: 'test-token' };
  }
}

describe('FlowRegistry', () => {
  let registry: FlowRegistry;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    registry = new FlowRegistry();
    mockConfig = createMockConfig();
  });

  describe('register', () => {
    it('should register a flow handler', () => {
      const handler = new MockFlowHandler('test_flow');
      
      registry.register(handler);
      
      expect(registry.hasHandler('test_flow')).toBe(true);
      expect(registry.getAllHandlers()).toHaveLength(1);
    });

    it('should register multiple handlers', () => {
      const handler1 = new MockFlowHandler('flow1', 10);
      const handler2 = new MockFlowHandler('flow2', 20);
      
      registry.register(handler1);
      registry.register(handler2);
      
      expect(registry.getAllHandlers()).toHaveLength(2);
    });

    it('should throw error when registering duplicate handler by default', () => {
      const handler1 = new MockFlowHandler('test_flow');
      const handler2 = new MockFlowHandler('test_flow');
      
      registry.register(handler1);
      
      expect(() => registry.register(handler2)).toThrow(OAuthError);
    });

    it('should allow duplicates when configured', () => {
      const registryWithDuplicates = new FlowRegistry({ allowDuplicates: true });
      const handler1 = new MockFlowHandler('test_flow');
      const handler2 = new MockFlowHandler('test_flow');

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
      const handler = new MockFlowHandler('test_flow');
      
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
      const handler1 = new MockFlowHandler('flow1', 10);
      const handler2 = new MockFlowHandler('flow2', 20);
      const handler3 = new MockFlowHandler('flow3', 30);

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
      const handler = new MockFlowHandler('test_flow');
      registry.register(handler);

      const params = new URLSearchParams({ other_param: 'value' });
      const compatible = registry.getCompatibleHandlers(params, mockConfig);

      expect(compatible).toHaveLength(0);
    });
  });

  describe('getHandlerCount', () => {
    it('should return correct handler count', () => {
      expect(registry.getHandlerCount()).toBe(0);

      const handler1 = new MockFlowHandler('flow1');
      registry.register(handler1);
      expect(registry.getHandlerCount()).toBe(1);

      const handler2 = new MockFlowHandler('flow2');
      registry.register(handler2);
      expect(registry.getHandlerCount()).toBe(2);
    });
  });

  describe('getHandler', () => {
    it('should get handler by name', () => {
      const handler = new MockFlowHandler('test_flow');
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
      const handler = new MockFlowHandler('test_flow');
      registry.register(handler);
      
      expect(registry.hasHandler('test_flow')).toBe(true);
    });

    it('should return false for non-existent handler', () => {
      expect(registry.hasHandler('non_existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all handlers', () => {
      const handler1 = new MockFlowHandler('flow1');
      const handler2 = new MockFlowHandler('flow2');
      
      registry.register(handler1);
      registry.register(handler2);
      
      expect(registry.getAllHandlers()).toHaveLength(2);
      
      registry.clear();
      
      expect(registry.getAllHandlers()).toHaveLength(0);
    });
  });

  describe('validateRequiredHandlers', () => {
    it('should not throw when all required handlers are present', () => {
      const handler1 = new MockFlowHandler('flow1');
      const handler2 = new MockFlowHandler('flow2');
      
      registry.register(handler1);
      registry.register(handler2);
      
      expect(() => registry.validateRequiredHandlers(['flow1', 'flow2'])).not.toThrow();
    });

    it('should throw when required handlers are missing', () => {
      const handler1 = new MockFlowHandler('flow1');
      registry.register(handler1);
      
      expect(() => registry.validateRequiredHandlers(['flow1', 'flow2', 'flow3']))
        .toThrow(OAuthError);
    });
  });

  describe('registerMultiple', () => {
    it('should register multiple handlers at once', () => {
      const handlers = [
        new MockFlowHandler('flow1'),
        new MockFlowHandler('flow2'),
        new MockFlowHandler('flow3'),
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
      const handler1 = new MockFlowHandler('flow1');
      const handler2 = new MockFlowHandler('flow2');
      
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
});
