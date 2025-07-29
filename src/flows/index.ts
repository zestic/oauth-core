/**
 * Flow handlers exports
 */

// Base callback flow handler
export { BaseCallbackFlowHandler, SimpleCallbackFlowHandler, FlowHandlerFactory } from './BaseCallbackFlowHandler';

// Built-in flow handlers

export { BaseMagicLinkFlowHandler } from './BaseMagicLinkFlowHandler';
export { MagicLinkLoginFlowHandler } from './MagicLinkLoginFlowHandler';
export { MagicLinkVerifyFlowHandler } from './MagicLinkVerifyFlowHandler';
export { MagicLinkRegisteredFlowHandler, createMagicLinkRegisteredFlowHandler } from './MagicLinkRegisteredFlowHandler';

// Flow types
export * from '../types/CallbackFlowTypes';

// Note: Factory functions are implemented in OAuthCore to avoid circular dependencies
