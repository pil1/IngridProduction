/**
 * Enhanced Permissions System Types - Version 2.0
 * Two-Tier Permission Architecture
 *
 * Tier 1: Data Permissions (Foundation) - Basic operational permissions
 * Tier 2: Module Permissions (Premium) - Advanced features with sub-permissions
 *
 * @packageDocumentation
 */

// ================================================================
// CORE TYPES
// ================================================================

export type UserRole = 'user' | 'admin' | 'super-admin';
export type SystemRole = UserRole;

export type ModuleTier = 'core' | 'standard' | 'premium';
export type PricingTier = 'standard' | 'custom' | 'enterprise';
export type ModuleCategory = 'core' | 'operations' | 'accounting' | 'ai' | 'automation' | 'analytics' | 'general';

export type PermissionGroup =
  | 'Company Configuration'
  | 'Customer Relationship Management'
  | 'Dashboard & Analytics'
  | 'Expense Operations'
  | 'GL Account Management'
  | 'Expense Category Management'
  | 'Vendor and Supplier Management'
  | 'User Management'
  | 'Notification Management'
  | 'General';

export type PermissionSource = 'data' | 'module' | 'role';

// ================================================================
// DATA PERMISSIONS (TIER 1 - FOUNDATION)
// ================================================================

/**
 * Data Permission - Foundation-level operational permissions
 * These are NOT tied to paid modules - they're basic access controls
 */
export interface DataPermission {
  id: string;
  permission_key: string;
  permission_name: string;
  description: string | null;
  human_description?: string;
  permission_group: PermissionGroup;
  ui_display_order: number;
  requires_permissions: string[]; // Dependency permissions
  is_foundation_permission: boolean;
  is_system_permission: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User Data Permission - Individual grants for foundation permissions
 */
export interface UserDataPermission {
  id: string;
  user_id: string;
  permission_id: string;
  company_id: string;
  is_granted: boolean;
  granted_by: string | null;
  granted_at: string;
  granted_reason?: string;
  last_used_at?: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  permission?: DataPermission;
}

// ================================================================
// MODULE PERMISSIONS (TIER 2 - PREMIUM)
// ================================================================

/**
 * Enhanced Module with Two-Tier System
 */
export interface EnhancedModule {
  id: string;
  name: string;
  description: string | null;
  module_tier: ModuleTier;
  category: ModuleCategory;
  is_active: boolean;

  // Pricing
  default_monthly_price: number;
  default_per_user_price: number;

  // Permissions & Features
  included_permissions: string[]; // Array of permission keys
  sub_features: ModuleSubFeature[];
  feature_limits: Record<string, any>;
  module_dependencies: string[]; // Required module IDs

  // Metadata
  api_endpoints: string[];
  ui_components: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Module Sub-Feature
 */
export interface ModuleSubFeature {
  name: string;
  key: string;
  description?: string;
  icon?: string;
  is_enabled?: boolean;
}

/**
 * Module Permission Junction
 * Explicitly links modules to their required permissions
 */
export interface ModulePermission {
  id: string;
  module_id: string;
  permission_id: string;
  is_required: boolean; // Always granted with module
  is_optional: boolean; // Admin can choose to grant
  permission_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  permission?: DataPermission;
  module?: EnhancedModule;
}

/**
 * User Module Permission
 * Tracks specific module permission grants for users
 */
export interface UserModulePermission {
  id: string;
  user_id: string;
  module_id: string;
  permission_id: string;
  company_id: string;
  is_granted: boolean;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  permission?: DataPermission;
  module?: EnhancedModule;
}

// ================================================================
// COMPANY MODULE PROVISIONING
// ================================================================

/**
 * Enhanced Company Module with Pricing
 */
export interface EnhancedCompanyModule {
  id: string;
  company_id: string;
  module_id: string;
  is_enabled: boolean;
  enabled_by: string | null;
  enabled_at: string;

  // Pricing Configuration
  pricing_tier: PricingTier;
  monthly_price?: number;
  per_user_price?: number;
  users_licensed: number;

  // Configuration
  configuration: Record<string, any>;
  usage_limits: Record<string, any>;
  feature_configuration: Record<string, any>;
  billing_notes?: string;

