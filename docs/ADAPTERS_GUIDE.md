# Adapter Implementation Guide

This guide provides comprehensive documentation for implementing adapters for the OAuth Core library. Each adapter serves a specific purpose in the OAuth flow and can be customized for different environments.

## Overview

The OAuth Core library uses an adapter pattern to integrate with different environments and services. Each adapter is responsible for a specific functionality:

- **StorageAdapter**: Token storage and retrieval
- **HttpAdapter**: HTTP requests with metadata support
- **PKCEAdapter**: Cryptographic operations
- **UserAdapter**: User management operations
- **GraphQLAdapter**: Server-side GraphQL mutations

## Required Adapters

### 1. TokenStorageAdapter - Token Storage and Retrieval

The storage adapter handles all token-related storage operations. It extends the basic `StorageAdapter` with token-specific methods.

```typescript
import { TokenStorageAdapter, OAuthTokens } from '@zestic/oauth-core';

class BrowserStorageAdapter implements TokenStorageAdapter {
  // Basic storage operations
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async removeItems(keys: string[]): Promise<void> {
    keys.forEach(key => localStorage.removeItem(key));
  }

  // Token-specific operations (NEW in Phase 7)
  async setTokenData(key: string, data: OAuthTokens): Promise<void> {
    const jsonData = JSON.stringify(data);
    localStorage.setItem(key, jsonData);
  }

  async getTokenData(key: string): Promise<OAuthTokens | null> {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }

  async removeTokenData(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}
```

#### React Native Example

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

class ReactNativeStorageAdapter implements TokenStorageAdapter {
  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async removeItems(keys: string[]): Promise<void> {
    await AsyncStorage.multiRemove(keys);
  }

  async setTokenData(key: string, data: OAuthTokens): Promise<void> {
    const jsonData = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonData);
  }

  async getTokenData(key: string): Promise<OAuthTokens | null> {
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }

  async removeTokenData(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}
```

### 2. HttpAdapter - HTTP Requests with Metadata Support

The HTTP adapter handles all OAuth-related HTTP requests and supports rate limiting metadata extraction.

```typescript
import { HttpAdapter, HttpResponse } from '@zestic/oauth-core';

class FetchHttpAdapter implements HttpAdapter {
  constructor(private baseHeaders: Record<string, string> = {}) {}

  async post(url: string, data: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...this.baseHeaders,
        ...headers,
      },
      body: new URLSearchParams(data as Record<string, string>),
    });

    return this.createHttpResponse(response);
  }

  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    const response = await fetch(url, {
      headers: {
        ...this.baseHeaders,
        ...headers,
      },
    });

    return this.createHttpResponse(response);
  }

  private async createHttpResponse(response: Response): Promise<HttpResponse> {
    // Extract rate limiting headers (Phase 7 feature)
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitReset = response.headers.get('X-RateLimit-Reset');

    return {
      status: response.status,
      data: await response.json().catch(() => ({})), // Handle non-JSON responses
      headers: Object.fromEntries(response.headers.entries()),
      // Rate limiting metadata (NEW in Phase 7)
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
      rateLimitReset: rateLimitReset ? new Date(parseInt(rateLimitReset, 10) * 1000) : undefined,
    };
  }
}
```

#### Axios Example

```typescript
import axios, { AxiosResponse } from 'axios';

class AxiosHttpAdapter implements HttpAdapter {
  constructor(private axiosInstance = axios.create()) {}

  async post(url: string, data: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse> {
    const response = await this.axiosInstance.post(url, data, { headers });

    return this.createHttpResponse(response);
  }

  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    const response = await this.axiosInstance.get(url, { headers });

    return this.createHttpResponse(response);
  }

  private createHttpResponse(response: AxiosResponse): HttpResponse {
    const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
    const rateLimitReset = response.headers['x-ratelimit-reset'];

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
      rateLimitReset: rateLimitReset ? new Date(parseInt(rateLimitReset, 10) * 1000) : undefined,
    };
  }
}
```

### 3. PKCEAdapter - Cryptographic Operations

The PKCE adapter handles the generation of PKCE challenges and state parameters.

```typescript
import { PKCEAdapter, PKCEChallenge } from '@zestic/oauth-core';

class CryptoPKCEAdapter implements PKCEAdapter {
  async generateCodeChallenge(): Promise<PKCEChallenge> {
    // Generate cryptographically secure random bytes
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);

    // Convert to base64url
    const codeVerifier = this.base64URLEncode(array);
    const codeChallenge = await this.sha256(codeVerifier);

