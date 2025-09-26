/**
 * Authentication Service for JWT-based auth
 * Replaces Supabase authentication
 */

import { apiClient } from '@/integrations/api/client';

export interface AuthUser {
  id: string;
  email: string;
  role: 'super-admin' | 'admin' | 'user';
  company_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
  expires_in: string;
}

class AuthService {
  private currentSession: AuthSession | null = null;
  private authStateListeners: ((event: string, session: AuthSession | null) => void)[] = [];

  constructor() {
    // Load session from localStorage on startup
    this.loadSessionFromStorage();
  }

  private saveSessionToStorage(session: AuthSession | null) {
    if (session) {
      localStorage.setItem('infotrac_session', JSON.stringify(session));
      localStorage.setItem('infotrac_token', session.access_token);
      apiClient.setAuthToken(session.access_token);
    } else {
      localStorage.removeItem('infotrac_session');
      localStorage.removeItem('infotrac_token');
      apiClient.setAuthToken(null);
    }
  }

  private loadSessionFromStorage() {
    try {
      const sessionData = localStorage.getItem('infotrac_session');
      const token = localStorage.getItem('infotrac_token');

      if (sessionData && token) {
        const session = JSON.parse(sessionData) as AuthSession;
        this.currentSession = session;
        apiClient.setAuthToken(token);

        // Verify the session is still valid
        this.verifySession().catch(() => {
          // If verification fails, clear the session
          this.clearSession();
        });
      }
    } catch (error) {
      console.error('Error loading session from storage:', error);
      this.clearSession();
    }
  }

  private async verifySession(): Promise<boolean> {
    try {
      const response = await apiClient.auth.getUser();
      if (response.success && response.data) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private clearSession() {
    this.currentSession = null;
    this.saveSessionToStorage(null);
    this.emitAuthStateChange('SIGNED_OUT', null);
  }

  private emitAuthStateChange(event: string, session: AuthSession | null) {
    this.authStateListeners.forEach(listener => {
      try {
        listener(event, session);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  // Public API methods
  async signInWithPassword(email: string, password: string): Promise<{ data: AuthSession | null; error: any }> {
    try {
      const response = await apiClient.auth.signInWithPassword({ email, password });

      if (response.success && response.data) {
        const session: AuthSession = {
          access_token: response.data.tokens.accessToken,
          refresh_token: response.data.tokens.refreshToken,
          user: response.data.user,
          expires_in: response.data.tokens.expiresIn,
        };

        this.currentSession = session;
        this.saveSessionToStorage(session);
        this.emitAuthStateChange('SIGNED_IN', session);

        return { data: session, error: null };
      }

      return { data: null, error: response.error };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : 'Sign in failed' }
      };
    }
  }

  async signOut(): Promise<{ error: any }> {
    try {
      // Call backend signout (mainly for logging)
      await apiClient.auth.signOut();
    } catch (error) {
      console.warn('Error calling backend signOut:', error);
    }

    // Always clear local session
    this.clearSession();
    return { error: null };
  }

  async getSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    if (this.currentSession) {
      // Verify session is still valid
      const isValid = await this.verifySession();
      if (!isValid) {
        this.clearSession();
        return { data: { session: null }, error: null };
      }
    }

    return { data: { session: this.currentSession }, error: null };
  }

  async getUser(): Promise<{ data: { user: AuthUser | null }; error: any }> {
    if (!this.currentSession) {
      return { data: { user: null }, error: null };
    }

    try {
      const response = await apiClient.auth.getUser();
      if (response.success && response.data) {
        // Update the user info in current session
        this.currentSession.user = response.data.user;
        this.saveSessionToStorage(this.currentSession);
        return { data: { user: response.data.user }, error: null };
      }

      return { data: { user: this.currentSession.user }, error: response.error };
    } catch (error) {
      return {
        data: { user: this.currentSession.user },
        error: { message: error instanceof Error ? error.message : 'Failed to get user' }
      };
    }
  }

  async refreshSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    // In our JWT implementation, tokens are long-lived
    // We'll just verify the current session
    if (this.currentSession) {
      const isValid = await this.verifySession();
      if (isValid) {
        return { data: { session: this.currentSession }, error: null };
      }
    }

    this.clearSession();
    return { data: { session: null }, error: { message: 'Session expired' } };
  }

  async resetPasswordForEmail(email: string, options?: any): Promise<{ data: any; error: any }> {
    try {
      const response = await apiClient.auth.resetPasswordForEmail(email, options);
      return { data: response.data, error: response.error };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : 'Password reset failed' }
      };
    }
  }

  async updateUser(updates: any): Promise<{ data: any; error: any }> {
    try {
      const response = await apiClient.auth.updateUser(updates);
      if (response.success && response.data && this.currentSession) {
        // Update the user in current session
        this.currentSession.user = { ...this.currentSession.user, ...response.data };
        this.saveSessionToStorage(this.currentSession);
      }
      return { data: response.data, error: response.error };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : 'Update failed' }
      };
    }
  }

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    this.authStateListeners.push(callback);

    // Immediately call with current state
    setTimeout(() => callback('INITIAL_SESSION', this.currentSession), 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const index = this.authStateListeners.indexOf(callback);
            if (index > -1) {
              this.authStateListeners.splice(index, 1);
            }
          }
        }
      }
    };
  }
}

// Export singleton instance
export const authService = new AuthService();

// For backward compatibility with existing Supabase auth code
export const auth = {
  signInWithPassword: authService.signInWithPassword.bind(authService),
  signOut: authService.signOut.bind(authService),
  getSession: authService.getSession.bind(authService),
  getUser: authService.getUser.bind(authService),
  refreshSession: authService.refreshSession.bind(authService),
  resetPasswordForEmail: authService.resetPasswordForEmail.bind(authService),
  updateUser: authService.updateUser.bind(authService),
  onAuthStateChange: authService.onAuthStateChange.bind(authService),
};