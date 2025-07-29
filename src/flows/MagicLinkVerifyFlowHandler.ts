/**
 * Magic Link Verify Flow Handler
 * Handles magic link authentication for verification flows
 */

import { BaseMagicLinkFlowHandler } from './BaseMagicLinkFlowHandler';
import { OAuthConfig } from '../types/OAuthTypes';

export class MagicLinkVerifyFlowHandler extends BaseMagicLinkFlowHandler {
  readonly name = 'magic_link_verify';

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

    // Must have flow=verify parameter
    const flow = params.get('flow');
    return flow === 'verify';
  }

  /**
   * Validate the verify flow parameters
   */
  async validate(params: URLSearchParams, config: OAuthConfig): Promise<boolean> {
    return this.canHandle(params, config);
  }
}

/**
 * Factory function to create magic link verify flow handler
 */
export function createMagicLinkVerifyFlowHandler(): MagicLinkVerifyFlowHandler {
  return new MagicLinkVerifyFlowHandler();
}
