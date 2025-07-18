/**
 * Flow handlers exports
 */

// Base flow handler
export { BaseFlowHandler, SimpleFlowHandler, FlowHandlerFactory } from './FlowHandler';

// Built-in flow handlers
export {
  AuthorizationCodeFlowHandler
} from './AuthorizationCodeFlowHandler';

export {
  MagicLinkFlowHandler,
  MagicLinkLoginFlowHandler,
  MagicLinkRegistrationFlowHandler
} from './MagicLinkFlowHandler';

// Flow types
export * from '../types/FlowTypes';

// Note: Factory functions are implemented in OAuthCore to avoid circular dependencies
