import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from '../user';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn()
    }
  }
}));

describe('UserService', () => {
  let mockFrom: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock query builder chain
    mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn()
    };

    vi.mocked(supabase.from).mockReturnValue(mockFrom);
  });

  describe('getCurrentProfile', () => {
    it('should get current user profile successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'user',
        company_id: 'company-456'
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockFrom.maybeSingle.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const result = await userService.getCurrentProfile();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(mockFrom.eq).toHaveBeenCalledWith('id', 'user-123');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });

    it('should handle user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await userService.getCurrentProfile();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('User not authenticated');
    });

    it('should handle profile not found', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockFrom.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await userService.getCurrentProfile();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Profile not found');
    });

    it('should handle auth errors', async () => {
      const authError = new Error('Authentication failed');

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: authError
      });

      const result = await userService.getCurrentProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe(authError);
    });

    it('should handle database errors', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const dbError = new Error('Database connection failed');

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockFrom.maybeSingle.mockResolvedValue({
        data: null,
        error: dbError
      });

      const result = await userService.getCurrentProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBe(dbError);
    });
  });

  describe('getSession', () => {
    it('should get current session successfully', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_at: Date.now() / 1000 + 3600
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await userService.getSession();

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data?.session).toEqual(mockSession);
    });

    it('should handle no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await userService.getSession();

      expect(result.success).toBe(true);
      expect(result.data?.session).toBeNull();
    });

    it('should handle session errors', async () => {
      const sessionError = new Error('Session retrieval failed');

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: sessionError
      });

      const result = await userService.getSession();

      expect(result.success).toBe(false);
      expect(result.error).toBe(sessionError);
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'new-token-123',
        refresh_token: 'new-refresh-123',
        expires_at: Date.now() / 1000 + 3600
      };

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null
      });

      const result = await userService.refreshSession();

      expect(supabase.auth.refreshSession).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data?.session).toEqual(mockSession);
    });

    it('should handle refresh errors', async () => {
      const refreshError = new Error('Token expired');

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null, user: null },
        error: refreshError
      });

      const result = await userService.refreshSession();

      expect(result.success).toBe(false);
      expect(result.error).toBe(refreshError);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const userId = 'user-123';
      const updates = {
        first_name: 'Jane',
        last_name: 'Smith',
        phone: '+1234567890'
      };
      const updatedProfile = {
        id: userId,
        ...updates,
        email: 'jane@example.com',
        role: 'user',
        updated_at: '2025-01-01T00:00:00Z'
      };

      mockFrom.single.mockResolvedValue({
        data: updatedProfile,
        error: null
      });

      const result = await userService.updateProfile(userId, updates);

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockFrom.update).toHaveBeenCalledWith(updates);
      expect(mockFrom.eq).toHaveBeenCalledWith('id', userId);
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedProfile);
    });

    it('should handle profile update errors', async () => {
      const userId = 'user-123';
      const updates = { first_name: 'Jane' };
      const updateError = new Error('Validation failed');

      mockFrom.single.mockResolvedValue({
        data: null,
        error: updateError
      });

      const result = await userService.updateProfile(userId, updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe(updateError);
    });
  });

  describe('getUsersByCompany', () => {
    it('should get company users successfully', async () => {
      const companyId = 'company-456';
      const mockUsers = [
        { id: 'user-1', first_name: 'John', last_name: 'Doe', role: 'admin' },
        { id: 'user-2', first_name: 'Jane', last_name: 'Smith', role: 'user' }
      ];

      mockFrom.order.mockResolvedValue({
        data: mockUsers,
        error: null
      });

      const result = await userService.getUsersByCompany(companyId);

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(mockFrom.eq).toHaveBeenCalledWith('company_id', companyId);
      expect(mockFrom.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUsers);
    });

    it('should handle empty company results', async () => {
      const companyId = 'empty-company';

      mockFrom.order.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await userService.getUsersByCompany(companyId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('createProfile', () => {
    it('should create user profile successfully', async () => {
      const profileData = {
        id: 'user-123',
        email: 'newuser@example.com',
        first_name: 'New',
        last_name: 'User',
        role: 'user',
        company_id: 'company-456'
      };

      mockFrom.single.mockResolvedValue({
        data: { ...profileData, created_at: '2025-01-01T00:00:00Z' },
        error: null
      });

      const result = await userService.createProfile(profileData);

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockFrom.insert).toHaveBeenCalledWith(profileData);
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(profileData);
    });

    it('should handle profile creation conflicts', async () => {
      const profileData = {
        id: 'existing-user',
        email: 'existing@example.com',
        first_name: 'Existing',
        last_name: 'User',
        role: 'user'
      };
      const conflictError = new Error('Profile already exists');

      mockFrom.single.mockResolvedValue({
        data: null,
        error: conflictError
      });

      const result = await userService.createProfile(profileData);

      expect(result.success).toBe(false);
      expect(result.error).toBe(conflictError);
    });
  });

  describe('deleteProfile', () => {
    it('should delete user profile successfully', async () => {
      const userId = 'user-to-delete';

      mockFrom.single.mockResolvedValue({
        data: { id: userId },
        error: null
      });

      const result = await userService.deleteProfile(userId);

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockFrom.delete).toHaveBeenCalled();
      expect(mockFrom.eq).toHaveBeenCalledWith('id', userId);
      expect(result.success).toBe(true);
    });

    it('should handle deletion constraints', async () => {
      const userId = 'admin-user';
      const constraintError = new Error('Cannot delete admin user with dependencies');

      mockFrom.single.mockResolvedValue({
        data: null,
        error: constraintError
      });

      const result = await userService.deleteProfile(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(constraintError);
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts', async () => {
      vi.mocked(supabase.auth.getUser).mockRejectedValue(new Error('Network timeout'));

      const result = await userService.getCurrentProfile();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Network timeout');
    });

    it('should handle malformed auth responses', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue(null as any);

      const result = await userService.getSession();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });
});