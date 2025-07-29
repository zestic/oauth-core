/**
 * Registry for managing OAuth flow handlers
 */

import { CallbackFlowHandler, CallbackFlowDetectionResult, CallbackFlowRegistryOptions } from '../types/CallbackFlowTypes';
import { OAuthConfig, OAUTH_ERROR_CODES } from '../types/OAuthTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export class CallbackFlowRegistry {
  private handlers = new Map<string, CallbackFlowHandler>();
  private options: CallbackFlowRegistryOptions;

  constructor(options: CallbackFlowRegistryOptions = {}) {
    this.options = {
      allowDuplicates: false,
      defaultPriority: 50,
      ...options,
    };
  }

  /**
   * Register a flow handler
   */
  register(handler: CallbackFlowHandler): void {
    if (!this.options.allowDuplicates && this.handlers.has(handler.name)) {
      throw ErrorHandler.createError(
        `Flow handler '${handler.name}' is already registered`,
        OAUTH_ERROR_CODES.INVALID_CONFIGURATION
      );
    }

    this.handlers.set(handler.name, handler);
  }

  /**
   * Unregister a flow handler
   */
  unregister(name: string): boolean {
    return this.handlers.delete(name);
  }

  /**
   * Get a specific flow handler by name
   */
  getHandler(name: string): CallbackFlowHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): CallbackFlowHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get handlers sorted by priority
   */
  getHandlersByPriority(): CallbackFlowHandler[] {
    return Array.from(this.handlers.values())
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Auto-detect which flow to use based on parameters
   */
  detectFlow(params: URLSearchParams, config: OAuthConfig): CallbackFlowHandler | undefined {
    const sortedHandlers = this.getHandlersByPriority();
    
    for (const handler of sortedHandlers) {
      if (handler.canHandle(params, config)) {
        return handler;
      }
    }
    
    return undefined;
  }

  /**
   * Detect flow with confidence scoring
   */
  detectFlowWithConfidence(params: URLSearchParams, config: OAuthConfig): CallbackFlowDetectionResult | undefined {
    const sortedHandlers = this.getHandlersByPriority();
    
    for (const handler of sortedHandlers) {
      if (handler.canHandle(params, config)) {
        // Simple confidence calculation based on priority
        // Lower priority number = higher confidence
        const confidence = Math.max(0, 100 - handler.priority);
        
        return {
          handler,
          confidence,
          reason: `Handler '${handler.name}' can process the provided parameters`,
        };
      }
    }
    
    return undefined;
  }

  /**
   * Get all handlers that can handle the given parameters
   */
  getCompatibleHandlers(params: URLSearchParams, config: OAuthConfig): CallbackFlowHandler[] {
    // Handle null/undefined parameters gracefully
    if (!params || !config) {
      return [];
    }

    const compatibleHandlers = this.getAllHandlers().filter(handler => {
      try {
        return handler.canHandle(params, config);
      } catch (error) {
        // Log error but don't let it break the filtering
        console.warn(`Handler '${handler.name}' threw error in canHandle:`, error);
        return false;
      }
    });

    // Sort by priority (descending - higher priority first)
    return compatibleHandlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if a specific flow is registered
   */
  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Get the number of registered handlers
   */
  getHandlerCount(): number {
    return this.handlers.size;
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get handler names
   */
  getHandlerNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Validate that all required handlers are registered
   */
  validateRequiredHandlers(requiredHandlers: string[]): void {
    const missing = requiredHandlers.filter(name => !this.hasHandler(name));
    
    if (missing.length > 0) {
      throw ErrorHandler.createError(
        `Missing required flow handlers: ${missing.join(', ')}`,
        OAUTH_ERROR_CODES.INVALID_CONFIGURATION
      );
    }
  }

  /**
   * Register multiple handlers at once
   */
  registerMultiple(handlers: CallbackFlowHandler[]): void {
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  /**
   * Create a copy of the registry
   */
  clone(): CallbackFlowRegistry {
    const newRegistry = new CallbackFlowRegistry(this.options);
    
    for (const handler of this.getAllHandlers()) {
      newRegistry.register(handler);
    }
    
    return newRegistry;
  }
}
