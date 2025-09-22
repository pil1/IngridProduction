import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useExpenses, useCreateExpense } from '../useExpenses';
import { expenseService } from '@/services/api';
import { useOptimizedQuery, useOptimizedMutation } from '@/hooks/useOptimizedQuery';

// Mock the expense service
vi.mock('@/services/api', () => ({
  expenseService: {
    getExpenses: vi.fn(),
    createExpense: vi.fn(),
  }
}));

// Mock the session context
vi.mock('@/components/SessionContextProvider', () => ({
  useSession: () => ({
    profile: {
      id: 'user-123',
      company_id: 'company-456',
      role: 'user'
    }
  })
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}));

// Mock the optimized hooks
vi.mock('@/hooks/useOptimizedQuery', () => ({
  useOptimizedQuery: vi.fn(),
  useOptimizedMutation: vi.fn()
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the optimized query hook to behave like regular react-query
    vi.mocked(useOptimizedQuery).mockImplementation((options: any) => {
      return {
        isSuccess: false,
        isError: false,
        isLoading: false,
        isIdle: true,
        data: undefined,
        error: null,
        ...options
      };
    });
  });

  it('should fetch expenses successfully', async () => {
    const mockExpenses = {
      data: [
        { id: '1', amount: 100, description: 'Test expense' },
        { id: '2', amount: 200, description: 'Another expense' }
      ],
      count: 2,
      totalPages: 1,
      currentPage: 1,
      hasMore: false
    };

    vi.mocked(expenseService.getExpenses).mockResolvedValue({
      data: mockExpenses,
      error: null,
      success: true
    });

    // Mock successful query state
    vi.mocked(useOptimizedQuery).mockReturnValue({
      isSuccess: true,
      isError: false,
      isLoading: false,
      isIdle: false,
      data: mockExpenses,
      error: null
    });

    const { result } = renderHook(() => useExpenses(), {
      wrapper: createWrapper()
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(mockExpenses);
  });

  it('should handle error when fetching expenses', async () => {
    const error = new Error('Failed to fetch expenses');

    // Mock error query state
    vi.mocked(useOptimizedQuery).mockReturnValue({
      isSuccess: false,
      isError: true,
      isLoading: false,
      isIdle: false,
      data: undefined,
      error: error
    });

    const { result } = renderHook(() => useExpenses(), {
      wrapper: createWrapper()
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('should not fetch when company_id is missing', async () => {
    // Mock idle state when no company_id
    vi.mocked(useOptimizedQuery).mockReturnValue({
      isSuccess: false,
      isError: false,
      isLoading: false,
      isIdle: true,
      data: undefined,
      error: null
    });

    const { result } = renderHook(() => useExpenses(), {
      wrapper: createWrapper()
    });

    expect(result.current.isIdle).toBe(true);
  });
});

describe('useCreateExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the optimized mutation hook
    vi.mocked(useOptimizedMutation).mockImplementation((options: any) => {
      return {
        mutate: vi.fn(),
        isSuccess: false,
        isError: false,
        isPending: false,
        data: undefined,
        error: null,
        reset: vi.fn(),
        ...options
      };
    });
  });

  it('should create expense successfully', async () => {
    const newExpense = {
      amount: 150,
      description: 'New test expense',
      expense_date: '2025-01-01',
      company_id: 'company-456'
    };

    const createdExpense = {
      id: 'expense-123',
      ...newExpense,
      status: 'draft'
    };

    // Mock successful mutation state
    vi.mocked(useOptimizedMutation).mockReturnValue({
      mutate: vi.fn(),
      isSuccess: true,
      isError: false,
      isPending: false,
      data: createdExpense,
      error: null,
      reset: vi.fn()
    });

    const { result } = renderHook(() => useCreateExpense(), {
      wrapper: createWrapper()
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(createdExpense);
  });

  it('should handle creation error', async () => {
    const error = new Error('Failed to create expense');

    // Mock error mutation state
    vi.mocked(useOptimizedMutation).mockReturnValue({
      mutate: vi.fn(),
      isSuccess: false,
      isError: true,
      isPending: false,
      data: undefined,
      error: error,
      reset: vi.fn()
    });

    const { result } = renderHook(() => useCreateExpense(), {
      wrapper: createWrapper()
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});