/**
 * Permission Validation Service
 *
 * Validates permission changes to ensure system security and consistency.
 * Prevents invalid permission assignments and provides helpful error messages.
 */

import { UserRole } from '@/types/permissions';
import { permissionDependencyService } from './PermissionDependencyService';

export interface ValidationRule {
  id: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (context: ValidationContext) => boolean;
  message: string;
}

export interface ValidationContext {
  currentUserRole: UserRole;
  targetUserRole: UserRole;
  targetUserId: string;
  permissionKey?: string;
  moduleId?: string;
  action: 'grant' | 'revoke';
  isGranting: boolean;
  companyId: string;
  targetCompanyId: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
  blockedBy?: string[];
}

export class PermissionValidationService {
  private static instance: PermissionValidationService;
  private rules: ValidationRule[] = [];

  static getInstance(): PermissionValidationService {
    if (!PermissionValidationService.instance) {
      PermissionValidationService.instance = new PermissionValidationService();
      PermissionValidationService.instance.initializeDefaultRules();
    }
    return PermissionValidationService.instance;
  }

  private initializeDefaultRules(): void {
    this.rules = [
      // Super Admin Permission Rules
      {
        id: 'super-admin-only-permissions',
        description: 'Only Super Admins can grant Super Admin permissions',
        severity: 'error',
        check: (ctx) => {
          if (!ctx.permissionKey) return true;
          return !(
            ctx.permissionKey.includes('super') &&
            ctx.currentUserRole !== 'super-admin' &&
            ctx.isGranting
          );
        },
        message: 'Only Super Administrators can grant Super Admin permissions.',
      },
      {
        id: 'super-admin-role-protection',
        description: 'Non-Super Admins cannot modify Super Admin accounts',
        severity: 'error',
        check: (ctx) => {
          return !(
            ctx.currentUserRole !== 'super-admin' &&
            ctx.targetUserRole === 'super-admin'
          );
        },
        message: 'You cannot modify Super Administrator accounts.',
      },
      {
        id: 'cross-company-restriction',
        description: 'Admins can only manage users in their own company',
        severity: 'error',
        check: (ctx) => {
          return !(
            ctx.currentUserRole === 'admin' &&
            ctx.companyId !== ctx.targetCompanyId
          );
        },
        message: 'You can only manage users within your own company.',
      },
      {
        id: 'self-permission-restriction',
        description: 'Users cannot modify their own critical permissions',
        severity: 'error',
        check: (ctx) => {
          // Allow users to modify their own non-critical permissions
          if (!ctx.permissionKey) return true;

          const criticalPermissions = [
            'manage_users',
            'manage_permissions',
            'delete_users',
            'super_admin_access',
          ];

          return !(
            ctx.currentUserRole !== 'super-admin' &&
            ctx.targetUserId === ctx.currentUserRole && // This would need the current user ID
            criticalPermissions.some(perm => ctx.permissionKey!.includes(perm))
          );
        },
        message: 'You cannot modify your own critical permissions.',
      },

      // Module Access Rules
      {
        id: 'core-module-protection',
        description: 'Core modules cannot be disabled',
        severity: 'error',
        check: (ctx) => {
          // This would need additional context about which modules are core
          // For now, assume this check is handled elsewhere
          return true;
        },
        message: 'Core modules cannot be disabled.',
      },

      // Warning Rules
      {
        id: 'dangerous-permission-warning',
        description: 'Warning for granting dangerous permissions',
        severity: 'warning',
        check: (ctx) => {
          if (!ctx.permissionKey || !ctx.isGranting) return true;

          const dangerousPermissions = [
            'delete_users',
            'manage_billing',
            'system_settings',
            'delete_company',
          ];

          return !dangerousPermissions.some(perm =>
            ctx.permissionKey!.includes(perm)
          );
        },
        message: 'You are granting a potentially dangerous permission. Please verify this is intended.',
      },
      {
        id: 'role-elevation-warning',
        description: 'Warning when granting permissions above user\'s role',
        severity: 'warning',
        check: (ctx) => {
          if (!ctx.permissionKey || !ctx.isGranting) return true;

          // Check if permission is typically associated with higher roles
          const adminPermissions = [
            'manage_users',
            'manage_company',
            'view_analytics',
          ];

          return !(
            ctx.currentUserRole === 'admin' &&
            ctx.targetUserRole === 'user' &&
            adminPermissions.some(perm => ctx.permissionKey!.includes(perm))
          );
        },
        message: 'You are granting administrative permissions to a regular user.',
      },

      // Info Rules
      {
        id: 'first-admin-info',
        description: 'Information about first admin setup',
        severity: 'info',
        check: (ctx) => {
          // This would need additional context about whether this is the first admin
          return true;
        },
        message: 'Setting up the first administrator for this company.',
      },
    ];
  }

