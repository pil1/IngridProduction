import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/SessionContextProvider";
import CustomRoleService from "@/services/customRoleService";
import { PermissionKey, EffectivePermission } from "@/types/permissions";

/**
 * Hook to check user permissions using the new custom role system
 */
export const usePermissions = () => {
  const { profile } = useSession();

  // Fetch user's effective permissions
  const { data: effectivePermissions, isLoading } = useQuery<EffectivePermission[]>({
    queryKey: ["userEffectivePermissions", profile?.id, profile?.company_id],
    queryFn: () => {
      if (!profile?.id || !profile?.company_id) return [];
      return CustomRoleService.getUserEffectivePermissions(profile.id, profile.company_id);
    },
    enabled: !!profile?.id && !!profile?.company_id,
  });

  const permissionMap = new Map<PermissionKey, boolean>();
  effectivePermissions?.forEach(permission => {
    permissionMap.set(permission.permission_key as PermissionKey, permission.is_granted);
  });

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permissionKey: PermissionKey): boolean => {
    // Super admins have all permissions
    if (profile?.role === 'super-admin') return true;

    return permissionMap.get(permissionKey) === true;
  };

  /**
   * Check if user has any of the provided permissions
   */
  const hasAnyPermission = (permissionKeys: PermissionKey[]): boolean => {
    if (profile?.role === 'super-admin') return true;

    return permissionKeys.some(key => hasPermission(key));
  };

  /**
   * Check if user has all of the provided permissions
   */
  const hasAllPermissions = (permissionKeys: PermissionKey[]): boolean => {
    if (profile?.role === 'super-admin') return true;

    return permissionKeys.every(key => hasPermission(key));
  };

  /**
   * Get all permissions the user has
   */
  const getUserPermissions = (): PermissionKey[] => {
    return Array.from(permissionMap.entries())
      .filter(([_, isGranted]) => isGranted)
      .map(([permission, _]) => permission);
  };

  return {
    effectivePermissions,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getUserPermissions,
  };
};

export default usePermissions;