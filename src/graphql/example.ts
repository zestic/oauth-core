/**
 * Example implementation showing how to use OAuth Core with GraphQL
 */

import { typeDefs, resolvers, createGraphQLContext } from './index';
import type {
  ExtendedOAuthAdapters,
  MagicLinkConfig,
  UserAdapter,
  GraphQLAdapter,
  UserRegistrationResult,
  GraphQLResult,
  UserInfo
} from '../types/ServiceTypes';
import type {
  StorageAdapter,
  HttpAdapter,
  PKCEAdapter,
  PKCEChallenge,
  HttpResponse
} from '../types/OAuthTypes';

/**
 * Example implementation of UserAdapter
 */
class ExampleUserAdapter implements UserAdapter {
  private users: Map<string, UserInfo> = new Map();

  async registerUser(email: string, additionalData: Record<string, unknown>): Promise<UserRegistrationResult> {
    if (this.users.has(email)) {
      return {
        success: false,
        error: 'User already exists'
      };
    }

    const user: UserInfo = {
      id: `user_${Date.now()}`,
      email,
      additionalData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.users.set(email, user);

    return {
      success: true,
      userId: user.id,
      message: 'User registered successfully'
    };
  }

  async userExists(email: string): Promise<boolean> {
    return this.users.has(email);
  }

  async getUserByEmail(email: string): Promise<UserInfo | null> {
    return this.users.get(email) || null;
  }
}

/**
 * Example implementation of GraphQLAdapter
 */
class ExampleGraphQLAdapter implements GraphQLAdapter {
  async sendMagicLinkMutation(email: string, magicLinkUrl: string): Promise<GraphQLResult> {
    // In a real implementation, you would make a GraphQL mutation to your server
    // which would then handle sending the email via your email service
    console.log(`Triggering magic link sending for ${email}: ${magicLinkUrl}`);

    return {
      success: true,
      messageId: `msg_${Date.now()}`,
      message: 'Magic link mutation triggered successfully'
    };
  }

  async sendRegistrationConfirmationMutation(email: string): Promise<GraphQLResult> {
    console.log(`Triggering registration confirmation for ${email}`);

    return {
      success: true,
      messageId: `msg_${Date.now()}`,
      message: 'Registration confirmation mutation triggered successfully'
    };
  }
}

/**
 * Example storage adapter (in-memory)
 */
class ExampleStorageAdapter implements StorageAdapter {
  private storage: Map<string, string> = new Map();

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async removeItems(keys: string[]): Promise<void> {
    keys.forEach(key => this.storage.delete(key));
  }
}

/**
 * Example HTTP adapter
 */
class ExampleHttpAdapter implements HttpAdapter {
  async post(url: string, data: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse> {
    // In a real implementation, you would make actual HTTP requests
    console.log(`POST ${url}`, data, headers);
    
    return {
      status: 200,
      data: { success: true },
      headers: {}
    };
  }

  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    console.log(`GET ${url}`, headers);
    
    return {
      status: 200,
      data: { success: true },
      headers: {}
    };
  }
}

/**
 * Example PKCE adapter
 */
class ExamplePKCEAdapter implements PKCEAdapter {
  async generateCodeChallenge(): Promise<PKCEChallenge> {
    // In a real implementation, you would use proper cryptographic functions
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = this.base64URLEncode(codeVerifier); // Simplified
    
    return {
      codeChallenge,
      codeChallengeMethod: 'S256',
      codeVerifier
    };
  }

  async generateState(): Promise<string> {
    return this.generateRandomString(32);
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private base64URLEncode(str: string): string {
    // Simplified base64 encoding - use proper crypto in production
    return Buffer.from(str).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

/**
 * Create example adapters
 */
export function createExampleAdapters(): ExtendedOAuthAdapters {
  return {
    storage: new ExampleStorageAdapter(),
    http: new ExampleHttpAdapter(),
    pkce: new ExamplePKCEAdapter(),
    user: new ExampleUserAdapter(),
    graphql: new ExampleGraphQLAdapter()
  };
}

/**
 * Create example magic link configuration
 */
export function createExampleMagicLinkConfig(): MagicLinkConfig {
  return {
    baseUrl: 'https://your-app.com/auth/callback',
    tokenEndpoint: '/oauth/token',
    expirationMinutes: 15,
    customParams: {
      source: 'magic_link'
    }
  };
}

/**
 * Example GraphQL server setup (pseudo-code)
 */
export function createExampleGraphQLSetup() {
  const adapters = createExampleAdapters();
  const magicLinkConfig = createExampleMagicLinkConfig();
  const context = createGraphQLContext(adapters, magicLinkConfig);

  return {
    typeDefs,
    resolvers,
    context
  };
}

/**
 * Example GraphQL queries and mutations
 */
export const exampleQueries = {
  register: `
    mutation Register($input: RegistrationInput!) {
      register(input: $input) {
        success
        message
        code
      }
    }
  `,
  
  sendMagicLink: `
    mutation SendMagicLink($input: SendMagicLinkInput!) {
      sendMagicLink(input: $input) {
        success
        message
        code
      }
    }
  `
};

/**
 * Example variables for the mutations
 */
export const exampleVariables = {
  register: {
    input: {
      email: 'user@example.com',
      additionalData: {
        firstName: 'John',
        lastName: 'Doe',
        preferences: {
          newsletter: true
        }
      },
      codeChallenge: 'example_code_challenge',
      codeChallengeMethod: 'S256',
      redirectUri: 'https://your-app.com/auth/callback',
      state: 'example_state_value'
    }
  },
  
  sendMagicLink: {
    input: {
      email: 'user@example.com',
      codeChallenge: 'example_code_challenge',
      codeChallengeMethod: 'S256',
      redirectUri: 'https://your-app.com/auth/callback',
      state: 'example_state_value'
    }
  }
};
