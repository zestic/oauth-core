/**
 * Centralized loading state management for OAuth operations
 * Provides comprehensive tracking of active operations with timing, metadata, and event emission
 */

import type { EventEmitter } from '../events/EventEmitter';
import type { OAuthEventMap, LoadingContext } from '../events/OAuthEvents';

export interface LoadingManagerOptions {
  /**
   * Maximum number of concurrent operations to track
   * Older operations will be cleaned up when this limit is exceeded
   */
  maxConcurrentOperations?: number;
  
  /**
   * Maximum time (in ms) to keep completed operation data for debugging
   */
  completedOperationRetentionMs?: number;
  
  /**
   * Whether to emit warning when operations take longer than expected
   */
  warnOnLongOperations?: boolean;
  
  /**
   * Threshold (in ms) for considering an operation "long-running"
   */
  longOperationThresholdMs?: number;
}

export interface CompletedOperationData {
  context: LoadingContext;
  success: boolean;
  duration: number;
  completedAt: Date;
}

/**
 * Centralized loading state manager for OAuth operations
 * Handles operation tracking, timing, metadata, and event emission
 */
export class LoadingManager {
  private activeOperations = new Map<string, LoadingContext>();
  private completedOperations = new Map<string, CompletedOperationData>();
  private operationTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private eventEmitter?: EventEmitter<OAuthEventMap>;
  private options: Required<LoadingManagerOptions>;

  constructor(
    eventEmitter?: EventEmitter<OAuthEventMap>,
    options: LoadingManagerOptions = {}
  ) {
    this.eventEmitter = eventEmitter;
    this.options = {
      maxConcurrentOperations: options.maxConcurrentOperations ?? 50,
      completedOperationRetentionMs: options.completedOperationRetentionMs ?? 300000, // 5 minutes
      warnOnLongOperations: options.warnOnLongOperations ?? true,
      longOperationThresholdMs: options.longOperationThresholdMs ?? 30000, // 30 seconds
      ...options
    };

    // Cleanup completed operations periodically
    this.startCleanupTimer();
  }

  /**
   * Start tracking a new operation
   */
  startOperation(operation: string, metadata?: Record<string, unknown>): LoadingContext {
    // Clean up if we're at the limit
    if (this.activeOperations.size >= this.options.maxConcurrentOperations) {
      this.cleanupOldestOperation();
    }

    const context: LoadingContext = {
      operation,
      startTime: Date.now(),
      metadata
    };

    this.activeOperations.set(operation, context);

    // Set up warning for long-running operations
    if (this.options.warnOnLongOperations) {
      const timeoutId = setTimeout(() => {
        console.warn(
          `LoadingManager: Operation "${operation}" has been running for ${this.options.longOperationThresholdMs}ms. ` +
          'Consider checking for potential issues or increasing the threshold.'
        );
      }, this.options.longOperationThresholdMs);
      
      this.operationTimeouts.set(operation, timeoutId);
    }

    // Emit loading start event
    this.eventEmitter?.emit('loadingStart', context);

    return context;
  }

  /**
   * End tracking for an operation
   */
  endOperation(context: LoadingContext, success: boolean): void {
    const { operation } = context;
    
    // Remove from active operations
    this.activeOperations.delete(operation);
    
    // Clear timeout if exists
    const timeoutId = this.operationTimeouts.get(operation);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.operationTimeouts.delete(operation);
    }

    // Calculate duration and create completion data
    const duration = Date.now() - context.startTime;
    const completedData: CompletedOperationData = {
      context,
      success,
      duration,
      completedAt: new Date()
    };

    // Store completed operation data for debugging
    this.completedOperations.set(operation, completedData);

