/**
 * Permissions Hook
 *
 * React hook for checking user permissions and accessing security context.
 * Provides easy permission checking throughout the application.
 */

import { useMemo } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { PermissionService, UserPermissions, SecurityContext } from '@/services/permissions/PermissionService';

export interface UsePermissionsReturn {
  permissions: UserPermissions;
  securityContext: SecurityContext | null;
  hasPermission: (action: keyof UserPermissions) => boolean;
  canAccessGLData: boolean;
  canAccessFinancialData: boolean;
  canConfigureIngrid: boolean;
  canManageUsers: boolean;
  canViewSecurityLogs: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  filterSensitiveData: <T extends Record<string, any>>(data: T, sensitiveFields?: string[]) => Partial<T>;
}

export function usePermissions(): UsePermissionsReturn {
  const { profile, impersonatedProfile, session } = useSession();

  // Use impersonated profile if available, otherwise use actual profile
  const activeProfile = impersonatedProfile || profile;

  const { permissions, securityContext } = useMemo(() => {
    if (!activeProfile || !session) {
      return {
        permissions: PermissionService.getUserPermissions('user', null),
        securityContext: null
      };
    }

    const context = PermissionService.createSecurityContext(
      activeProfile,
      session.access_token,
      impersonatedProfile
    );

    const perms = PermissionService.getUserPermissions(
      activeProfile.role,
      activeProfile.company_id
    );

    return {
      permissions: perms,
      securityContext: context
    };
  }, [activeProfile, session, impersonatedProfile]);

  const hasPermission = (action: keyof UserPermissions): boolean => {
    return permissions[action];
  };

  const filterSensitiveData = <T extends Record<string, any>>(
    data: T,
    sensitiveFields?: string[]
  ): Partial<T> => {
    if (!securityContext) return data;
    return PermissionService.filterSensitiveData(data, securityContext, sensitiveFields);
  };

  return {
    permissions,
    securityContext,
    hasPermission,
    canAccessGLData: permissions.canViewGLAccounts,
    canAccessFinancialData: permissions.canViewFinancialReports,
    canConfigureIngrid: permissions.canConfigureIngridAI,
    canManageUsers: permissions.canEditUsers,
    canViewSecurityLogs: permissions.canViewSecurityLogs,
    isAdmin: activeProfile?.role === 'admin',
    isSuperAdmin: activeProfile?.role === 'super-admin',
    filterSensitiveData
  };
}