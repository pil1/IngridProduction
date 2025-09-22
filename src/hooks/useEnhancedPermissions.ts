// Enhanced Permissions Hooks
// React hooks for the new granular permissions system

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/SessionContextProvider";
import { PermissionsService } from "@/services/permissionsService";
import {
  PermissionKey,
  UserModuleAccess,
  PermissionCheck,
  UserPermissionSummary,
  SystemModule,
  Permission,
  UserPermission,
  CompanyModule,
  GrantPermissionRequest,
  UpdateUserModuleRequest,
  EnableCompanyModuleRequest,
  PermissionCheckOptions,
  ModuleAccessOptions,
  UserRole,
  ModuleType,
  ALL_PERMISSIONS,
} from "@/types/permissions";

// ================================================================
// PERMISSION CHECKING HOOKS
// ================================================================

export const usePermission = (
  permissionKey: PermissionKey,
  options: PermissionCheckOptions = {}
) => {
  const { profile } = useSession();

  return useQuery({
    queryKey: ["permission", profile?.user_id, permissionKey, options.company_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      return PermissionsService.checkUserPermission(
        profile.user_id,
        permissionKey,
        { ...options, company_id: options.company_id || profile.company_id }
      );
    },
    enabled: !!profile?.user_id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};

export const useMultiplePermissions = (
  permissionKeys: PermissionKey[],
  options: PermissionCheckOptions = {}
) => {
  const { profile } = useSession();

  return useQuery({
    queryKey: ["permissions", profile?.user_id, permissionKeys, options.company_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      return PermissionsService.checkMultiplePermissions(
        profile.user_id,
        permissionKeys,
        { ...options, company_id: options.company_id || profile.company_id }
      );
    },
    enabled: !!profile?.user_id && permissionKeys.length > 0,
    staleTime: 1000 * 60 * 5,
  });
};

export const useHasPermission = (
  permissionKey: PermissionKey,
  options: PermissionCheckOptions = {}
): boolean => {
  const { data } = usePermission(permissionKey, options);
  return data?.has_permission || false;
};

export const useHasAnyPermission = (
  permissionKeys: PermissionKey[],
  options: PermissionCheckOptions = {}
): boolean => {
  const { data } = useMultiplePermissions(permissionKeys, options);
  return data?.some(check => check.has_permission) || false;
};

export const useHasAllPermissions = (
  permissionKeys: PermissionKey[],
  options: PermissionCheckOptions = {}
): boolean => {
  const { data } = useMultiplePermissions(permissionKeys, options);
  return data?.every(check => check.has_permission) || false;
};

// ================================================================
// MODULE ACCESS HOOKS
// ================================================================

export const useUserModules = (options: ModuleAccessOptions = {}) => {
  const { profile } = useSession();

  return useQuery({
    queryKey: ["userModules", profile?.user_id, options],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      return PermissionsService.getUserModules(profile.user_id, options);
    },
    enabled: !!profile?.user_id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useHasModuleAccess = (moduleName: string): boolean => {
  const { data: modules } = useUserModules();
  return modules?.some(
    module => module.module_name === moduleName && module.has_access && module.is_enabled
  ) || false;
};

export const useCompanyModuleAccess = (moduleName: string) => {
  const { profile } = useSession();

  return useQuery({
    queryKey: ["companyModuleAccess", profile?.company_id, moduleName],
    queryFn: async () => {
      if (!profile?.company_id) return false;
      return PermissionsService.checkCompanyModuleAccess(
        profile.company_id,
        moduleName
      );
    },
    enabled: !!profile?.company_id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useUserPermissionSummary = (userId?: string) => {
  const { profile } = useSession();
  const targetUserId = userId || profile?.user_id;

  return useQuery({
    queryKey: ["userPermissionSummary", targetUserId, profile?.company_id],
    queryFn: async () => {
      if (!targetUserId) return null;
      return PermissionsService.getUserPermissionSummary(
        targetUserId,
        profile?.company_id
      );
    },
    enabled: !!targetUserId,
    staleTime: 1000 * 60 * 5,
  });
};

// ================================================================
// SYSTEM MODULE HOOKS
// ================================================================

export const useSystemModules = () => {
  return useQuery({
    queryKey: ["systemModules"],
    queryFn: () => PermissionsService.getAllSystemModules(),
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
};

export const useSystemModulesByType = (type: ModuleType) => {
  return useQuery({
    queryKey: ["systemModules", type],
    queryFn: () => PermissionsService.getSystemModulesByType(type),
    staleTime: 1000 * 60 * 10,
  });
};

export const useCoreModules = () => {
  return useSystemModulesByType('core');
};

export const useAddOnModules = () => {
  return useSystemModulesByType('add-on');
};

// ================================================================
// COMPANY MODULE HOOKS
// ================================================================

export const useCompanyModules = (companyId?: string) => {
  const { profile } = useSession();
  const targetCompanyId = companyId || profile?.company_id;

  return useQuery({
    queryKey: ["companyModules", targetCompanyId],
    queryFn: async () => {
      if (!targetCompanyId) return [];
      return PermissionsService.getCompanyModules(targetCompanyId);
    },
    enabled: !!targetCompanyId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useEnabledCompanyModules = (companyId?: string) => {
  const { profile } = useSession();
  const targetCompanyId = companyId || profile?.company_id;

  return useQuery({
    queryKey: ["enabledCompanyModules", targetCompanyId],
    queryFn: async () => {
      if (!targetCompanyId) return [];
      return PermissionsService.getEnabledCompanyModules(targetCompanyId);
    },
    enabled: !!targetCompanyId,
    staleTime: 1000 * 60 * 5,
  });
};

// ================================================================
// PERMISSION MANAGEMENT MUTATIONS
// ================================================================

export const useGrantPermission = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  return useMutation({
    mutationFn: async (request: GrantPermissionRequest) => {
      if (!profile?.user_id) throw new Error("Not authenticated");
      return PermissionsService.grantUserPermission(request, profile.user_id);
    },
    onSuccess: (_, request) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["permission", request.user_id]
      });
      queryClient.invalidateQueries({
        queryKey: ["permissions", request.user_id]
      });
      queryClient.invalidateQueries({
        queryKey: ["userPermissionSummary", request.user_id]
      });
    },
  });
};

export const useUpdateUserModule = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  return useMutation({
    mutationFn: async (request: UpdateUserModuleRequest) => {
      if (!profile?.user_id) throw new Error("Not authenticated");
      return PermissionsService.updateUserModule(request, profile.user_id);
    },
    onSuccess: (_, request) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["userModules", request.user_id]
      });
      queryClient.invalidateQueries({
        queryKey: ["userPermissionSummary", request.user_id]
      });
    },
  });
};

export const useEnableCompanyModule = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  return useMutation({
    mutationFn: async (request: EnableCompanyModuleRequest) => {
      if (!profile?.user_id) throw new Error("Not authenticated");
      return PermissionsService.enableCompanyModule(request, profile.user_id);
    },
    onSuccess: (_, request) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["companyModules", request.company_id]
      });
      queryClient.invalidateQueries({
        queryKey: ["enabledCompanyModules", request.company_id]
      });
      queryClient.invalidateQueries({
        queryKey: ["companyModuleAccess", request.company_id]
      });
    },
  });
};

