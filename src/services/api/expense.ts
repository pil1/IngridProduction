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

/**
 * Service class for managing expenses and expense categories
 *
 * Provides comprehensive CRUD operations for expenses, expense categories,
 * bulk operations, file uploads, and analytics. All methods include proper
 * error handling and return standardized ApiResponse objects.
 *
 * @example
 * ```typescript
 * import { expenseService } from '@/services/api/expense';
 *
 * // Get expenses with filtering and pagination
 * const response = await expenseService.getExpenses('company-id', {
 *   status: 'submitted',
 *   date_from: '2024-01-01'
 * }, { limit: 25, offset: 0 });
 *
 * if (response.success) {
 *   console.log(`Found ${response.data.count} expenses`);
 *   response.data.data.forEach(expense => console.log(expense.title));
 * }
 * ```
 */
export class ExpenseService extends BaseApiService {
  /**
   * Retrieves expenses for a company with optional filtering and pagination
   *
   * @param companyId - The ID of the company to get expenses for
   * @param filters - Optional filters to apply to the expense query
   * @param filters.status - Filter by expense status (draft, submitted, approved, rejected)
   * @param filters.category_id - Filter by expense category ID
   * @param filters.vendor_id - Filter by vendor ID
   * @param filters.date_from - Filter expenses from this date (YYYY-MM-DD)
   * @param filters.date_to - Filter expenses to this date (YYYY-MM-DD)
   * @param filters.amount_min - Filter expenses with amount >= this value
   * @param filters.amount_max - Filter expenses with amount <= this value
   * @param filters.submitted_by - Filter by user ID who submitted the expense
   * @param pagination - Optional pagination parameters
   * @param pagination.limit - Number of items per page (default: 50)
   * @param pagination.offset - Number of items to skip (default: 0)
   * @returns Promise resolving to paginated expense data with metadata
   *
   * @example
   * ```typescript
   * // Get recent submitted expenses
   * const response = await expenseService.getExpenses('company-123', {
   *   status: 'submitted',
   *   date_from: '2024-01-01'
   * });
   *
   * if (response.success) {
   *   console.log(`Page ${response.data.currentPage} of ${response.data.totalPages}`);
   *   console.log(`${response.data.count} total expenses found`);
   * }
   * ```
   */
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

  /**
   * Retrieves a single expense by ID with full details
   *
   * @param id - The expense ID to retrieve
   * @returns Promise resolving to expense data with related entities
   *
   * @example
   * ```typescript
   * const response = await expenseService.getExpenseById('expense-123');
   * if (response.success) {
   *   console.log(`Expense: ${response.data.title}`);
   *   console.log(`Category: ${response.data.expense_categories?.name}`);
   * }
   * ```
   */
  async getExpenseById(id: string): Promise<ApiResponse<Expense>> {
    return this.handleRequest(async () => {
      return this.supabase
        .from('expenses')
        .select('*, expense_categories(*), vendors(*), gl_accounts(*), profiles!expenses_submitted_by_fkey(*)')
        .eq('id', id)
        .single();
    });
  }

  /**
   * Creates a new expense in draft status
   *
   * @param expense - The expense data to create
   * @returns Promise resolving to the created expense with full details
   *
   * @example
   * ```typescript
   * const response = await expenseService.createExpense({
   *   title: 'Office Supplies',
   *   amount: 150.00,
   *   expense_date: '2024-01-15',
   *   company_id: 'company-123',
   *   submitted_by: 'user-456'
   * });
   * ```
   */
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

  /**
   * Updates an existing expense with partial data
   *
   * @param id - The expense ID to update
   * @param updates - Partial expense data to update
   * @returns Promise resolving to the updated expense
   *
   * @example
   * ```typescript
   * const response = await expenseService.updateExpense('expense-123', {
   *   status: 'submitted',
   *   review_notes: 'Updated with receipt'
   * });
   * ```
   */
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

  /**
   * Submits an expense for approval
   *
   * @param id - The expense ID to submit
   * @param submittedBy - The user ID submitting the expense
   * @returns Promise resolving to the updated expense
   *
   * @example
   * ```typescript
   * const response = await expenseService.submitExpense('expense-123', 'user-456');
   * if (response.success) {
   *   console.log('Expense submitted for approval');
   * }
   * ```
   */
  async submitExpense(id: string, submittedBy: string): Promise<ApiResponse<Expense>> {
    return this.updateExpense(id, {
      status: 'submitted',
      submitted_by: submittedBy
    });
  }

  /**
   * Approves a submitted expense
   *
   * @param approvedBy - The user ID approving the expense
   * @param id - The expense ID to approve
   * @returns Promise resolving to the approved expense
   */
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

  /**
   * Updates multiple expenses with the same data
   *
   * @param ids - Array of expense IDs to update
   * @param updates - The updates to apply to all expenses
   * @returns Promise resolving to array of updated expenses
   *
   * @example
   * ```typescript
   * // Bulk approve multiple expenses
   * const response = await expenseService.bulkUpdateExpenses(
   *   ['exp-1', 'exp-2', 'exp-3'],
   *   { status: 'approved', approved_by: 'manager-123' }
   * );
   * ```
   */
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

  /**
   * Retrieves expense categories for a company with optional filtering
   *
   * @param companyId - The company ID to get categories for
   * @param filters - Optional filters for categories
   * @param filters.is_active - Filter by active/inactive status
   * @param filters.search - Search categories by name
   * @returns Promise resolving to array of expense categories
   *
   * @example
   * ```typescript
   * const response = await expenseService.getExpenseCategories('company-123', {
   *   is_active: true,
   *   search: 'travel'
   * });
   * ```
   */
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

  /**
   * Gets expense summary analytics for a company
   *
   * @param companyId - The company ID to get summary for
   * @param dateFrom - Optional start date for the summary
   * @param dateTo - Optional end date for the summary
   * @returns Promise resolving to expense summary data
   */
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

  /**
   * Uploads a receipt file for an expense
   *
   * @param file - The receipt file to upload
   * @param expenseId - The expense ID to associate the receipt with
   * @returns Promise resolving to the public URL of the uploaded file
   *
   * @example
   * ```typescript
   * const fileInput = document.getElementById('receipt') as HTMLInputElement;
   * const file = fileInput.files?.[0];
   * if (file) {
   *   const response = await expenseService.uploadReceipt(file, 'expense-123');
   *   if (response.success) {
   *     console.log('Receipt uploaded:', response.data);
   *   }
   * }
   * ```
   */
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