import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpenseService } from '../expense';
import { ApiError } from '../base';

// Create mock query object that will be reused
const createMockQuery = () => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
});

const mockQuery = createMockQuery();

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockQuery),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn()
      }))
    }
  }
}));

describe('ExpenseService', () => {
  let expenseService: ExpenseService;

  beforeEach(() => {
    // Reset all mock functions
    Object.values(mockQuery).forEach(fn => {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        fn.mockReset();
      }
    });

    // Recreate the chain behavior
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockQuery.gte.mockReturnValue(mockQuery);
    mockQuery.lte.mockReturnValue(mockQuery);
    mockQuery.in.mockReturnValue(mockQuery);
    mockQuery.order.mockReturnValue(mockQuery);
    mockQuery.range.mockReturnValue(mockQuery);
    mockQuery.insert.mockReturnValue(mockQuery);
    mockQuery.update.mockReturnValue(mockQuery);
    mockQuery.delete.mockReturnValue(mockQuery);

    expenseService = new ExpenseService();
  });

  describe('getExpenses', () => {
    it('should fetch expenses successfully', async () => {
      const mockExpenses = [
        { id: '1', amount: 100, description: 'Test expense' },
        { id: '2', amount: 200, description: 'Another expense' }
      ];

      // Mock the final result that the chain resolves to
      const mockResult = Promise.resolve({
        data: mockExpenses,
        error: null,
        count: 2
      });

      // Mock the chain behavior - final methods should return the promise
      mockQuery.select.mockReturnValue(mockQuery);
      mockQuery.eq.mockReturnValue(mockQuery);
      mockQuery.order.mockReturnValue(mockQuery);
      mockQuery.range.mockReturnValue(mockResult);

      const result = await expenseService.getExpenses('company-123');

      expect(result.success).toBe(true);
      expect(result.data?.data).toEqual(mockExpenses);
      expect(result.data?.count).toBe(2);
      expect(mockQuery.eq).toHaveBeenCalledWith('company_id', 'company-123');
    });

    it('should handle database errors', async () => {
      const mockError = {
        message: 'Database connection failed',
        code: 'PGRST301',
        details: null,
        hint: null
      };

      // Mock error result - the error object needs the exact structure Supabase returns
      const mockResult = Promise.resolve({
        data: null,
        error: mockError,
        count: null
      });

      mockQuery.select.mockReturnValue(mockQuery);
      mockQuery.eq.mockReturnValue(mockQuery);
      mockQuery.order.mockReturnValue(mockQuery);
      mockQuery.range.mockReturnValue(mockResult);

      const result = await expenseService.getExpenses('company-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ApiError);
      expect(result.error?.message).toBe('Database connection failed');
      expect(result.error?.code).toBe('PGRST301');
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: 'approved' as const,
        amount_min: 50,
        amount_max: 500
      };

      // Mock empty result
      const mockResult = Promise.resolve({
        data: [],
        error: null,
        count: 0
      });

      mockQuery.select.mockReturnValue(mockQuery);
      mockQuery.eq.mockReturnValue(mockQuery);
      mockQuery.gte.mockReturnValue(mockQuery);
      mockQuery.lte.mockReturnValue(mockQuery);
      mockQuery.order.mockReturnValue(mockQuery);
      mockQuery.range.mockReturnValue(mockResult);

      await expenseService.getExpenses('company-123', filters);

      expect(mockQuery.eq).toHaveBeenCalledWith('company_id', 'company-123');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockQuery.gte).toHaveBeenCalledWith('amount', 50);
      expect(mockQuery.lte).toHaveBeenCalledWith('amount', 500);
    });
  });

  describe('createExpense', () => {
    it('should create expense successfully', async () => {
      const newExpense = {
        amount: 150,
        description: 'New test expense',
        expense_date: '2025-01-01',
        company_id: 'company-123'
      };

      const createdExpense = {
        id: 'expense-123',
        ...newExpense,
        status: 'draft'
      };

      mockQuery.single.mockResolvedValue({
        data: createdExpense,
        error: null
      });

      const result = await expenseService.createExpense(newExpense);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdExpense);
      expect(mockQuery.insert).toHaveBeenCalledWith({
        ...newExpense,
        status: 'draft'
      });
    });
  });

  describe('updateExpense', () => {
    it('should update expense successfully', async () => {
      const updates = {
        amount: 250,
        status: 'approved' as const
      };

      const updatedExpense = {
        id: 'expense-123',
        amount: 250,
        status: 'approved'
      };

      mockQuery.single.mockResolvedValue({
        data: updatedExpense,
        error: null
      });

      const result = await expenseService.updateExpense('expense-123', updates);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedExpense);
      expect(mockQuery.update).toHaveBeenCalledWith(updates);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'expense-123');
    });
  });

  describe('bulkUpdateExpenses', () => {
    it('should update multiple expenses', async () => {
      const ids = ['expense-1', 'expense-2'];
      const updates = { status: 'approved' as const };

      mockQuery.select.mockResolvedValue({
        data: [
          { id: 'expense-1', status: 'approved' },
          { id: 'expense-2', status: 'approved' }
        ],
        error: null
      });

      const result = await expenseService.bulkUpdateExpenses(ids, updates);

      expect(result.success).toBe(true);
      expect(mockQuery.update).toHaveBeenCalledWith(updates);
      expect(mockQuery.in).toHaveBeenCalledWith('id', ids);
    });
  });

  describe('expense status operations', () => {
    it('should submit expense', async () => {
      mockQuery.single.mockResolvedValue({
        data: { id: 'expense-123', status: 'submitted' },
        error: null
      });

      const result = await expenseService.submitExpense('expense-123', 'user-456');

      expect(result.success).toBe(true);
      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'submitted',
        submitted_by: 'user-456'
      });
    });

    it('should approve expense', async () => {
      mockQuery.single.mockResolvedValue({
        data: { id: 'expense-123', status: 'approved' },
        error: null
      });

      const result = await expenseService.approveExpense('expense-123', 'admin-789');

      expect(result.success).toBe(true);
      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'approved',
        approved_by: 'admin-789'
      });
    });
  });
});