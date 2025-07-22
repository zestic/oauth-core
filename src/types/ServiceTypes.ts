/**
 * Service-related types and interfaces for registration and magic link operations
 */

/**
 * Input for user registration
 */
export interface RegistrationInput {
  email: string;
  additionalData: Record<string, unknown>;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  state: string;
}

/**
 * Input for sending magic link
 */
export interface SendMagicLinkInput {
  email: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  state: string;
}

/**
 * Response for registration operations
 */
export interface RegistrationResponse {
  success: boolean;
  message: string;
  code: string;
}

/**
 * Response for magic link operations
 */
export interface MagicLinkResponse {
  success: boolean;
  message: string;
  code: string;
}

/**
 * Adapter for user management operations
 */
export interface UserAdapter {
  /**
   * Register a new user with email and additional data
   */
  registerUser(email: string, additionalData: Record<string, unknown>): Promise<UserRegistrationResult>;
  
  /**
   * Check if a user exists by email
   */
  userExists(email: string): Promise<boolean>;
  
  /**
   * Get user information by email
   */
  getUserByEmail(email: string): Promise<UserInfo | null>;
}

/**
 * Result of user registration operation
 */
export interface UserRegistrationResult {
  success: boolean;
  userId?: string;
  message?: string;
  error?: string;
}

/**
 * User information
 */
export interface UserInfo {
  id: string;
  email: string;
  additionalData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Adapter for email operations
 */
export interface EmailAdapter {
  /**
   * Send a magic link email to the specified address
   */
  sendMagicLink(email: string, magicLinkUrl: string, options?: EmailOptions): Promise<EmailResult>;
  
  /**
   * Send a registration confirmation email
   */
  sendRegistrationConfirmation(email: string, options?: EmailOptions): Promise<EmailResult>;
}

/**
 * Options for email sending
 */
export interface EmailOptions {
  subject?: string;
  templateData?: Record<string, unknown>;
  fromAddress?: string;
  fromName?: string;
}

/**
 * Result of email sending operation
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
}

/**
 * Configuration for magic link generation
 */
export interface MagicLinkConfig {
  baseUrl: string;
  tokenEndpoint: string;
  expirationMinutes?: number;
  customParams?: Record<string, string>;
}

/**
 * Magic link token information
 */
export interface MagicLinkToken {
  token: string;
  email: string;
  expiresAt: Date;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
}

/**
 * Extended OAuth adapters that include new service adapters
 */
export interface ExtendedOAuthAdapters {
  storage: import('./OAuthTypes').StorageAdapter;
  http: import('./OAuthTypes').HttpAdapter;
  pkce: import('./OAuthTypes').PKCEAdapter;
  user: UserAdapter;
  email: EmailAdapter;
}

/**
 * Service operation result
 */
export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}
