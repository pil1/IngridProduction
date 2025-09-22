import { useOptimizedQuery, useOptimizedMutation } from '@/hooks/useOptimizedQuery';
import { expenseService } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { toast } from '@/hooks/use-toast';
import type {
  CreateExpenseRequest,
  UpdateExpenseRequest,
  CreateCategoryRequest,
  ExpenseFilters,
  CategoryFilters,
  PaginationOptions
} from '@/services/api/types';

// Expense queries
export const useExpenses = (
  filters?: ExpenseFilters,
  pagination?: PaginationOptions
) => {
  const { profile } = useSession();
  const companyId = profile?.company_id;

  return useOptimizedQuery({
    queryKey: ['expenses', companyId, filters, pagination],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID available');
      const response = await expenseService.getExpenses(companyId, filters, pagination);
      if (!response.success) throw response.error;
      return response.data;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data || { data: [], count: 0, totalPages: 0, currentPage: 1, hasMore: false }
  });
};

export const useExpense = (id?: string) => {
  return useOptimizedQuery({
    queryKey: ['expense', id],
    queryFn: async () => {
      if (!id) throw new Error('Expense ID is required');
      const response = await expenseService.getExpenseById(id);
      if (!response.success) throw response.error;
      return response.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useExpenseCategories = (filters?: CategoryFilters) => {
  const { profile } = useSession();
  const companyId = profile?.company_id;

  return useOptimizedQuery({
    queryKey: ['expense-categories', companyId, filters],
    queryFn: async () => {
      if (!companyId) throw new Error('No company ID available');
      const response = await expenseService.getExpenseCategories(companyId, filters);
      if (!response.success) throw response.error;
      return response.data;
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000, // 10 minutes - categories don't change often
    select: (data) => data ?? []
  });
};

// Expense mutations
export const useCreateExpense = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  return useOptimizedMutation({
    mutationFn: async (expense: CreateExpenseRequest) => {
      const response = await expenseService.createExpense(expense);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch expense queries
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Success',
        description: 'Expense created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create expense: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateExpense = () => {
  const queryClient = useQueryClient();

  return useOptimizedMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateExpenseRequest }) => {
      const response = await expenseService.updateExpense(id, updates);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: (data, { id }) => {
      // Update the specific expense in cache
      queryClient.setQueryData(['expense', id], data);
      // Invalidate expenses list to reflect changes
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Success',
        description: 'Expense updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update expense: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();

  return useOptimizedMutation({
    mutationFn: async (id: string) => {
      const response = await expenseService.deleteExpense(id);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['expense', id] });
      // Invalidate expenses list
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Success',
        description: 'Expense deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete expense: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

// Expense status mutations
export const useSubmitExpense = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  return useOptimizedMutation({
    mutationFn: async (id: string) => {
      if (!profile?.id) throw new Error('User ID not available');
      const response = await expenseService.submitExpense(id, profile.id);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData(['expense', id], data);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Success',
        description: 'Expense submitted for approval',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to submit expense: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useApproveExpense = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  return useOptimizedMutation({
    mutationFn: async (id: string) => {
      if (!profile?.id) throw new Error('User ID not available');
      const response = await expenseService.approveExpense(id, profile.id);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData(['expense', id], data);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Success',
        description: 'Expense approved successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to approve expense: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

export const useRejectExpense = () => {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  return useOptimizedMutation({
    mutationFn: async (id: string) => {
      if (!profile?.id) throw new Error('User ID not available');
      const response = await expenseService.rejectExpense(id, profile.id);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData(['expense', id], data);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Success',
        description: 'Expense rejected',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to reject expense: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

// Bulk operations
export const useBulkUpdateExpenses = () => {
  const queryClient = useQueryClient();

  return useOptimizedMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: UpdateExpenseRequest }) => {
      const response = await expenseService.bulkUpdateExpenses(ids, updates);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({
        title: 'Success',
        description: 'Expenses updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update expenses: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

// Category mutations
export const useCreateExpenseCategory = () => {
  const queryClient = useQueryClient();

  return useOptimizedMutation({
    mutationFn: async (category: CreateCategoryRequest) => {
      const response = await expenseService.createCategory(category);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast({
        title: 'Success',
        description: 'Category created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create category: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

// File upload
export const useUploadReceipt = () => {
  const queryClient = useQueryClient();

  return useOptimizedMutation({
    mutationFn: async ({ file, expenseId }: { file: File; expenseId: string }) => {
      const response = await expenseService.uploadReceipt(file, expenseId);
      if (!response.success) throw response.error;
      return response.data;
    },
    onSuccess: (_, { expenseId }) => {
      queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
      toast({
        title: 'Success',
        description: 'Receipt uploaded successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to upload receipt: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};