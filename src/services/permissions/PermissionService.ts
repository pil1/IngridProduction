/**
 * Permission Service
 *
 * Central permission validation and capability checking system.
 * Ensures users only access data they're authorized to see.
 * Integrates with SecurityMonitoringService for activity tracking.
 */

import { SecurityMonitoringService } from './SecurityMonitoringService';

export interface UserPermissions {
  // Financial Data Access
  canViewGLAccounts: boolean;
  canEditGLAccounts: boolean;
  canViewFinancialReports: boolean;
  canViewBudgets: boolean;
  canViewCompanyFinancials: boolean;

  // Expense Management
  canCreateExpenses: boolean;
  canEditOwnExpenses: boolean;
  canEditAllExpenses: boolean;
  canApproveExpenses: boolean;
  canViewAllExpenses: boolean;

  // User Management
  canViewUsers: boolean;
  canEditUsers: boolean;
  canInviteUsers: boolean;
  canDeleteUsers: boolean;
  canChangeUserRoles: boolean;
  canImpersonateUsers: boolean;

  // Company Settings
  canEditCompanySettings: boolean;
  canViewCompanySettings: boolean;
  canConfigureIngridAI: boolean;
  canViewSecurityLogs: boolean;
  canManageIntegrations: boolean;

  // Data & Automation
  canViewVendors: boolean;
  canEditVendors: boolean;
  canViewCustomers: boolean;
  canEditCustomers: boolean;
  canConfigureAutomations: boolean;
  canViewAnalytics: boolean;

  // System Administration
  canAccessSystemSettings: boolean;
  canViewAuditLogs: boolean;
  canManageSystemUsers: boolean;
  canConfigureBilling: boolean;
}

export interface SecurityContext {
  userId: string;
  userRole: 'super-admin' | 'admin' | 'user';
  companyId: string | null;
  sessionId: string;
  isImpersonating: boolean;
  impersonatedBy?: string;
}

export interface AccessAttempt {
  userId: string;
  action: string;
  resource: string;
  permitted: boolean;
  timestamp: string;
  context: Record<string, any>;
  riskScore: number;
}

export class PermissionService {

  /**
   * Get user permissions based on their role and company settings
   */
  static getUserPermissions(
    userRole: 'super-admin' | 'admin' | 'user',
    companyId: string | null
  ): UserPermissions {
    const basePermissions: UserPermissions = {
      // Default: No access
      canViewGLAccounts: false,
      canEditGLAccounts: false,
      canViewFinancialReports: false,
      canViewBudgets: false,
      canViewCompanyFinancials: false,
      canCreateExpenses: false,
      canEditOwnExpenses: false,
      canEditAllExpenses: false,
      canApproveExpenses: false,
      canViewAllExpenses: false,
      canViewUsers: false,
      canEditUsers: false,
      canInviteUsers: false,
      canDeleteUsers: false,
      canChangeUserRoles: false,
      canImpersonateUsers: false,
      canEditCompanySettings: false,
      canViewCompanySettings: false,
      canConfigureIngridAI: false,
      canViewSecurityLogs: false,
      canManageIntegrations: false,
      canViewVendors: false,
      canEditVendors: false,
      canViewCustomers: false,
      canEditCustomers: false,
      canConfigureAutomations: false,
      canViewAnalytics: false,
      canAccessSystemSettings: false,
      canViewAuditLogs: false,
      canManageSystemUsers: false,
      canConfigureBilling: false
    };

    switch (userRole) {
      case 'super-admin':
        return {
          ...basePermissions,
          // Super admins have access to everything
          canViewGLAccounts: true,
          canEditGLAccounts: true,
          canViewFinancialReports: true,
          canViewBudgets: true,
          canViewCompanyFinancials: true,
          canCreateExpenses: true,
          canEditOwnExpenses: true,
          canEditAllExpenses: true,
          canApproveExpenses: true,
          canViewAllExpenses: true,
          canViewUsers: true,
          canEditUsers: true,
          canInviteUsers: true,
          canDeleteUsers: true,
          canChangeUserRoles: true,
          canImpersonateUsers: true,
          canEditCompanySettings: true,
          canViewCompanySettings: true,
          canConfigureIngridAI: true,
          canViewSecurityLogs: true,
          canManageIntegrations: true,
          canViewVendors: true,
          canEditVendors: true,
          canViewCustomers: true,
          canEditCustomers: true,
          canConfigureAutomations: true,
          canViewAnalytics: true,
          canAccessSystemSettings: true,
          canViewAuditLogs: true,
          canManageSystemUsers: true,
          canConfigureBilling: true
        };

      case 'admin':
        return {
          ...basePermissions,
          // Company admins have broad access within their company
          canViewGLAccounts: true,
          canEditGLAccounts: true,
          canViewFinancialReports: true,
          canViewBudgets: true,
          canViewCompanyFinancials: true,
          canCreateExpenses: true,
          canEditOwnExpenses: true,
          canEditAllExpenses: true,
          canApproveExpenses: true,
          canViewAllExpenses: true,
          canViewUsers: true,
          canEditUsers: true,
          canInviteUsers: true,
          canDeleteUsers: true,
          canChangeUserRoles: true,
          canImpersonateUsers: false, // Only super-admins can impersonate
          canEditCompanySettings: true,
          canViewCompanySettings: true,
          canConfigureIngridAI: true,
          canViewSecurityLogs: true,
          canManageIntegrations: true,
          canViewVendors: true,
          canEditVendors: true,
          canViewCustomers: true,
          canEditCustomers: true,
          canConfigureAutomations: true,
          canViewAnalytics: true,
          canAccessSystemSettings: false, // Only super-admins
          canViewAuditLogs: true,
          canManageSystemUsers: false, // Only super-admins
          canConfigureBilling: false // Only super-admins
        };

      case 'user':
        return {
          ...basePermissions,
          // Regular users have limited access
          canViewGLAccounts: false, // Users cannot see GL accounts by default
          canEditGLAccounts: false,
          canViewFinancialReports: false,
          canViewBudgets: false,
          canViewCompanyFinancials: false,
          canCreateExpenses: true,
          canEditOwnExpenses: true,
          canEditAllExpenses: false,
          canApproveExpenses: false,
          canViewAllExpenses: false, // Users only see their own expenses
          canViewUsers: false,
          canEditUsers: false,
          canInviteUsers: false,
          canDeleteUsers: false,
          canChangeUserRoles: false,
          canImpersonateUsers: false,
          canEditCompanySettings: false,
          canViewCompanySettings: false,
          canConfigureIngridAI: false,
          canViewSecurityLogs: false,
          canManageIntegrations: false,
          canViewVendors: true, // Users can view vendors for expense creation
          canEditVendors: false,
          canViewCustomers: false,
          canEditCustomers: false,
          canConfigureAutomations: false,
          canViewAnalytics: false,
          canAccessSystemSettings: false,
          canViewAuditLogs: false,
          canManageSystemUsers: false,
          canConfigureBilling: false
        };

      default:
        return basePermissions; // No permissions for unknown roles
    }
  }

