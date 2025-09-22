// Permission Wrapper Components
// Components for conditional rendering based on permissions and module access

import React from 'react';
import {
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions,
  useHasModuleAccess,
  useCanAccessIngrid,
  useCanAccessExpenseManagement,
  useIsAdmin,
  useIsSuperAdmin
} from '@/hooks/useEnhancedPermissions';
import { PermissionKey, PermissionCheckOptions } from '@/types/permissions';

// ================================================================
// BASE PERMISSION WRAPPER
// ================================================================

interface PermissionWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

interface HasPermissionProps extends PermissionWrapperProps {
  permission: PermissionKey;
  options?: PermissionCheckOptions;
}

export const HasPermission: React.FC<HasPermissionProps> = ({
  permission,
  options,
  children,
  fallback = null,
  loading = null,
}) => {
  const hasPermission = useHasPermission(permission, options);

  if (loading && hasPermission === undefined) {
    return <>{loading}</>;
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

// ================================================================
// MULTIPLE PERMISSION WRAPPERS
// ================================================================

interface HasAnyPermissionProps extends PermissionWrapperProps {
  permissions: PermissionKey[];
  options?: PermissionCheckOptions;
}

export const HasAnyPermission: React.FC<HasAnyPermissionProps> = ({
  permissions,
  options,
  children,
  fallback = null,
  loading = null,
}) => {
  const hasAnyPermission = useHasAnyPermission(permissions, options);

  if (loading && hasAnyPermission === undefined) {
    return <>{loading}</>;
  }

  return hasAnyPermission ? <>{children}</> : <>{fallback}</>;
};

interface HasAllPermissionsProps extends PermissionWrapperProps {
  permissions: PermissionKey[];
  options?: PermissionCheckOptions;
}

export const HasAllPermissions: React.FC<HasAllPermissionsProps> = ({
  permissions,
  options,
  children,
  fallback = null,
  loading = null,
}) => {
  const hasAllPermissions = useHasAllPermissions(permissions, options);

  if (loading && hasAllPermissions === undefined) {
    return <>{loading}</>;
  }

  return hasAllPermissions ? <>{children}</> : <>{fallback}</>;
};

// ================================================================
// MODULE ACCESS WRAPPERS
// ================================================================

interface HasModuleAccessProps extends PermissionWrapperProps {
  moduleName: string;
}

export const HasModuleAccess: React.FC<HasModuleAccessProps> = ({
  moduleName,
  children,
  fallback = null,
  loading = null,
}) => {
  const hasAccess = useHasModuleAccess(moduleName);

  if (loading && hasAccess === undefined) {
    return <>{loading}</>;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

// ================================================================
// ROLE-BASED WRAPPERS
// ================================================================

export const AdminOnly: React.FC<PermissionWrapperProps> = ({
  children,
  fallback = null,
  loading = null,
}) => {
  const isAdmin = useIsAdmin();

  if (loading && isAdmin === undefined) {
    return <>{loading}</>;
  }

  return isAdmin ? <>{children}</> : <>{fallback}</>;
};

export const SuperAdminOnly: React.FC<PermissionWrapperProps> = ({
  children,
  fallback = null,
  loading = null,
}) => {
  const isSuperAdmin = useIsSuperAdmin();

  if (loading && isSuperAdmin === undefined) {
    return <>{loading}</>;
  }

  return isSuperAdmin ? <>{children}</> : <>{fallback}</>;
};

// ================================================================
// FEATURE-SPECIFIC WRAPPERS
// ================================================================

export const IngridFeature: React.FC<PermissionWrapperProps> = ({
  children,
  fallback = null,
  loading = null,
}) => {
  const canAccess = useCanAccessIngrid();

  if (loading && canAccess === undefined) {
    return <>{loading}</>;
  }

  return canAccess ? <>{children}</> : <>{fallback}</>;
};

export const ExpenseManagementFeature: React.FC<PermissionWrapperProps> = ({
  children,
  fallback = null,
  loading = null,
}) => {
  const canAccess = useCanAccessExpenseManagement();

  if (loading && canAccess === undefined) {
    return <>{loading}</>;
  }

  return canAccess ? <>{children}</> : <>{fallback}</>;
};

// ================================================================
// CONDITIONAL FEATURE RENDERER
// ================================================================

interface ConditionalFeatureProps {
  condition: boolean | (() => boolean);
  children: React.ReactNode;
  fallback?: React.ReactNode;
  whenTrue?: React.ReactNode;
  whenFalse?: React.ReactNode;
}

export const ConditionalFeature: React.FC<ConditionalFeatureProps> = ({
  condition,
  children,
  fallback = null,
  whenTrue,
  whenFalse,
}) => {
  const isConditionMet = typeof condition === 'function' ? condition() : condition;

  if (whenTrue && whenFalse) {
    return isConditionMet ? <>{whenTrue}</> : <>{whenFalse}</>;
  }

  if (whenTrue) {
    return isConditionMet ? <>{whenTrue}</> : <>{fallback}</>;
  }

  return isConditionMet ? <>{children}</> : <>{fallback}</>;
};

// ================================================================
// PERMISSION GATE (FOR NAVIGATION/ROUTING)
// ================================================================

interface PermissionGateProps extends PermissionWrapperProps {
  permissions?: PermissionKey[];
  modules?: string[];
  requireAll?: boolean;
  redirectTo?: string;
  unauthorizedMessage?: string;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permissions = [],
  modules = [],
  requireAll = false,
  children,
  fallback,
  unauthorizedMessage = "You don't have permission to access this feature.",
  redirectTo,
}) => {
  // Check permissions
  const hasPermissions = requireAll
    ? useHasAllPermissions(permissions)
    : useHasAnyPermission(permissions);

  // Check module access
  const moduleChecks = modules.map(module => useHasModuleAccess(module));
  const hasModuleAccess = requireAll
    ? moduleChecks.every(check => check)
    : moduleChecks.some(check => check);

  // Determine if access is granted
  const hasAccess =
    (permissions.length === 0 || hasPermissions) &&
    (modules.length === 0 || hasModuleAccess);

  if (!hasAccess) {
    if (redirectTo) {
      // In a real app, you'd use your router here
      console.warn(`Access denied. Should redirect to: ${redirectTo}`);
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[200px] p-8">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Access Denied</div>
          <div className="text-gray-600">{unauthorizedMessage}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ================================================================
// UTILITY COMPONENTS
// ================================================================

interface FeatureToggleProps {
  featureName: string;
  enabled?: boolean;
  children: React.ReactNode;
  disabledMessage?: string;
}

export const FeatureToggle: React.FC<FeatureToggleProps> = ({
  featureName,
  enabled = true,
  children,
  disabledMessage = `The ${featureName} feature is currently disabled.`,
}) => {
  if (!enabled) {
    return (
      <div className="p-4 bg-gray-100 border border-gray-300 rounded">
        <div className="text-gray-600">{disabledMessage}</div>
      </div>
    );
  }

  return <>{children}</>;
};

// ================================================================
// PERMISSION CONTEXT PROVIDER
// ================================================================

interface PermissionProviderProps {
  children: React.ReactNode;
  fallbackComponent?: React.ComponentType<{ message: string }>;
  loadingComponent?: React.ComponentType;
}

const DefaultFallback: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-red-500 text-sm">{message}</div>
);

const DefaultLoading: React.FC = () => (
  <div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div>
);

export const PermissionProvider: React.FC<PermissionProviderProps> = ({
  children,
  fallbackComponent: FallbackComponent = DefaultFallback,
  loadingComponent: LoadingComponent = DefaultLoading,
}) => {
  return (
    <div className="permission-provider">
      {children}
    </div>
  );
};