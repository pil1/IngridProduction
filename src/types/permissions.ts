// Enhanced Permissions System Types
// This file defines all TypeScript interfaces for the new granular permissions system

export type UserRole = 'user' | 'admin' | 'super-admin';

export type ModuleType = 'core' | 'super' | 'add-on';

export type ModuleCategory = 'core' | 'operations' | 'accounting' | 'ai' | 'automation' | 'analytics' | 'general';

export type PermissionCategory = 'core' | 'admin' | 'operations' | 'accounting' | 'ai' | 'automation' | 'analytics' | 'general';

// ================================================================
// DATABASE ENTITY INTERFACES
// ================================================================

export interface SystemModule {
  id: string;
  name: string;
  description: string | null;
  module_type: ModuleType;
  category: ModuleCategory;
  is_core_required: boolean;
  is_active: boolean;
  default_monthly_price: number;
  default_per_user_price: number;
  requires_modules: string[];
  feature_flags: Record<string, any>;
  api_endpoints: string[];
  ui_components: string[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  permission_key: string;
  permission_name: string;
  description: string | null;
  category: PermissionCategory;
  module_id: string | null;
  is_system_permission: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission_id: string;
  company_id: string;
  is_granted: boolean;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  permission?: Permission;
}

export interface RolePermission {
  id: string;
  role_name: UserRole;
  permission_id: string;
  module_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  permission?: Permission;
  module?: SystemModule;
}

export interface UserModule {
  id: string;
  user_id: string;
  module_id: string;
  company_id: string;
  is_enabled: boolean;
  granted_by: string | null;
  granted_at: string;
  restrictions: Record<string, any>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  module?: SystemModule;
}

export interface CompanyModule {
  id: string;
  company_id: string;
  module_id: string;
  is_enabled: boolean;
  enabled_by: string | null;
  enabled_at: string;
  configuration: Record<string, any>;
  usage_limits: Record<string, any>;
  billing_tier: string;
  created_at: string;
  updated_at: string;
  // Joined data
  module?: SystemModule;
}

// ================================================================
// RESPONSE INTERFACES
// ================================================================

export interface UserModuleAccess {
  module_id: string;
  module_name: string;
  module_type: ModuleType;
  category: ModuleCategory;
  is_enabled: boolean;
  has_access: boolean;
}

export interface PermissionCheck {
  permission_key: string;
  has_permission: boolean;
  source: 'direct' | 'role' | 'system' | 'denied';
  expires_at?: string;
}

export interface UserPermissionSummary {
  user_id: string;
  company_id: string;
  role: UserRole;
  modules: UserModuleAccess[];
  permissions: PermissionCheck[];
  last_updated: string;
}

// ================================================================
// REQUEST/FORM INTERFACES
// ================================================================

export interface CreatePermissionRequest {
  permission_key: string;
  permission_name: string;
  description?: string;
  category: PermissionCategory;
  module_id?: string;
  is_system_permission?: boolean;
}

export interface GrantPermissionRequest {
  user_id: string;
  permission_key: string;
  company_id: string;
  is_granted: boolean;
  expires_at?: string;
}

export interface UpdateUserModuleRequest {
  user_id: string;
  module_id: string;
  company_id: string;
  is_enabled: boolean;
  restrictions?: Record<string, any>;
  expires_at?: string;
}

export interface EnableCompanyModuleRequest {
  company_id: string;
  module_id: string;
  is_enabled: boolean;
  configuration?: Record<string, any>;
  usage_limits?: Record<string, any>;
  billing_tier?: string;
}

// ================================================================
// UI COMPONENT INTERFACES
// ================================================================

export interface ModuleCard {
  module: SystemModule;
  isEnabled: boolean;
  hasAccess: boolean;
  canToggle: boolean;
  restrictions?: Record<string, any>;
  usageInfo?: {
    current_usage: number;
    limit: number;
    billing_period: string;
  };
}

export interface PermissionGroup {
  category: PermissionCategory;
  permissions: Permission[];
  moduleId?: string;
  moduleName?: string;
}

export interface UserPermissionMatrix {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
  };
  modules: {
    [moduleId: string]: {
      module: SystemModule;
      hasAccess: boolean;
      isEnabled: boolean;
      permissions: {
        [permissionKey: string]: {
          permission: Permission;
          hasPermission: boolean;
          source: 'direct' | 'role' | 'system';
          canModify: boolean;
        };
      };
    };
  };
}

// ================================================================
// PREDEFINED PERMISSION KEYS
// ================================================================

export const CORE_PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  COMPANY_SETTINGS_VIEW: 'company.settings.view',
  COMPANY_SETTINGS_EDIT: 'company.settings.edit',
  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
} as const;

