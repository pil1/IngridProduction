/**
 * Permission Guard Hook
 *
 * React hook for graceful permission handling in components.
 * Automatically handles permission changes and provides safe fallbacks.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { permissionGuard, UserPermissionState } from '@/services/permissions/PermissionGuardService';
import { useToast } from '@/hooks/use-toast';

interface UsePermissionGuardOptions {
  strictMode?: boolean;
  showNotifications?: boolean;
  autoRedirect?: boolean;
}

export function usePermissionGuard(options: UsePermissionGuardOptions = {}) {
  const { profile, impersonatedProfile } = useSession();
  const { toast } = useToast();
  const [permissionState, setPermissionState] = useState<UserPermissionState | null>(null);

  const activeProfile = impersonatedProfile ?? profile;
  const userId = activeProfile?.user_id;

  // Initialize permission state when profile loads
  useEffect(() => {
    if (!activeProfile || !userId) return;

    // This would typically be loaded from your permissions API
    // For now, creating a basic state structure
    const initialState: UserPermissionState = {
      userId,
      role: activeProfile.role,
      companyId: activeProfile.company_id || '',
      permissions: {}, // Would be loaded from API
      modules: {}, // Would be loaded from API
    };

    permissionGuard.registerUserState(userId, initialState);
    setPermissionState(initialState);
  }, [activeProfile, userId]);

  // Subscribe to permission changes
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = permissionGuard.subscribe(userId, (newState) => {
      setPermissionState(newState);

      if (options.showNotifications) {
        toast({
          title: "Permissions Updated",
          description: "Your access permissions have been modified.",
        });
      }
    });

    return unsubscribe;
  }, [userId, options.showNotifications, toast]);

  /**
   * Check if user has specific permission with graceful fallback
   */
  const hasPermission = useCallback((
    permissionKey: string,
    fallback = false
  ) => {
    if (!userId) return { hasPermission: false, action: 'hide' as const };

    return permissionGuard.checkPermission(userId, permissionKey, {
      fallback,
      strictMode: options.strictMode,
    });
  }, [userId, options.strictMode]);

  /**
   * Check if user has module access with graceful fallback
   */
  const hasModuleAccess = useCallback((moduleId: string) => {
    if (!userId) return { hasAccess: false, action: 'redirect' as const, fallbackRoute: '/dashboard' };

    return permissionGuard.checkModuleAccess(userId, moduleId);
  }, [userId]);

  /**
   * Get safe actions for component based on required permissions
   */
  const getSafeActions = useCallback((requiredPermissions: string[]) => {
    if (!userId) {
      return {
        allowedActions: [],
        disabledActions: requiredPermissions,
        hiddenActions: [],
        readonlyMode: true,
      };
    }

    return permissionGuard.getSafeActions(userId, requiredPermissions);
  }, [userId]);

  /**
   * Component wrapper that handles permission checks
   */
  const PermissionWrapper: React.FC<{
    children: React.ReactNode;
    permission: string;
    fallback?: React.ReactNode;
    mode?: 'hide' | 'disable' | 'readonly';
  }> = ({ children, permission, fallback, mode }) => {
    const check = hasPermission(permission);

    if (!check.hasPermission) {
      const action = mode || check.action;

      if (action === 'hide') {
        return fallback ? <>{fallback}</> : null;
      }

      if (action === 'disable' && React.isValidElement(children)) {
        return React.cloneElement(children, {
          disabled: true,
          title: check.reason || 'Permission required',
        });
      }

      if (action === 'readonly') {
        return (
          <div className="relative">
            {children}
            <div className="absolute inset-0 bg-gray-100/50 cursor-not-allowed rounded"
                 title={check.reason || 'Read-only mode'} />
          </div>
        );
      }
    }

    return <>{children}</>;
  };

  /**
   * Module wrapper that handles module access checks
   */
  const ModuleWrapper: React.FC<{
    children: React.ReactNode;
    moduleId: string;
    fallback?: React.ReactNode;
  }> = ({ children, moduleId, fallback }) => {
    const check = hasModuleAccess(moduleId);

    if (!check.hasAccess) {
      if (check.action === 'redirect' && options.autoRedirect) {
        // In a real app, you might use router navigation here
        console.warn(`Module ${moduleId} access denied, should redirect to ${check.fallbackRoute}`);
      }

      if (check.action === 'hide') {
        return fallback ? <>{fallback}</> : (
          <div className="p-4 text-center text-gray-500">
            <p>This module is not available.</p>
            {check.reason && <p className="text-sm">{check.reason}</p>}
          </div>
        );
      }
    }

    return <>{children}</>;
  };

  return {
    permissionState,
    hasPermission,
    hasModuleAccess,
    getSafeActions,
    PermissionWrapper,
    ModuleWrapper,
    isReady: !!permissionState,
  };
}

/**
 * Simple hook for checking a single permission
 */
export function usePermissionCheck(permissionKey: string) {
  const { hasPermission } = usePermissionGuard();
  return hasPermission(permissionKey);
}

/**
 * Hook for checking multiple permissions at once
 */
export function usePermissionChecks(permissionKeys: string[]) {
  const { getSafeActions } = usePermissionGuard();
  return getSafeActions(permissionKeys);
}