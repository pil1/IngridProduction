// src/types/expenses.ts

export interface Receipt {
  id: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  ai_extracted_text: string | null;
  ai_raw_json: any | null;
  text_hash: string | null; // Added for duplicate detection
  document_type_classification: string | null; // Added for AI document type classification
  document_type_confidence: number | null; // Added for AI document type confidence
}

export interface ExpenseLineItem {
  id: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  line_amount: number;
  currency_code: string;
  category_id?: string | null; // Optional, can be inferred or manually assigned
  gl_account_id?: string | null; // Optional
  extracted_from_receipt_id?: string | null; // For traceability
}

export interface Expense {
  id: string;
  title: string;
  description: string | null;
  amount: number; // This is original_currency_amount
  expense_date: string;
  status: string;
  submitted_by: string;
  company_id: string;
  category_id: string | null;
  gl_account_id: string | null;
  currency_code: string; // This is original_currency_code
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  controller_id: string | null;
  controller_notes: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  base_currency_amount: number | null;
  exchange_rate: number | null;
  original_currency_amount?: number | null; // Added for consistency, though 'amount' is used
  original_currency_code?: string | null; // Added for consistency, though 'currency_code' is used
  vendor_name: string | null;
  merchant_address: string | null;
  receipt_summary: string | null;
  ai_confidence_score: number | null;
  is_reimbursable: boolean | null; // Changed to nullable
  project_code: string | null;
  cost_center: string | null;
  receipts: Receipt[] | null; // Array of Receipt objects
  // Removed expense_categories and gl_accounts as nested objects, now using flattened names/codes
  expense_line_items: ExpenseLineItem[] | null; // Array of ExpenseLineItem objects
  profiles?: { full_name: string | null; email: string } | null; // Submitter profile (optional, for joins)
  reviewer_profile?: { full_name: string | null; email: string } | null; // Reviewer profile (optional, for joins)
  controller_profile?: { full_name: string | null; email: string } | null; // Controller profile (optional, for joins)
  submitter_profile?: { full_name: string | null; email: string } | null; // Added for ExpenseReviewPage
  // Flattened fields from get_expenses_with_submitter RPC
  submitter_email: string | null;
  submitter_first_name: string | null;
  submitter_last_name: string | null;
  submitter_full_name: string | null;
  submitter_avatar_url: string | null;
  category_name: string | null; // From expense_categories join
  gl_account_name: string | null; // From gl_accounts join
  gl_account_code: string | null; // From gl_accounts join
}

export interface ExpenseComment {
  id: string;
  expense_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
}

export interface ExpenseAuditLog {
  id: string;
  expense_id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  performed_by: string;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
}

// Define all possible expense fields that can be configured
export const ALL_EXPENSE_FIELDS = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount" },
  { key: "expense_date", label: "Expense Date" },
  { key: "currency_code", label: "Currency" },
  { key: "vendor_name", label: "Vendor Name" },
  { key: "merchant_address", label: "Merchant Address" },
  { key: "receipt_summary", label: "Receipt Summary" },
  { key: "category_id", label: "Category" },
  { key: "gl_account_id", label: "GL Account" },
  { key: "is_reimbursable", label: "Is Reimbursable" },
  { key: "project_code", label: "Project Code" },
  { key: "cost_center", label: "Cost Center" },
  { key: "line_items", label: "Line Items" },
  { key: "receipt_upload", label: "Receipt Upload" }, // Represents receipts section
  { key: "review_notes", label: "Review Notes" }, // For controller input
];