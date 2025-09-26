"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Permission types
export interface Permission {
  id: string;
  permission_name: string;
  permission_type: string;
  resource_name: string;
  description: string;
}

export interface UserPermissions {
  role: string;
  companyId: string;
  permissions: Permission[];
  enabledModules: string[];
  canAccess: (permission: string) => boolean;
  hasModule: (moduleId: string) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

interface PermissionContextType {
  permissions: UserPermissions | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading: isSessionLoading } = useSession();

  // Fetch user permissions and modules
  const {
    data: permissions,
    isLoading,
    error,
    refetch
  } = useQuery<UserPermissions | null>({
    queryKey: ['userPermissions', user?.id, profile?.company_id, profile?.role],
    queryFn: async (): Promise<UserPermissions | null> => {
      if (!user?.id || !profile) {
        return null;
      }

      // Super admins don't need company-specific permissions
      if (profile.role === 'super-admin') {
        return {
          role: 'super-admin',
          companyId: profile.company_id || '',
          permissions: [], // Super admins have all permissions by default
          enabledModules: [], // Super admins have access to all modules
          canAccess: () => true, // Super admins can access everything
          hasModule: () => true, // Super admins have all modules
          isAdmin: () => true,
          isSuperAdmin: () => true
        };
      }

      // Regular users need a company ID
      if (!profile.company_id) {
        throw new Error('User profile missing company assignment');
      }

      // Fetch role-based permissions
      const { data: rolePermissions, error: permError } = await supabase
        .from('role_permissions')
        .select(`
          permission_id,
          permissions:permission_id (
            id,
            permission_name,
            permission_type,
            resource_name,
            description
          )
        `)
        .eq('role_name', profile.role);

      if (permError) {
        throw new Error(`Failed to fetch permissions: ${permError.message}`);
      }

      // Fetch company enabled modules
      const { data: companyModules, error: moduleError } = await supabase
        .from('company_modules')
        .select('module_id')
        .eq('company_id', profile.company_id)
        .eq('is_enabled', true);

      if (moduleError) {
        throw new Error(`Failed to fetch modules: ${moduleError.message}`);
      }

      // Extract permissions from the nested structure
      const userPermissions: Permission[] = rolePermissions
        ?.map(rp => rp.permissions)
        .filter(Boolean)
        .flat() || [];

      const enabledModules = companyModules?.map(cm => cm.module_id) || [];

      return {
        role: profile.role,
        companyId: profile.company_id,
        permissions: userPermissions,
        enabledModules,
        canAccess: (permission: string) => {
          return userPermissions.some(p =>
            p.permission_name === permission ||
            p.resource_name === permission
          );
        },
        hasModule: (moduleId: string) => {
          return enabledModules.includes(moduleId);
        },
        isAdmin: () => {
          return profile.role === 'admin' || profile.role === 'super-admin';
        },
        isSuperAdmin: () => {
          return profile.role === 'super-admin';
        }
      };
    },
    enabled: !!user?.id && !!profile && !isSessionLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    suspense: false, // Disable suspense to prevent sync errors
    retry: false, // Disable retry to prevent loops
  });

  return (
    <PermissionContext.Provider value={{
      permissions,
      isLoading,
      error,
      refetch
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextType {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

// Convenience hooks
export function useCanAccess(permission: string): boolean {
  const { permissions } = usePermissions();
  return permissions?.canAccess(permission) ?? false;
}

export function useHasModule(moduleId: string): boolean {
  const { permissions } = usePermissions();
  return permissions?.hasModule(moduleId) ?? false;
}

export function useIsAdmin(): boolean {
  const { permissions } = usePermissions();
  return permissions?.isAdmin() ?? false;
}

export function useIsSuperAdmin(): boolean {
  const { permissions } = usePermissions();
  return permissions?.isSuperAdmin() ?? false;
}