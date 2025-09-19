import { useQuery, UseQueryOptions } from '@tanstack/react-query';

// Define different caching strategies for different data types
export const CACHE_STRATEGIES = {
  // User profile data - very stable
  PROFILE: {
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },

  // Financial data - moderately stable
  FINANCIAL: {
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always' as const,
  },

  // Real-time data - changes frequently
  REALTIME: {
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always' as const,
    refetchInterval: 1000 * 60, // Refetch every minute
  },

  // Static data - very stable (categories, settings)
  STATIC: {
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },

  // Lists that change moderately (users, companies)
  LIST: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: 'always' as const,
  },
} as const;

type CacheStrategy = keyof typeof CACHE_STRATEGIES;

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  strategy?: CacheStrategy;
}

/**
 * Custom hook factory for creating optimized queries with predefined caching strategies
 */
export function useOptimizedQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options: OptimizedQueryOptions<T> = {}
) {
  const { strategy = 'LIST', ...otherOptions } = options;
  const cacheStrategy = CACHE_STRATEGIES[strategy];

  return useQuery({
    queryKey,
    queryFn,
    ...cacheStrategy,
    ...otherOptions, // Allow overriding cache strategy
    retry: (failureCount, error: Error) => {
      // Custom retry logic
      if (error?.status >= 400 && error?.status < 500) {
        return false; // Don't retry client errors
      }
      if (error?.code === 'PGRST116') {
        return false; // Don't retry "no rows found"
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for queries that should be disabled when dependencies are missing
 */
export function useConditionalQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  enabled: boolean,
  options: OptimizedQueryOptions<T> = {}
) {
  return useOptimizedQuery(queryKey, queryFn, {
    ...options,
    enabled,
    placeholderData: options.placeholderData,
  });
}

/**
 * Hook for paginated queries with infinite scroll support
 */
export function usePaginatedQuery<T>(
  queryKey: readonly unknown[],
  queryFn: (page: number) => Promise<T>,
  page: number = 1,
  options: OptimizedQueryOptions<T> = {}
) {
  return useOptimizedQuery(
    [...queryKey, page],
    () => queryFn(page),
    {
      strategy: 'LIST',
      ...options,
      keepPreviousData: true, // Keep previous page data while loading new page
    }
  );
}

export default useOptimizedQuery;