  created_at: string;
  updated_at: string;
  // Joined data
  module?: EnhancedModule;
}

// ================================================================
// USER MODULE ACCESS
// ================================================================

/**
 * User Module - Individual user module access
 */
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
  module?: EnhancedModule;
}

// ================================================================
// PERMISSION TEMPLATES
// ================================================================

/**
 * Permission Template - Quick user setup
 */
export interface PermissionTemplate {
  id: string;
  template_name: string;
  display_name: string;
  description?: string;
  target_role: UserRole;
  data_permissions: string[]; // Array of permission keys
  modules: string[]; // Array of module IDs
  is_system_template: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Pre-defined templates
export const PERMISSION_TEMPLATES = {
  BASIC_USER: 'basic_user',
  EXPENSE_REVIEWER: 'expense_reviewer',
  DEPARTMENT_MANAGER: 'department_manager',
  CONTROLLER: 'controller',
} as const;

// ================================================================
// UNIFIED PERMISSION SYSTEM
// ================================================================

/**
 * Complete User Permissions - Combines data + module permissions
 */
export interface CompleteUserPermissions {
  permission_key: string;
  permission_name: string;
  permission_source: PermissionSource;
  module_name?: string;
  is_granted: boolean;
}

/**
 * User Permission Summary - Complete overview
 */
export interface UserPermissionSummary {
  user_id: string;
  company_id: string;
  role: UserRole;

  // Data permissions (foundation)
  data_permissions: {
    total_count: number;
    granted_count: number;
    by_group: Record<PermissionGroup, number>;
  };

  // Module permissions (premium)
  module_permissions: {
    total_modules: number;
    active_modules: number;
    active_module_list: string[];
  };