export const OPERATIONS_PERMISSIONS = {
  VENDORS_VIEW: 'vendors.view',
  VENDORS_CREATE: 'vendors.create',
  VENDORS_EDIT: 'vendors.edit',
  VENDORS_DELETE: 'vendors.delete',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_EDIT: 'customers.edit',
  CUSTOMERS_DELETE: 'customers.delete',
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_EDIT: 'expenses.edit',
  EXPENSES_DELETE: 'expenses.delete',
  EXPENSES_APPROVE: 'expenses.approve',
  EXPENSES_REVIEW: 'expenses.review',
} as const;

export const AI_PERMISSIONS = {
  INGRID_VIEW: 'ingrid.suggestions.view',
  INGRID_APPROVE: 'ingrid.suggestions.approve',
  INGRID_CONFIGURE: 'ingrid.configure',
  INGRID_ANALYTICS: 'ingrid.analytics.view',
} as const;

export const ACCOUNTING_PERMISSIONS = {
  GL_ACCOUNTS_VIEW: 'gl_accounts.view',
  GL_ACCOUNTS_CREATE: 'gl_accounts.create',
  GL_ACCOUNTS_EDIT: 'gl_accounts.edit',
  GL_ACCOUNTS_DELETE: 'gl_accounts.delete',
  EXPENSE_CATEGORIES_VIEW: 'expense_categories.view',
  EXPENSE_CATEGORIES_CREATE: 'expense_categories.create',
  EXPENSE_CATEGORIES_EDIT: 'expense_categories.edit',
  EXPENSE_CATEGORIES_DELETE: 'expense_categories.delete',
} as const;

export const AUTOMATION_PERMISSIONS = {
  AUTOMATION_VIEW: 'automation.view',
  AUTOMATION_CREATE: 'automation.create',
  AUTOMATION_EDIT: 'automation.edit',
  AUTOMATION_DELETE: 'automation.delete',
  AUTOMATION_EXECUTE: 'automation.execute',
} as const;

export const ANALYTICS_PERMISSIONS = {
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  ANALYTICS_ADVANCED: 'analytics.advanced',
} as const;

// All permissions combined
export const ALL_PERMISSIONS = {
  ...CORE_PERMISSIONS,
  ...OPERATIONS_PERMISSIONS,
  ...AI_PERMISSIONS,
  ...ACCOUNTING_PERMISSIONS,
  ...AUTOMATION_PERMISSIONS,
  ...ANALYTICS_PERMISSIONS,
} as const;

// Type for any permission key
export type PermissionKey = typeof ALL_PERMISSIONS[keyof typeof ALL_PERMISSIONS];

// ================================================================
// UTILITY TYPES
// ================================================================

export interface PermissionCheckOptions {
  company_id?: string;
  require_module_access?: boolean;
  check_expiry?: boolean;
}

export interface ModuleAccessOptions {
  include_disabled?: boolean;
  filter_by_category?: ModuleCategory[];
  filter_by_type?: ModuleType[];
}

export interface PermissionAuditLog {
  id: string;
  user_id: string;
  permission_key: string;
  action: 'granted' | 'revoked' | 'expired' | 'checked';
  performed_by: string;
  company_id: string;
  details: Record<string, any>;
  created_at: string;
}

// ================================================================
// HELPER TYPE GUARDS
// ================================================================

export const isUserRole = (role: string): role is UserRole => {
  return ['user', 'admin', 'super-admin'].includes(role);
};

export const isModuleType = (type: string): type is ModuleType => {
  return ['core', 'super', 'add-on'].includes(type);
};

export const isPermissionKey = (key: string): key is PermissionKey => {
  return Object.values(ALL_PERMISSIONS).includes(key as PermissionKey);
};

export const isCoreModule = (module: SystemModule): boolean => {
  return module.module_type === 'core' || module.is_core_required;
};

export const isAddOnModule = (module: SystemModule): boolean => {
  return module.module_type === 'add-on';
};

// ================================================================
// DEFAULT CONFIGURATIONS
// ================================================================

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  'user': [
    CORE_PERMISSIONS.DASHBOARD_VIEW,
    OPERATIONS_PERMISSIONS.VENDORS_VIEW,
    OPERATIONS_PERMISSIONS.CUSTOMERS_VIEW,
    OPERATIONS_PERMISSIONS.EXPENSES_VIEW,
    OPERATIONS_PERMISSIONS.EXPENSES_CREATE,
    ACCOUNTING_PERMISSIONS.GL_ACCOUNTS_VIEW,
    ACCOUNTING_PERMISSIONS.EXPENSE_CATEGORIES_VIEW,
  ],
  'admin': Object.values(ALL_PERMISSIONS).filter(p =>
    !p.includes('delete') && !p.includes('super')
  ) as PermissionKey[],
  'super-admin': Object.values(ALL_PERMISSIONS) as PermissionKey[],
};

export const CORE_MODULES = [
  'Dashboard',
  'User Management',
  'Company Settings',
  'Notifications',
  'Vendors',
  'Customers',
  'GL Accounts',
  'Expense Categories',
] as const;

export const ADD_ON_MODULES = [
  'Ingrid AI',
  'Expense Management',
  'Process Automation',
  'Advanced Analytics',
] as const;