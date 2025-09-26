import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  apiKeyService,
  CompanyApiKey,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeyUsageStats
} from '@/services/api/apiKeys';

const QUERY_KEYS = {
  all: ['apiKeys'] as const,
  lists: () => [...QUERY_KEYS.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...QUERY_KEYS.lists(), { filters }] as const,
  details: () => [...QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...QUERY_KEYS.details(), id] as const,
  stats: () => [...QUERY_KEYS.all, 'stats'] as const,
};

export function useApiKeys() {
  return useQuery({
    queryKey: QUERY_KEYS.lists(),
    queryFn: () => apiKeyService.getAllWithCompanies(),
    select: (response) => response.data || [],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useApiKeysByCompany(companyId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.list({ companyId }),
    queryFn: () => companyId ? apiKeyService.getByCompany(companyId) : Promise.resolve({ data: [], success: true, error: null }),
    select: (response) => response.data || [],
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useApiKeysByProvider(provider: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.list({ provider }),
    queryFn: () => provider ? apiKeyService.getByProvider(provider) : Promise.resolve({ data: [], success: true, error: null }),
    select: (response) => response.data || [],
    enabled: !!provider,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useApiKey(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.detail(id || ''),
    queryFn: () => id ? apiKeyService.getById(id) : Promise.resolve({ data: null, success: true, error: null }),
    select: (response) => response.data,
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useApiKeyStats() {
  return useQuery({
    queryKey: QUERY_KEYS.stats(),
    queryFn: () => apiKeyService.getUsageStats(),
    select: (response) => response.data,
    staleTime: 1000 * 60 * 2, // 2 minutes (stats should be more current)
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) => apiKeyService.createApiKey(data),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('API key created successfully');
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      } else {
        toast.error(`Failed to create API key: ${response.error?.message}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to create API key: ${error.message}`);
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKeyRequest }) =>
      apiKeyService.updateApiKey(id, data),
    onSuccess: (response, { id }) => {
      if (response.success) {
        toast.success('API key updated successfully');
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.detail(id) });
      } else {
        toast.error(`Failed to update API key: ${response.error?.message}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to update API key: ${error.message}`);
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiKeyService.delete(id),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('API key deleted successfully');
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      } else {
        toast.error(`Failed to delete API key: ${response.error?.message}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete API key: ${error.message}`);
    },
  });
}

export function useToggleApiKeyActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiKeyService.toggleActive(id, isActive),
    onSuccess: (response, { isActive }) => {
      if (response.success) {
        toast.success(`API key ${isActive ? 'activated' : 'deactivated'} successfully`);
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      } else {
        toast.error(`Failed to ${isActive ? 'activate' : 'deactivate'} API key: ${response.error?.message}`);
      }
    },
    onError: (error: Error, { isActive }) => {
      toast.error(`Failed to ${isActive ? 'activate' : 'deactivate'} API key: ${error.message}`);
    },
  });
}

export function useIncrementApiKeyUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount?: number }) =>
      apiKeyService.incrementUsage(id, amount),
    onSuccess: () => {
      // Silently update - no toast for usage increments
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats() });
    },
    // No error handling for usage increments - they should be silent
  });
}

export function useResetMonthlyUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiKeyService.resetMonthlyUsage(),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Monthly usage reset for all API keys');
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats() });
      } else {
        toast.error(`Failed to reset monthly usage: ${response.error?.message}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset monthly usage: ${error.message}`);
    },
  });
}