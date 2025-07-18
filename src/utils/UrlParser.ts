/**
 * URL parameter parsing utilities for OAuth callbacks
 */

export class UrlParser {
  /**
   * Parse URL search parameters from a URL string or URLSearchParams
   */
  static parseParams(input: string | URLSearchParams): URLSearchParams {
    if (input instanceof URLSearchParams) {
      return input;
    }

    // Handle full URLs
    if (input.includes('://')) {
      const url = new URL(input);
      return url.searchParams;
    }

    // Handle query strings (with or without leading ?)
    const queryString = input.startsWith('?') ? input.slice(1) : input;
    return new URLSearchParams(queryString);
  }

  /**
   * Extract specific parameters from URLSearchParams
   */
  static extractParams(params: URLSearchParams, keys: string[]): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    
    for (const key of keys) {
      result[key] = params.get(key) ?? undefined;
    }
    
    return result;
  }

  /**
   * Check if required parameters are present
   */
  static hasRequiredParams(params: URLSearchParams, requiredKeys: string[]): boolean {
    return requiredKeys.every(key => params.has(key));
  }

  /**
   * Check if any of the specified parameters are present
   */
  static hasAnyParams(params: URLSearchParams, keys: string[]): boolean {
    return keys.some(key => params.has(key));
  }

  /**
   * Get the first non-null parameter value from a list of possible keys
   */
  static getFirstParam(params: URLSearchParams, keys: string[]): string | null {
    for (const key of keys) {
      const value = params.get(key);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  /**
   * Convert URLSearchParams to a plain object
   */
  static toObject(params: URLSearchParams): Record<string, string> {
    const result: Record<string, string> = {};

    params.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * Create URLSearchParams from an object
   */
  static fromObject(obj: Record<string, string | number | boolean | undefined | null>): URLSearchParams {
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
    
    return params;
  }

  /**
   * Validate that a parameter matches expected format
   */
  static validateParam(params: URLSearchParams, key: string, validator: (value: string) => boolean): boolean {
    const value = params.get(key);
    return value !== null && validator(value);
  }

  /**
   * Extract OAuth error information from parameters
   */
  static extractOAuthError(params: URLSearchParams): { error?: string; errorDescription?: string } {
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    return {
      ...(error && { error }),
      ...(errorDescription && { errorDescription }),
    };
  }

  /**
   * Check if parameters contain OAuth error
   */
  static hasOAuthError(params: URLSearchParams): boolean {
    return params.has('error');
  }

  /**
   * Sanitize parameters by removing sensitive information for logging
   */
  static sanitizeForLogging(params: URLSearchParams): Record<string, string> {
    const sensitiveKeys = ['code', 'token', 'magic_link_token', 'access_token', 'refresh_token'];
    const result: Record<string, string> = {};

    params.forEach((value, key) => {
      if (sensitiveKeys.includes(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * Merge multiple URLSearchParams objects
   */
  static merge(...paramSets: URLSearchParams[]): URLSearchParams {
    const result = new URLSearchParams();

    for (const params of paramSets) {
      params.forEach((value, key) => {
        result.set(key, value);
      });
    }

    return result;
  }
}
