// src/types/expenses.ts

export interface Receipt {
  id: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  ai_extracted_text: string | null;
  ai_raw_json: Record<string, unknown> | null;
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

// Tax breakdown for invoice-style display
export interface TaxLineItem {
  id: string;
  taxType: string; // 'HST', 'GST', 'PST', 'Sales Tax', 'VAT', etc.
  rate: number; // Tax rate as decimal (0.13 = 13%)
  baseAmount: number; // Amount this tax applies to
  taxAmount: number; // Calculated tax amount
  jurisdiction: string; // 'Canada', 'US', 'UK', etc.
  confidence: number; // AI confidence in this tax calculation
  isCalculated: boolean; // True if calculated, false if extracted from document
}

// Invoice summary for display
export interface InvoiceSummary {
  subtotal: number; // Sum of all line items before tax
  taxLines: TaxLineItem[]; // Individual tax breakdowns
  totalTax: number; // Sum of all tax amounts
  grandTotal: number; // Final total including all taxes
  currency: string;
  currencyConfidence: number; // Confidence in currency detection
  currencyReason: string; // Explanation for currency choice
  hasCompanyMismatch: boolean; // True if detected currency differs from company default
}

// Enhanced currency detection result for UI display
export interface CurrencyDetectionInfo {
  detectedCurrency: string;
  confidence: number;
  reason: string;
  companyDefaultCurrency: string;
  hasMismatch: boolean;
  suggestedAction: 'accept' | 'verify' | 'override';
  warnings: string[];
}

// Invoice header information extracted from documents
export interface InvoiceHeader {
  invoiceNumber: string | null;
  purchaseOrderNumber: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  paymentTerms: string | null;
  reference: string | null;
  // Vendor information
  vendorName: string;
  vendorAddress: string | null;
  vendorPhone: string | null;
  vendorEmail: string | null;
  vendorWebsite: string | null;
  vendorTaxNumber: string | null;
  // Bill-to information (the company receiving the invoice)
  billToName: string | null;
  billToAddress: string | null;
  // Confidence scores for extracted fields
  confidence: InvoiceFieldConfidences;
}

// Confidence scores for individual invoice fields
export interface InvoiceFieldConfidences {
  invoiceNumber: number;
  purchaseOrderNumber: number;
  issueDate: number;
  dueDate: number;
  vendorName: number;
  vendorAddress: number;
  vendorContact: number;
  billToInfo: number;
  overallConfidence: number;
}

// Enhanced line item with invoice-style structure
export interface InvoiceLineItem extends ExpenseLineItem {
  lineNumber: number;
  productCode: string | null;
  taxRate: number | null;
  taxAmount: number | null;
  discountRate: number | null;
  discountAmount: number | null;
  netAmount: number; // Amount after discount, before tax
  grossAmount: number; // Final amount including tax
  taxJurisdiction: string | null; // 'Federal', 'Provincial', 'State', etc.
  taxType: string | null; // 'GST', 'PST', 'HST', 'VAT', 'Sales Tax'
  confidence: number;
}

// Comprehensive tax breakdown for invoice
export interface EnhancedTaxLineItem extends TaxLineItem {
  lineItemIds: string[]; // Which line items this tax applies to
  extractedFromDocument: boolean; // True if found in document, false if calculated
  verificationStatus: 'verified' | 'needs_review' | 'incorrect';
  complianceNotes: string | null; // Notes about tax compliance or issues
}

// Complete invoice structure combining all elements
export interface InvoiceStructure {
  header: InvoiceHeader;
  lineItems: InvoiceLineItem[];
  taxBreakdown: EnhancedTaxLineItem[];
  summary: InvoiceSummary;
  metadata: InvoiceMetadata;
}

// Invoice processing metadata
export interface InvoiceMetadata {
  processingMethod: 'ai_extracted' | 'manual_entry' | 'hybrid';
  documentQuality: 'excellent' | 'good' | 'fair' | 'poor';
  processingTime: number; // milliseconds
  aiModelUsed: string;
  extractionWarnings: string[];
  manualOverrides: string[]; // Fields that were manually corrected
  reviewRequired: boolean;
  processingDate: Date;
}

// Enhanced AI and UI Types
export type FieldSource = 'ai' | 'manual' | 'mixed' | 'override';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type ProcessingMethod = 'ai' | 'manual' | 'hybrid';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface FieldConfidence {
  value: number;
  level: ConfidenceLevel;
  source: FieldSource;
}

export interface EnhancedStatus {
  primary: 'draft' | 'submitted' | 'approved' | 'rejected' | 'pending_review' | 'info_requested';
  aiContext: ProcessingMethod;
  priority: UrgencyLevel;
  flags: ('requires-receipt' | 'high-amount' | 'policy-check' | 'manual-review')[];
}

export interface AIMetrics {
  processingStats: {
    totalExpenses: number;
    aiProcessed: number;
    manualEntry: number;
    hybridProcessing: number;
    averageConfidence: number;
    averageProcessingTime: number;
  };

  fieldAccuracy: Record<string, {
    aiAccuracy: number;
    manualOverrideRate: number;
    averageConfidence: number;
    totalProcessed: number;
  }>;

  timeSeriesData: {
    date: string;
    aiProcessed: number;
    manualEntry: number;
    averageConfidence: number;
    processingTime: number;
    errorRate: number;
  }[];

  userAdoption: {
    totalUsers: number;
    activeAIUsers: number;
    adoptionRate: number;
    satisfactionScore: number;
  };
}

export interface ExpenseFieldModification {
  id: string;
  expense_id: string;
  field_name: string;
  original_value: string | null;
  new_value: string;
  source_type: FieldSource;
  confidence_score: number | null;
  modified_by: string;
  modified_at: string;
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

  // AI Processing Metadata (Enhanced)
  ingrid_processed: boolean;
  ingrid_confidence_score: number | null;
  ingrid_field_confidences: Record<string, number>;
  ingrid_suggestions: string[];
  ingrid_response_id: string | null;
  field_sources: Record<string, FieldSource>;
  manual_overrides: string[];
  processing_time_ms: number | null;

  // Enhanced Receipt & Document Metadata
  receipt_url: string | null;
  receipt_count: number;
  receipt_preview_url: string | null;
  document_name: string | null;
  document_size: number | null;
  document_mime_type: string | null;

  // Additional Enhancement Fields
  tags: string[];
  urgency_level: UrgencyLevel;
  has_receipt: boolean;

  // Invoice-style enhancements
  invoice_structure?: InvoiceStructure; // Complete invoice data structure
  invoice_summary?: InvoiceSummary; // Calculated invoice breakdown
  tax_line_items?: EnhancedTaxLineItem[]; // Individual tax lines from AI extraction
  currency_detection_info?: CurrencyDetectionInfo; // Currency detection metadata
  original_document_currency?: string; // Currency as it appeared in the document
  exchange_rate_applied?: number; // If currency conversion was applied
  foreign_currency_detected?: boolean; // True if invoice currency differs from company default

  // Enhanced AI processing metadata
  document_quality_score?: number; // Overall document quality assessment
  processing_method?: 'ai_extracted' | 'manual_entry' | 'hybrid';
  extraction_warnings?: string[]; // Warnings from AI processing
  field_edit_history?: Record<string, { original: any; modified: any; timestamp: string; userId: string }>;
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