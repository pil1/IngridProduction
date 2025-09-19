// Base entity interface
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// User and Profile types
export interface Profile extends BaseEntity {
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  role: 'super-admin' | 'admin' | 'user';
  company_id: string | null;
  is_active: boolean;
}

// Company types
export interface Company extends BaseEntity {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  is_active: boolean;
}

// Expense types
export interface Expense extends BaseEntity {
  amount: number;
  currency: string;
  description: string | null;
  expense_date: string;
  receipt_url: string | null;
  category_id: string | null;
  vendor_id: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  submitted_by: string;
  approved_by: string | null;
  company_id: string;
  gl_account_id: string | null;
  notes: string | null;
  receipt_filename: string | null;
}

export interface ExpenseCategory extends BaseEntity {
  name: string;
  description: string | null;
  company_id: string;
  gl_account_id: string | null;
  is_active: boolean;
}

// Vendor and Customer types
export interface Vendor extends BaseEntity {
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  company_id: string;
  is_active: boolean;
}

export interface Customer extends BaseEntity {
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_id: string;
  is_active: boolean;
}

// GL Account types
export interface GLAccount extends BaseEntity {
  account_number: string;
  account_name: string;
  account_type: string;
  description: string | null;
  company_id: string;
  is_active: boolean;
}

// Location types
export interface Location extends BaseEntity {
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  company_id: string;
  is_active: boolean;
}

// Request types for creating/updating entities
export interface CreateExpenseRequest {
  amount: number;
  currency?: string;
  description?: string;
  expense_date: string;
  receipt_url?: string;
  category_id?: string;
  vendor_id?: string;
  company_id: string;
  gl_account_id?: string;
  notes?: string;
  receipt_filename?: string;
}

export interface UpdateExpenseRequest {
  amount?: number;
  currency?: string;
  description?: string;
  expense_date?: string;
  category_id?: string;
  vendor_id?: string;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  gl_account_id?: string;
  notes?: string;
  approved_by?: string;
}

export interface CreateVendorRequest {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  company_id: string;
}

export interface UpdateVendorRequest {
  name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  is_active?: boolean;
}

export interface CreateCustomerRequest {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  company_id: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active?: boolean;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  company_id: string;
  gl_account_id?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  gl_account_id?: string;
  is_active?: boolean;
}

export interface CreateGLAccountRequest {
  account_number: string;
  account_name: string;
  account_type: string;
  description?: string;
  company_id: string;
}

export interface UpdateGLAccountRequest {
  account_number?: string;
  account_name?: string;
  account_type?: string;
  description?: string;
  is_active?: boolean;
}

// Filter types
export interface ExpenseFilters {
  status?: string;
  category_id?: string;
  vendor_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  submitted_by?: string;
}

export interface VendorFilters {
  is_active?: boolean;
  search?: string;
}

export interface CustomerFilters {
  is_active?: boolean;
  search?: string;
}

export interface CategoryFilters {
  is_active?: boolean;
  search?: string;
}

// Pagination types
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
}