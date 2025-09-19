import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

interface OptimizedMutationOptions<T, V> extends UseMutationOptions<T, Error, V> {
  // Keys to invalidate after successful mutation
  invalidateQueries?: (readonly unknown[])[];
  // Keys to update with optimistic updates
  optimisticUpdates?: {
    queryKey: readonly unknown[];
    updater: (oldData: unknown, variables: V) => unknown;
  }[];
  // Success message
  successMessage?: string;
  // Error message (or function to generate one)
  errorMessage?: string | ((error: Error) => string);
  // Whether to show toast notifications
  showToast?: boolean;
}

/**
 * Optimized mutation hook with built-in cache invalidation and notifications
 */
export function useOptimizedMutation<T = unknown, V = unknown>(
  mutationFn: (variables: V) => Promise<T>,
  options: OptimizedMutationOptions<T, V> = {}
) {
  const queryClient = useQueryClient();
  const {
    invalidateQueries = [],
    optimisticUpdates = [],
    successMessage,
    errorMessage,
    showToast = true,
    ...mutationOptions
  } = options;

  return useMutation({
    mutationFn,
    ...mutationOptions,

    // Handle optimistic updates
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await Promise.all(
        optimisticUpdates.map(({ queryKey }) =>
          queryClient.cancelQueries({ queryKey })
        )
      );

      // Snapshot previous values
      const previousData = optimisticUpdates.reduce((acc, { queryKey }) => {
        acc[queryKey.join('.')] = queryClient.getQueryData(queryKey);
        return acc;
      }, {} as Record<string, any>);

      // Apply optimistic updates
      optimisticUpdates.forEach(({ queryKey, updater }) => {
        queryClient.setQueryData(queryKey, (oldData: unknown) =>
          updater(oldData, variables)
        );
      });

      // Call user's onMutate if provided
      const userContext = await mutationOptions.onMutate?.(variables);

      return { previousData, userContext };
    },

    // Handle success
    onSuccess: (data, variables, context) => {
      // Invalidate specified queries
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Show success message
      if (showToast && successMessage) {
        toast.success(successMessage);
      }

      // Call user's onSuccess if provided
      mutationOptions.onSuccess?.(data, variables, context);
    },

    // Handle errors
    onError: (error, variables, context) => {
      // Revert optimistic updates
      if (context?.previousData) {
        optimisticUpdates.forEach(({ queryKey }) => {
          const key = queryKey.join('.');
          if (context.previousData[key] !== undefined) {
            queryClient.setQueryData(queryKey, context.previousData[key]);
          }
        });
      }

      // Show error message
      if (showToast) {
        const message = typeof errorMessage === 'function'
          ? errorMessage(error)
          : errorMessage || `Error: ${error.message}`;
        toast.error(message);
      }

      // Call user's onError if provided
      mutationOptions.onError?.(error, variables, context);
    },

    // Always called after success or error
    onSettled: (data, error, variables, context) => {
      // Refetch related queries to ensure consistency
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Call user's onSettled if provided
      mutationOptions.onSettled?.(data, error, variables, context);
    },
  });
}

/**
 * Mutation for creating new items with optimistic updates
 */
export function useCreateMutation<T, V>(
  mutationFn: (variables: V) => Promise<T>,
  listQueryKey: readonly unknown[],
  options: Omit<OptimizedMutationOptions<T, V>, 'optimisticUpdates'> = {}
) {
  return useOptimizedMutation(mutationFn, {
    ...options,
    invalidateQueries: [listQueryKey, ...(options.invalidateQueries || [])],
    optimisticUpdates: [
      {
        queryKey: listQueryKey,
        updater: (oldData: T[], variables: V) => {
          if (!oldData) return [variables as unknown as T];
          return [...oldData, variables as unknown as T];
        },
      },
    ],
  });
}

/**
 * Mutation for updating existing items with optimistic updates
 */
export function useUpdateMutation<T extends { id: string }, V extends { id: string }>(
  mutationFn: (variables: V) => Promise<T>,
  listQueryKey: readonly unknown[],
  options: Omit<OptimizedMutationOptions<T, V>, 'optimisticUpdates'> = {}
) {
  return useOptimizedMutation(mutationFn, {
    ...options,
    invalidateQueries: [listQueryKey, ...(options.invalidateQueries || [])],
    optimisticUpdates: [
      {
        queryKey: listQueryKey,
        updater: (oldData: T[], variables: V) => {
          if (!oldData) return [];
          return oldData.map((item) =>
            item.id === variables.id ? { ...item, ...variables } : item
          );
        },
      },
    ],
  });
}

/**
 * Mutation for deleting items with optimistic updates
 */
export function useDeleteMutation<T extends { id: string }, V extends { id: string }>(
  mutationFn: (variables: V) => Promise<void>,
  listQueryKey: readonly unknown[],
  options: Omit<OptimizedMutationOptions<void, V>, 'optimisticUpdates'> = {}
) {
  return useOptimizedMutation(mutationFn, {
    ...options,
    invalidateQueries: [listQueryKey, ...(options.invalidateQueries || [])],
    optimisticUpdates: [
      {
        queryKey: listQueryKey,
        updater: (oldData: T[], variables: V) => {
          if (!oldData) return [];
          return oldData.filter((item) => item.id !== variables.id);
        },
      },
    ],
  });
}

export default useOptimizedMutation;