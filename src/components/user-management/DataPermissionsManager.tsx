/**
 * DataPermissionsManager Component
 * Foundation-level data permissions management with grouped display
 *
 * Features:
 * - Grouped permission toggles by permission_group
 * - Dependency visualization
 * - Bulk operations support
 * - Real-time change tracking
 * - Permission validation
 * - MynaUI design system
 */

import * as React from 'react';
import { EnhancedDialogSection, EnhancedDialogGrid } from '@/components/myna';
import { EnhancedSwitch } from '@/components/myna/forms/enhanced-switch';
import { Shield, AlertCircleIcon, InfoIcon, CheckCircleIcon } from '@/lib/icons';
import { useDataPermissions } from '@/hooks/useDataPermissions';
import type { DataPermission, PermissionGroup } from '@/types/permissions-v2';
import { PERMISSION_GROUP_INFO } from '@/types/permissions-v2';
import { Badge } from '@/components/ui/badge';

interface DataPermissionsManagerProps {
  userId: string;
  companyId: string;
  userName?: string;
  userRole?: string;
  onPermissionsChanged?: () => void;
}

export const DataPermissionsManager: React.FC<DataPermissionsManagerProps> = ({
  userId,
  companyId,
  userName = 'User',
  userRole = 'user',
  onPermissionsChanged,
}) => {
  // Pass companyId to filter permissions by company's provisioned modules
  const {
    allPermissions,
    loadingAll,
    getUserPermissions,
    grantPermission,
    bulkGrantPermissions,
  } = useDataPermissions(companyId);

  const {
    data: userPermissionsData,
    isLoading: loadingUser,
  } = getUserPermissions(userId);

  const [pendingChanges, setPendingChanges] = React.useState<Record<string, boolean>>({});

  // Create a map of user's current permissions
  const userPermissionMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    userPermissionsData?.permissions?.forEach((up) => {
      const permission = allPermissions?.permissions?.find((p) => p.id === up.permission_id);
      if (permission) {
        map[permission.permission_key] = up.is_granted;
      }
    });
    return map;
  }, [userPermissionsData, allPermissions]);

  // Check if permission is enabled
  const isPermissionEnabled = (permissionKey: string) => {
    if (pendingChanges[permissionKey] !== undefined) {
      return pendingChanges[permissionKey];
    }
    return userPermissionMap[permissionKey] || false;
  };

  // Handle toggle change
  const handleToggle = (permissionKey: string, currentValue: boolean) => {
    const originalValue = userPermissionMap[permissionKey] || false;
    const newValue = !currentValue;

    // If new value matches original, remove from pending changes
    if (newValue === originalValue) {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[permissionKey];
        return next;
      });
    } else {
      setPendingChanges((prev) => ({
        ...prev,
        [permissionKey]: newValue,
      }));
    }
  };

  // Save all pending changes
  const handleSaveChanges = async () => {
    const changes = Object.entries(pendingChanges);
    if (changes.length === 0) return;

    await bulkGrantPermissions.mutateAsync({
      user_id: userId,
      company_id: companyId,
      permissions: changes.map(([permission_key, is_granted]) => ({
        permission_key,
        is_granted,
      })),
      reason: `Bulk permission update for ${userName}`,
    });

    setPendingChanges({});
    onPermissionsChanged?.();
  };

  // Clear pending changes
  const handleCancelChanges = () => {
    setPendingChanges({});
  };

  // Check if permission dependencies are met
  const areDependenciesMet = (permission: DataPermission): boolean => {
    if (!permission.requires_permissions || permission.requires_permissions.length === 0) {
      return true;
    }
    return permission.requires_permissions.every((reqKey) => isPermissionEnabled(reqKey));
  };

  // Group permissions by permission_group
  const groupedPermissions = React.useMemo(() => {
    if (!allPermissions?.grouped) return {};
    return allPermissions.grouped;
  }, [allPermissions]);

  const isLoading = loadingAll || loadingUser;
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const isSaving = grantPermission.isPending || bulkGrantPermissions.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-muted-foreground">Loading permissions...</p>
      </div>
    );
  }

  // Debug: Check if we have data
  const hasPermissions = allPermissions?.permissions && allPermissions.permissions.length > 0;
  const hasGroupedPermissions = Object.keys(groupedPermissions).length > 0;

  return (
    <div className="space-y-6">
      {/* Header with save/cancel buttons */}
      {hasPendingChanges && (
        <div className="sticky top-0 z-10 rounded-lg bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-600 p-4 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {Object.keys(pendingChanges).length} Unsaved Change{Object.keys(pendingChanges).length > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Save your changes or cancel to revert.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelChanges}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    Save {Object.keys(pendingChanges).length} Change{Object.keys(pendingChanges).length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grouped Permissions */}
      {Object.entries(groupedPermissions).map(([groupName, permissions]) => {
        const groupInfo = PERMISSION_GROUP_INFO[groupName as PermissionGroup];

        return (
          <EnhancedDialogSection
            key={groupName}
            title={groupName}
            description={groupInfo?.description}
          >
            <EnhancedDialogGrid columns={2}>
              {permissions.map((permission: DataPermission) => {
                const isEnabled = isPermissionEnabled(permission.permission_key);
                const isPending = pendingChanges[permission.permission_key] !== undefined;
                const dependenciesMet = areDependenciesMet(permission);
                const hasDependencies = permission.requires_permissions && permission.requires_permissions.length > 0;

                return (
                  <div
                    key={permission.id}
                    className={`rounded-lg border-2 p-4 transition-all ${
                      isPending
                        ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30'
                        : !dependenciesMet
                        ? 'border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-950/30 opacity-60'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                            {permission.permission_name}
                          </h4>
                          {permission.is_foundation_permission && (
                            <Badge variant="secondary" className="text-xs">
                              Foundation
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {permission.human_description || permission.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {permission.permission_key}
                        </p>
                      </div>
                      <EnhancedSwitch
                        checked={isEnabled}
                        onCheckedChange={() => handleToggle(permission.permission_key, isEnabled)}
                        variant={isEnabled ? 'success' : 'default'}
                        disabled={!dependenciesMet && !isEnabled}
                      />
                    </div>

                    {/* Pending change indicator */}
                    {isPending && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                        <InfoIcon className="h-3 w-3" />
                        <span>
                          Pending: Will be {pendingChanges[permission.permission_key] ? 'granted' : 'revoked'}
                        </span>
                      </div>
                    )}

                    {/* Dependencies warning */}
                    {hasDependencies && (
                      <div className={`mt-3 flex items-start gap-2 text-xs ${
                        dependenciesMet
                          ? 'text-slate-600 dark:text-slate-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {dependenciesMet ? (
                          <CheckCircleIcon className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircleIcon className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium">
                            {dependenciesMet ? 'Dependencies met' : 'Missing dependencies'}
                          </p>
                          <p className="mt-1">
                            Requires: {permission.requires_permissions.join(', ')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </EnhancedDialogGrid>
          </EnhancedDialogSection>
        );
      })}

      {/* No permissions available */}
      {!hasGroupedPermissions && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-6">
            <Shield className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <p className="font-medium text-slate-900 dark:text-slate-100">No Permissions Available</p>
            <p className="text-sm text-muted-foreground max-w-md">
              {hasPermissions
                ? "Permissions exist but couldn't be grouped. Contact system administrator."
                : "No data permissions are configured in the system yet."
              }
            </p>
          </div>
          {!hasPermissions && (
            <div className="text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900 rounded-lg p-3 max-w-md">
              <p className="font-mono">Debug: allPermissions={String(hasPermissions)}, grouped={String(hasGroupedPermissions)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataPermissionsManager;