  /**
   * Check if user has permission for a specific action
   */
  static async hasPermission(
    context: SecurityContext,
    action: keyof UserPermissions,
    resource: string = 'permission_check'
  ): Promise<boolean> {
    const permissions = this.getUserPermissions(context.userRole, context.companyId);
    const hasAccess = permissions[action];

    // Monitor the user action through SecurityMonitoringService
    await SecurityMonitoringService.monitorUserAction(
      context.userId,
      context.userId, // In production, this would be the actual user name
      action,
      resource,
      hasAccess,
      {
        userRole: context.userRole,
        companyId: context.companyId,
        isImpersonating: context.isImpersonating,
        sessionId: context.sessionId
      }
    );

    return hasAccess;
  }

  /**
   * Check if user can access GL account data
   */
  static async canAccessGLData(context: SecurityContext): Promise<boolean> {
    return this.hasPermission(context, 'canViewGLAccounts');
  }

  /**
   * Check if user can access financial reports
   */
  static async canAccessFinancialData(context: SecurityContext): Promise<boolean> {
    return this.hasPermission(context, 'canViewFinancialReports');
  }

  /**
   * Check if user can configure Ingrid AI
   */
  static async canConfigureIngrid(context: SecurityContext): Promise<boolean> {
    return this.hasPermission(context, 'canConfigureIngridAI');
  }

  /**
   * Filter data based on user permissions
   */
  static filterSensitiveData<T extends Record<string, any>>(
    data: T,
    context: SecurityContext,
    sensitiveFields: string[] = []
  ): Partial<T> {
    const permissions = this.getUserPermissions(context.userRole, context.companyId);
    const filtered = { ...data };

    // Default sensitive fields that require specific permissions
    const defaultSensitiveFields = [
      'gl_account_code',
      'gl_account_name',
      'total_budget',
      'financial_data',
      'company_financials',
      'audit_log',
      'security_log'
    ];

    const allSensitiveFields = [...defaultSensitiveFields, ...sensitiveFields];

    // Remove sensitive fields if user doesn't have permission
    allSensitiveFields.forEach(field => {
      if (field in filtered) {
        if (field.includes('gl_account') && !permissions.canViewGLAccounts) {
          delete filtered[field];
        } else if (field.includes('financial') && !permissions.canViewFinancialReports) {
          delete filtered[field];
        } else if (field.includes('budget') && !permissions.canViewBudgets) {
          delete filtered[field];
        } else if (field.includes('audit') && !permissions.canViewAuditLogs) {
          delete filtered[field];
        } else if (field.includes('security') && !permissions.canViewSecurityLogs) {
          delete filtered[field];
        }
      }
    });

    return filtered;
  }

  /**
   * Get filtered action cards based on user permissions
   */
  static filterActionCards(
    actionCards: any[],
    context: SecurityContext
  ): any[] {
    const permissions = this.getUserPermissions(context.userRole, context.companyId);

    return actionCards.filter(card => {
      switch (card.type) {
        case 'create_expense':
          return permissions.canCreateExpenses;
        case 'approve_expense':
          return permissions.canApproveExpenses;
        case 'create_vendor':
          return permissions.canEditVendors;
        case 'create_customer':
          return permissions.canEditCustomers;
        case 'update_gl_account':
          return permissions.canEditGLAccounts;
        default:
          return true; // Allow general actions
      }
    }).map(card => {
      // Filter sensitive data from action card data
      const filteredData = this.filterSensitiveData(card.data || {}, context);
      return {
        ...card,
        data: filteredData
      };
    });
  }



  /**
   * Create security context from session data
   */
  static createSecurityContext(
    profile: any,
    sessionId: string,
    impersonatedProfile?: any
  ): SecurityContext {
    return {
      userId: profile.id,
      userRole: profile.role,
      companyId: profile.company_id,
      sessionId,
      isImpersonating: !!impersonatedProfile,
      impersonatedBy: impersonatedProfile ? profile.id : undefined
    };
  }
}