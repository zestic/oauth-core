/**
 * Magic Link Login Flow Handler
 * Handles magic link authentication for user login
 */

import { BaseMagicLinkFlowHandler } from './BaseMagicLinkFlowHandler';
import { OAuthConfig } from '../types/OAuthTypes';

export class MagicLinkLoginFlowHandler extends BaseMagicLinkFlowHandler {
  readonly name = 'magic_link_login';

  /**
   * Check if this handler can process the given parameters
   */
  canHandle(params: URLSearchParams, config: OAuthConfig): boolean {
    // Check if flow is disabled
    if (this.isFlowDisabled(config)) {
      return false;
    }

    // Must have magic link token parameters
    if (!this.hasRequiredMagicLinkParams(params)) {
      return false;
    }

    // Must have flow=login parameter
    const flow = params.get('flow');
    return flow === 'login';
  }

  /**
   * Validate the login flow parameters
   */
  async validate(params: URLSearchParams, config: OAuthConfig): Promise<boolean> {
    return this.canHandle(params, config);
  }
}

/**
 * Factory function to create magic link login flow handler
 */
export function createMagicLinkLoginFlowHandler(): MagicLinkLoginFlowHandler {
  return new MagicLinkLoginFlowHandler();
}
