import { BaseApiService, ApiResponse } from './base';
import { Profile, Company } from './types';

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

export class UserService extends BaseApiService {
  // Profile management
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

  // Company users management
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

  // User invitation system
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

  // Authentication methods
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