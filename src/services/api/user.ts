import { BaseApiService, ApiResponse } from './base';
import { Profile } from './types';

export interface CreateProfileRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  role?: 'admin' | 'user';
  company_id?: string;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: 'super-admin' | 'admin' | 'user';
  company_id?: string;
  is_active?: boolean;
}

export interface InviteUserRequest {
  email: string;
  role: 'admin' | 'user';
  company_id: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Service class for user and profile management
 *
 * Provides comprehensive user authentication, profile management, user invitations,
 * and company user administration. Handles both authenticated and public operations
 * with proper error handling and security measures.
 *
 * @example
 * ```typescript
 * import { userService } from '@/services/api/user';
 *
 * // Get current user profile
 * const profile = await userService.getCurrentProfile();
 * if (profile.success && profile.data) {
 *   console.log(`Welcome ${profile.data.first_name}!`);
 * }
 *
 * // Invite a new user
 * await userService.inviteUser({
 *   email: 'newuser@company.com',
 *   role: 'user',
 *   company_id: 'company-123'
 * });
 * ```
 */
export class UserService extends BaseApiService {
  /**
   * Retrieves the current authenticated user's profile
   *
   * @returns Promise resolving to the current user's profile or null if not authenticated
   *
   * @example
   * ```typescript
   * const response = await userService.getCurrentProfile();
   * if (response.success && response.data) {
   *   console.log(`Current user: ${response.data.first_name} ${response.data.last_name}`);
   *   console.log(`Role: ${response.data.role}`);
   *   console.log(`Company: ${response.data.companies?.name}`);
   * }
   * ```
   */
  async getCurrentProfile(): Promise<ApiResponse<Profile | null>> {
    return this.handleAuthRequest(async () => {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        return { data: null, error: null };
      }

      const { data, error } = await this.supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', user.id)
        .single();

      return { data, error };
    });
  }