    // Emit loading end event
    this.eventEmitter?.emit('loadingEnd', { ...context, success, duration });
  }

  /**
   * Check if any operations are currently active
   */
  get isLoading(): boolean {
    return this.activeOperations.size > 0;
  }

  /**
   * Get list of active operation names
   */
  getActiveOperations(): string[] {
    return Array.from(this.activeOperations.keys());
  }

  /**
   * Check if a specific operation is currently active
   */
  isOperationActive(operation: string): boolean {
    return this.activeOperations.has(operation);
  }

  /**
   * Get context for a specific active operation
   */
  getOperationContext(operation: string): LoadingContext | undefined {
    return this.activeOperations.get(operation);
  }

  /**
   * Get all active operation contexts
   */
  getActiveOperationContexts(): LoadingContext[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get completed operation data for debugging
   */
  getCompletedOperation(operation: string): CompletedOperationData | undefined {
    return this.completedOperations.get(operation);
  }

  /**
   * Get all completed operations (useful for debugging)
   */
  getCompletedOperations(): CompletedOperationData[] {
    return Array.from(this.completedOperations.values());
  }

  /**
   * Cancel/clear a specific active operation
   */
  cancelOperation(operation: string): boolean {
    const context = this.activeOperations.get(operation);
    if (!context) {
      return false;
    }

    // End the operation as unsuccessful
    this.endOperation(context, false);
    return true;
  }

  /**
   * Cancel all active operations
   */
  cancelAllOperations(): void {
    const activeOps = Array.from(this.activeOperations.values());
    activeOps.forEach(context => {
      this.endOperation(context, false);
    });
  }

  /**
   * Clear all completed operation data
   */
  clearCompletedOperations(): void {
    this.completedOperations.clear();
  }

  /**
   * Get statistics about operations
   */
  getStatistics(): {
    activeCount: number;
    completedCount: number;
    averageDuration: number;
    successRate: number;
    longestRunningOperation?: { operation: string; duration: number };
  } {
    const activeCount = this.activeOperations.size;
    const completedOps = Array.from(this.completedOperations.values());
    const completedCount = completedOps.length;

    let averageDuration = 0;
    let successCount = 0;
    
    if (completedCount > 0) {
      const totalDuration = completedOps.reduce((sum, op) => sum + op.duration, 0);
      averageDuration = totalDuration / completedCount;
      successCount = completedOps.filter(op => op.success).length;
    }

    const successRate = completedCount > 0 ? successCount / completedCount : 0;

    // Find longest running active operation
    let longestRunningOperation: { operation: string; duration: number } | undefined;
    const now = Date.now();
    
    for (const [operation, context] of this.activeOperations) {
      const duration = now - context.startTime;
      if (!longestRunningOperation || duration > longestRunningOperation.duration) {
        longestRunningOperation = { operation, duration };
      }
    }

    return {
      activeCount,
      completedCount,
      averageDuration,
      successRate,
      longestRunningOperation
    };
  }

  /**
   * Cleanup oldest active operation when at capacity
   */
  private cleanupOldestOperation(): void {
    let oldestOperation: string | undefined;
    let oldestTime = Infinity;

    for (const [operation, context] of this.activeOperations) {
      if (context.startTime < oldestTime) {
        oldestTime = context.startTime;
        oldestOperation = operation;
      }
    }

    if (oldestOperation) {
      console.warn(
        `LoadingManager: Cleaning up the oldest operation due to capacity limit (${this.options.maxConcurrentOperations})`
      );
      this.cancelOperation(oldestOperation);
    }
  }

  /**
   * Start periodic cleanup of completed operations
   */
  private startCleanupTimer(): void {
    // Clean up every 5 minutes
    setInterval(() => {
      this.cleanupCompletedOperations();
    }, 300000);
  }

  /**
   * Clean up old completed operations
   */
  private cleanupCompletedOperations(): void {
    const now = Date.now();
    const cutoffTime = now - this.options.completedOperationRetentionMs;

    for (const [operation, data] of this.completedOperations) {
      if (data.completedAt.getTime() < cutoffTime) {
        this.completedOperations.delete(operation);
      }
    }
  }

  /**
   * Cleanup resources when manager is no longer needed
   */
  destroy(): void {
    // Cancel all active operations
    this.cancelAllOperations();
    
    // Clear all timeouts
    for (const timeoutId of this.operationTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.operationTimeouts.clear();
    
    // Clear completed operations
    this.clearCompletedOperations();
    
    // Remove event emitter reference
    this.eventEmitter = undefined;
  }
}
