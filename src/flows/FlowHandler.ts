/**
 * Base flow handler interface and abstract implementation
 */

import { FlowHandler as IFlowHandler } from '../types/FlowTypes';
import { OAuthConfig, OAuthAdapters, OAuthResult, OAUTH_ERROR_CODES } from '../types/OAuthTypes';
import { ErrorHandler } from '../utils/ErrorHandler';
import { UrlParser } from '../utils/UrlParser';

/**
 * Abstract base class for flow handlers
 */
export abstract class BaseFlowHandler implements IFlowHandler {
  abstract readonly name: string;
  abstract readonly priority: number;

  abstract canHandle(params: URLSearchParams, config: OAuthConfig): boolean;
  abstract handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult>;

  /**
   * Optional validation step - can be overridden by subclasses
   */
  async validate?(params: URLSearchParams, config: OAuthConfig): Promise<boolean>;

  /**
   * Check for OAuth errors in parameters
   */
  protected checkForOAuthError(params: URLSearchParams): void {
    if (UrlParser.hasOAuthError(params)) {
      const { error, errorDescription } = UrlParser.extractOAuthError(params);
      const message = errorDescription || error || 'OAuth error occurred';
      
      throw ErrorHandler.createError(
        message,
        error && typeof error === 'string' ? error as import('../types/OAuthTypes').OAuthErrorCode : OAUTH_ERROR_CODES.INVALID_GRANT
      );
    }
  }

  /**
   * Validate required parameters
   */
  protected validateRequiredParams(params: URLSearchParams, requiredParams: string[]): void {
    const missing = requiredParams.filter(param => !params.has(param));
    
    if (missing.length > 0) {
      throw ErrorHandler.handleMissingParameter(missing.join(', '));
    }
  }

  /**
   * Extract parameter safely with validation
   */
  protected getRequiredParam(params: URLSearchParams, key: string): string {
    const value = params.get(key);
    
    if (!value) {
      throw ErrorHandler.handleMissingParameter(key);
    }
    
    return value;
  }

  /**
   * Get optional parameter with default value
   */
  protected getOptionalParam(params: URLSearchParams, key: string, defaultValue?: string): string | undefined {
    return params.get(key) ?? defaultValue;
  }

  /**
   * Create success result
   */
  protected createSuccessResult(
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): OAuthResult {
    return {
      success: true,
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Create error result
   */
  protected createErrorResult(error: string, errorCode?: string): OAuthResult {
    return {
      success: false,
      error,
      errorCode,
    };
  }

  /**
   * Log flow execution
   */
  protected logFlowExecution(message: string, params?: URLSearchParams): void {
    const sanitizedParams = params ? UrlParser.sanitizeForLogging(params) : {};
    console.log(`[${this.name}] ${message}`, sanitizedParams);
  }

  /**
   * Measure execution time
   */
  protected async measureExecutionTime<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      console.log(`[${this.name}] ${operationName} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[${this.name}] ${operationName} failed after ${duration}ms:`, error);
      throw error;
    }
  }
}

/**
 * Simple flow handler implementation for basic flows
 */
export class SimpleFlowHandler extends BaseFlowHandler {
  constructor(
    public readonly name: string,
    public readonly priority: number,
    private canHandleFunc: (params: URLSearchParams, config: OAuthConfig) => boolean,
    private handleFunc: (params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig) => Promise<OAuthResult>,
    private validateFunc?: (params: URLSearchParams, config: OAuthConfig) => Promise<boolean>
  ) {
    super();
  }

  canHandle(params: URLSearchParams, config: OAuthConfig): boolean {
    return this.canHandleFunc(params, config);
  }

  async handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult> {
    return this.handleFunc(params, adapters, config);
  }

  async validate(params: URLSearchParams, config: OAuthConfig): Promise<boolean> {
    if (this.validateFunc) {
      return this.validateFunc(params, config);
    }
    return true;
  }
}

/**
 * Factory for creating simple flow handlers
 */
export class FlowHandlerFactory {
  static create(
    name: string,
    priority: number,
    canHandle: (params: URLSearchParams, config: OAuthConfig) => boolean,
    handle: (params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig) => Promise<OAuthResult>,
    validate?: (params: URLSearchParams, config: OAuthConfig) => Promise<boolean>
  ): IFlowHandler {
    return new SimpleFlowHandler(name, priority, canHandle, handle, validate);
  }
}
