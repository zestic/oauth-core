# GraphQL Client Integration Guide for @zestic/oauth-core

This guide shows how to integrate `@zestic/oauth-core` v0.3.0+ GraphQL features with client-side applications.

## Overview

`@zestic/oauth-core` v0.3.0 provides GraphQL schema and resolvers for OAuth flows, but **does not include client-side integration instructions**. This guide fills that gap by showing how to:

1. Generate PKCE parameters on the client
2. Call GraphQL mutations with proper parameters
3. Handle responses and errors
4. Integrate with popular client-side OAuth libraries

## Prerequisites

- `@zestic/oauth-core` v0.3.0 or higher
- A GraphQL client (Apollo, urql, etc.)
- A client-side OAuth library for PKCE generation (optional but recommended)

## GraphQL Schema

oauth-core v0.3.0 provides these GraphQL operations:

```graphql
# Input Types
input SendMagicLinkInput {
  email: String!
  codeChallenge: String!
  codeChallengeMethod: String!
  redirectUri: String!
  state: String!
}

input RegistrationInput {
  email: String!
  additionalData: JSON!
  codeChallenge: String!
  codeChallengeMethod: String!
  redirectUri: String!
  state: String!
}

# Response Types
type MagicLinkResponse {
  success: Boolean!
  message: String!
  code: String!
}

type RegistrationResponse {
  success: Boolean!
  message: String!
  code: String!
}

# Mutations
type Mutation {
  sendMagicLink(input: SendMagicLinkInput!): MagicLinkResponse!
  register(input: RegistrationInput!): RegistrationResponse!
}
```

## Client-Side Integration

### Step 1: Generate PKCE Parameters

You need to generate PKCE parameters on the client. Here are examples for different scenarios:

#### Option A: Using expo-auth-session (React Native/Expo)

```typescript
import { ExpoOAuthAdapter } from '@zestic/oauth-expo';
import * as AuthSession from 'expo-auth-session';

// Configure OAuth adapter
const oauthConfig = {
  clientId: 'your-client-id',
  redirectUri: 'yourapp://auth/callback',
  scopes: ['read', 'write'],
  scheme: 'yourapp',
  path: 'auth/callback',
  endpoints: {
    authorization: 'https://auth.example.com/oauth/authorize',
    token: 'https://auth.example.com/oauth/token',
    revocation: 'https://auth.example.com/oauth/revoke',
  },
};

const adapter = new ExpoOAuthAdapter(oauthConfig);

// Generate PKCE parameters
async function generatePKCEParams() {
  // Generate authorization URL to initialize PKCE state
  const { state } = await adapter.generateAuthorizationUrl({
    flow: 'magic_link',
    email: 'user@example.com'
  });

  // Get the PKCE parameters
  const pkceParams = await adapter.generatePKCEParams();
  
  return {
    codeChallenge: pkceParams.codeChallenge,
    codeChallengeMethod: pkceParams.codeChallengeMethod,
    state: state
  };
}
```

#### Option B: Manual PKCE Generation (Web/Node.js)

```typescript
import { createHash, randomBytes } from 'crypto';

function generatePKCEParams() {
  // Generate code verifier
  const codeVerifier = randomBytes(32).toString('base64url');
  
  // Generate code challenge
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  // Generate state
  const state = randomBytes(16).toString('base64url');
  
  return {
    codeChallenge,
    codeChallengeMethod: 'S256',
    codeVerifier, // Store this for token exchange
    state
  };
}
```

### Step 2: Call GraphQL Mutations

#### Magic Link Authentication

```typescript
import { gql } from '@apollo/client'; // or your GraphQL client

const SEND_MAGIC_LINK_MUTATION = gql`
  mutation SendMagicLink($input: SendMagicLinkInput!) {
    sendMagicLink(input: $input) {
      success
      message
      code
    }
  }
`;

async function sendMagicLink(email: string, redirectUri: string) {
  // Generate PKCE parameters
  const { codeChallenge, codeChallengeMethod, state } = await generatePKCEParams();
  
  // Call GraphQL mutation
  const result = await apolloClient.mutate({
    mutation: SEND_MAGIC_LINK_MUTATION,
    variables: {
      input: {
        email,
        codeChallenge,
        codeChallengeMethod,
        redirectUri,
        state
      }
    }
  });
  
  if (result.data?.sendMagicLink.success) {
    console.log('Magic link sent:', result.data.sendMagicLink.message);
    return { success: true, code: result.data.sendMagicLink.code };
  } else {
    console.error('Failed to send magic link:', result.data?.sendMagicLink.message);
    return { success: false, error: result.data?.sendMagicLink.message };
  }
}
```

#### User Registration

```typescript
const REGISTER_USER_MUTATION = gql`
  mutation Register($input: RegistrationInput!) {
    register(input: $input) {
      success
      message
      code
    }
  }
`;

async function registerUser(email: string, displayName: string, redirectUri: string) {
  // Generate PKCE parameters
  const { codeChallenge, codeChallengeMethod, state } = await generatePKCEParams();
  
  // Call GraphQL mutation
  const result = await apolloClient.mutate({
    mutation: REGISTER_USER_MUTATION,
    variables: {
      input: {
        email,
        additionalData: {
          displayName
        },
        codeChallenge,
        codeChallengeMethod,
        redirectUri,
        state
      }
    }
  });
  
  if (result.data?.register.success) {
    console.log('User registered:', result.data.register.message);
    return { success: true, code: result.data.register.code };
  } else {
    console.error('Registration failed:', result.data?.register.message);
    return { success: false, error: result.data?.register.message };
  }
}
```

### Step 3: Handle OAuth Callbacks

After the user clicks the magic link, they'll be redirected to your app with callback parameters. Use oauth-core's callback handling:

