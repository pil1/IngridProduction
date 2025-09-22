// Enhanced Permissions Service
// This service provides all permission-related functionality for the application

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
      const { data, error } = await supabase.rpc('user_has_permission', {
        check_user_id: userId,
        permission_key_param: permissionKey,
        check_company_id: options.company_id || null,
      });

      if (error) throw error;

      return {
        permission_key: permissionKey,
        has_permission: data || false,
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
      const { data, error } = await supabase.rpc('company_has_module', {
        check_company_id: companyId,
        module_name_param: moduleName,
      });

      if (error) throw error;
      return data || false;
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
      const { data, error } = await supabase.rpc('get_user_modules', {
        check_user_id: userId,
      });

      if (error) throw error;

      let modules = data || [];

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
      const { error } = await supabase
        .from('company_modules')
        .upsert({
          company_id: request.company_id,
          module_id: request.module_id,
          is_enabled: request.is_enabled,
          enabled_by: enabledBy,
          configuration: request.configuration || {},
          usage_limits: request.usage_limits || {},
          billing_tier: request.billing_tier || 'standard',
        }, {
          onConflict: 'company_id,module_id'
        });

      if (error) throw error;
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
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('is_active', true)
        .order('module_type')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting system modules:', error);
      return [];
    }
  }

  static async getSystemModulesByType(type: ModuleType): Promise<SystemModule[]> {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('module_type', type)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
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