// ================================================================
// CONVENIENCE HOOKS FOR COMMON PERMISSION CHECKS
// ================================================================

export const useCanManageUsers = (): boolean => {
  return useHasAnyPermission([
    ALL_PERMISSIONS.USERS_VIEW,
    ALL_PERMISSIONS.USERS_CREATE,
    ALL_PERMISSIONS.USERS_EDIT,
  ]);
};

export const useCanManageVendors = (): boolean => {
  return useHasAnyPermission([
    ALL_PERMISSIONS.VENDORS_CREATE,
    ALL_PERMISSIONS.VENDORS_EDIT,
    ALL_PERMISSIONS.VENDORS_DELETE,
  ]);
};

export const useCanManageExpenses = (): boolean => {
  return useHasAnyPermission([
    ALL_PERMISSIONS.EXPENSES_CREATE,
    ALL_PERMISSIONS.EXPENSES_EDIT,
    ALL_PERMISSIONS.EXPENSES_APPROVE,
  ]);
};

export const useCanAccessIngrid = (): boolean => {
  const hasModuleAccess = useHasModuleAccess('Ingrid AI');
  const hasPermission = useHasAnyPermission([
    ALL_PERMISSIONS.INGRID_VIEW,
    ALL_PERMISSIONS.INGRID_APPROVE,
  ]);
  return hasModuleAccess && hasPermission;
};

export const useCanAccessExpenseManagement = (): boolean => {
  const hasModuleAccess = useHasModuleAccess('Expense Management');
  const hasPermission = useHasAnyPermission([
    ALL_PERMISSIONS.EXPENSES_VIEW,
    ALL_PERMISSIONS.EXPENSES_CREATE,
  ]);
  return hasModuleAccess && hasPermission;
};

// ================================================================
// ROLE-BASED PERMISSION HOOKS
// ================================================================

export const useIsAdmin = (): boolean => {
  const { profile } = useSession();
  return PermissionsService.isCompanyAdmin(profile?.role as UserRole);
};

export const useIsSuperAdmin = (): boolean => {
  const { profile } = useSession();
  return PermissionsService.isSystemAdmin(profile?.role as UserRole);
};

export const useCanManageCompanyModules = (): boolean => {
  const { profile } = useSession();
  return PermissionsService.canManageCompanyModules(profile?.role as UserRole);
};

export const useCanManageUserPermissions = (): boolean => {
  const { profile } = useSession();
  return PermissionsService.canManageUserPermissions(profile?.role as UserRole);
};

// ================================================================
// UTILITY HOOKS
// ================================================================

export const useRefreshPermissions = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  return () => {
    if (profile?.user_id) {
      // Invalidate all permission-related queries for the current user
      queryClient.invalidateQueries({
        queryKey: ["permission", profile.user_id]
      });
      queryClient.invalidateQueries({
        queryKey: ["permissions", profile.user_id]
      });
      queryClient.invalidateQueries({
        queryKey: ["userModules", profile.user_id]
      });
      queryClient.invalidateQueries({
        queryKey: ["userPermissionSummary", profile.user_id]
      });
    }
  };
};

// Hook to get user's effective permissions (combining role and individual permissions)
export const useEffectivePermissions = () => {
  const { profile } = useSession();
  const { data: allPermissions } = useMultiplePermissions(
    Object.values(ALL_PERMISSIONS),
    { company_id: profile?.company_id }
  );

  return {
    permissions: allPermissions || [],
    hasPermission: (key: PermissionKey) =>
      allPermissions?.find(p => p.permission_key === key)?.has_permission || false,
    loading: !allPermissions,
  };
};