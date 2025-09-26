import { BaseService, ApiResponse } from './baseService';
import { supabase } from '@/integrations/supabase/client';

export interface UserModulePermission {
  id: string;
  user_id: string;
  company_id: string;
  module_name: string;
  permission_type: 'chat' | 'document_processing' | 'automation' | 'analytics';
  is_enabled: boolean;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  usage_limit: number | null;
  current_usage: number;
  created_at: string;
  updated_at: string;
  notes?: string;

  // Joined data
  user?: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  granted_by_user?: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface IngridPermissionSummary {
  user_id: string;
  has_chat: boolean;
  has_document_processing: boolean;
  has_automation: boolean;
  has_analytics: boolean;
  total_usage: number;
  expires_at: string | null;
}

export interface CreatePermissionRequest {
  user_id: string;
  company_id: string;
  permission_type: 'chat' | 'document_processing' | 'automation' | 'analytics';
  is_enabled?: boolean;
  expires_at?: string | null;
  usage_limit?: number | null;
  notes?: string;
}

export interface UpdatePermissionRequest {
  is_enabled?: boolean;
  expires_at?: string | null;
  usage_limit?: number | null;
  notes?: string;
}

class IngridPermissionsService extends BaseService<UserModulePermission> {
  protected tableName = 'user_module_permissions';

  /**
   * Get all Ingrid permissions for a company with user details
   */
  async getCompanyIngridPermissions(companyId: string): Promise<ApiResponse<UserModulePermission[]>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .select(`
          *,
          user:profiles!user_module_permissions_user_id_fkey(
            user_id,
            email,
            first_name,
            last_name,
            role
          ),
          granted_by_user:profiles!user_module_permissions_granted_by_fkey(
            user_id,
            email,
            first_name,
            last_name
          )
        `)
        .eq('company_id', companyId)
        .eq('module_name', 'Ingrid AI Assistant')
        .order('created_at', { ascending: false });

      return this.handleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  /**
   * Get user's Ingrid permissions summary
   */
  async getUserIngridPermissions(userId: string): Promise<ApiResponse<IngridPermissionSummary | null>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('module_name', 'Ingrid AI Assistant')
        .eq('is_enabled', true);

      if (response.error) {
        throw response.error;
      }

      const permissions = response.data || [];
      const summary: IngridPermissionSummary = {
        user_id: userId,
        has_chat: permissions.some(p => p.permission_type === 'chat'),
        has_document_processing: permissions.some(p => p.permission_type === 'document_processing'),
        has_automation: permissions.some(p => p.permission_type === 'automation'),
        has_analytics: permissions.some(p => p.permission_type === 'analytics'),
        total_usage: permissions.reduce((sum, p) => sum + (p.current_usage || 0), 0),
        expires_at: permissions.find(p => p.expires_at)?.expires_at || null,
      };

      return {
        data: summary,
        error: null,
        success: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  /**
   * Check if user has specific Ingrid permission
   */
  async checkUserPermission(
    userId: string,
    permissionType: 'chat' | 'document_processing' | 'automation' | 'analytics'
  ): Promise<ApiResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('check_user_ingrid_permission', {
        p_user_id: userId,
        p_permission_type: permissionType,
      });

      if (error) {
        throw error;
      }

      return {
        data: data || false,
        error: null,
        success: true,
      };
    } catch (error) {
      return {
        data: false,
        error: error as any,
        success: false,
      };
    }
  }

  /**
   * Grant Ingrid permission to user
   */
  async grantPermission(data: CreatePermissionRequest): Promise<ApiResponse<UserModulePermission | null>> {
    try {
      const payload = {
        ...data,
        module_name: 'Ingrid AI Assistant',
        is_enabled: data.is_enabled ?? true,
        current_usage: 0,
      };

      const response = await supabase
        .from(this.tableName)
        .insert(payload)
        .select(`
          *,
          user:profiles!user_module_permissions_user_id_fkey(
            user_id,
            email,
            first_name,
            last_name,
            role
          )
        `);

      return this.handleSingleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  /**
   * Update user's Ingrid permission
   */
  async updatePermission(
    id: string,
    data: UpdatePermissionRequest
  ): Promise<ApiResponse<UserModulePermission | null>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select(`
          *,
          user:profiles!user_module_permissions_user_id_fkey(
            user_id,
            email,
            first_name,
            last_name,
            role
          )
        `);

      return this.handleSingleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  /**
   * Revoke user's Ingrid permission
   */
  async revokePermission(id: string): Promise<ApiResponse<null>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      return {
        data: null,
        error: response.error,
        success: !response.error,
      };
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  /**
   * Increment usage for user's permission
   */
  async incrementUsage(
    userId: string,
    permissionType: 'chat' | 'document_processing' | 'automation' | 'analytics',
    amount: number = 1
  ): Promise<ApiResponse<null>> {
    try {
      const { data, error } = await supabase.rpc('increment_ingrid_usage', {
        p_user_id: userId,
        p_permission_type: permissionType,
        p_amount: amount,
      });

      return {
        data: null,
        error,
        success: !error,
      };
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  /**
   * Bulk grant permissions to multiple users
   */
  async bulkGrantPermissions(
    userIds: string[],
    companyId: string,
    permissionTypes: ('chat' | 'document_processing' | 'automation' | 'analytics')[],
    options: {
      expires_at?: string | null;
      usage_limit?: number | null;
      notes?: string;
    } = {}
  ): Promise<ApiResponse<UserModulePermission[]>> {
    try {
      const permissions = userIds.flatMap(userId =>
        permissionTypes.map(permissionType => ({
          user_id: userId,
          company_id: companyId,
          module_name: 'Ingrid AI Assistant',
          permission_type: permissionType,
          is_enabled: true,
          current_usage: 0,
          ...options,
        }))
      );

      const response = await supabase
        .from(this.tableName)
        .insert(permissions)
        .select(`
          *,
          user:profiles!user_module_permissions_user_id_fkey(
            user_id,
            email,
            first_name,
            last_name,
            role
          )
        `);

      return this.handleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  /**
   * Get usage statistics for company
   */
  async getCompanyUsageStats(companyId: string): Promise<ApiResponse<{
    total_users: number;
    active_users: number;
    total_usage: number;
    usage_by_type: Record<string, number>;
  }>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .select('permission_type, current_usage, user_id')
        .eq('company_id', companyId)
        .eq('module_name', 'Ingrid AI Assistant')
        .eq('is_enabled', true);

      if (response.error) {
        throw response.error;
      }

      const permissions = response.data || [];
      const uniqueUsers = new Set(permissions.map(p => p.user_id));
      const usageByType: Record<string, number> = {};

      permissions.forEach(p => {
        usageByType[p.permission_type] = (usageByType[p.permission_type] || 0) + (p.current_usage || 0);
      });

      const stats = {
        total_users: uniqueUsers.size,
        active_users: permissions.filter(p => (p.current_usage || 0) > 0).length,
        total_usage: permissions.reduce((sum, p) => sum + (p.current_usage || 0), 0),
        usage_by_type: usageByType,
      };

      return {
        data: stats,
        error: null,
        success: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }
}

export const ingridPermissionsService = new IngridPermissionsService();