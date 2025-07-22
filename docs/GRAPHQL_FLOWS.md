# GraphQL Authentication Flows

This document provides detailed flow diagrams and explanations for all GraphQL authentication scenarios.

## Flow Overview

The GraphQL integration supports multiple authentication flows that work seamlessly with the existing OAuth infrastructure:

1. **Registration + Magic Link Flow** - Complete user onboarding
2. **Direct Magic Link Flow** - Simplified login for existing users
3. **Mobile App Flow** - React Native/Expo integration
4. **Error Recovery Flows** - Handling failures gracefully

## Flow 1: Complete Registration + Magic Link Authentication

This is the most comprehensive flow for new users:

```mermaid
sequenceDiagram
    participant User as User
    participant ClientApp as Client App
    participant GraphQL as GraphQL API
    participant UserDB as User Database
    participant EmailSvc as Email Service
    participant Storage as Storage
    participant OAuthSvr as OAuth Server
    participant MagicLinkHandler as MagicLinkFlowHandler

    Note over User,MagicLinkHandler: Phase 1: User Registration
    
    User->>ClientApp: Fill registration form
    ClientApp->>ClientApp: Generate PKCE parameters
    ClientApp->>GraphQL: register mutation
    
    GraphQL->>UserDB: Check if user exists
    UserDB-->>GraphQL: User not found
    
    GraphQL->>Storage: Store PKCE challenge & state
    GraphQL->>UserDB: Create user account
    UserDB-->>GraphQL: User created successfully
    
    GraphQL->>EmailSvc: Send registration confirmation
    EmailSvc-->>GraphQL: Email sent
    GraphQL-->>ClientApp: Registration success
    
    ClientApp->>User: Show "Registration successful"

    Note over User,MagicLinkHandler: Phase 2: Magic Link Login (Later)
    
    User->>ClientApp: Request login
    ClientApp->>ClientApp: Generate new PKCE parameters
    ClientApp->>GraphQL: sendMagicLink mutation
    
    GraphQL->>Storage: Store new PKCE challenge & state
    GraphQL->>GraphQL: Generate magic link token
    GraphQL->>Storage: Store magic link token with expiration
    GraphQL->>GraphQL: Build magic link URL
    GraphQL->>EmailSvc: Send magic link email
    EmailSvc-->>GraphQL: Email sent
    GraphQL-->>ClientApp: Magic link sent
    
    ClientApp->>User: Show "Check your email"

    Note over User,MagicLinkHandler: Phase 3: OAuth Callback
    
    User->>User: Click magic link in email
    User->>MagicLinkHandler: GET /callback?magic_link_token=xyz&state=abc
    
    MagicLinkHandler->>Storage: Validate state parameter
    Storage-->>MagicLinkHandler: State valid
    
    MagicLinkHandler->>Storage: Retrieve magic link token
    Storage-->>MagicLinkHandler: Token found and valid
    
    MagicLinkHandler->>Storage: Retrieve PKCE parameters
    Storage-->>MagicLinkHandler: PKCE data retrieved
    
    MagicLinkHandler->>OAuthSvr: Exchange magic link token for OAuth tokens
    OAuthSvr-->>MagicLinkHandler: Access & refresh tokens
    
    MagicLinkHandler->>Storage: Store OAuth tokens
    MagicLinkHandler->>Storage: Clean up magic link token
    MagicLinkHandler->>User: Redirect to app with success
    
    User->>ClientApp: Authenticated session established
```

### Key Points:

1. **Two Separate PKCE Flows**: Registration and login use different PKCE parameters for security
2. **Shared Storage**: GraphQL services and OAuth handlers share the same storage keys
3. **Token Lifecycle**: Magic link tokens are temporary and cleaned up after use
4. **State Validation**: OAuth state parameters prevent CSRF attacks

## Flow 2: Direct Magic Link (Existing Users)

Simplified flow for users who are already registered:

```mermaid
sequenceDiagram
    participant User as User
    participant ClientApp as Client App
    participant GraphQL as GraphQL API
    participant Storage as Storage
    participant EmailSvc as Email Service
    participant MagicLinkHandler as MagicLinkFlowHandler
    participant OAuthSvr as OAuth Server

    User->>ClientApp: Enter email for login
    ClientApp->>ClientApp: Generate PKCE parameters
    ClientApp->>GraphQL: sendMagicLink mutation
    
    GraphQL->>GraphQL: Validate email format
    GraphQL->>Storage: Store PKCE challenge & state
    GraphQL->>GraphQL: Generate magic link token
    GraphQL->>Storage: Store magic link token
    GraphQL->>EmailSvc: Send magic link email
    EmailSvc-->>GraphQL: Email sent
    GraphQL-->>ClientApp: Magic link sent
    
    User->>User: Click magic link in email
    User->>MagicLinkHandler: OAuth callback with magic link token
    
    MagicLinkHandler->>Storage: Validate state & retrieve PKCE
    MagicLinkHandler->>OAuthSvr: Exchange token
    OAuthSvr-->>MagicLinkHandler: OAuth tokens
    MagicLinkHandler->>User: Redirect with authentication
```

### Key Points:

1. **No User Creation**: Skips user registration step
2. **Security**: Still validates email format and uses PKCE
3. **User Enumeration Protection**: Doesn't reveal whether user exists

## Flow 3: Mobile App Integration (React Native/Expo)

How GraphQL works with oauth-expo for mobile authentication:

