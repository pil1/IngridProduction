/**
 * Custom Role Management Service
 *
 * Handles all operations related to custom roles, role assignments, and role templates.
 * Provides comprehensive CRUD operations with proper permission validation.
 */

import { apiClient } from '@/integrations/api/client';
import {
  CustomRole,
  UserRoleAssignment,
  RoleTemplate,
  CustomRolePermission,
  EffectivePermission,
  PermissionKey,
  SystemRole
} from '@/types/permissions';

// ================================================================
// CUSTOM ROLE OPERATIONS
// ================================================================

export interface CreateCustomRoleRequest {
  company_id: string;
  role_name: string;
  role_display_name: string;
  description?: string;
  based_on_role?: SystemRole;
  permissions?: PermissionKey[];
}

export interface UpdateCustomRoleRequest {
  role_display_name?: string;
  description?: string;
  is_active?: boolean;
  permissions?: PermissionKey[];
}

export class CustomRoleService {
  /**
   * Get all custom roles for a company
   */
  static async getCompanyCustomRoles(companyId: string): Promise<CustomRole[]> {
    try {
      const params = new URLSearchParams({
        company_id: companyId,
        is_active: 'true'
      });

      const response = await apiClient.get(`/custom_roles?${params.toString()}`);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get custom roles');
      }

      return response.data || [];
    } catch (error) {
      console.error('Error getting company custom roles:', error);
      return [];
    }
  }

  /**
   * Get a specific custom role with its permissions
   */
  static async getCustomRoleDetails(roleId: string): Promise<CustomRole & { permissions: CustomRolePermission[] }> {
    const { data: role, error: roleError } = await supabase
      .from('custom_roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (roleError) throw roleError;

    const { data: permissions, error: permError } = await supabase
      .from('custom_role_permissions')
      .select(`
        *,
        permission:permissions(*)
      `)
      .eq('custom_role_id', roleId);

    if (permError) throw permError;

    return {
      ...role,
      permissions: permissions || []
    };
  }

  /**
   * Create a new custom role
   */
  static async createCustomRole(request: CreateCustomRoleRequest): Promise<CustomRole> {
    const { data: role, error: roleError } = await supabase
      .from('custom_roles')
      .insert({
        company_id: request.company_id,
        role_name: request.role_name.toLowerCase().replace(/\s+/g, '_'),
        role_display_name: request.role_display_name,
        description: request.description,
        based_on_role: request.based_on_role,
        is_active: true,
        is_system_role: false,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (roleError) throw roleError;

    // Add permissions if provided
    if (request.permissions && request.permissions.length > 0) {
      await this.setCustomRolePermissions(role.id, request.permissions);
    }

    return role;
  }

  /**
   * Update a custom role
   */
  static async updateCustomRole(roleId: string, request: UpdateCustomRoleRequest): Promise<CustomRole> {
    const { data, error } = await supabase
      .from('custom_roles')
      .update(request)
      .eq('id', roleId)
      .select()
      .single();

    if (error) throw error;

    // Update permissions if provided
    if (request.permissions) {
      await this.setCustomRolePermissions(roleId, request.permissions);
    }

    return data;
  }

  /**
   * Delete a custom role (soft delete)
   */
  static async deleteCustomRole(roleId: string): Promise<void> {
    const { error } = await supabase
      .from('custom_roles')
      .update({ is_active: false })
      .eq('id', roleId);

    if (error) throw error;
  }

  /**
   * Set permissions for a custom role (replaces existing permissions)
   */
  static async setCustomRolePermissions(roleId: string, permissionKeys: PermissionKey[]): Promise<void> {
    // First, get permission IDs from keys
    const { data: permissions, error: permError } = await supabase
      .from('permissions')
      .select('id, permission_key')
      .in('permission_key', permissionKeys);

    if (permError) throw permError;

    // Delete existing permissions
    const { error: deleteError } = await supabase
      .from('custom_role_permissions')
      .delete()
      .eq('custom_role_id', roleId);

    if (deleteError) throw deleteError;

    // Insert new permissions
    if (permissions && permissions.length > 0) {
      const permissionsToInsert = permissions.map(perm => ({
        custom_role_id: roleId,
        permission_id: perm.id,
        is_granted: true,
        granted_by: (async () => (await supabase.auth.getUser()).data.user?.id)()
      }));

      const { error: insertError } = await supabase
        .from('custom_role_permissions')
        .insert(permissionsToInsert);

      if (insertError) throw insertError;
    }
  }

  // ================================================================
  // USER ROLE ASSIGNMENT OPERATIONS
  // ================================================================

  /**
   * Get user's current role assignment
   */
  static async getUserRoleAssignment(userId: string, companyId: string): Promise<UserRoleAssignment | null> {
    try {
      const params = new URLSearchParams({
        user_id: userId,
        company_id: companyId,
        is_active: 'true'
      });

      const response = await apiClient.get(`/user_role_assignments?${params.toString()}`);

      if (!response.success || !response.data) {
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('Error getting user role assignment:', error);
      return null;
    }
  }

  /**
   * Assign a role to a user
   */
  static async assignRoleToUser(
    userId: string,
    companyId: string,
    roleId?: string,
    systemRole?: SystemRole,
    expiresAt?: string
  ): Promise<UserRoleAssignment> {
    try {
      const response = await apiClient.post('/user_role_assignments', {
        user_id: userId,
        custom_role_id: roleId,
        company_id: companyId,
        expires_at: expiresAt
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to assign role to user');
      }

      return response.data;
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw error;
    }
  }

  /**
   * Remove role assignment from user (fallback to system role)
   */
  static async removeUserRoleAssignment(userId: string, companyId: string): Promise<void> {
    try {
      // Get the current assignment first
      const assignment = await this.getUserRoleAssignment(userId, companyId);
      if (!assignment) return;

      const response = await apiClient.delete(`/user_role_assignments/${assignment.id}`);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to remove role assignment');
      }
    } catch (error) {
      console.error('Error removing user role assignment:', error);
      throw error;
    }
  }

  // ================================================================
  // ROLE TEMPLATE OPERATIONS
  // ================================================================

  /**
   * Get all available role templates
   */
  static async getRoleTemplates(): Promise<RoleTemplate[]> {
    const { data, error } = await supabase
      .from('role_templates')
      .select('*')
      .order('display_name');

    if (error) throw error;
    return data || [];
  }

  /**
   * Create custom role from template
   */
  static async createRoleFromTemplate(
    templateId: string,
    companyId: string,
    customizations?: {
      role_display_name?: string;
      description?: string;
      additional_permissions?: PermissionKey[];
      removed_permissions?: PermissionKey[];
    }
  ): Promise<CustomRole> {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from('role_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    // Calculate final permissions
    let finalPermissions = template.base_permissions as PermissionKey[];

    if (customizations?.additional_permissions) {
      finalPermissions = [...finalPermissions, ...customizations.additional_permissions];
    }

    if (customizations?.removed_permissions) {
      finalPermissions = finalPermissions.filter(p =>
        !customizations.removed_permissions!.includes(p)
      );
    }

    // Create role
    const roleRequest: CreateCustomRoleRequest = {
      company_id: companyId,
      role_name: template.template_name,
      role_display_name: customizations?.role_display_name || template.display_name,
      description: customizations?.description || template.description,
      permissions: finalPermissions
    };

    return await this.createCustomRole(roleRequest);
  }

  // ================================================================
  // PERMISSION RESOLUTION
  // ================================================================

  /**
   * Get effective permissions for a user (combines all sources)
   */
  static async getUserEffectivePermissions(userId: string, companyId: string): Promise<EffectivePermission[]> {
    try {
      const response = await apiClient.post('/rpc/get_user_effective_permissions', {
        user_id_param: userId,
        company_id_param: companyId
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get effective permissions');
      }

      return response.data || [];
    } catch (error) {
      console.error('Error getting user effective permissions:', error);
      return [];
    }
  }

  /**
   * Check if user has specific permission (considering all sources)
   */
  static async userHasPermission(
    userId: string,
    permissionKey: PermissionKey,
    companyId: string
  ): Promise<boolean> {
    try {
      const response = await apiClient.post('/rpc/user_has_permission', {
        user_id_param: userId,
        permission_key_param: permissionKey,
        company_id_param: companyId
      });

      if (!response.success) {
        return false;
      }

      return response.data || false;
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Get role assignment summary for multiple users
   */
  static async getUsersRoleAssignments(userIds: string[], companyId: string): Promise<Map<string, UserRoleAssignment | null>> {
    const { data, error } = await supabase
      .from('user_role_assignments')
      .select(`
        user_id,
        *,
        custom_role:custom_roles(*)
      `)
      .in('user_id', userIds)
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (error) throw error;

    const assignments = new Map<string, UserRoleAssignment>();
    data?.forEach(assignment => {
      assignments.set(assignment.user_id, assignment);
    });

    // Ensure all users are represented
    const result = new Map<string, UserRoleAssignment | null>();
    userIds.forEach(userId => {
      result.set(userId, assignments.get(userId) || null);
    });

    return result;
  }

  // ================================================================
  // ROLE VALIDATION AND UTILITIES
  // ================================================================

  /**
   * Validate role permissions before assignment
   */
  static async validateRoleAssignment(
    userId: string,
    roleId: string,
    companyId: string
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Get role details
    const role = await this.getCustomRoleDetails(roleId);

    // Check if role belongs to the company
    if (role.company_id !== companyId) {
      issues.push('Role does not belong to the specified company');
    }

    // Check if role is active
    if (!role.is_active) {
      issues.push('Role is not active');
    }

    // Check required modules are enabled for company
    const requiredModules = role.permissions
      .map(p => p.permission?.module_id)
      .filter(Boolean);

    if (requiredModules.length > 0) {
      const { data: companyModules } = await supabase
        .from('company_modules')
        .select('module_id')
        .eq('company_id', companyId)
        .eq('is_enabled', true)
        .in('module_id', requiredModules);

      const enabledModuleIds = companyModules?.map(cm => cm.module_id) || [];
      const missingModules = requiredModules.filter(m => !enabledModuleIds.includes(m));

      if (missingModules.length > 0) {
        issues.push(`Required modules not enabled: ${missingModules.join(', ')}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get role usage statistics
   */
  static async getRoleUsageStats(roleId: string): Promise<{
    totalAssignments: number;
    activeAssignments: number;
    lastAssigned: string | null;
  }> {
    const { data, error } = await supabase
      .from('user_role_assignments')
      .select('assigned_at, is_active')
      .eq('role_id', roleId);

    if (error) throw error;

    const assignments = data || [];
    const activeAssignments = assignments.filter(a => a.is_active).length;
    const lastAssigned = assignments.length > 0
      ? assignments.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())[0].assigned_at
      : null;

    return {
      totalAssignments: assignments.length,
      activeAssignments,
      lastAssigned
    };
  }
}

export default CustomRoleService;