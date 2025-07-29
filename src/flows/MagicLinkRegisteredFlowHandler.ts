/**
 * Magic Link Registered Flow Handler
 * Handles magic link authentication for users who have completed registration
 */

import { BaseMagicLinkFlowHandler } from './BaseMagicLinkFlowHandler';
import { OAuthConfig } from '../types/OAuthTypes';

export class MagicLinkRegisteredFlowHandler extends BaseMagicLinkFlowHandler {
  readonly name = 'magic_link_registered';

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

    // Must have flow=registered parameter
    const flow = params.get('flow');
    return flow === 'registered';
  }

  /**
   * Validate the registered flow parameters
   */
  async validate(params: URLSearchParams, config: OAuthConfig): Promise<boolean> {
    return this.canHandle(params, config);
  }
}

/**
 * Factory function to create magic link registered flow handler
 */
export function createMagicLinkRegisteredFlowHandler(): MagicLinkRegisteredFlowHandler {
  return new MagicLinkRegisteredFlowHandler();
}
