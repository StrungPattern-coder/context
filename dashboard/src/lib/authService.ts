/**
 * Authentication Service
 * 
 * Handles login, registration, and token management
 */

import { api } from './api';
import type { AuthTokens, AuthUser, LoginCredentials } from '@/types';

interface RegisterData {
  email: string;
  password: string;
  display_name?: string;
  tenant_slug: string;
}

interface UserResponse {
  id: string;
  email: string;
  display_name: string | null;
  tenant_id: string;
  external_id: string;
  created_at: string;
}

export const authService = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await api.post<AuthTokens>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<UserResponse> {
    const response = await api.post<UserResponse>('/auth/register', data);
    return response.data;
  },

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<AuthUser> {
    const response = await api.get<UserResponse>('/auth/me');
    return {
      id: response.data.id,
      email: response.data.email || '',
      tenant_id: response.data.tenant_id,
      is_admin: false, // Can be extended if needed
    };
  },

  /**
   * Refresh the access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await api.post<AuthTokens>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  /**
   * OAuth2 compatible token endpoint (form-based)
   */
  async tokenOAuth2(username: string, password: string): Promise<AuthTokens> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post<AuthTokens>('/auth/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
};

export default authService;
