/**
 * Permission Protected Component
 *
 * Higher-order component that wraps existing components with graceful permission handling.
 * Prevents components from breaking when permissions are revoked.
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';

interface PermissionConfig {
  required: string[];
  optional?: string[];
  module?: string;
  fallbackMode?: 'hide' | 'disable' | 'readonly' | 'graceful';
  showPermissionInfo?: boolean;
}

interface PermissionProtectedProps {
  config: PermissionConfig;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onPermissionDenied?: (missingPermissions: string[]) => void;
}

export const PermissionProtectedComponent: React.FC<PermissionProtectedProps> = ({
  config,
  children,
  fallback,
  onPermissionDenied,
}) => {
  const { hasPermission, hasModuleAccess, getSafeActions, isReady } = usePermissionGuard({
    showNotifications: false,
  });

  const [permissionStatus, setPermissionStatus] = useState<{
    canAccess: boolean;
    missingPermissions: string[];
    safeActions: ReturnType<typeof getSafeActions>;
    moduleAccess?: ReturnType<typeof hasModuleAccess>;
  }>({
    canAccess: false,
    missingPermissions: [],
    safeActions: {
      allowedActions: [],
      disabledActions: [],
      hiddenActions: [],
      readonlyMode: true,
    },
  });

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!isReady) return;

    // Check module access first
    let moduleAccess;
    if (config.module) {
      moduleAccess = hasModuleAccess(config.module);
      if (!moduleAccess.hasAccess) {
        setPermissionStatus({
          canAccess: false,
          missingPermissions: [],
          safeActions: {
            allowedActions: [],
            disabledActions: config.required,
            hiddenActions: [],
            readonlyMode: true,
          },
          moduleAccess,
        });
        onPermissionDenied?.([config.module]);
        return;
      }
    }

    // Check required permissions
    const missingPermissions: string[] = [];
    const allPermissions = [...config.required, ...(config.optional || [])];

    for (const permission of config.required) {
      const check = hasPermission(permission);
      if (!check.hasPermission) {
        missingPermissions.push(permission);
      }
    }

    const safeActions = getSafeActions(allPermissions);
    const canAccess = missingPermissions.length === 0 || config.fallbackMode === 'graceful';

    setPermissionStatus({
      canAccess,
      missingPermissions,
      safeActions,
      moduleAccess,
    });

    if (missingPermissions.length > 0) {
      onPermissionDenied?.(missingPermissions);
    }
  }, [isReady, config, hasPermission, hasModuleAccess, getSafeActions, onPermissionDenied]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-pulse">Checking permissions...</div>
      </div>
    );
  }

  // Module access denied
  if (permissionStatus.moduleAccess && !permissionStatus.moduleAccess.hasAccess) {
    if (config.fallbackMode === 'hide') {
      return null;
    }

    return (
      <Card className="p-6 text-center">
        <Lock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Module Access Required</h3>
        <p className="text-gray-600 mb-4">
          {permissionStatus.moduleAccess.reason || 'You do not have access to this module.'}
        </p>
        {fallback}
      </Card>
    );
  }

  // No access to required permissions
  if (!permissionStatus.canAccess && config.fallbackMode !== 'graceful') {
    if (config.fallbackMode === 'hide') {
      return null;
    }

    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Insufficient Permissions</h3>
            <p className="text-gray-600 mb-4">
              You do not have the required permissions to access this feature.
            </p>

            {config.showPermissionInfo && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2"
                >
                  {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showDetails ? 'Hide Details' : 'Show Details'}
                </Button>

                {showDetails && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-900 mb-2">Missing Permissions:</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {permissionStatus.missingPermissions.map((permission) => (
                        <li key={permission} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                          {permission.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {fallback && (
              <div className="mt-4">
                {fallback}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Graceful mode - render with limited functionality
  if (config.fallbackMode === 'graceful' && permissionStatus.missingPermissions.length > 0) {
    return (
      <div className="space-y-4">
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Some features may be limited due to permission restrictions.
            {config.showPermissionInfo && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="ml-2 h-auto p-0 text-amber-800 underline"
              >
                View details
              </Button>
            )}
          </AlertDescription>
        </Alert>

        {showDetails && (
          <Card className="p-4 bg-amber-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-green-700 mb-2">Available Actions:</h4>
                <ul className="space-y-1">
                  {permissionStatus.safeActions.allowedActions.map((action) => (
                    <li key={action} className="flex items-center gap-2 text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      {action.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-amber-700 mb-2">Disabled Actions:</h4>
                <ul className="space-y-1">
                  {permissionStatus.safeActions.disabledActions.map((action) => (
                    <li key={action} className="flex items-center gap-2 text-amber-600">
                      <div className="w-2 h-2 bg-amber-500 rounded-full" />
                      {action.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-red-700 mb-2">Hidden Actions:</h4>
                <ul className="space-y-1">
                  {permissionStatus.safeActions.hiddenActions.map((action) => (
                    <li key={action} className="flex items-center gap-2 text-red-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      {action.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        <div className={permissionStatus.safeActions.readonlyMode ? 'pointer-events-none opacity-75' : ''}>
          {children}
        </div>
      </div>
    );
  }

  // Full access - render normally
  return <>{children}</>;
};

/**
 * Higher-order component factory for creating permission-protected components
 */
export function withPermissionProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config: PermissionConfig
) {
  return function PermissionProtectedWrapper(props: P) {
    return (
      <PermissionProtectedComponent config={config}>
        <WrappedComponent {...props} />
      </PermissionProtectedComponent>
    );
  };
}

/**
 * Hook for protecting individual UI elements
 */
export function usePermissionProtectedElement(
  permissionKey: string,
  mode: 'hide' | 'disable' | 'readonly' = 'disable'
) {
  const { hasPermission } = usePermissionGuard();

  return {
    protect: (element: React.ReactElement) => {
      const check = hasPermission(permissionKey);

      if (!check.hasPermission) {
        if (mode === 'hide') {
          return null;
        }

        if (mode === 'disable') {
          return React.cloneElement(element, {
            disabled: true,
            title: check.reason || 'Permission required',
          });
        }

        if (mode === 'readonly') {
          return (
            <div className="relative">
              {element}
              <div
                className="absolute inset-0 bg-gray-100/50 cursor-not-allowed rounded"
                title={check.reason || 'Read-only mode'}
              />
            </div>
          );
        }
      }

      return element;
    },
    hasPermission: check.hasPermission,
    reason: check.reason,
  };
}