```mermaid
sequenceDiagram
    participant User as User
    participant MobileApp as Mobile App
    participant GraphQL as GraphQL API
    participant EmailSvc as Email Service
    participant DeepLink as Deep Link Handler
    participant OAuthExpo as oauth-expo
    participant Storage as Device Storage

    User->>MobileApp: Tap "Login with Email"
    MobileApp->>OAuthExpo: Generate PKCE parameters
    OAuthExpo-->>MobileApp: PKCE challenge & state
    
    MobileApp->>GraphQL: sendMagicLink mutation
    GraphQL->>EmailSvc: Send magic link with deep link URL
    EmailSvc-->>GraphQL: Email sent
    GraphQL-->>MobileApp: Magic link sent
    
    MobileApp->>User: Show "Check your email"
    
    User->>User: Click magic link in email
    User->>DeepLink: myapp://auth/callback?magic_link_token=xyz
    DeepLink->>MobileApp: App opens with deep link
    
    MobileApp->>OAuthExpo: Handle callback URL
    OAuthExpo->>Storage: Retrieve stored PKCE parameters
    OAuthExpo->>OAuthExpo: Validate state & exchange token
    OAuthExpo-->>MobileApp: OAuth tokens
    
    MobileApp->>User: Show authenticated home screen
```

### Key Points:

1. **Deep Links**: Magic links use custom URL schemes (myapp://)
2. **oauth-expo Integration**: Existing oauth-expo functionality handles callbacks
3. **Device Storage**: PKCE parameters stored on device securely

## Flow 4: Error Recovery Scenarios

### Scenario A: Email Service Failure

```mermaid
sequenceDiagram
    participant User as User
    participant ClientApp as Client App
    participant GraphQL as GraphQL API
    participant EmailSvc as Email Service

    User->>ClientApp: Request magic link
    ClientApp->>GraphQL: sendMagicLink mutation
    GraphQL->>EmailSvc: Send magic link email
    EmailSvc-->>GraphQL: Error: SMTP server down
    GraphQL-->>ClientApp: { success: false, code: "EMAIL_SEND_FAILED" }
    ClientApp->>User: Show "Email service temporarily unavailable"
    
    Note over User,EmailSvc: User can retry later
    
    User->>ClientApp: Retry magic link request
    ClientApp->>GraphQL: sendMagicLink mutation (new PKCE)
    GraphQL->>EmailSvc: Send magic link email
    EmailSvc-->>GraphQL: Email sent successfully
    GraphQL-->>ClientApp: { success: true, code: "MAGIC_LINK_SENT" }
```

### Scenario B: Expired Magic Link Token

```mermaid
sequenceDiagram
    participant User as User
    participant MagicLinkHandler as MagicLinkFlowHandler
    participant Storage as Storage
    participant ClientApp as Client App

    User->>User: Click expired magic link
    User->>MagicLinkHandler: OAuth callback with expired token
    MagicLinkHandler->>Storage: Validate magic link token
    Storage-->>MagicLinkHandler: Token expired
    MagicLinkHandler->>Storage: Clean up expired token
    MagicLinkHandler->>User: Redirect to error page
    
    User->>ClientApp: Navigate to login page
    ClientApp->>User: Show "Magic link expired, please request a new one"
```

### Scenario C: Invalid State Parameter (CSRF Protection)

```mermaid
sequenceDiagram
    participant Attacker as Attacker
    participant User as User
    participant MagicLinkHandler as MagicLinkFlowHandler
    participant Storage as Storage

    Attacker->>User: Send malicious link with wrong state
    User->>MagicLinkHandler: Click malicious link
    MagicLinkHandler->>Storage: Validate state parameter
    Storage-->>MagicLinkHandler: State mismatch
    MagicLinkHandler->>User: Redirect to error page (CSRF attempt blocked)
```

## Storage Key Lifecycle

Understanding how storage keys are managed throughout the flows:

```mermaid
graph TD
    A[GraphQL Mutation] --> B[Generate PKCE]
    B --> C[Store pkce_challenge]
    B --> D[Store pkce_method]
    B --> E[Store pkce_state]
    B --> F[Store pkce_redirect_uri]
    
    G[Magic Link Service] --> H[Generate Token]
    H --> I[Store magic_link_token:xyz]
    H --> J[Store magic_link_email:user@example.com]
    
    K[User Clicks Link] --> L[MagicLinkFlowHandler]
    L --> M[Retrieve pkce_*]
    L --> N[Retrieve magic_link_token:xyz]
    L --> O[Validate State]
    
    P[Token Exchange Success] --> Q[Store access_token]
    P --> R[Store refresh_token]
    P --> S[Clean up pkce_*]
    P --> T[Clean up magic_link_*]
```

## Security Flow Analysis

### PKCE Flow Security

1. **Code Challenge Generation**: Client generates cryptographically secure random string
2. **Challenge Storage**: Server stores challenge, client keeps verifier
3. **Token Exchange**: Server validates verifier matches stored challenge
4. **One-Time Use**: PKCE parameters are cleaned up after successful exchange

### State Parameter Security

1. **CSRF Protection**: State parameter prevents cross-site request forgery
2. **Unique Per Request**: Each magic link request generates new state
3. **Server Validation**: OAuth handler validates state matches stored value
4. **Cleanup**: State parameters are cleaned up after use

### Magic Link Token Security

1. **Cryptographically Secure**: Tokens generated using secure random functions
2. **Time-Limited**: Configurable expiration (default 15 minutes)
3. **Single Use**: Tokens are invalidated after successful exchange
4. **Scoped Storage**: Tokens stored with email association for validation

This comprehensive flow documentation ensures developers understand exactly how the GraphQL authentication system works and integrates with existing OAuth infrastructure.
