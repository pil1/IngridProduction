import { BaseApiService, ApiResponse } from './base';
import {
  Expense,
  ExpenseCategory,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ExpenseFilters,
  CategoryFilters,
  PaginationOptions,
  PaginatedResponse
} from './types';

export class ExpenseService extends BaseApiService {
  // Expense CRUD operations
  async getExpenses(
    companyId: string,
    filters?: ExpenseFilters,
    pagination?: PaginationOptions
  ): Promise<ApiResponse<PaginatedResponse<Expense>>> {
    return this.handleRequest(async () => {
      let query = this.supabase
        .from('expenses')
        .select('*, expense_categories(*), vendors(*), gl_accounts(*)', { count: 'exact' })
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters?.vendor_id) {
        query = query.eq('vendor_id', filters.vendor_id);
      }
      if (filters?.date_from) {
        query = query.gte('expense_date', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('expense_date', filters.date_to);
      }
      if (filters?.amount_min) {
        query = query.gte('amount', filters.amount_min);
      }
      if (filters?.amount_max) {
        query = query.lte('amount', filters.amount_max);
      }
      if (filters?.submitted_by) {
        query = query.eq('submitted_by', filters.submitted_by);
      }

      // Apply pagination
      const limit = pagination?.limit ?? 50;
      const offset = pagination?.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: {
          data: data ?? [],
          count: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit),
          currentPage: Math.floor(offset / limit) + 1,
          hasMore: (count ?? 0) > offset + limit
        },
        error: null
      };
    });
  }

  async getExpenseById(id: string): Promise<ApiResponse<Expense>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expenses')
        .select('*, expense_categories(*), vendors(*), gl_accounts(*), profiles!expenses_submitted_by_fkey(*)')
        .eq('id', id)
        .single();
    });
  }

  async createExpense(expense: CreateExpenseRequest): Promise<ApiResponse<Expense>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expenses')
        .insert({
          ...expense,
          status: 'draft'
        })
        .select('*, expense_categories(*), vendors(*), gl_accounts(*)')
        .single();
    });
  }

  async updateExpense(id: string, updates: UpdateExpenseRequest): Promise<ApiResponse<Expense>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select('*, expense_categories(*), vendors(*), gl_accounts(*)')
        .single();
    });
  }

  async deleteExpense(id: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expenses')
        .delete()
        .eq('id', id);
    });
  }

  // Expense status management
  async submitExpense(id: string, submittedBy: string): Promise<ApiResponse<Expense>> {
    return this.updateExpense(id, {
      status: 'submitted',
      submitted_by: submittedBy
    });
  }

  async approveExpense(id: string, approvedBy: string): Promise<ApiResponse<Expense>> {
    return this.updateExpense(id, {
      status: 'approved',
      approved_by: approvedBy
    });
  }

  async rejectExpense(id: string, approvedBy: string): Promise<ApiResponse<Expense>> {
    return this.updateExpense(id, {
      status: 'rejected',
      approved_by: approvedBy
    });
  }

  // Bulk operations
  async bulkUpdateExpenses(ids: string[], updates: UpdateExpenseRequest): Promise<ApiResponse<Expense[]>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expenses')
        .update(updates)
        .in('id', ids)
        .select('*, expense_categories(*), vendors(*), gl_accounts(*)');
    });
  }

  async bulkDeleteExpenses(ids: string[]): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expenses')
        .delete()
        .in('id', ids);
    });
  }

  // Expense Categories CRUD operations
  async getExpenseCategories(
    companyId: string,
    filters?: CategoryFilters
  ): Promise<ApiResponse<ExpenseCategory[]>> {
    return this.handleRequest(async () => {
      let query = this.supabase
        .from('expense_categories')
        .select('*, gl_accounts(*)')
        .eq('company_id', companyId)
        .order('name');

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      return query;
    });
  }

  async getCategoryById(id: string): Promise<ApiResponse<ExpenseCategory>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expense_categories')
        .select('*, gl_accounts(*)')
        .eq('id', id)
        .single();
    });
  }

  async createCategory(category: CreateCategoryRequest): Promise<ApiResponse<ExpenseCategory>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expense_categories')
        .insert({
          ...category,
          is_active: true
        })
        .select('*, gl_accounts(*)')
        .single();
    });
  }

  async updateCategory(id: string, updates: UpdateCategoryRequest): Promise<ApiResponse<ExpenseCategory>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expense_categories')
        .update(updates)
        .eq('id', id)
        .select('*, gl_accounts(*)')
        .single();
    });
  }

  async deleteCategory(id: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expense_categories')
        .delete()
        .eq('id', id);
    });
  }

  // Report and analytics methods
  async getExpenseSummary(companyId: string, dateFrom?: string, dateTo?: string) {
    return this.handleRpcRequest('get_expense_summary', {
      company_id: companyId,
      date_from: dateFrom,
      date_to: dateTo
    });
  }

  async getExpensesByCategory(companyId: string, dateFrom?: string, dateTo?: string) {
    return this.handleRpcRequest('get_expenses_by_category', {
      company_id: companyId,
      date_from: dateFrom,
      date_to: dateTo
    });
  }

  // File upload helpers
  async uploadReceipt(file: File, expenseId: string): Promise<ApiResponse<string>> {
    return this.handleRequest(async () => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${expenseId}_${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('expense-receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = this.supabase.storage
        .from('expense-receipts')
        .getPublicUrl(filePath);

      return { data: data.publicUrl, error: null };
    });
  }

  async deleteReceipt(filePath: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      return this.supabase.storage
        .from('expense-receipts')
        .remove([filePath]);
    });
  }
}

// Create singleton instance
export const expenseService = new ExpenseService();