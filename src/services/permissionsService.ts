// Enhanced Permissions Service
// This service provides all permission-related functionality for the application

import { apiClient } from "@/integrations/api/client";
import { supabase } from "@/integrations/supabase/client";
import {
  Permission,
  UserPermission,
  RolePermission,
  UserModule,
  CompanyModule,
  SystemModule,
  UserModuleAccess,
  PermissionCheck,
  UserPermissionSummary,
  CreatePermissionRequest,
  GrantPermissionRequest,
  UpdateUserModuleRequest,
  EnableCompanyModuleRequest,
  PermissionKey,
  UserRole,
  ModuleType,
  PermissionCheckOptions,
  ModuleAccessOptions,
} from "@/types/permissions";

export class PermissionsService {
  // ================================================================
  // PERMISSION CHECKING METHODS
  // ================================================================

  static async checkUserPermission(
    userId: string,
    permissionKey: PermissionKey,
    options: PermissionCheckOptions = {}
  ): Promise<PermissionCheck> {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.warn('No access token available for permission check');
        return {
          permission_key: permissionKey,
          has_permission: false,
          source: 'denied',
        };
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/rpc/user_has_permission`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id_param: userId,
          permission_key_param: permissionKey,
          company_id_param: options.company_id || null,
        }),
      });

      if (!response.ok) {
        console.error('Failed to check user permission:', response.status, response.statusText);
        return {
          permission_key: permissionKey,
          has_permission: false,
          source: 'denied',
        };
      }

      const data = await response.json();
      if (!data.success) {
        console.warn('Invalid permission check response:', data);
        return {
          permission_key: permissionKey,
          has_permission: false,
          source: 'denied',
        };
      }

      return {
        permission_key: permissionKey,
        has_permission: data.data?.has_permission || false,
        source: 'system', // The RPC function handles the logic internally
      };
    } catch (error) {
      console.error('Error checking user permission:', error);
      return {
        permission_key: permissionKey,
        has_permission: false,
        source: 'denied',
      };
    }
  }

  static async checkMultiplePermissions(
    userId: string,
    permissionKeys: PermissionKey[],
    options: PermissionCheckOptions = {}
  ): Promise<PermissionCheck[]> {
    const checks = await Promise.all(
      permissionKeys.map(key => this.checkUserPermission(userId, key, options))
    );
    return checks;
  }

  static async checkCompanyModuleAccess(
    companyId: string,
    moduleName: string
  ): Promise<boolean> {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.warn('No access token available for company module check');
        return false;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/rpc/company_has_module`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id_param: companyId,
          module_name_param: moduleName,
        }),
      });

      if (!response.ok) {
        console.error('Failed to check company module access:', response.status, response.statusText);
        return false;
      }

      const data = await response.json();
      if (!data.success) {
        console.warn('Invalid company module check response:', data);
        return false;
      }

      return data.data?.has_module || false;
    } catch (error) {
      console.error('Error checking company module access:', error);
      return false;
    }
  }

  // ================================================================
  // USER MODULE ACCESS METHODS
  // ================================================================

  static async getUserModules(
    userId: string,
    options: ModuleAccessOptions = {}
  ): Promise<UserModuleAccess[]> {
    try {
      const response = await apiClient.get('/modules/user/accessible');

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch user modules');
      }

      let modules = response.data?.modules || [];

      // Apply filters
      if (options.filter_by_category?.length) {
        modules = modules.filter(m => options.filter_by_category!.includes(m.category));
      }

      if (options.filter_by_type?.length) {
        modules = modules.filter(m => options.filter_by_type!.includes(m.module_type));
      }

      if (!options.include_disabled) {
        modules = modules.filter(m => m.is_enabled && m.has_access);
      }

      return modules;
    } catch (error) {
      console.error('Error getting user modules:', error);
      return [];
    }
  }

  static async getUserPermissionSummary(
    userId: string,
    companyId?: string
  ): Promise<UserPermissionSummary | null> {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      const targetCompanyId = companyId || profile.company_id;

      // Get user modules
      const modules = await this.getUserModules(userId);

      // Get user permissions (this would need a more complex query in a real implementation)
      const permissions: PermissionCheck[] = [];

      return {
        user_id: userId,
        company_id: targetCompanyId,
        role: profile.role,
        modules,
        permissions,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting user permission summary:', error);
      return null;
    }
  }

  // ================================================================
  // PERMISSION MANAGEMENT METHODS (ADMIN)
  // ================================================================

  static async grantUserPermission(
    request: GrantPermissionRequest,
    grantedBy: string
  ): Promise<boolean> {
    try {
      // First get the permission ID
      const { data: permission, error: permError } = await supabase
        .from('permissions')
        .select('id')
        .eq('permission_key', request.permission_key)
        .single();

      if (permError) throw permError;

      // Upsert user permission
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: request.user_id,
          permission_id: permission.id,
          company_id: request.company_id,
          is_granted: request.is_granted,
          granted_by: grantedBy,
          expires_at: request.expires_at || null,
        }, {
          onConflict: 'user_id,permission_id,company_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error granting user permission:', error);
      return false;
    }
  }

  static async updateUserModule(
    request: UpdateUserModuleRequest,
    updatedBy: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_modules')
        .upsert({
          user_id: request.user_id,
          module_id: request.module_id,
          company_id: request.company_id,
          is_enabled: request.is_enabled,
          granted_by: updatedBy,
          restrictions: request.restrictions || {},
          expires_at: request.expires_at || null,
        }, {
          onConflict: 'user_id,module_id,company_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating user module:', error);
      return false;
    }
  }

  static async enableCompanyModule(
    request: EnableCompanyModuleRequest,
    enabledBy: string
  ): Promise<boolean> {
    try {
      const endpoint = request.is_enabled
        ? `/modules/company/${request.company_id}/enable/${request.module_id}`
        : `/modules/company/${request.company_id}/disable/${request.module_id}`;

      const response = await apiClient.post(endpoint, {
        configuration: request.configuration || {},
        usage_limits: request.usage_limits || {},
        billing_tier: request.billing_tier || 'standard',
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update company module');
      }

      return true;
    } catch (error) {
      console.error('Error enabling company module:', error);
      return false;
    }
  }

  // ================================================================
  // SYSTEM MODULE METHODS
  // ================================================================

  static async getAllSystemModules(): Promise<SystemModule[]> {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.warn('No access token available for modules fetch');
        return [];
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch modules:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      if (!data.success || !data.data?.modules) {
        console.warn('Invalid modules response:', data);
        return [];
      }

      return data.data.modules || [];
    } catch (error) {
      console.error('Error getting system modules:', error);
      return [];
    }
  }

  static async getSystemModulesByType(type: ModuleType): Promise<SystemModule[]> {
    try {
      // Fetch all modules and filter by type client-side
      // This reduces API calls and leverages the cached modules
      const allModules = await this.getAllSystemModules();
      return allModules.filter(module => module.module_type === type);
    } catch (error) {
      console.error('Error getting system modules by type:', error);
      return [];
    }
  }

  static async getCoreModules(): Promise<SystemModule[]> {
    return this.getSystemModulesByType('core');
  }

  static async getAddOnModules(): Promise<SystemModule[]> {
    return this.getSystemModulesByType('add-on');
  }

  // ================================================================
  // PERMISSION DEFINITION METHODS
  // ================================================================

  static async getAllPermissions(): Promise<Permission[]> {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category')
        .order('permission_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting all permissions:', error);
      return [];
    }
  }

  static async getPermissionsByModule(moduleId: string): Promise<Permission[]> {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .eq('module_id', moduleId)
        .order('permission_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting permissions by module:', error);
      return [];
    }
  }

  static async createPermission(
    request: CreatePermissionRequest
  ): Promise<Permission | null> {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .insert({
          permission_key: request.permission_key,
          permission_name: request.permission_name,
          description: request.description || null,
          category: request.category,
          module_id: request.module_id || null,
          is_system_permission: request.is_system_permission || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating permission:', error);
      return null;
    }
  }

  // ================================================================
  // COMPANY MODULE METHODS
  // ================================================================

  static async getCompanyModules(companyId: string): Promise<CompanyModule[]> {
    try {
      const { data, error } = await supabase
        .from('company_modules')
        .select(`
          *,
          module:modules(*)
        `)
        .eq('company_id', companyId)
        .order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting company modules:', error);
      return [];
    }
  }

  static async getEnabledCompanyModules(companyId: string): Promise<CompanyModule[]> {
    try {
      const { data, error } = await supabase
        .from('company_modules')
        .select(`
          *,
          module:modules(*)
        `)
        .eq('company_id', companyId)
        .eq('is_enabled', true)
        .order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting enabled company modules:', error);
      return [];
    }
  }

  // ================================================================
  // USER PERMISSION METHODS
  // ================================================================

  static async getUserPermissions(
    userId: string,
    companyId?: string
  ): Promise<UserPermission[]> {
    try {
      let query = supabase
        .from('user_permissions')
        .select(`
          *,
          permission:permissions(*)
        `)
        .eq('user_id', userId);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  static async getRolePermissions(role: UserRole): Promise<RolePermission[]> {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          *,
          permission:permissions(*),
          module:modules(*)
        `)
        .eq('role_name', role)
        .eq('is_default', true)
        .order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting role permissions:', error);
      return [];
    }
  }

  // ================================================================
  // UTILITY METHODS
  // ================================================================

  static async refreshUserPermissions(userId: string): Promise<void> {
    // This would typically invalidate caches or trigger a permission recalculation
    // For now, we'll just log the action
    console.log(`Refreshing permissions for user: ${userId}`);
  }

  static async validateModuleDependencies(
    moduleId: string,
    enabledModules: string[]
  ): Promise<{ valid: boolean; missingDependencies: string[] }> {
    try {
      const { data: module, error } = await supabase
        .from('modules')
        .select('requires_modules, name')
        .eq('id', moduleId)
        .single();

      if (error) throw error;

      const requiredModules = module.requires_modules || [];
      const missingDependencies = requiredModules.filter(
        req => !enabledModules.includes(req)
      );

      return {
        valid: missingDependencies.length === 0,
        missingDependencies,
      };
    } catch (error) {
      console.error('Error validating module dependencies:', error);
      return { valid: false, missingDependencies: [] };
    }
  }

  static isSystemAdmin(role: UserRole): boolean {
    return role === 'super-admin';
  }

  static isCompanyAdmin(role: UserRole): boolean {
    return role === 'admin' || role === 'super-admin';
  }

  static canManageUsers(role: UserRole): boolean {
    return role === 'admin' || role === 'super-admin';
  }

  static canManageCompanyModules(role: UserRole): boolean {
    return role === 'super-admin';
  }

  static canManageUserPermissions(role: UserRole): boolean {
    return role === 'admin' || role === 'super-admin';
  }
}