    return {
      codeChallenge,
      codeChallengeMethod: 'S256',
      codeVerifier
    };
  }

  async generateState(): Promise<string> {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return this.base64URLEncode(new Uint8Array(hashBuffer));
  }

  private base64URLEncode(array: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
```

#### React Native Crypto Example

```typescript
import { PKCEAdapter, PKCEChallenge } from '@zestic/oauth-core';

class ReactNativePKCEAdapter implements PKCEAdapter {
  async generateCodeChallenge(): Promise<PKCEChallenge> {
    // For React Native, you might use a crypto library like react-native-crypto
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = await this.sha256(codeVerifier);

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

  private async sha256(message: string): Promise<string> {
    // Use react-native-crypto or similar for SHA-256
    // Implementation depends on your crypto library
    throw new Error('SHA-256 implementation needed for React Native');
  }
}
```

## Optional Adapters

### 4. UserAdapter - User Management Operations

Required for magic link flows and user registration features.

```typescript
import { UserAdapter, UserRegistrationResult, UserInfo } from '@zestic/oauth-core';

class ApiUserAdapter implements UserAdapter {
  constructor(private apiBaseUrl: string) {}

  async registerUser(email: string, additionalData: Record<string, unknown>): Promise<UserRegistrationResult> {
    const response = await fetch(`${this.apiBaseUrl}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...additionalData })
    });

    const result = await response.json();
    return {
      success: response.ok,
      userId: result.userId,
      message: result.message
    };
  }

  async userExists(email: string): Promise<boolean> {
    const response = await fetch(`${this.apiBaseUrl}/users/exists?email=${encodeURIComponent(email)}`);
    const result = await response.json();
    return result.exists;
  }

  async getUserByEmail(email: string): Promise<UserInfo | null> {
    const response = await fetch(`${this.apiBaseUrl}/users/by-email?email=${encodeURIComponent(email)}`);
    if (!response.ok) return null;
    return response.json();
  }
}
```

### 5. GraphQLAdapter - Server-side GraphQL Mutations

Required for GraphQL-based server communication, such as magic link flows.

```typescript
import { GraphQLAdapter, GraphQLResult, GraphQLOptions } from '@zestic/oauth-core';

class FetchGraphQLAdapter implements GraphQLAdapter {
  constructor(private graphqlEndpoint: string) {}

  async sendMagicLinkMutation(email: string, magicLinkUrl: string, options?: GraphQLOptions): Promise<GraphQLResult> {
    const mutation = `
      mutation SendMagicLink($input: SendMagicLinkInput!) {
        sendMagicLink(input: $input) {
          success
          message
          code
        }
      }
    `;

    const response = await fetch(this.graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: { email, magicLinkUrl, ...options }
        }
      })
    });

    const result = await response.json();
    return result.data.sendMagicLink;
  }

  async sendRegistrationConfirmationMutation(email: string, options?: GraphQLOptions): Promise<GraphQLResult> {
    const mutation = `
      mutation SendRegistrationConfirmation($input: SendRegistrationConfirmationInput!) {
        sendRegistrationConfirmation(input: $input) {
          success
          message
          code
        }
      }
    `;

    const response = await fetch(this.graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: { email, ...options }
        }
      })
    });

    const result = await response.json();
    return result.data.sendRegistrationConfirmation;
  }
}
```

## Putting It All Together

```typescript
import { OAuthCore } from '@zestic/oauth-core';

// Create all required adapters
const storage = new BrowserStorageAdapter();
const http = new FetchHttpAdapter();
const pkce = new CryptoPKCEAdapter();
const user = new ApiUserAdapter('/api'); // Optional
const graphql = new FetchGraphQLAdapter('/graphql'); // Optional

// Create OAuth configuration
const config = {
  clientId: 'your-client-id',
  endpoints: {
    authorization: 'https://auth.example.com/oauth/authorize',
    token: 'https://auth.example.com/oauth/token',
    revocation: 'https://auth.example.com/oauth/revoke',
  },
  redirectUri: 'https://yourapp.com/auth/callback',
  scopes: ['read', 'write'],
};

// Initialize OAuth core with adapters
const oauth = new OAuthCore(config, {
  storage,  // Required
  http,     // Required
  pkce,     // Required
  user,     // Optional - needed for user management features
  graphql   // Optional - needed for GraphQL-based flows
});

// Use with metadata tracking (Phase 7 feature)
const result = await oauth.handleCallback(params);

if (result.metadata) {
  console.log(`Request took ${result.metadata.duration}ms`);
  console.log(`Rate limit remaining: ${result.metadata.rateLimitRemaining}`);
}
```

## Environment-Specific Implementations

### Node.js Environment

For server-side Node.js applications:

```typescript
import { readFileSync, writeFileSync } from 'fs';
import { randomBytes, createHash } from 'crypto';

class NodeStorageAdapter implements TokenStorageAdapter {
  private storage = new Map<string, string>();

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    // Optionally persist to file
    // writeFileSync(`./storage/${key}`, value);
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  // ... other methods
}

class NodePKCEAdapter implements PKCEAdapter {
  async generateCodeChallenge(): Promise<PKCEChallenge> {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return {
      codeChallenge,
      codeChallengeMethod: 'S256',
      codeVerifier
    };
  }

  async generateState(): Promise<string> {
    return randomBytes(16).toString('base64url');
  }
}
```

## Testing Adapters

When testing, you can create mock adapters or use the provided test utilities:

```typescript
import { createE2EAdapters } from './test-adapters';

// Use the integration test adapters
const adapters = createE2EAdapters();

// Or create custom mocks for unit tests
const mockAdapters = {
  storage: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    removeItems: jest.fn(),
    setTokenData: jest.fn(),
    getTokenData: jest.fn(),
    removeTokenData: jest.fn(),
  } as any, // Cast as any for testing
  http: {
    post: jest.fn(),
    get: jest.fn(),
  },
  pkce: {
    generateCodeChallenge: jest.fn(),
    generateState: jest.fn(),
  },
};