  /**
   * Validate a permission change with dependency checking
   */
  async validatePermissionChange(
    context: ValidationContext,
    currentUserPermissions?: string[]
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    const blockedBy: string[] = [];

    // First run role-based validation rules
    for (const rule of this.rules) {
      const passed = rule.check(context);

      if (!passed) {
        switch (rule.severity) {
          case 'error':
            errors.push(rule.message);
            blockedBy.push(rule.id);
            break;
          case 'warning':
            warnings.push(rule.message);
            break;
          case 'info':
            info.push(rule.message);
            break;
        }
      }
    }

    // Then run dependency validation if we have permission key and user permissions
    if (context.permissionKey && currentUserPermissions) {
      try {
        const dependencyResult = await permissionDependencyService.validatePermissionChange(
          context.targetUserId,
          context.permissionKey,
          context.isGranting,
          currentUserPermissions
        );

        errors.push(...dependencyResult.errors);
        warnings.push(...dependencyResult.warnings);

        if (!dependencyResult.isValid) {
          blockedBy.push('permission-dependencies');
        }
      } catch (error) {
        console.warn('Failed to validate permission dependencies:', error);
        warnings.push('Could not validate permission dependencies. Please verify manually.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
    };
  }

  /**
   * Synchronous validation for backward compatibility
   */
  validatePermissionChangeSync(context: ValidationContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    const blockedBy: string[] = [];

    for (const rule of this.rules) {
      const passed = rule.check(context);

      if (!passed) {
        switch (rule.severity) {
          case 'error':
            errors.push(rule.message);
            blockedBy.push(rule.id);
            break;
          case 'warning':
            warnings.push(rule.message);
            break;
          case 'info':
            info.push(rule.message);
            break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      info,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
    };
  }

  /**
   * Validate multiple permission changes in batch
   */
  validateBatchChanges(
    changes: Array<{
      context: ValidationContext;
      description: string;
    }>
  ): {
    overallValid: boolean;
    results: Array<{
      description: string;
      result: ValidationResult;
    }>;
    summary: {
      totalErrors: number;
      totalWarnings: number;
      blockedChanges: number;
    };
  } {
    const results = changes.map(change => ({
      description: change.description,
      result: this.validatePermissionChange(change.context),
    }));

    const summary = results.reduce(
      (acc, { result }) => ({
        totalErrors: acc.totalErrors + result.errors.length,
        totalWarnings: acc.totalWarnings + result.warnings.length,
        blockedChanges: acc.blockedChanges + (result.isValid ? 0 : 1),
      }),
      { totalErrors: 0, totalWarnings: 0, blockedChanges: 0 }
    );

    return {
      overallValid: summary.blockedChanges === 0,
      results,
      summary,
    };
  }

  /**
   * Add a custom validation rule
   */
  addRule(rule: ValidationRule): void {
    // Remove existing rule with same ID if it exists
    this.rules = this.rules.filter(r => r.id !== rule.id);
    this.rules.push(rule);
  }

  /**
   * Remove a validation rule
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * Get all current rules
   */
  getRules(): ValidationRule[] {
    return [...this.rules];
  }

  /**
   * Check if a permission can be granted to a user
   */
  canGrantPermission(
    currentUserRole: UserRole,
    targetUserRole: UserRole,
    permissionKey: string,
    companyId: string,
    targetCompanyId: string
  ): ValidationResult {
    return this.validatePermissionChange({
      currentUserRole,
      targetUserRole,
      targetUserId: 'unknown', // Would need actual user ID
      permissionKey,
      action: 'grant',
      isGranting: true,
      companyId,
      targetCompanyId,
    });
  }

  /**
   * Check if a module can be enabled for a user
   */
  canEnableModule(
    currentUserRole: UserRole,
    targetUserRole: UserRole,
    moduleId: string,
    companyId: string,
    targetCompanyId: string
  ): ValidationResult {
    return this.validatePermissionChange({
      currentUserRole,
      targetUserRole,
      targetUserId: 'unknown', // Would need actual user ID
      moduleId,
      action: 'grant',
      isGranting: true,
      companyId,
      targetCompanyId,
    });
  }

  /**
   * Get validation summary for a role
   */
  getRoleCapabilities(
    currentUserRole: UserRole,
    companyId: string
  ): {
    canManageUsers: boolean;
    canManagePermissions: boolean;
    canManageSuperAdmins: boolean;
    canManageOtherCompanies: boolean;
    restrictedPermissions: string[];
  } {
    const isSuperAdmin = currentUserRole === 'super-admin';
    const isAdmin = currentUserRole === 'admin';

    return {
      canManageUsers: isSuperAdmin || isAdmin,
      canManagePermissions: isSuperAdmin || isAdmin,
      canManageSuperAdmins: isSuperAdmin,
      canManageOtherCompanies: isSuperAdmin,
      restrictedPermissions: isSuperAdmin ? [] : [
        'super_admin_access',
        'manage_super_admins',
        'system_settings',
        'billing_management',
      ],
    };
  }
}

export const permissionValidator = PermissionValidationService.getInstance();