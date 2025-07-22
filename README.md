# @zestic/oauth-core

[![Test](https://github.com/zestic/oauth-core/workflows/Test/badge.svg)](https://github.com/zestic/oauth-core/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/zestic/oauth-core/branch/main/graph/badge.svg)](https://codecov.io/gh/zestic/oauth-core)
[![npm version](https://badge.fury.io/js/%40zestic%2Foauth-core.svg)](https://badge.fury.io/js/%40zestic%2Foauth-core)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Framework-agnostic OAuth authentication library with support for multiple OAuth flows including authorization code flow, magic link authentication, and custom flows.

## Features

- **Multiple OAuth Flows**: Authorization code flow, magic link authentication, and extensible custom flows
- **PKCE Support**: Built-in PKCE (Proof Key for Code Exchange) implementation for enhanced security
- **Framework Agnostic**: Works with any JavaScript/TypeScript framework through adapter pattern
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
  storage: new YourStorageAdapter(),
  http: new YourHttpAdapter(),
  pkce: new YourPKCEAdapter(),
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

Custom magic link authentication flow.

```typescript
// Callback URL: https://yourapp.com/callback?token=magic_token&flow=login
const params = new URLSearchParams(window.location.search);
const result = await oauth.handleCallback(params);
```

### Custom Flows

Extend the library with custom OAuth flows:

```typescript
import { BaseFlowHandler } from '@zestic/oauth-core';

class CustomFlowHandler extends BaseFlowHandler {
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
```

## API Reference

### OAuthCore

Main class for handling OAuth operations.

#### Methods

- `handleCallback(params: URLSearchParams | string, explicitFlow?: string): Promise<OAuthResult>`
- `generatePKCEChallenge(): Promise<PKCEChallenge>`
- `generateState(): Promise<string>`
- `getAccessToken(): Promise<string | null>`
- `getRefreshToken(): Promise<string | null>`
- `isTokenExpired(): Promise<boolean>`
- `refreshAccessToken(): Promise<OAuthResult>`
- `logout(): Promise<void>`
- `registerFlow(handler: FlowHandler): void`
- `unregisterFlow(name: string): void`

### Flow Handlers

Built-in flow handlers:

- `AuthorizationCodeFlowHandler`: Standard OAuth 2.0 authorization code flow
- `MagicLinkFlowHandler`: Magic link authentication flow

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