  // Complete permission list
  all_permissions: CompleteUserPermissions[];
}

// ================================================================
// REQUEST/RESPONSE INTERFACES
// ================================================================

/**
 * Grant Data Permission Request
 */
export interface GrantDataPermissionRequest {
  user_id: string;
  permission_key: string;
  company_id: string;
  is_granted: boolean;
  reason?: string;
  expires_at?: string;
}

/**
 * Grant Module Access Request
 */
export interface GrantModuleAccessRequest {
  user_id: string;
  module_id: string;
  company_id: string;
  granted_by: string;
  restrictions?: Record<string, any>;
  expires_at?: string;
}

/**
 * Provision Company Module Request (Super-Admin)
 */
export interface ProvisionCompanyModuleRequest {
  company_id: string;
  module_id: string;
  is_enabled: boolean;
  pricing_tier: PricingTier;
  monthly_price?: number;
  per_user_price?: number;
  users_licensed?: number;
  configuration?: Record<string, any>;
  usage_limits?: Record<string, any>;
  billing_notes?: string;
}

/**
 * Bulk Permission Update Request
 */
export interface BulkPermissionUpdateRequest {
  user_ids: string[];
  company_id: string;
  data_permissions?: {
    permission_key: string;
    is_granted: boolean;
  }[];
  modules?: {
    module_id: string;
    is_enabled: boolean;
  }[];
  granted_by: string;
}

// ================================================================
// UI COMPONENT INTERFACES
// ================================================================

/**
 * Data Permission Group (for UI)
 */
export interface DataPermissionGroupUI {
  group_name: PermissionGroup;
  permissions: {
    permission: DataPermission;
    has_permission: boolean;
    can_modify: boolean;
    is_dependency_met: boolean;
    required_permissions: string[];
  }[];
}

/**
 * Module Card (for UI)
 */
export interface ModuleCardUI {
  module: EnhancedModule;
  is_provisioned_to_company: boolean;
  user_has_access: boolean;
  can_toggle: boolean;
  company_pricing: {
    pricing_tier: PricingTier;
    monthly_price: number;
    per_user_price: number;
    users_licensed: number;
    monthly_cost: number;
  };
  sub_features: ModuleSubFeature[];
  included_permissions: DataPermission[];
}

/**
 * Company Module Provisioning Card (for Super-Admin)
 */
export interface CompanyModuleProvisioningCard {
  company: {
    id: string;
    name: string;
    user_count: number;
  };
  module: EnhancedModule;
  current_status: {
    is_enabled: boolean;
    pricing_tier: PricingTier;
    monthly_price: number;
    per_user_price: number;
    users_licensed: number;
    monthly_cost: number;
  };
  available_tiers: {
    tier: PricingTier;
    monthly_price: number;
    per_user_price: number;
    description: string;
  }[];
}

// ================================================================
// PREDEFINED PERMISSION KEYS (UPDATED)
// ================================================================

/**
 * Foundation Data Permissions (No Cost)
 */
export const DATA_PERMISSIONS = {
  // Company Configuration
  COMPANY_SETTINGS_VIEW: 'company.settings.view',
  COMPANY_SETTINGS_EDIT: 'company.settings.edit',

  // Dashboard & Analytics (Basic)
  DASHBOARD_VIEW: 'dashboard.view',
  ANALYTICS_VIEW: 'analytics.view',

  // Customer Relationship Management
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_EDIT: 'customers.edit',
  CUSTOMERS_DELETE: 'customers.delete',

  // Vendor Management (Basic)
  VENDORS_VIEW: 'vendors.view',
  VENDORS_CREATE: 'vendors.create',
  VENDORS_EDIT: 'vendors.edit',
  VENDORS_DELETE: 'vendors.delete',

  // Expense Operations (Basic)
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_EDIT: 'expenses.edit',
  EXPENSES_DELETE: 'expenses.delete',

  // GL Account Management
  GL_ACCOUNTS_VIEW: 'gl_accounts.view',
  GL_ACCOUNTS_CREATE: 'gl_accounts.create',
  GL_ACCOUNTS_EDIT: 'gl_accounts.edit',
  GL_ACCOUNTS_DELETE: 'gl_accounts.delete',

  // Expense Category Management
  EXPENSE_CATEGORIES_VIEW: 'expense_categories.view',
  EXPENSE_CATEGORIES_CREATE: 'expense_categories.create',
  EXPENSE_CATEGORIES_EDIT: 'expense_categories.edit',
  EXPENSE_CATEGORIES_DELETE: 'expense_categories.delete',

  // User Management
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',

  // Notification Management
  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
} as const;

/**
 * Premium Module Permissions (Paid Features)
 */
export const MODULE_PERMISSIONS = {
  // Expense Management Suite
  EXPENSES_APPROVE: 'expenses.approve',
  EXPENSES_REVIEW: 'expenses.review',
  EXPENSES_ASSIGN: 'expenses.assign',

  // Ingrid AI Assistant
  INGRID_VIEW: 'ingrid.view',
  INGRID_APPROVE: 'ingrid.approve',
  INGRID_CONFIGURE: 'ingrid.configure',
  INGRID_ANALYTICS: 'ingrid.analytics',

  // Advanced Analytics
  ANALYTICS_ADVANCED: 'analytics.advanced',
  ANALYTICS_EXPORT: 'analytics.export',
  ANALYTICS_CUSTOM_REPORTS: 'analytics.custom_reports',

  // Process Automation
  AUTOMATION_VIEW: 'automation.view',
  AUTOMATION_CREATE: 'automation.create',
  AUTOMATION_EDIT: 'automation.edit',
  AUTOMATION_EXECUTE: 'automation.execute',
} as const;

export const ALL_PERMISSIONS = {
  ...DATA_PERMISSIONS,
  ...MODULE_PERMISSIONS,
} as const;

export type PermissionKey = typeof ALL_PERMISSIONS[keyof typeof ALL_PERMISSIONS];

// ================================================================
// PERMISSION VALIDATION
// ================================================================

/**
 * Permission Validation Result
 */
export interface PermissionValidation {
  permission_key: string;
  is_valid: boolean;
  has_permission: boolean;
  missing_dependencies: string[];
  requires_module?: string;
  error_message?: string;
}

// ================================================================
// AUDIT LOGGING
// ================================================================

/**
 * Permission Change Audit Log
 */
export interface PermissionChangeAudit {
  id: string;
  user_id: string;
  affected_user_id: string;
  company_id: string;
  change_type: 'grant_data_permission' | 'revoke_data_permission' | 'grant_module' | 'revoke_module' | 'grant_module_permission' | 'revoke_module_permission';
  permission_key?: string;
  module_id?: string;
  old_value: boolean;
  new_value: boolean;
  reason?: string;
  performed_at: string;
  ip_address?: string;
  user_agent?: string;
}

// ================================================================
// HELPER FUNCTIONS & TYPE GUARDS
// ================================================================

export const isDataPermission = (permissionKey: string): boolean => {
  return Object.values(DATA_PERMISSIONS).includes(permissionKey as any);
};

export const isModulePermission = (permissionKey: string): boolean => {
  return Object.values(MODULE_PERMISSIONS).includes(permissionKey as any);
};

export const isCoreModule = (moduleTier: ModuleTier): boolean => {
  return moduleTier === 'core';
};

export const isPremiumModule = (moduleTier: ModuleTier): boolean => {
  return moduleTier === 'premium';
};

/**
 * Module tier display information
 */
export const MODULE_TIER_INFO: Record<ModuleTier, { label: string; description: string; color: string }> = {
  core: {
    label: 'Core',
    description: 'Essential system functionality (always included)',
    color: 'blue',
  },
  standard: {
    label: 'Standard',
    description: 'Standard tier features with basic pricing',
    color: 'green',
  },
  premium: {
    label: 'Premium',
    description: 'Advanced features with premium pricing',
    color: 'purple',
  },
};

/**
 * Permission group display information
 */
export const PERMISSION_GROUP_INFO: Record<PermissionGroup, { icon: string; description: string }> = {
  'Company Configuration': {
    icon: 'Settings',
    description: 'Company-wide settings and configuration',
  },
  'Customer Relationship Management': {
    icon: 'Users',
    description: 'Customer data and relationship management',
  },
  'Dashboard & Analytics': {
    icon: 'BarChart',
    description: 'Dashboard viewing and basic analytics',
  },
  'Expense Operations': {
    icon: 'Receipt',
    description: 'Basic expense tracking and management',
  },
  'GL Account Management': {
    icon: 'Book',
    description: 'General ledger account configuration',
  },
  'Expense Category Management': {
    icon: 'FolderTree',
    description: 'Expense category organization',
  },
  'Vendor and Supplier Management': {
    icon: 'Building',
    description: 'Vendor and supplier data management',
  },
  'User Management': {
    icon: 'UserCog',
    description: 'User administration and permissions',
  },
  'Notification Management': {
    icon: 'Bell',
    description: 'System and user notifications',
  },
  'General': {
    icon: 'Star',
    description: 'General system permissions',
  },
};

// ================================================================
// DEFAULT CONFIGURATIONS
// ================================================================

/**
 * Default role permissions (data permissions only)
 */
export const DEFAULT_ROLE_DATA_PERMISSIONS: Record<UserRole, string[]> = {
  'user': [
    DATA_PERMISSIONS.DASHBOARD_VIEW,
    DATA_PERMISSIONS.ANALYTICS_VIEW,
    DATA_PERMISSIONS.EXPENSES_VIEW,
    DATA_PERMISSIONS.EXPENSES_CREATE,
    DATA_PERMISSIONS.NOTIFICATIONS_VIEW,
  ],
  'admin': [
    ...Object.values(DATA_PERMISSIONS),
  ],
  'super-admin': [
    ...Object.values(DATA_PERMISSIONS),
    ...Object.values(MODULE_PERMISSIONS),
  ],
};

/**
 * Module pricing presets
 */
export const MODULE_PRICING_PRESETS = {
  // Core modules (free)
  CORE: {
    monthly_price: 0,
    per_user_price: 0,
  },
  // Standard tier
  STANDARD: {
    monthly_price: 9.99,
    per_user_price: 2.50,
  },
  // Premium tier
  PREMIUM: {
    monthly_price: 29.99,
    per_user_price: 5.99,
  },
  // Enterprise tier
  ENTERPRISE: {
    monthly_price: 99.99,
    per_user_price: 9.99,
  },
};

export default {
  DATA_PERMISSIONS,
  MODULE_PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_TEMPLATES,
  MODULE_TIER_INFO,
  PERMISSION_GROUP_INFO,
  DEFAULT_ROLE_DATA_PERMISSIONS,
  MODULE_PRICING_PRESETS,
};
