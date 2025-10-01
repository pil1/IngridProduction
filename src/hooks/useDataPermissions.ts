/**
 * useDataPermissions Hook
 * Comprehensive hook for managing foundation-level data permissions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import type {
  DataPermission,
  UserDataPermission,
  CompleteUserPermissions,
  GrantDataPermissionRequest,
  PermissionValidation,
} from '@/types/permissions-v2';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface DataPermissionsResponse {
  success: boolean;
  data: {
    permissions: DataPermission[];
    grouped: Record<string, DataPermission[]>;
  };
}

interface UserDataPermissionsResponse {
  success: boolean;
  data: {
    permissions: UserDataPermission[];
    grouped_permissions: Record<string, any[]>;
  };
}

interface CompletePermissionsResponse {
  success: boolean;
  data: {
    user_id: string;
    company_id: string;
    role: string;
    complete_permissions: CompleteUserPermissions[];
    summary: {
      total_permissions: number;
      from_data: number;
      from_modules: number;
      from_role: number;
    };
  };
}

interface GrantPermissionResponse {
  success: boolean;
  message: string;
  data?: {
    validation_result: PermissionValidation;
  };
}

/**
 * Get authorization headers with JWT token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  if (!token) throw new Error('No access token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Hook for managing data permissions
 * @param companyId - Optional company ID to filter permissions by company's provisioned modules
 */
export const useDataPermissions = (companyId?: string) => {
  const { profile } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use provided companyId or fall back to user's company
  const filterCompanyId = companyId || profile?.company_id;

  // Fetch all data permissions with grouping and company filtering
  // Shows permissions relevant to the company's provisioned modules
  const {
    data: allPermissions,
    isLoading: loadingAll,
    error: allError,
  } = useQuery({
    queryKey: ['data-permissions', 'grouped', filterCompanyId || 'all'],
    queryFn: async () => {
      // Filter by company to show only relevant permissions
      const companyFilter = filterCompanyId ? `&company_id=${filterCompanyId}` : '';
      const response = await fetch(`${API_URL}/data-permissions?grouped=true${companyFilter}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch data permissions');
      const data: DataPermissionsResponse = await response.json();
      return data.data;
    },
    enabled: !!profile?.role, // Only fetch when we know the user's role
  });

  // Fetch user's data permissions
  const getUserPermissions = (userId: string) => {
    return useQuery({
      queryKey: ['data-permissions', 'user', userId],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/data-permissions/user/${userId}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch user permissions');
        const data: UserDataPermissionsResponse = await response.json();
        return data.data;
      },
      enabled: !!userId,
    });
  };

  // Fetch user's complete permissions (data + module + role)
  const getCompletePermissions = (userId: string, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['data-permissions', 'user', userId, 'complete'],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/data-permissions/user/${userId}/complete`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch complete permissions');
        const data: CompletePermissionsResponse = await response.json();
        return data.data;
      },
      enabled: options?.enabled !== undefined ? options.enabled : !!userId,
    });
  };

  // Grant or revoke data permission
  const grantPermission = useMutation({
    mutationFn: async (request: GrantDataPermissionRequest) => {
      const response = await fetch(`${API_URL}/data-permissions/user/${request.user_id}/grant`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          permission_key: request.permission_key,
          company_id: request.company_id,
          is_granted: request.is_granted,
          reason: request.reason,
          expires_at: request.expires_at,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to grant permission');
      }
      const data: GrantPermissionResponse = await response.json();
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['data-permissions', 'user', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['data-permissions', 'user', variables.user_id, 'complete'] });
      toast({
        title: variables.is_granted ? 'Permission Granted' : 'Permission Revoked',
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Operation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk grant/revoke permissions
  const bulkGrantPermissions = useMutation({
    mutationFn: async ({
      user_id,
      company_id,
      permissions,
      reason,
    }: {
      user_id: string;
      company_id: string;
      permissions: { permission_key: string; is_granted: boolean }[];
      reason?: string;
    }) => {
      const response = await fetch(`${API_URL}/data-permissions/user/${user_id}/bulk-grant`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          company_id,
          permissions,
          reason,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to bulk grant permissions');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['data-permissions', 'user', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['data-permissions', 'user', variables.user_id, 'complete'] });
      toast({
        title: 'Permissions Updated',
        description: `Successfully updated ${variables.permissions.length} permission${variables.permissions.length > 1 ? 's' : ''}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk Operation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Check if user has specific permission
  const checkPermission = async (userId: string, permissionKey: string) => {
    const response = await fetch(`${API_URL}/data-permissions/user/${userId}/check/${permissionKey}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to check permission');
    const data = await response.json();
    return data.data.has_permission as boolean;
  };

  // Get permission dependencies
  const getPermissionDependencies = (permissionKey: string) => {
    return useQuery({
      queryKey: ['data-permissions', 'dependencies', permissionKey],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/data-permissions/${permissionKey}/dependencies`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch dependencies');
        const data = await response.json();
        return data.data;
      },
      enabled: !!permissionKey,
    });
  };

  // Get audit log
  const getAuditLog = (filters?: {
    user_id?: string;
    affected_user_id?: string;
    company_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    return useQuery({
      queryKey: ['data-permissions', 'audit', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (filters?.user_id) params.append('user_id', filters.user_id);
        if (filters?.affected_user_id) params.append('affected_user_id', filters.affected_user_id);
        if (filters?.company_id) params.append('company_id', filters.company_id);
        if (filters?.limit) params.append('limit', filters.limit.toString());
        if (filters?.offset) params.append('offset', filters.offset.toString());

        const response = await fetch(`${API_URL}/data-permissions/audit?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch audit log');
        const data = await response.json();
        return data.data;
      },
    });
  };

  return {
    // Query results
    allPermissions,
    loadingAll,
    allError,

    // Query functions
    getUserPermissions,
    getCompletePermissions,
    getPermissionDependencies,
    getAuditLog,

    // Mutations
    grantPermission,
    bulkGrantPermissions,

    // Helper functions
    checkPermission,
  };
};

export default useDataPermissions;
