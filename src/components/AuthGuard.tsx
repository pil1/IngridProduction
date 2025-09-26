"use client";

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { usePermissions } from '@/contexts/PermissionProvider';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AuthGuardProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredModule?: string;
  requiredRole?: 'user' | 'admin' | 'super-admin';
  fallback?: ReactNode;
}

export default function AuthGuard({
  children,
  requiredPermission,
  requiredModule,
  requiredRole,
  fallback
}: AuthGuardProps) {
  const { user, profile, isLoading: isSessionLoading } = useSession();
  const { permissions, isLoading: isPermissionsLoading } = usePermissions();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isSessionLoading || isPermissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Super admins bypass all profile and company requirements
  if (profile && profile.role === 'super-admin') {
    // Super admins can operate without companies and with minimal profile data
    // They have universal access to everything
  } else {
    // Show profile completion if needed (for non-super-admins)
    if (user && (!profile || !profile.full_name)) {
      return <Navigate to="/auth/complete-profile" replace />;
    }

    // Regular users need a company
    if (profile && !profile.company_id) {
      return <Navigate to="/auth/complete-profile" replace />;
    }
  }

  // Check permissions if specified
  if (permissions) {
    // Check role requirement
    if (requiredRole) {
      const hasRole = (() => {
        switch (requiredRole) {
          case 'super-admin':
            return permissions.isSuperAdmin();
          case 'admin':
            return permissions.isAdmin();
          case 'user':
            return true; // All roles include user permissions
          default:
            return false;
        }
      })();

      if (!hasRole) {
        return fallback || (
          <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-red-600" />
                </div>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                  You don't have the required role ({requiredRole}) to access this page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => window.history.back()}
                  className="w-full"
                  variant="outline"
                >
                  Go Back
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      }
    }

    // Check permission requirement
    if (requiredPermission && !permissions.canAccess(requiredPermission)) {
      return fallback || (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <CardTitle>Permission Required</CardTitle>
              <CardDescription>
                You don't have the required permission to access this feature.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p><strong>Required:</strong> {requiredPermission}</p>
                <p><strong>Your Role:</strong> {permissions.role}</p>
              </div>
              <Button
                onClick={() => window.history.back()}
                className="w-full"
                variant="outline"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Check module requirement
    if (requiredModule && !permissions.hasModule(requiredModule)) {
      return fallback || (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Module Not Available</CardTitle>
              <CardDescription>
                Your company doesn't have access to this module.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p><strong>Required Module:</strong> {requiredModule}</p>
                <p>Contact your administrator to enable this module.</p>
              </div>
              <Button
                onClick={() => window.history.back()}
                className="w-full"
                variant="outline"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // If all checks pass, render children
  return <>{children}</>;
}

// Convenience wrapper components
export function AdminGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <AuthGuard requiredRole="admin" fallback={fallback}>
      {children}
    </AuthGuard>
  );
}

export function SuperAdminGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <AuthGuard requiredRole="super-admin" fallback={fallback}>
      {children}
    </AuthGuard>
  );
}

export function ModuleGuard({
  moduleId,
  children,
  fallback
}: {
  moduleId: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <AuthGuard requiredModule={moduleId} fallback={fallback}>
      {children}
    </AuthGuard>
  );
}

export function PermissionGuard({
  permission,
  children,
  fallback
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <AuthGuard requiredPermission={permission} fallback={fallback}>
      {children}
    </AuthGuard>
  );
}