```typescript
import { createOAuthCore } from '@zestic/oauth-core';

// Initialize OAuth core for callback handling
const oauth = createOAuthCore(config, adapters);

// Handle callback
async function handleOAuthCallback(callbackParams: URLSearchParams) {
  try {
    const result = await oauth.handleCallback(callbackParams);
    
    if (result.success) {
      console.log('Authentication successful!');
      console.log('Access token:', result.accessToken);
      console.log('Refresh token:', result.refreshToken);
      return result;
    } else {
      console.error('Authentication failed:', result.error);
      return result;
    }
  } catch (error) {
    console.error('Callback handling error:', error);
    return { success: false, error: 'Callback handling failed' };
  }
}
```

## Complete Example: React Native with Expo

```typescript
import { ExpoOAuthAdapter } from '@zestic/oauth-expo';
import { createClient, cacheExchange, fetchExchange } from 'urql';

// Setup GraphQL client
const graphqlClient = createClient({
  url: 'https://your-api.com/graphql',
  exchanges: [cacheExchange, fetchExchange],
});

// Setup OAuth adapter
const oauthAdapter = new ExpoOAuthAdapter({
  clientId: 'your-client-id',
  redirectUri: 'yourapp://auth/callback',
  scopes: ['read', 'write'],
  scheme: 'yourapp',
  path: 'auth/callback',
  endpoints: {
    authorization: 'https://auth.example.com/oauth/authorize',
    token: 'https://auth.example.com/oauth/token',
    revocation: 'https://auth.example.com/oauth/revoke',
  },
});

class AuthService {
  static async sendMagicLink(email: string): Promise<{ success: boolean; message?: string; code?: string }> {
    try {
      // Generate PKCE parameters using oauth-expo
      const { state } = await oauthAdapter.generateAuthorizationUrl({
        flow: 'magic_link',
        email
      });
      
      const pkceParams = await oauthAdapter.generatePKCEParams();
      
      // Call GraphQL mutation
      const result = await graphqlClient.mutation(SEND_MAGIC_LINK_MUTATION, {
        input: {
          email,
          codeChallenge: pkceParams.codeChallenge,
          codeChallengeMethod: pkceParams.codeChallengeMethod,
          redirectUri: 'yourapp://auth/callback',
          state: state
        }
      }).toPromise();
      
      if (result.error) {
        return { success: false, message: 'GraphQL error occurred' };
      }
      
      const response = result.data?.sendMagicLink;
      return {
        success: response.success,
        message: response.message,
        code: response.code
      };
      
    } catch (error) {
      console.error('Error sending magic link:', error);
      return { success: false, message: 'Network error occurred' };
    }
  }
  
  static async registerUser(email: string, displayName: string): Promise<{ success: boolean; message?: string; code?: string }> {
    try {
      // Generate PKCE parameters using oauth-expo
      const { state } = await oauthAdapter.generateAuthorizationUrl({
        flow: 'registration',
        email,
        displayName
      });
      
      const pkceParams = await oauthAdapter.generatePKCEParams();
      
      // Call GraphQL mutation
      const result = await graphqlClient.mutation(REGISTER_USER_MUTATION, {
        input: {
          email,
          additionalData: { displayName },
          codeChallenge: pkceParams.codeChallenge,
          codeChallengeMethod: pkceParams.codeChallengeMethod,
          redirectUri: 'yourapp://auth/callback',
          state: state
        }
      }).toPromise();
      
      if (result.error) {
        return { success: false, message: 'GraphQL error occurred' };
      }
      
      const response = result.data?.register;
      return {
        success: response.success,
        message: response.message,
        code: response.code
      };
      
    } catch (error) {
      console.error('Error registering user:', error);
      return { success: false, message: 'Network error occurred' };
    }
  }
}

// Usage
async function handleLogin() {
  const result = await AuthService.sendMagicLink('user@example.com');
  if (result.success) {
    alert('Magic link sent! Check your email.');
  } else {
    alert(`Error: ${result.message}`);
  }
}

async function handleRegistration() {
  const result = await AuthService.registerUser('user@example.com', 'John Doe');
  if (result.success) {
    alert('Registration magic link sent! Check your email.');
  } else {
    alert(`Error: ${result.message}`);
  }
}
```

## Error Handling

oauth-core GraphQL resolvers return structured error responses:

```typescript
type ErrorResponse = {
  success: false;
  message: string;
  code: string; // Error codes like 'USER_EXISTS', 'INVALID_EMAIL', etc.
}
```

Handle errors appropriately in your client:

```typescript
if (!result.data?.sendMagicLink.success) {
  const errorCode = result.data.sendMagicLink.code;
  const errorMessage = result.data.sendMagicLink.message;
  
  switch (errorCode) {
    case 'USER_NOT_FOUND':
      // Handle user not found
      break;
    case 'INVALID_EMAIL':
      // Handle invalid email
      break;
    case 'RATE_LIMITED':
      // Handle rate limiting
      break;
    default:
      // Handle generic error
      console.error('Unknown error:', errorMessage);
  }
}
```

## Security Considerations

1. **PKCE Parameters**: Always generate PKCE parameters on the client, never trust server-generated ones
2. **State Validation**: Ensure the state parameter is validated during callback handling
3. **Token Storage**: Store tokens securely (Keychain on iOS, Keystore on Android, secure storage on web)
4. **HTTPS Only**: Always use HTTPS for redirect URIs in production
5. **Scope Limitation**: Request only the minimum required OAuth scopes

## Backend Setup

This guide assumes your backend is configured with oauth-core v0.3.0 GraphQL resolvers. See the oauth-core documentation for backend setup instructions.

## Contributing

If you find issues with this guide or have improvements, please contribute back to the oauth-core project.
