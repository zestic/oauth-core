/**
 * GraphQL Resolvers for OAuth Core
 */

import { RegistrationService } from '../services/RegistrationService';
import { MagicLinkService } from '../services/MagicLinkService';
import { ErrorHandler } from '../utils/ErrorHandler';
import type {
  RegistrationInput,
  SendMagicLinkInput,
  RegistrationResponse,
  MagicLinkResponse,
  ExtendedOAuthAdapters,
  MagicLinkConfig
} from '../types/ServiceTypes';
// GraphQL AST node interfaces
interface ASTNode {
  kind: string;
  value?: string;
  fields?: Array<{ name: { value: string }; value: ASTNode }>;
  values?: ASTNode[];
}

/**
 * Context interface for GraphQL resolvers
 */
export interface GraphQLContext {
  adapters: ExtendedOAuthAdapters;
  magicLinkConfig: MagicLinkConfig;
}

/**
 * GraphQL resolvers
 */
export const resolvers = {
  Query: {
    _empty: () => 'OAuth Core GraphQL API'
  },

  Mutation: {
    /**
     * Register a new user
     */
    register: async (
      _parent: unknown,
      { input }: { input: RegistrationInput },
      context: GraphQLContext
    ): Promise<RegistrationResponse> => {
      try {
        const registrationService = new RegistrationService(context.adapters);
        return await registrationService.register(input);
      } catch (error) {
        // Handle OAuth errors gracefully
        if (ErrorHandler.isOAuthError(error)) {
          return {
            success: false,
            message: error.message,
            code: error.code
          };
        }

        // Handle unexpected errors
        return {
          success: false,
          message: 'An unexpected error occurred during registration',
          code: 'INTERNAL_ERROR'
        };
      }
    },

    /**
     * Send a magic link to the specified email
     */
    sendMagicLink: async (
      _parent: unknown,
      { input }: { input: SendMagicLinkInput },
      context: GraphQLContext
    ): Promise<MagicLinkResponse> => {
      try {
        const magicLinkService = new MagicLinkService(context.adapters, context.magicLinkConfig);
        return await magicLinkService.sendMagicLink(input);
      } catch (error) {
        // Handle OAuth errors gracefully
        if (ErrorHandler.isOAuthError(error)) {
          return {
            success: false,
            message: error.message,
            code: error.code
          };
        }

        // Handle unexpected errors
        return {
          success: false,
          message: 'An unexpected error occurred while sending magic link',
          code: 'INTERNAL_ERROR'
        };
      }
    }
  },

  // Custom scalar resolver for JSON
  JSON: {
    serialize: (value: unknown) => value,
    parseValue: (value: unknown) => value,
    parseLiteral: (ast: ASTNode): unknown => {
      switch (ast.kind) {
        case 'StringValue':
        case 'BooleanValue':
          return ast.value;
        case 'IntValue':
        case 'FloatValue':
          return ast.value ? parseFloat(ast.value) : 0;
        case 'ObjectValue':
          return ast.fields?.reduce((obj: Record<string, unknown>, field: { name: { value: string }; value: ASTNode }) => {
            obj[field.name.value] = resolvers.JSON.parseLiteral(field.value);
            return obj;
          }, {}) ?? {};
        case 'ListValue':
          return ast.values?.map(resolvers.JSON.parseLiteral) ?? [];
        case 'NullValue':
          return null;
        default:
          throw new Error(`Unexpected kind in JSON literal: ${ast.kind}`);
      }
    }
  }
};

/**
 * Type definitions for resolver arguments
 */
export interface ResolverArgs {
  register: {
    input: RegistrationInput;
  };
  sendMagicLink: {
    input: SendMagicLinkInput;
  };
}

/**
 * Helper function to create GraphQL context
 */
export function createGraphQLContext(
  adapters: ExtendedOAuthAdapters,
  magicLinkConfig: MagicLinkConfig
): GraphQLContext {
  return {
    adapters,
    magicLinkConfig
  };
}

/**
 * Validation helpers for resolvers
 */
export const validationHelpers = {
  /**
   * Validate that required context is present
   */
  validateContext(context: GraphQLContext): void {
    if (!context.adapters) {
      throw new Error('OAuth adapters not provided in GraphQL context');
    }

    if (!context.adapters.user) {
      throw new Error('User adapter not provided in GraphQL context');
    }

    if (!context.adapters.email) {
      throw new Error('Email adapter not provided in GraphQL context');
    }

    if (!context.magicLinkConfig) {
      throw new Error('Magic link configuration not provided in GraphQL context');
    }
  },

  /**
   * Sanitize error messages for client consumption
   */
  sanitizeError(error: unknown): { message: string; code: string } {
    if (ErrorHandler.isOAuthError(error)) {
      return {
        message: error.message,
        code: error.code
      };
    }

    // Don't expose internal error details to clients
    return {
      message: 'An internal error occurred',
      code: 'INTERNAL_ERROR'
    };
  }
};