  async getProfileById(id: string): Promise<ApiResponse<Profile>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', id)
        .single();
    });
  }

  /**
   * Updates a user profile with partial data
   *
   * @param id - The profile ID to update
   * @param updates - Partial profile data to update
   * @returns Promise resolving to the updated profile
   *
   * @example
   * ```typescript
   * const response = await userService.updateProfile('user-123', {
   *   first_name: 'John',
   *   last_name: 'Doe',
   *   phone: '+1-555-0123'
   * });
   * ```
   */
  async updateProfile(id: string, updates: UpdateProfileRequest): Promise<ApiResponse<Profile>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select('*, companies(*)')
        .single();
    });
  }

  async createProfile(userId: string, profile: CreateProfileRequest): Promise<ApiResponse<Profile>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('profiles')
        .insert({
          id: userId,
          ...profile,
          is_active: true
        })
        .select('*, companies(*)')
        .single();
    });
  }

  /**
   * Retrieves all active users for a specific company
   *
   * @param companyId - The company ID to get users for
   * @returns Promise resolving to array of active company users
   *
   * @example
   * ```typescript
   * const response = await userService.getCompanyUsers('company-123');
   * if (response.success) {
   *   console.log(`Company has ${response.data.length} active users`);
   *   response.data.forEach(user => {
   *     console.log(`${user.first_name} ${user.last_name} (${user.role})`);
   *   });
   * }
   * ```
   */
  async getCompanyUsers(companyId: string): Promise<ApiResponse<Profile[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    });
  }

  async getAllUsers(): Promise<ApiResponse<Profile[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('profiles')
        .select('*, companies(*)')
        .order('created_at', { ascending: false });
    });
  }

  /**
   * Invites a new user to join a company
   *
   * Sends an invitation email to the specified address with a secure token.
   * The user can then accept the invitation to create their account.
   *
   * @param invitation - The invitation details
   * @param invitation.email - The email address to invite
   * @param invitation.role - The role to assign (admin or user)
   * @param invitation.company_id - The company ID to invite the user to
   * @param invitation.first_name - Optional first name
   * @param invitation.last_name - Optional last name
   * @returns Promise resolving when invitation is sent
   *
   * @example
   * ```typescript
   * const response = await userService.inviteUser({
   *   email: 'newuser@company.com',
   *   role: 'user',
   *   company_id: 'company-123',
   *   first_name: 'Jane',
   *   last_name: 'Smith'
   * });
   * ```
   */
  async inviteUser(invitation: InviteUserRequest): Promise<ApiResponse<void>> {
    return this.handleAuthRequest(async () => {
      // This would typically call a Supabase Edge Function
      return this.supabase.functions.invoke('invite-user', {
        body: invitation
      });
    });
  }

  async acceptInvitation(token: string, userData: {
    first_name: string;
    last_name: string;
    password: string;
  }): Promise<ApiResponse<Profile>> {
    return this.handleAuthRequest(async () => {
      return this.supabase.functions.invoke('accept-invitation', {
        body: { token, ...userData }
      });
    });
  }

  /**
   * Authenticates a user with email and password
   *
   * @param email - The user's email address
   * @param password - The user's password
   * @returns Promise resolving to authentication data
   *
   * @example
   * ```typescript
   * const response = await userService.signIn('user@company.com', 'password123');
   * if (response.success) {
   *   console.log('User signed in successfully');
   *   // Redirect to dashboard or update UI state
   * }
   * ```
   */
  async signIn(email: string, password: string): Promise<ApiResponse<any>> {
    return this.handleAuthRequest(async () => {
      return this.supabase.auth.signInWithPassword({
        email,
        password
      });
    });
  }

  async signOut(): Promise<ApiResponse<void>> {
    return this.handleAuthRequest(async () => {
      return this.supabase.auth.signOut();
    });
  }

  /**
   * Initiates password reset for a user
   *
   * Sends a password reset email to the specified address with a secure link.
   *
   * @param email - The email address to send reset link to
   * @returns Promise resolving when reset email is sent
   *
   * @example
   * ```typescript
   * const response = await userService.resetPassword('user@company.com');
   * if (response.success) {
   *   console.log('Password reset email sent');
   * }
   * ```
   */
  async resetPassword(email: string): Promise<ApiResponse<void>> {
    return this.handleAuthRequest(async () => {
      return this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
    });
  }

  async updatePassword(password: string): Promise<ApiResponse<any>> {
    return this.handleAuthRequest(async () => {
      return this.supabase.auth.updateUser({
        password
      });
    });
  }

  // Session management
  async getSession(): Promise<ApiResponse<any>> {
    return this.handleAuthRequest(async () => {
      return this.supabase.auth.getSession();
    });
  }

  async refreshSession(): Promise<ApiResponse<any>> {
    return this.handleAuthRequest(async () => {
      return this.supabase.auth.refreshSession();
    });
  }

  // Admin user management
  async deactivateUser(userId: string): Promise<ApiResponse<Profile>> {
    return this.updateProfile(userId, { is_active: false });
  }

  async activateUser(userId: string): Promise<ApiResponse<Profile>> {
    return this.updateProfile(userId, { is_active: true });
  }

  async changeUserRole(userId: string, role: 'admin' | 'user'): Promise<ApiResponse<Profile>> {
    return this.updateProfile(userId, { role });
  }

  async transferUserToCompany(userId: string, companyId: string): Promise<ApiResponse<Profile>> {
    return this.updateProfile(userId, { company_id: companyId });
  }

  // User preferences and settings
  async getUserPreferences(userId: string): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
    });
  }

  async updateUserPreferences(userId: string, preferences: Record<string, any>): Promise<ApiResponse<any>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          ...preferences
        })
        .select()
        .single();
    });
  }

  // Impersonation (for super-admin)
  async impersonateUser(targetUserId: string): Promise<ApiResponse<Profile>> {
    return this.getProfileById(targetUserId);
  }

  async stopImpersonation(): Promise<ApiResponse<Profile | null>> {
    return this.getCurrentProfile();
  }

  // User statistics and analytics
  async getUserStats(companyId?: string): Promise<ApiResponse<any>> {
    return this.handleRpcRequest('get_user_statistics', {
      company_id: companyId
    });
  }

  async getUserActivityLog(userId: string, limit: number = 50): Promise<ApiResponse<any[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('user_activity_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    });
  }
}

// Create singleton instance
export const userService = new UserService();