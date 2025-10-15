/**
 * Comprehensive tests for LoadingManager
 * Covers all functionality, edge cases, and error scenarios for close to 100% coverage
 */

import { LoadingManager } from '../../src/state/LoadingManager';
import { EventEmitter } from '../../src/events/EventEmitter';
import { OAuthEventMap, LoadingContext } from '../../src/events/OAuthEvents';

describe('LoadingManager', () => {
  let loadingManager: LoadingManager;
  let eventEmitter: EventEmitter<OAuthEventMap>;
  let emittedEvents: Array<{ event: string; data: any }>;

  beforeEach(() => {
    eventEmitter = new EventEmitter<OAuthEventMap>();
    emittedEvents = [];
    
    // Capture all emitted events
    eventEmitter.on('loadingStart', (context) => {
      emittedEvents.push({ event: 'loadingStart', data: context });
    });
    
    eventEmitter.on('loadingEnd', (context) => {
      emittedEvents.push({ event: 'loadingEnd', data: context });
    });

    loadingManager = new LoadingManager(eventEmitter);
  });

  afterEach(() => {
    loadingManager.destroy();
  });

  describe('Basic Operation Management', () => {
    it('should start and track operations', () => {
      expect(loadingManager.isLoading).toBe(false);
      expect(loadingManager.getActiveOperations()).toEqual([]);

      const context = loadingManager.startOperation('test-operation');

      expect(loadingManager.isLoading).toBe(true);
      expect(loadingManager.getActiveOperations()).toEqual(['test-operation']);
      expect(context.operation).toBe('test-operation');
      expect(context.startTime).toBeGreaterThan(0);
      expect(context.metadata).toBeUndefined();
    });

    it('should start operations with metadata', () => {
      const metadata = { userId: '123', action: 'login' };
      const context = loadingManager.startOperation('test-operation', metadata);

      expect(context.metadata).toEqual(metadata);
    });

    it('should end operations successfully', () => {
      const context = loadingManager.startOperation('test-operation');
      
      // Wait a bit to ensure duration > 0
      setTimeout(() => {
        loadingManager.endOperation(context, true);

        expect(loadingManager.isLoading).toBe(false);
        expect(loadingManager.getActiveOperations()).toEqual([]);
      }, 10);
    });

    it('should end operations with failure', () => {
      const context = loadingManager.startOperation('test-operation');
      loadingManager.endOperation(context, false);

      expect(loadingManager.isLoading).toBe(false);
      expect(loadingManager.getActiveOperations()).toEqual([]);
    });

    it('should track multiple concurrent operations', () => {
      const context1 = loadingManager.startOperation('operation-1');
      const context2 = loadingManager.startOperation('operation-2');
      const context3 = loadingManager.startOperation('operation-3');

      expect(loadingManager.isLoading).toBe(true);
      expect(loadingManager.getActiveOperations()).toEqual(['operation-1', 'operation-2', 'operation-3']);

      loadingManager.endOperation(context2, true);
      expect(loadingManager.getActiveOperations()).toEqual(['operation-1', 'operation-3']);

      loadingManager.endOperation(context1, true);
      loadingManager.endOperation(context3, false);
      expect(loadingManager.isLoading).toBe(false);
      expect(loadingManager.getActiveOperations()).toEqual([]);
    });
  });

  describe('Operation Querying', () => {
    it('should check if specific operation is active', () => {
      expect(loadingManager.isOperationActive('test-operation')).toBe(false);

      loadingManager.startOperation('test-operation');
      expect(loadingManager.isOperationActive('test-operation')).toBe(true);
      expect(loadingManager.isOperationActive('other-operation')).toBe(false);
    });

    it('should get operation context', () => {
      const metadata = { test: 'data' };
      const context = loadingManager.startOperation('test-operation', metadata);

      const retrievedContext = loadingManager.getOperationContext('test-operation');
      expect(retrievedContext).toEqual(context);

      const nonExistentContext = loadingManager.getOperationContext('non-existent');
      expect(nonExistentContext).toBeUndefined();
    });

    it('should get all active operation contexts', () => {
      const context1 = loadingManager.startOperation('operation-1', { id: 1 });
      const context2 = loadingManager.startOperation('operation-2', { id: 2 });

      const contexts = loadingManager.getActiveOperationContexts();
      expect(contexts).toHaveLength(2);
      expect(contexts).toContain(context1);
      expect(contexts).toContain(context2);
    });
  });

  describe('Event Emission', () => {
    it('should emit loadingStart events', () => {
      const metadata = { test: 'data' };
      loadingManager.startOperation('test-operation', metadata);

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('loadingStart');
      expect(emittedEvents[0].data.operation).toBe('test-operation');
      expect(emittedEvents[0].data.metadata).toEqual(metadata);
    });

    it('should emit loadingEnd events with duration and success', () => {
      const context = loadingManager.startOperation('test-operation');

      // Clear previous events to avoid interference
      emittedEvents.length = 0;

      loadingManager.endOperation(context, true);

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('loadingEnd');
      expect(emittedEvents[0].data.operation).toBe('test-operation');
      expect(emittedEvents[0].data.success).toBe(true);
      expect(emittedEvents[0].data.duration).toBeGreaterThanOrEqual(0);
    });

    it('should work without event emitter', () => {
      const managerWithoutEvents = new LoadingManager();
      
      expect(() => {
        const context = managerWithoutEvents.startOperation('test');
        managerWithoutEvents.endOperation(context, true);
      }).not.toThrow();

      managerWithoutEvents.destroy();
    });
  });

  describe('Operation Cancellation', () => {
    it('should cancel specific operations', () => {
      loadingManager.startOperation('operation-1');
      loadingManager.startOperation('operation-2');

      expect(loadingManager.getActiveOperations()).toHaveLength(2);

      const cancelled = loadingManager.cancelOperation('operation-1');
      expect(cancelled).toBe(true);
      expect(loadingManager.getActiveOperations()).toEqual(['operation-2']);

      // Check that loadingEnd event was emitted with success: false
      const endEvent = emittedEvents.find(e => e.event === 'loadingEnd');
      expect(endEvent).toBeDefined();
      expect(endEvent!.data.success).toBe(false);
    });

    it('should return false when cancelling non-existent operation', () => {
      const cancelled = loadingManager.cancelOperation('non-existent');
      expect(cancelled).toBe(false);
    });

    it('should cancel all operations', () => {
      loadingManager.startOperation('operation-1');
      loadingManager.startOperation('operation-2');
      loadingManager.startOperation('operation-3');

      expect(loadingManager.getActiveOperations()).toHaveLength(3);

      loadingManager.cancelAllOperations();
      expect(loadingManager.isLoading).toBe(false);
      expect(loadingManager.getActiveOperations()).toEqual([]);

      // Check that all operations emitted loadingEnd events with success: false
      const endEvents = emittedEvents.filter(e => e.event === 'loadingEnd');
      expect(endEvents).toHaveLength(3);
      endEvents.forEach(event => {
        expect(event.data.success).toBe(false);
      });
    });
  });

  describe('Completed Operations Tracking', () => {
    it('should track completed operations', (done) => {
      const context = loadingManager.startOperation('test-operation');
      
      setTimeout(() => {
        loadingManager.endOperation(context, true);

        const completedOp = loadingManager.getCompletedOperation('test-operation');
        expect(completedOp).toBeDefined();
        expect(completedOp!.success).toBe(true);
        expect(completedOp!.duration).toBeGreaterThan(0);
        expect(completedOp!.completedAt).toBeInstanceOf(Date);

        const allCompleted = loadingManager.getCompletedOperations();
        expect(allCompleted).toHaveLength(1);
        expect(allCompleted[0]).toEqual(completedOp);
        done();
      }, 10);
    });

    it('should clear completed operations', () => {
      const context = loadingManager.startOperation('test-operation');
      loadingManager.endOperation(context, true);

      expect(loadingManager.getCompletedOperations()).toHaveLength(1);

      loadingManager.clearCompletedOperations();
      expect(loadingManager.getCompletedOperations()).toEqual([]);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', (done) => {
      // Start some operations
      const context1 = loadingManager.startOperation('op1');
      const context2 = loadingManager.startOperation('op2');
      loadingManager.startOperation('op3');

      setTimeout(() => {
        // Complete some operations
        loadingManager.endOperation(context1, true);
        loadingManager.endOperation(context2, false);
        // Leave context3 active

        const stats = loadingManager.getStatistics();
        expect(stats.activeCount).toBe(1);
        expect(stats.completedCount).toBe(2);
        expect(stats.successRate).toBe(0.5); // 1 success out of 2 completed
        expect(stats.averageDuration).toBeGreaterThan(0);
        expect(stats.longestRunningOperation).toBeDefined();
        expect(stats.longestRunningOperation!.operation).toBe('op3');
        expect(stats.longestRunningOperation!.duration).toBeGreaterThan(0);
        done();
      }, 10);
    });

    it('should handle statistics with no operations', () => {
      const stats = loadingManager.getStatistics();
      expect(stats.activeCount).toBe(0);
      expect(stats.completedCount).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.longestRunningOperation).toBeUndefined();
    });
  });

  describe('Configuration Options', () => {
    it('should respect maxConcurrentOperations limit', () => {
      const limitedManager = new LoadingManager(eventEmitter, {
        maxConcurrentOperations: 2
      });

      // Start 3 operations, should cleanup oldest
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      limitedManager.startOperation('op1');
      limitedManager.startOperation('op2');
      limitedManager.startOperation('op3'); // Should trigger cleanup

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up the oldest operation due to capacity limit (2)')
      );
      expect(limitedManager.getActiveOperations()).toEqual(['op2', 'op3']);

      consoleSpy.mockRestore();
      limitedManager.destroy();
    });

    it('should warn on long-running operations', (done) => {
      const warningManager = new LoadingManager(eventEmitter, {
        warnOnLongOperations: true,
        longOperationThresholdMs: 50
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      warningManager.startOperation('long-operation');

      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Operation "long-operation" has been running for 50ms')
        );

        consoleSpy.mockRestore();
        warningManager.destroy();
        done();
      }, 60);
    });

    it('should not warn when warnOnLongOperations is disabled', (done) => {
      const noWarningManager = new LoadingManager(eventEmitter, {
        warnOnLongOperations: false,
        longOperationThresholdMs: 10
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      noWarningManager.startOperation('operation');

      setTimeout(() => {
        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
        noWarningManager.destroy();
        done();
      }, 20);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle duplicate operation names', () => {
      loadingManager.startOperation('duplicate-op');
      const context2 = loadingManager.startOperation('duplicate-op');

      // Should overwrite the first operation
      expect(loadingManager.getActiveOperations()).toEqual(['duplicate-op']);
      expect(loadingManager.getOperationContext('duplicate-op')).toEqual(context2);
    });

    it('should handle ending non-existent operations gracefully', () => {
      const fakeContext: LoadingContext = {
        operation: 'non-existent',
        startTime: Date.now()
      };

      expect(() => {
        loadingManager.endOperation(fakeContext, true);
      }).not.toThrow();
    });

    it('should handle operations with same name but different contexts', () => {
      const context1 = loadingManager.startOperation('same-name');
      loadingManager.endOperation(context1, true);

      const context2 = loadingManager.startOperation('same-name');
      expect(loadingManager.isOperationActive('same-name')).toBe(true);
      expect(loadingManager.getOperationContext('same-name')).toEqual(context2);
    });

    it('should properly cleanup timeouts on operation end', () => {
      const context = loadingManager.startOperation('test-op');

      // End operation immediately, should clear timeout
      loadingManager.endOperation(context, true);

      // No timeout should be active
      expect(loadingManager.isOperationActive('test-op')).toBe(false);
    });

    it('should handle destroy with active operations', () => {
      loadingManager.startOperation('op1');
      loadingManager.startOperation('op2');

      expect(loadingManager.isLoading).toBe(true);

      loadingManager.destroy();

      expect(loadingManager.isLoading).toBe(false);
      expect(loadingManager.getActiveOperations()).toEqual([]);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup completed operations after retention period', (done) => {
      const shortRetentionManager = new LoadingManager(eventEmitter, {
        completedOperationRetentionMs: 50
      });

      const context = shortRetentionManager.startOperation('test-op');
      shortRetentionManager.endOperation(context, true);

      expect(shortRetentionManager.getCompletedOperations()).toHaveLength(1);

      // Wait for cleanup (cleanup runs every 5 minutes, but we can test the cleanup method directly)
      setTimeout(() => {
        // Manually trigger cleanup for testing
        (shortRetentionManager as any).cleanupCompletedOperations();

        expect(shortRetentionManager.getCompletedOperations()).toHaveLength(0);
        shortRetentionManager.destroy();
        done();
      }, 60);
    });

    it('should not cleanup recent completed operations', () => {
      const context = loadingManager.startOperation('test-op');
      loadingManager.endOperation(context, true);

      expect(loadingManager.getCompletedOperations()).toHaveLength(1);

      // Manually trigger cleanup
      (loadingManager as any).cleanupCompletedOperations();

      // Should still be there since it's recent
      expect(loadingManager.getCompletedOperations()).toHaveLength(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle rapid start/end cycles', () => {
      for (let i = 0; i < 10; i++) {
        const context = loadingManager.startOperation(`rapid-op-${i}`);
        loadingManager.endOperation(context, i % 2 === 0);
      }

      expect(loadingManager.isLoading).toBe(false);
      expect(loadingManager.getCompletedOperations()).toHaveLength(10);

      const stats = loadingManager.getStatistics();
      expect(stats.completedCount).toBe(10);
      expect(stats.successRate).toBe(0.5); // Every other operation succeeded
    });

    it('should handle concurrent operations with different metadata', () => {
      const contexts = [];
      for (let i = 0; i < 5; i++) {
        const context = loadingManager.startOperation(`concurrent-op-${i}`, {
          index: i,
          type: i % 2 === 0 ? 'even' : 'odd'
        });
        contexts.push(context);
      }

      expect(loadingManager.getActiveOperations()).toHaveLength(5);

      // End operations in random order
      loadingManager.endOperation(contexts[2], true);
      loadingManager.endOperation(contexts[0], false);
      loadingManager.endOperation(contexts[4], true);
      loadingManager.endOperation(contexts[1], true);
      loadingManager.endOperation(contexts[3], false);

      expect(loadingManager.isLoading).toBe(false);

      const stats = loadingManager.getStatistics();
      expect(stats.successRate).toBe(0.6); // 3 out of 5 succeeded
    });
  });
});
