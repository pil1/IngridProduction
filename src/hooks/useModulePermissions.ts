/**
 * useModulePermissions Hook
 * Comprehensive hook for managing premium module permissions and provisioning
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import type {
  EnhancedModule,
  ModuleTier,
  ProvisionCompanyModuleRequest,
  GrantModuleAccessRequest,
} from '@/types/permissions-v2';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ModulesResponse {
  success: boolean;
  data: {
    modules: EnhancedModule[];
    total_count: number;
    by_tier: Record<ModuleTier, number>;
  };
}

interface UserModulesResponse {
  success: boolean;
  data: {
    modules: Array<{
      module: EnhancedModule;
      company_provisioned: boolean;
      user_has_access: boolean;
      pricing: {
        pricing_tier: string;
        monthly_price: number;
        per_user_price: number;
        users_licensed: number;
        monthly_cost: number;
      };
    }>;
  };
}

interface CompanyCostsResponse {
  success: boolean;
  data: {
    modules: Array<{
      module_name: string;
      pricing_tier: string;
      monthly_price: number;
      per_user_price: number;
      users_licensed: number;
      actual_users: number;
      licensed_monthly_cost: number;
      actual_monthly_cost: number;
    }>;
    summary: {
      total_licensed_cost: number;
      total_actual_cost: number;
      cost_difference: number;
    };
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
 * Hook for managing module permissions
 */
export const useModulePermissions = () => {
  const { profile } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all enhanced modules
  const {
    data: allModules,
    isLoading: loadingModules,
    error: modulesError,
  } = useQuery({
    queryKey: ['module-permissions', 'modules'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/module-permissions/modules`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch modules');
      const data: ModulesResponse = await response.json();
      return data.data;
    },
  });

  // Fetch modules filtered by tier
  const getModulesByTier = (tier: ModuleTier) => {
    return useQuery({
      queryKey: ['module-permissions', 'modules', 'tier', tier],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/module-permissions/modules?tier=${tier}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch modules by tier');
        const data: ModulesResponse = await response.json();
        return data.data;
      },
      enabled: !!tier,
    });
  };

  // Fetch user's available modules
  const getUserModules = (userId: string) => {
    return useQuery({
      queryKey: ['module-permissions', 'user', userId, 'available'],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/module-permissions/user/${userId}/available`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch user modules');
        const data: UserModulesResponse = await response.json();
        return data.data;
      },
      enabled: !!userId,
    });
  };

  // Fetch company module costs
  const getCompanyCosts = (companyId: string) => {
    return useQuery({
      queryKey: ['module-permissions', 'company', companyId, 'costs'],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/module-permissions/company/${companyId}/costs`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch company costs');
        const data: CompanyCostsResponse = await response.json();
        return data.data;
      },
      enabled: !!companyId,
    });
  };

  // Provision module to company (super-admin only)
  const provisionModule = useMutation({
    mutationFn: async (request: ProvisionCompanyModuleRequest) => {
      const response = await fetch(`${API_URL}/module-permissions/company/${request.company_id}/provision`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          module_id: request.module_id,
          is_enabled: request.is_enabled,
          pricing_tier: request.pricing_tier,
          monthly_price: request.monthly_price,
          per_user_price: request.per_user_price,
          users_licensed: request.users_licensed,
          configuration: request.configuration,
          usage_limits: request.usage_limits,
          billing_notes: request.billing_notes,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to provision module');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-permissions', 'company', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['module-permissions', 'company', variables.company_id, 'costs'] });
      toast({
        title: variables.is_enabled ? 'Module Provisioned' : 'Module Removed',
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Provisioning Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Grant module to user
  const grantModule = useMutation({
    mutationFn: async (request: GrantModuleAccessRequest) => {
      const response = await fetch(`${API_URL}/module-permissions/user/${request.user_id}/grant-module`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          module_id: request.module_id,
          company_id: request.company_id,
          restrictions: request.restrictions,
          expires_at: request.expires_at,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to grant module');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-permissions', 'user', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['data-permissions', 'user', variables.user_id, 'complete'] });
      toast({
        title: 'Module Granted',
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Grant Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Revoke module from user
  const revokeModule = useMutation({
    mutationFn: async ({
      user_id,
      module_id,
      company_id,
    }: {
      user_id: string;
      module_id: string;
      company_id: string;
    }) => {
      const response = await fetch(`${API_URL}/module-permissions/user/${user_id}/revoke-module`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          module_id,
          company_id,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to revoke module');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-permissions', 'user', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['data-permissions', 'user', variables.user_id, 'complete'] });
      toast({
        title: 'Module Revoked',
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Revoke Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get user's module permissions
  const getUserModulePermissions = (userId: string, moduleId: string) => {
    return useQuery({
      queryKey: ['module-permissions', 'user', userId, 'module', moduleId],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/module-permissions/user/${userId}/module/${moduleId}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch module permissions');
        const data = await response.json();
        return data.data;
      },
      enabled: !!userId && !!moduleId,
    });
  };

  return {
    // Query results
    allModules,
    loadingModules,
    modulesError,

    // Query functions
    getModulesByTier,
    getUserModules,
    getCompanyCosts,
    getUserModulePermissions,

    // Mutations
    provisionModule,
    grantModule,
    revokeModule,
  };
};

export default useModulePermissions;
