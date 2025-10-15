# @zestic/oauth-core

[![Test](https://github.com/zestic/oauth-core/workflows/Test/badge.svg)](https://github.com/zestic/oauth-core/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/zestic/oauth-core/branch/main/graph/badge.svg)](https://codecov.io/gh/zestic/oauth-core)
[![npm version](https://badge.fury.io/js/%40zestic%2Foauth-core.svg)](https://badge.fury.io/js/%40zestic%2Foauth-core)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Framework-agnostic OAuth authentication library with support for multiple OAuth flows including authorization code flow, magic link authentication, and custom flows. This client-side library manages the complete OAuth lifecycle while integrating seamlessly with your server-side authentication system.

## Architecture

This library is designed as a **client-side OAuth manager** that handles:

1. **PKCE Management**: Generates and stores PKCE challenge/verifier pairs for secure OAuth flows
2. **State Management**: Generates and validates OAuth state parameters to prevent CSRF attacks
3. **GraphQL Integration**: Provides mutations to send PKCE/state data to your server
4. **Callback Handling**: Acts as the OAuth callback handler (framework-agnostic)
5. **Token Management**: Exchanges authorization codes for tokens and manages refresh cycles
6. **Storage Abstraction**: Uses adapters for different storage needs (localStorage, AsyncStorage, etc.)

### Magic Link Flow

The magic link authentication follows this secure server-client flow:

```
1. Client (this library) → GraphQL mutation → Server
   { email, codeChallenge, codeChallengeMethod, state }

2. Server processes, stores PKCE data, sends email

3. User clicks email → Server validates → Server calls client callback
   GET /oauth/callback?code=magic-code&state=original-state

4. Client callback (this library) → Validates state → Exchanges code for tokens
   POST /oauth/token { grant_type, code, code_verifier, client_id }

5. Client (this library) → Manages token refresh cycle
```

### Framework Integration

The library works with any JavaScript framework through its adapter pattern:

- **Expo Router**: `app/oauth/callback/+api.ts` → calls this library
- **React Router**: Route handler → calls this library
- **Next.js**: API route → calls this library
- **Any framework**: Implements callback endpoint → delegates to this library

### Complete Authentication Lifecycle

1. **Client generates PKCE challenge** and state parameters
2. **Client sends GraphQL mutation** with user email and PKCE data
3. **Server stores PKCE data** and sends magic link email
4. **User clicks magic link** in email
5. **Server validates magic link** and calls client callback with authorization code
6. **Client validates state** parameter to prevent CSRF attacks
7. **Client exchanges authorization code** for access/refresh tokens using PKCE verifier
8. **Client manages token lifecycle** including automatic refresh

## Features

- **Multiple OAuth Flows**: Authorization code flow, magic link authentication, and extensible custom flows
- **PKCE Support**: Built-in PKCE (Proof Key for Code Exchange) implementation for enhanced security
- **Framework Agnostic**: Works with any JavaScript/TypeScript framework through adapter pattern
- **GraphQL Ready**: Built-in support for GraphQL mutations to trigger server-side actions
- **Event-Driven Architecture**: Reactive state management with comprehensive event system
- **Structured Error Handling**: Rich, actionable error information with metadata and retry logic
- **Automatic Loading States**: Built-in loading state tracking for all async operations
- **Advanced Token Management**: Automatic token refresh scheduling and expiration handling
- **Authentication Status Tracking**: Centralized auth status with granular reactive states
- **Request/Response Metadata**: Comprehensive request tracking with timing, rate limiting, and retry information
- **Type Safe**: Full TypeScript support with comprehensive type definitions
- **Extensible**: Plugin-based architecture for custom OAuth flows
- **Well Tested**: Comprehensive test coverage with Jest
- **Storage Agnostic**: Pluggable storage adapters for different environments

## Installation

```bash
yarn add @zestic/oauth-core
# or
npm install @zestic/oauth-core
```

## Quick Start

```typescript
import { OAuthCore, createOAuthCore } from '@zestic/oauth-core';

// Configure OAuth
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

// Create adapters (implement these for your environment)
const adapters = {
  storage: new YourStorageAdapter(),    // localStorage, AsyncStorage, etc.
  http: new YourHttpAdapter(),          // fetch, axios, etc.
  pkce: new YourPKCEAdapter(),          // PKCE challenge generation
  user: new YourUserAdapter(),          // User registration/lookup
  graphql: new YourGraphQLAdapter(),    // GraphQL mutations to your server
};

// Initialize OAuth core
const oauth = createOAuthCore(config, adapters);

// Handle OAuth callback
const result = await oauth.handleCallback(window.location.search);

if (result.success) {
  console.log('Access token:', result.accessToken);
  console.log('Refresh token:', result.refreshToken);
} else {
  console.error('OAuth failed:', result.error);
}
```

## Supported OAuth Flows

### Authorization Code Flow

Standard OAuth 2.0 authorization code flow with PKCE support.

```typescript
// Callback URL: https://yourapp.com/callback?code=auth_code&state=xyz
const params = new URLSearchParams(window.location.search);
const result = await oauth.handleCallback(params);
```

### Magic Link Flow

Custom magic link authentication flow that integrates with your GraphQL server.

```typescript
import { resolvers, createGraphQLContext } from '@zestic/oauth-core';

// 1. Send magic link via GraphQL mutation
const magicLinkResult = await resolvers.Mutation.sendMagicLink(
  null,
  {
    input: {
      email: 'user@example.com',
      codeChallenge: 'generated-challenge',
      codeChallengeMethod: 'S256',
      state: 'secure-state',
      redirectUri: 'https://yourapp.com/oauth/callback'
    }
  },
  graphqlContext
);

// 2. User clicks email link, server calls your callback
// Callback URL: https://yourapp.com/oauth/callback?code=magic_code&state=secure-state
const params = new URLSearchParams(window.location.search);
const result = await oauth.handleCallback(params);

if (result.success) {
  console.log('Magic link authentication successful');
  console.log('Access token:', result.accessToken);
}
```

### Custom Flows

Extend the library with custom OAuth flows:

```typescript
import { BaseCallbackFlowHandler } from '@zestic/oauth-core';

class CustomFlowHandler extends BaseCallbackFlowHandler {
  readonly name = 'custom_flow';
  readonly priority = 10;

  canHandle(params: URLSearchParams): boolean {
    return params.has('custom_token');
  }

  async handle(params: URLSearchParams, adapters: OAuthAdapters, config: OAuthConfig): Promise<OAuthResult> {
    // Custom flow implementation
    const token = params.get('custom_token');
    // ... handle token exchange
    return { success: true, accessToken: 'token' };
  }
}

// Register custom flow
oauth.registerFlow(new CustomFlowHandler());
```

## Configuration

### Flow Configuration

Control which flows are enabled:

```typescript
const oauth = createOAuthCore(config, adapters, {
  enabledFlows: ['authorization_code', 'magic_link'], // Only enable specific flows
  disabledFlows: ['magic_link'], // Disable specific flows
  customFlows: [new CustomFlowHandler()], // Add custom flows
});
```

## Adapter Architecture

The library uses an adapter pattern to integrate with different environments and services. Each adapter serves a specific purpose:

- **StorageAdapter**: localStorage (web) vs AsyncStorage (React Native) vs custom storage
- **HttpAdapter**: fetch vs axios vs custom HTTP client
- **PKCEAdapter**: PKCE challenge/verifier generation
- **UserAdapter**: User registration, lookup, and management
- **GraphQLAdapter**: GraphQL mutations to trigger server-side actions (magic links, confirmations)

### Adapter Implementation

Implement adapters for your environment:

```typescript
import { StorageAdapter, HttpAdapter, PKCEAdapter } from '@zestic/oauth-core';

// Storage adapter example (using localStorage)
class BrowserStorageAdapter implements StorageAdapter {
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
}

// HTTP adapter example (using fetch)
class FetchHttpAdapter implements HttpAdapter {
  async post(url: string, data: Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body: new URLSearchParams(data as Record<string, string>),
    });

    return {
      status: response.status,
      data: await response.json(),
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    const response = await fetch(url, { headers });
    return {
      status: response.status,
      data: await response.json(),
      headers: Object.fromEntries(response.headers.entries()),
    };
  }
}

// GraphQL adapter example (for magic links and server communication)
class GraphQLAdapter implements GraphQLAdapter {
  constructor(private graphqlEndpoint: string) {}

  async sendMagicLinkMutation(email: string, magicLinkUrl: string): Promise<GraphQLResult> {
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
          input: { email, magicLinkUrl }
        }
      })
    });

    const result = await response.json();
    return result.data.sendMagicLink;
  }

  async sendRegistrationConfirmationMutation(email: string): Promise<GraphQLResult> {
    // Similar GraphQL mutation for registration confirmation
    // Your server handles the actual email sending
    return { success: true, message: 'Confirmation triggered' };
  }
}

// User adapter example (for user management)
class UserAdapter implements UserAdapter {
  async registerUser(email: string, additionalData: Record<string, unknown>): Promise<UserRegistrationResult> {
    // Call your user registration API
    const response = await fetch('/api/users/register', {
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
    const response = await fetch(`/api/users/exists?email=${encodeURIComponent(email)}`);
    const result = await response.json();
    return result.exists;
  }

  async getUserByEmail(email: string): Promise<UserInfo | null> {
    const response = await fetch(`/api/users/by-email?email=${encodeURIComponent(email)}`);
    if (!response.ok) return null;
    return response.json();
  }
}
```

## Server-Side Integration

This client-side library requires server-side components to handle:

### GraphQL Schema Requirements

Your GraphQL server should implement these mutations:

```graphql
type Mutation {
  # Magic link authentication
  sendMagicLink(input: SendMagicLinkInput!): MagicLinkResponse!

  # User registration
  register(input: RegistrationInput!): RegistrationResponse!
}

input SendMagicLinkInput {
  email: String!
  codeChallenge: String!
  codeChallengeMethod: String!
  state: String!
  redirectUri: String!
}

input RegistrationInput {
  email: String!
  codeChallenge: String!
  codeChallengeMethod: String!
  state: String!
  redirectUri: String!
  additionalData: JSON
}

type MagicLinkResponse {
  success: Boolean!
  message: String
  code: String
}

type RegistrationResponse {
  success: Boolean!
  message: String
  code: String
}
```

### Server-Side Flow

1. **Receive GraphQL mutation** with PKCE data from client
2. **Store PKCE challenge and state** with unique token
3. **Send email** with magic link containing the token
4. **Handle magic link click** by looking up PKCE data
5. **Call client callback** with authorization code and state
6. **Client exchanges code** for access/refresh tokens using PKCE verifier

### Framework Integration Examples

#### Next.js API Route

```typescript
// pages/api/oauth/callback.ts or app/api/oauth/callback/route.ts
import { OAuthCore } from '@zestic/oauth-core';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const result = await oauth.handleCallback(params);

  if (result.success) {
    // Redirect to success page
    return Response.redirect('/dashboard');
  } else {
    // Handle error
    return Response.redirect('/login?error=oauth_failed');
  }
}
```

#### Expo Router API Route

```typescript
// app/oauth/callback/+api.ts
import { ExpoRequest, ExpoResponse } from 'expo-router/server';
import { OAuthCore } from '@zestic/oauth-core';

export async function GET(request: ExpoRequest): Promise<ExpoResponse> {
  const url = new URL(request.url);
  const result = await oauth.handleCallback(url.searchParams);

  return Response.json(result);
}
```

## API Reference

### OAuthCore

Main class for handling OAuth operations with event-driven architecture and reactive state management.

#### Event Methods

- `on<TEvent extends keyof OAuthEventMap>(event: TEvent, callback: OAuthEventMap[TEvent]): () => void`
- `once<TEvent extends keyof OAuthEventMap>(event: TEvent, callback: OAuthEventMap[TEvent]): () => void`
- `off<TEvent extends keyof OAuthEventMap>(event: TEvent, callback: OAuthEventMap[TEvent]): void`
- `emit<TEvent extends keyof OAuthEventMap>(event: TEvent, ...args: Parameters<OAuthEventMap[TEvent]>): boolean`
- `removeAllListeners(event?: keyof OAuthEventMap): void`
- `listenerCount(event: keyof OAuthEventMap): number`
- `hasListeners(event?: keyof OAuthEventMap): boolean`

#### Core Methods

- `handleCallback(params: URLSearchParams | string, explicitFlow?: string): Promise<OAuthResult>`
- `generatePKCEChallenge(): Promise<PKCEChallenge>`
- `generateState(): Promise<string>`
- `generateAuthorizationUrl(additionalParams?: Record<string, string>): Promise<{ url: string; state: string }>`

#### Token Management

- `getAccessToken(): Promise<string | null>`
- `getRefreshToken(): Promise<string | null>`
- `isTokenExpired(): Promise<boolean>`
- `refreshAccessToken(): Promise<OAuthResult>`
- `getTokenExpirationTime(): Promise<Date | null>`
- `getTimeUntilTokenExpiration(): Promise<number>`
- `scheduleTokenRefresh(bufferMs?: number): () => void`
- `isTokenRefreshScheduled(): boolean`

#### Authentication State

- `get authenticationStatus(): AuthStatus`
- `get isAuthenticated(): boolean`
- `get isLoading(): boolean`
- `get activeOperationsList(): string[]`
- `isOperationActive(operation: string): boolean`
- `getOperationContext(operation: string): LoadingContext | undefined`
- `getLoadingStatistics(): LoadingStatistics`

#### Flow Management

- `registerFlow(handler: FlowHandler): void`
- `unregisterFlow(name: string): void`
- `getRegisteredFlows(): CallbackFlowHandler[]`
- `getCompatibleHandlers(params: URLSearchParams | string): CallbackFlowHandler[]`

#### Cleanup

- `logout(reason?: 'user' | 'expired' | 'error' | 'revoked'): Promise<void>`
- `destroy(): void`

### Event System

The library provides comprehensive event-driven architecture:

#### Authentication Events
- `authStatusChange`: Emitted when authentication status changes
- `authSuccess`: Emitted when authentication succeeds
- `authError`: Emitted when authentication fails

#### Token Events
- `tokenRefresh`: Emitted when tokens are refreshed
- `tokenExpired`: Emitted when tokens expire
- `tokenRefreshScheduled`: Emitted when token refresh is scheduled

#### Loading Events
- `loadingStart`: Emitted when async operations begin
- `loadingEnd`: Emitted when async operations complete

#### Flow Events
- `callbackStart`: Emitted when callback handling starts
- `callbackComplete`: Emitted when callback handling completes
- `flowDetected`: Emitted when OAuth flow is detected

#### Other Events
- `pkceGenerated`: Emitted when PKCE challenge is generated
- `stateGenerated`: Emitted when state parameter is generated
- `authUrlGenerated`: Emitted when authorization URL is generated
- `tokensStored`: Emitted when tokens are stored
- `tokensCleared`: Emitted when tokens are cleared
- `logout`: Emitted when user logs out

### Error Handling

Structured error system with rich metadata:

```typescript
try {
  const result = await oauth.handleCallback(params);
} catch (error) {
  if (error.code === 'TOKEN_ERROR') {
    // Handle token errors
    if (error.canRetry()) {
      // Retry after error.retryDelay
    }
  }
}
```

### Reactive State Management

Subscribe to authentication state changes:

```typescript
const unsubscribe = oauth.on('authStatusChange', (status, previousStatus) => {
  console.log(`Auth status changed from ${previousStatus} to ${status}`);

  switch (status) {
    case 'authenticated':
      // User is now logged in
      break;
    case 'expired':
      // Tokens expired, trigger refresh
      break;
    case 'error':
      // Handle auth errors
      break;
  }
});

// Clean up when done
unsubscribe();
```

### Loading State Tracking

Monitor async operations:

```typescript
oauth.on('loadingStart', (context) => {
  console.log(`Operation started: ${context.operation}`);
  showSpinner();
});

oauth.on('loadingEnd', (context, success, duration) => {
  console.log(`Operation completed: ${context.operation} (${duration}ms)`);
  hideSpinner();
});

// Check current loading state
if (oauth.isLoading) {
  const activeOps = oauth.activeOperationsList;
  console.log('Active operations:', activeOps);
}
```

### Request/Response Metadata

Track detailed information about OAuth operations:

```typescript
const result = await oauth.handleCallback(params);

if (result.metadata) {
  console.log('Request details:', {
    requestId: result.metadata.requestId,
    timestamp: result.metadata.timestamp,
    duration: result.metadata.duration,
    retryCount: result.metadata.retryCount,
    rateLimitRemaining: result.metadata.rateLimitRemaining,
    rateLimitReset: result.metadata.rateLimitReset
  });
}

// Monitor all operations with metadata
oauth.on('authSuccess', (data) => {
  if (data.metadata) {
    console.log(`Authentication completed in ${data.metadata.duration}ms`);
    console.log(`Rate limit remaining: ${data.metadata.rateLimitRemaining}`);
  }
});
```

#### Metadata Fields

- **`requestId`**: Unique identifier for the request (useful for tracing)
- **`timestamp`**: When the request was initiated
- **`duration`**: Total time taken for the operation in milliseconds
- **`retryCount`**: Number of retry attempts made (for future retry logic)
- **`rateLimitRemaining`**: Remaining requests allowed in current rate limit window
- **`rateLimitReset`**: When the rate limit window resets (Date object)

### Flow Handlers

Built-in flow handlers:

- `AuthorizationCodeFlowHandler`: Standard OAuth 2.0 authorization code flow
- `MagicLinkFlowHandler`: Magic link authentication flow

## Security Considerations

This library implements several security best practices:

### PKCE (Proof Key for Code Exchange)

- **Prevents authorization code interception attacks**
- **Generates cryptographically secure code challenges**
- **Uses SHA256 hashing with base64url encoding**
- **Code verifier never leaves the client**

### State Parameter Validation

- **Prevents CSRF attacks** by validating state parameters
- **Cryptographically secure state generation**
- **Automatic state cleanup** after successful validation

### Token Management

- **Secure token storage** through adapter pattern
- **Automatic token refresh** before expiration
- **Proper token cleanup** on logout
- **No sensitive data in URLs** (tokens only in secure storage)

### Magic Link Security

- **Server-side PKCE storage** prevents client-side tampering
- **Time-limited magic links** (configurable expiration)
- **One-time use tokens** prevent replay attacks
- **State validation** ensures request authenticity

## Testing

Run the test suite:

```bash
yarn test
```

Run tests with coverage:

```bash
yarn test:coverage
```

## Development

Build the library:

```bash
yarn build
```

Run linting:

```bash
yarn lint
```

Run the full CI pipeline locally:

```bash
yarn ci
```

### Future Improvements:

* Add client secret validation in AuthorizationCodeFlowHandler
* Implement refresh token binding to client IP/user agent
* Add scope validation during refresh operations
* Test refresh token revocation after single use
The test suite would benefit from additional coverage of OAuth 2.1 security recommendations while maintaining its strong foundation in RFC 6749 requirements.


### Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Security

For security vulnerabilities, please see [SECURITY.md](SECURITY.md) for reporting instructions.

## CI/CD

This project uses GitHub Actions for continuous integration:

- **Linting**: ESLint checks on every push and PR
- **Testing**: Jest tests across Node.js 16, 18, and 20
- **Build**: TypeScript compilation verification
- **Security**: CodeQL analysis and dependency review
- **Release**: Automated npm publishing on version tags

## License

Apache 2.0
