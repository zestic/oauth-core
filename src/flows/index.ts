/**
 * Flow handlers exports
 */

// Base callback flow handler
export { BaseCallbackFlowHandler, SimpleCallbackFlowHandler, FlowHandlerFactory } from './BaseCallbackFlowHandler';

// Built-in flow handlers

export {
  MagicLinkFlowHandler,
  MagicLinkLoginFlowHandler,
  MagicLinkRegistrationFlowHandler
} from './MagicLinkFlowHandler';

// Flow types
export * from '../types/CallbackFlowTypes';

// Note: Factory functions are implemented in OAuthCore to avoid circular dependencies
