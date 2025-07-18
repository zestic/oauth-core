/**
 * Token exchange and management
 */

import {
  HttpAdapter,
  TokenExchangeRequest,
  TokenResponse,
  OAuthResult,
  OAuthConfig,
  StorageAdapter,
  OAUTH_ERROR_CODES
} from '../types/OAuthTypes';
import { ErrorHandler } from '../utils/ErrorHandler';

export class TokenManager {
  private static readonly STORAGE_KEYS = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRY: 'token_expiry',
    TOKEN_TYPE: 'token_type',
  };

  constructor(
    private httpAdapter: HttpAdapter,
    private storageAdapter: StorageAdapter
  ) {}

  /**
   * Exchange authorization code for tokens
   */
  async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
    config: OAuthConfig
  ): Promise<OAuthResult> {
    const request: TokenExchangeRequest = {
      grantType: 'authorization_code',
      code,
      redirectUri: config.redirectUri,
      codeVerifier,
      clientId: config.clientId,
    };

    return this.performTokenExchange(request, config);
  }

  /**
   * Exchange magic link token for OAuth tokens
   */
  async exchangeMagicLinkToken(
    token: string,
    config: OAuthConfig,
    additionalParams?: Record<string, string>
  ): Promise<OAuthResult> {
    const request: TokenExchangeRequest = {
      grantType: 'magic_link',
      token,
      clientId: config.clientId,
      ...additionalParams,
    };

    return this.performTokenExchange(request, config);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string, config: OAuthConfig): Promise<OAuthResult> {
    const request: TokenExchangeRequest = {
      grantType: 'refresh_token',
      token: refreshToken,
      clientId: config.clientId,
    };

    return this.performTokenExchange(request, config);
  }

  /**
   * Perform the actual token exchange HTTP request
   */
  private async performTokenExchange(
    request: TokenExchangeRequest,
    config: OAuthConfig
  ): Promise<OAuthResult> {
    try {
      const requestBody = this.buildTokenRequestBody(request);
      
      const response = await this.httpAdapter.post(
        config.endpoints.token,
        requestBody,
        {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        }
      );

      if (response.status >= 400) {
        throw ErrorHandler.handleTokenExchangeError(
          new Error(`HTTP ${response.status}`),
          response.data
        );
      }

      const tokenResponse = response.data as TokenResponse;
      
      // Store tokens
      await this.storeTokens(tokenResponse);

      return {
        success: true,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
      };

    } catch (error) {
      if (ErrorHandler.isOAuthError(error)) {
        throw error;
      }

      throw ErrorHandler.handleTokenExchangeError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Build the request body for token exchange
   */
  private buildTokenRequestBody(request: TokenExchangeRequest): Record<string, string> {
    const body: Record<string, string> = {
      grant_type: request.grantType,
      client_id: request.clientId,
    };

    if (request.code) {
      body.code = request.code;
    }

    if (request.redirectUri) {
      body.redirect_uri = request.redirectUri;
    }

    if (request.codeVerifier) {
      body.code_verifier = request.codeVerifier;
    }

    if (request.token) {
      if (request.grantType === 'refresh_token') {
        body.refresh_token = request.token;
      } else {
        body.token = request.token;
      }
    }

    if (request.state) {
      body.state = request.state;
    }

    return body;
  }

  /**
   * Store tokens in storage
   */
  async storeTokens(tokenResponse: TokenResponse): Promise<void> {
    try {
      await this.storageAdapter.setItem(
        TokenManager.STORAGE_KEYS.ACCESS_TOKEN,
        tokenResponse.access_token
      );

      if (tokenResponse.refresh_token) {
        await this.storageAdapter.setItem(
          TokenManager.STORAGE_KEYS.REFRESH_TOKEN,
          tokenResponse.refresh_token
        );
      }

      if (tokenResponse.expires_in) {
        const expiryTime = Date.now() + (tokenResponse.expires_in * 1000);
        await this.storageAdapter.setItem(
          TokenManager.STORAGE_KEYS.TOKEN_EXPIRY,
          expiryTime.toString()
        );
      }

      await this.storageAdapter.setItem(
        TokenManager.STORAGE_KEYS.TOKEN_TYPE,
        tokenResponse.token_type || 'Bearer'
      );

    } catch (error) {
      throw ErrorHandler.createError(
        'Failed to store tokens',
        OAUTH_ERROR_CODES.NETWORK_ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get stored access token
   */
  async getAccessToken(): Promise<string | null> {
    return this.storageAdapter.getItem(TokenManager.STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Get stored refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return this.storageAdapter.getItem(TokenManager.STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Check if access token is expired
   */
  async isTokenExpired(): Promise<boolean> {
    const expiryTimeStr = await this.storageAdapter.getItem(TokenManager.STORAGE_KEYS.TOKEN_EXPIRY);
    
    if (!expiryTimeStr) {
      return false; // No expiry time stored, assume not expired
    }

    const expiryTime = parseInt(expiryTimeStr, 10);
    return Date.now() >= expiryTime;
  }

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    const keys = Object.values(TokenManager.STORAGE_KEYS);
    await this.storageAdapter.removeItems(keys);
  }

  /**
   * Revoke tokens
   */
  async revokeTokens(config: OAuthConfig): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      
      if (accessToken) {
        await this.httpAdapter.post(
          config.endpoints.revocation,
          { token: accessToken, client_id: config.clientId },
          { 'Content-Type': 'application/x-www-form-urlencoded' }
        );
      }

      await this.clearTokens();
    } catch (error) {
      // Log error but don't throw - token revocation failure shouldn't prevent logout
      console.warn('Token revocation failed:', error);
      await this.clearTokens();
    }
  }
}
