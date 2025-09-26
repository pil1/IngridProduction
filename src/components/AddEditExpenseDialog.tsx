"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarIcon, Sparkles, AlertCircle, PlusCircle, Trash2, Send, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/SessionContextProvider";
import { format } from "date-fns";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import *as z from "zod";
import FormattedCurrencyDisplay from "@/components/FormattedCurrencyDisplay";
import FormattedCurrencyInput from "@/components/FormattedCurrencyInput"; // Import FormattedCurrencyInput
import ReceiptUpload from "./ReceiptUpload"; // New component import
import { Checkbox } from "@/components/ui/checkbox"; // shadcn Checkbox
import { Expense, ExpenseLineItem, ALL_EXPENSE_FIELDS, InvoiceStructure } from "@/types/expenses"; // Import shared Expense interface and ALL_EXPENSE_FIELDS
import InvoiceView from "./InvoiceView"; // Import InvoiceView component
import DualColumnInvoiceView from "./DualColumnInvoiceView"; // Import DualColumnInvoiceView component
import { InvoiceExtractionService } from "@/services/ingrid/InvoiceExtractionService"; // Import extraction service
import { InvoiceOCRData } from "@/services/ingrid/OCRService"; // Import OCR data type

interface AddEditExpenseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingExpenseId?: string | null; // Support for editing by ID
  editingExpense?: Expense | null; // Support for editing by object
  onSuccess?: () => void;
  // AI mode props
  aiMode?: boolean;
  aiExpenseData?: any;
  aiUploadedFile?: File | null;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate_to_usd: number;
}

// Define the structure for field settings
interface FieldSetting {
  visible: boolean;
  required: boolean;
}

const lineItemSchema = z.object({
  id: z.string().optional(), // Optional for new line items
  description: z.string().min(1, "Description is required"),
  quantity: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().positive("Quantity must be positive").nullable().optional()
  ),
  unit_price: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().positive("Unit price must be positive").nullable().optional()
  ),
  line_amount: z.preprocess(
    (val) => Number(val),
    z.number().positive("Line amount must be positive")
  ),
  currency_code: z.string().min(1, "Currency is required").default("USD"),
});

// Base schema where fields are optional for drafts
const baseExpenseFormSchema = z.object({
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)), // Allow empty string to become 0 for drafts
    z.number().min(0, "Amount must be non-negative")
  ),
  expense_date: z.date().optional().nullable(),
  category_id: z.string().optional().nullable(),
  gl_account_id: z.string().optional().nullable(),
  currency_code: z.string().optional().nullable(),
  vendor_name: z.string().optional().nullable(),
  merchant_address: z.string().optional().nullable(),
  receipt_summary: z.string().optional().nullable(),
  ai_confidence_score: z.number().optional().nullable(),
  is_reimbursable: z.boolean().default(true),
  project_code: z.string().optional().nullable(),
  cost_center: z.string().optional().nullable(),
  line_items: z.array(lineItemSchema).optional(),
});

// Infer type from base schema for consistency
type ExpenseFormValues = z.infer<typeof baseExpenseFormSchema>;

const AddEditExpenseDialog = ({
  isOpen,
  onOpenChange,
  editingExpenseId,
  editingExpense,
  onSuccess,
  aiMode = false,
  aiExpenseData = null,
  aiUploadedFile = null,
}: AddEditExpenseDialogProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentSubmissionType, setCurrentSubmissionType] = useState<'draft' | 'submitted'>('draft'); // Corrected type to 'submitted'
  const [documentId, setDocumentId] = useState<string | null>(null); // Track document ID from new document system

  // Invoice-style workflow state
  const [invoiceStructure, setInvoiceStructure] = useState<import('@/types/expenses').InvoiceStructure | null>(null);
  const [showInvoiceView, setShowInvoiceView] = useState(false);
  const [invoiceEditable, setInvoiceEditable] = useState(true);

  const currentCompanyId = profile?.company_id;
  const currentUserId = profile?.user_id; // Keep for receipt upload and update logic
  const userRole = profile?.role;

  // 1. Fetch Expense Management Module ID
  const { data: expenseModuleId, isLoading: isLoadingExpenseModuleId } = useQuery<string | null>({
    queryKey: ["expenseModuleSystemId"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("id")
        .eq("name", "Expense Management")
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.id ?? null;
    },
  });

  // 2. Fetch Expense Management Configuration for the current company (controller fields)
  const { data: expenseModuleConfig, isLoading: isLoadingConfig } = useQuery<{ settings: { user_fields: Record<string, FieldSetting> } } | null>({
    queryKey: ["expenseModuleConfig", currentCompanyId, expenseModuleId],
    retry: false, // Don't retry to avoid 406 errors causing Suspense issues
    queryFn: async () => {
      if (!currentCompanyId || !expenseModuleId) return null;
      try {
        const { data, error } = await supabase
          .from("module_configurations")
          .select("settings")
          .eq("company_id", currentCompanyId)
          .eq("module_id", expenseModuleId)
          .eq("config_key", "expense_management_fields")
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      } catch (error: unknown) {
        // Handle missing module_configurations table gracefully
        const dbError = error as { code?: string; status?: number };
        if (dbError.code === 'PGRST205' || dbError.status === 406) {
          console.warn('Module configurations table not found - using default field settings');
          return null;
        }
        throw error;
      }
    },
    enabled: !!currentCompanyId && !!expenseModuleId && !isLoadingSession,
  });

  // Dynamically create the Zod schema based on configuration
  const createDynamicSchema = (config: Record<string, FieldSetting>) => {
    return baseExpenseFormSchema.superRefine((data, ctx) => {
      // Apply base validation for submission
      if (currentSubmissionType === 'submitted') { // Changed to 'submitted'
        if (!data.title || data.title.trim() === "") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Title is required for submission", path: ["title"] });
        }
        if (!data.amount || data.amount <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be positive for submission", path: ["amount"] });
        }
        if (!data.expense_date) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expense date is required for submission", path: ["expense_date"] });
        }
        if (!data.currency_code || data.currency_code.trim() === "") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Currency is required for submission", path: ["currency_code"] });
        }
      }

      // Apply dynamic required rules from config
      for (const fieldKey of ALL_EXPENSE_FIELDS.map(f => f.key)) {
        const fieldConfig = config[fieldKey];
        if (fieldConfig?.required && currentSubmissionType === 'submitted') { // Changed to 'submitted'
          // Special handling for different field types
          if (fieldKey === "title" && (!data.title || data.title.trim() === "")) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${ALL_EXPENSE_FIELDS.find(f => f.key === fieldKey)?.label} is required`, path: [fieldKey] });
          } else if (fieldKey === "amount" && (!data.amount || data.amount <= 0)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${ALL_EXPENSE_FIELDS.find(f => f.key === fieldKey)?.label} must be positive`, path: [fieldKey] });
          } else if (fieldKey === "expense_date" && !data.expense_date) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${ALL_EXPENSE_FIELDS.find(f => f.key === fieldKey)?.label} is required`, path: [fieldKey] });
          } else if (fieldKey === "currency_code" && (!data.currency_code || data.currency_code.trim() === "")) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${ALL_EXPENSE_FIELDS.find(f => f.key === fieldKey)?.label} is required`, path: [fieldKey] });
          } else if (fieldKey === "category_id" && !data.category_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${ALL_EXPENSE_FIELDS.find(f => f.key === fieldKey)?.label} is required`, path: [fieldKey] });
          } else if (fieldKey === "gl_account_id" && !data.gl_account_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${ALL_EXPENSE_FIELDS.find(f => f.key === fieldKey)?.label} is required`, path: [fieldKey] });
          } else if (fieldKey === "vendor_name" && (!data.vendor_name || data.vendor_name.trim() === "")) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${ALL_EXPENSE_FIELDS.find(f => f.key === fieldKey)?.label} is required`, path: [fieldKey] });
          } else if (fieldKey === "receipt_upload" && !uploadedFile && !editingExpense?.receipts?.length) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `A receipt upload is required`, path: ["receipt_upload"] });
          }
          // Add more specific checks for other fields if needed
        }
      }
    });
  };

  const userFieldsConfig = expenseModuleConfig?.settings?.user_fields ?? {};
  const currentDynamicSchema = createDynamicSchema(userFieldsConfig);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(currentDynamicSchema),
    defaultValues: {
      title: "",
      description: null,
      amount: 0,
      expense_date: null,
      category_id: null,
      gl_account_id: null,
      currency_code: "USD",
      vendor_name: null,
      merchant_address: null,
      receipt_summary: null,
      ai_confidence_score: null,
      is_reimbursable: true,
      project_code: null,
      cost_center: null,
      line_items: [],
    },
    mode: "onChange", // Validate on change for better UX
  });

  const { fields: lineItemFields, append: appendLineItem, remove: removeLineItem } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  // Fetch all active currencies
  const { data: allCurrencies = [], error: currenciesError } = useQuery<Currency[]>({
    queryKey: ["allCurrencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("*").eq("is_active", true).order("code");
      if (error) {
        console.error("Error fetching currencies:", error);
        throw error;
      }
      return data || [];
    },
    retry: 1,
    staleTime: 10 * 60 * 1000, // 10 minutes - currencies change infrequently
  });

  // Fetch expense categories
  const { data: categories = [], error: categoriesDialogError } = useQuery<{ id: string; name: string; description: string | null }[]>({
    queryKey: ["expense_categories", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name, description")
        .eq("company_id", currentCompanyId)
        .eq("is_active", true);
      if (error) {
        console.error("Error fetching expense categories (dialog):", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!currentCompanyId,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch GL accounts
  const { data: glAccounts = [], error: glAccountsError } = useQuery<{ id: string; account_code: string; account_name: string }[]>({
    queryKey: ["gl_accounts", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const { data, error } = await supabase
        .from("gl_accounts")
        .select("id, account_code, account_name")
        .eq("company_id", currentCompanyId)
        .eq("is_active", true);
      if (error) {
        console.error("Error fetching GL accounts:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!currentCompanyId && ['admin', 'controller', 'super-admin'].includes(userRole ?? ''),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Reset form when dialog opens/closes or editing expense changes
  useEffect(() => {
    const initializeForm = async () => {
      if (isOpen) {
        if (editingExpense) {
          form.reset({
            title: editingExpense.title,
            description: editingExpense.description ?? null,
            amount: editingExpense.amount,
            expense_date: new Date(editingExpense.expense_date),
            category_id: editingExpense.category_id ?? null,
            gl_account_id: editingExpense.gl_account_id ?? null,
            currency_code: editingExpense.currency_code ?? "USD",
            vendor_name: editingExpense.vendor_name ?? null,
            merchant_address: editingExpense.merchant_address ?? null,
            receipt_summary: editingExpense.receipt_summary ?? null,
            ai_confidence_score: editingExpense.ai_confidence_score ?? null,
            is_reimbursable: editingExpense.is_reimbursable ?? true,
            project_code: editingExpense.project_code ?? null,
            cost_center: editingExpense.cost_center ?? null,
            line_items: editingExpense.expense_line_items ?? [],
          });

          // Generate signed URL for existing receipt if available
          if (editingExpense.receipts && editingExpense.receipts.length > 0) {
            const receipt = editingExpense.receipts[0];
            const path = receipt.file_url.split('/storage/v1/object/public/expense-receipts/')[1];
            if (path) {
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from('expense-receipts').createSignedUrl(path, 3600); // 1 hour validity
              if (signedUrlError) {
                console.error("Error creating signed URL for existing receipt:", signedUrlError);
                toast({ title: "Error", description: "Failed to load existing receipt preview.", variant: "destructive" });
                setReceiptPreviewUrl(null);
              } else {
                setReceiptPreviewUrl(signedUrlData.signedUrl);
              }
            } else {
              setReceiptPreviewUrl(receipt.file_url); // Fallback to direct URL if path extraction fails (e.g., public bucket)
            }
          } else {
            setReceiptPreviewUrl(null);
          }
        } else if (aiMode && aiExpenseData) {
          // Handle AI mode - populate form with AI processed data
          form.reset({
            title: aiExpenseData.description || "",
            description: aiExpenseData.description || null,
            amount: aiExpenseData.amount || 0,
            expense_date: aiExpenseData.expense_date ? new Date(aiExpenseData.expense_date) : null,
            category_id: aiExpenseData.category_id || null,
            gl_account_id: aiExpenseData.gl_account_id || null,
            currency_code: aiExpenseData.currency_code || "USD",
            vendor_name: aiExpenseData.vendor_name || null,
            merchant_address: null, // Will be filled from vendor data if available
            receipt_summary: null,
            ai_confidence_score: aiExpenseData.confidence_score || null,
            is_reimbursable: true,
            project_code: null,
            cost_center: null,
            line_items: [],
          });

          // Set up uploaded file if provided
          if (aiUploadedFile) {
            setUploadedFile(aiUploadedFile);
            setReceiptPreviewUrl(URL.createObjectURL(aiUploadedFile));
          } else {
            setReceiptPreviewUrl(null);
          }

          // Create InvoiceStructure from AI data for dual column view
          const invoiceStruct: InvoiceStructure = {
            header: {
              invoiceNumber: aiExpenseData.invoice_number || null,
              purchaseOrderNumber: aiExpenseData.po_number || null,
              issueDate: aiExpenseData.expense_date ? new Date(aiExpenseData.expense_date) : null,
              dueDate: null,
              paymentTerms: null,
              reference: null,
              vendorName: aiExpenseData.vendor_name || 'Unknown Vendor',
              vendorAddress: aiExpenseData.vendor_address || null,
              vendorPhone: aiExpenseData.vendor_phone || null,
              vendorEmail: aiExpenseData.vendor_email || null,
              vendorWebsite: null,
              vendorTaxNumber: null,
              billToName: null,
              billToAddress: null,
              confidence: {
                invoiceNumber: aiExpenseData.field_confidences?.invoice_number || 0.5,
                purchaseOrderNumber: aiExpenseData.field_confidences?.po_number || 0.5,
                issueDate: aiExpenseData.field_confidences?.expense_date || 0.5,
                dueDate: 0.5,
                vendorName: aiExpenseData.field_confidences?.vendor_name || 0.7,
                vendorAddress: aiExpenseData.field_confidences?.vendor_address || 0.5,
                vendorContact: aiExpenseData.field_confidences?.vendor_phone || aiExpenseData.field_confidences?.vendor_email || 0.5,
                billToInfo: 0.5,
                overallConfidence: aiExpenseData.confidence_score || 0.7
              }
            },
            lineItems: [],
            taxBreakdown: [],
            summary: {
              subtotal: (aiExpenseData.amount || 0) * 0.87, // Estimate assuming ~13% tax
              taxLines: [{
                id: 'tax-1',
                taxType: 'Sales Tax',
                rate: 0.13,
                baseAmount: (aiExpenseData.amount || 0) * 0.87,
                taxAmount: (aiExpenseData.amount || 0) * 0.13,
                jurisdiction: 'Unknown',
                confidence: aiExpenseData.field_confidences?.tax_amount || 0.6,
                isCalculated: true
              }],
              totalTax: (aiExpenseData.amount || 0) * 0.13,
              grandTotal: aiExpenseData.amount || 0,
              currency: aiExpenseData.currency_code || 'USD',
              currencyConfidence: aiExpenseData.field_confidences?.currency_code || 0.8,
              currencyReason: 'Detected from AI processing',
              hasCompanyMismatch: false
            },
            metadata: {
              processingMethod: 'ai_extracted',
              documentQuality: 'good',
              processingTime: aiExpenseData.processing_time_ms || 0,
              aiModelUsed: 'ingrid-ai',
              extractionWarnings: aiExpenseData.ingrid_suggestions || [],
              manualOverrides: [],
              reviewRequired: (aiExpenseData.confidence_score || 0) < 0.8,
              processingDate: new Date()
            }
          };

          setInvoiceStructure(invoiceStruct);

          // Automatically switch to invoice view for AI mode
          setShowInvoiceView(true);
          setInvoiceEditable(true);

          console.log('AI Mode activated with data:', aiExpenseData);
        } else {
          form.reset({
            title: "",
            description: null,
            amount: 0,
            expense_date: null, // Changed to null for optional
            category_id: null,
            gl_account_id: null,
            currency_code: "USD",
            vendor_name: null,
            merchant_address: null,
            receipt_summary: null,
            ai_confidence_score: null,
            is_reimbursable: true,
            project_code: null,
            cost_center: null,
            line_items: [],
          });
          setReceiptPreviewUrl(null);
        }

        // Only clear these states if not in AI mode
        if (!aiMode) {
          setUploadedFile(null);
          setAiAnalysisResult(null);
          setIsAnalyzing(false);
          setDocumentId(null); // Clear document ID
        }
        setCurrentSubmissionType('draft'); // Reset to draft when opening

        // TESTING: Automatically show invoice view for demo/testing purposes
        setTimeout(() => {
          const mockOcrData: InvoiceOCRData = {
            header: {
              invoiceNumber: 'INV-2025-001',
              purchaseOrderNumber: 'PO-12345',
              issueDate: new Date().toISOString(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              reference: 'REF-001'
            },
            vendor: {
              name: 'Office Supplies Inc.',
              address: '123 Business Street, Toronto, ON M5V 1A1',
              phone: '(416) 555-0123',
              email: 'billing@officesupplies.com',
              website: 'www.officesupplies.com',
              taxNumber: 'HST123456789'
            },
            billTo: {
              name: 'Your Company Name',
              address: '456 Company Ave, Toronto, ON M4B 2C3'
            },
            lineItems: [{
              lineNumber: 1,
              description: 'Office Printer Paper - 500 sheets',
              quantity: 5,
              unitPrice: 12.99,
              amount: 64.95,
              productCode: 'PP500',
              taxRate: 0.13,
              taxAmount: 8.44,
              confidence: 0.92
            }, {
              lineNumber: 2,
              description: 'Blue Pens - Pack of 10',
              quantity: 2,
              unitPrice: 8.50,
              amount: 17.00,
              productCode: 'BP10',
              taxRate: 0.13,
              taxAmount: 2.21,
              confidence: 0.89
            }],
            taxes: [{
              type: 'HST',
              rate: 0.13,
              baseAmount: 81.95,
              taxAmount: 10.65,
              jurisdiction: 'Ontario',
              confidence: 0.88
            }],
            totals: {
              subtotal: 81.95,
              totalTax: 10.65,
              grandTotal: 92.60,
              currency: 'CAD',
              confidence: 0.95
            },
            overallConfidence: 0.91,
            documentQuality: 'excellent'
          };

          const extractionService = new InvoiceExtractionService({
            companyDefaultCurrency: 'CAD',
            enableTaxValidation: true,
            strictModeEnabled: false,
            confidenceThreshold: 0.6
          });

          extractionService.extractInvoiceFromOCR(
            mockOcrData,
            1250,
            'openai-vision-preview'
          ).then(invoiceStructure => {
            setInvoiceStructure(invoiceStructure);
            setShowInvoiceView(true);
            setInvoiceEditable(true);

            // Also populate form with the data
            form.setValue("title", "Office Supplies Purchase");
            form.setValue("description", "Monthly office supplies order");
            form.setValue("amount", 92.60);
            form.setValue("currency_code", "CAD");
            form.setValue("expense_date", new Date());
            form.setValue("vendor_name", "Office Supplies Inc.");
            form.setValue("merchant_address", "123 Business Street, Toronto, ON M5V 1A1");
          }).catch(error => {
            console.error('Failed to create demo invoice structure:', error);
          });
        }, 500); // Small delay to ensure component is ready
      }
    };
    initializeForm();
  }, [isOpen, editingExpense, form, toast, aiMode, aiExpenseData, aiUploadedFile]);

  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormValues & { status: 'draft' | 'submitted' }) => { // Added status to data type
      if (!currentCompanyId) throw new Error("Company not identified.");

      // 1. Upload receipt if new file is present
      let receiptFileUrl: string | null = null;
      let receiptFileName: string | null = null;
      let receiptMimeType: string | null = null;
      let aiExtractedText: string | null = null;
      let aiRawJson: Record<string, unknown> | null = null;
      let textHash: string | null = null;
      let documentTypeClassification: string | null = null;
      let documentTypeConfidence: number | null = null;

      if (uploadedFile) {
        const fileExtension = uploadedFile.name.split('.').pop();
        const filePath = `${currentUserId}/receipts/${Date.now()}.${fileExtension}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(filePath, uploadedFile, {
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('expense-receipts')
          .getPublicUrl(uploadData.path);

        receiptFileUrl = publicUrlData.publicUrl;
        receiptFileName = uploadedFile.name;
        receiptMimeType = uploadedFile.type;
        aiExtractedText = aiAnalysisResult?.ai_extracted_text ?? null;
        aiRawJson = aiAnalysisResult?.ai_raw_json ?? null;
        textHash = aiAnalysisResult?.text_hash ?? null;
        documentTypeClassification = aiAnalysisResult?.document_type_classification ?? null;
        documentTypeConfidence = aiAnalysisResult?.document_type_confidence ?? null;
      }

      // Fetch company's default currency for base_currency_amount calculation
      const { data: companyData, error: companyError } = await supabase.from('companies').select('default_currency').eq('id', currentCompanyId).single();
      if (companyError) console.error("Error fetching company default currency:", companyError);
      const companyDefaultCurrency = companyData?.default_currency ?? 'USD';

      let baseCurrencyAmount: number | null = null;
      let exchangeRate: number | null = null;

      if (data.amount && data.currency_code && companyDefaultCurrency) {
        if (data.currency_code === companyDefaultCurrency) {
          baseCurrencyAmount = data.amount;
          exchangeRate = 1;
        } else {
          // Placeholder for actual currency conversion API call
          console.warn(`DEBUG: Currency conversion from ${data.currency_code} to ${companyDefaultCurrency} is a placeholder.`);
          if (data.currency_code === 'USD' && companyDefaultCurrency === 'CAD') {
            exchangeRate = 1.35;
            baseCurrencyAmount = data.amount * exchangeRate;
          } else if (data.currency_code === 'CAD' && companyDefaultCurrency === 'USD') {
            exchangeRate = 0.74; // 1/1.35
            baseCurrencyAmount = data.amount * exchangeRate;
          } else {
            // Fallback to 1:1 if no specific rate or API is integrated
            exchangeRate = 1;
            baseCurrencyAmount = data.amount;
          }
        }
      }

      // 2. Insert new expense
      const { data: newExpense, error: expenseError } = await supabase.from("expenses").insert({
        title: data.title ?? null, // Allow null for draft
        description: data.description ?? null,
        amount: data.amount, // This is original_currency_amount
        expense_date: data.expense_date ? format(data.expense_date, "yyyy-MM-dd") : null, // Allow null for draft
        category_id: data.category_id ?? null,
        gl_account_id: data.gl_account_id ?? null,
        currency_code: data.currency_code ?? null, // Allow null for draft
        company_id: currentCompanyId,
        submitted_by: currentUserId, // Explicitly provide submitted_by
        status: data.status, // Use data.status directly
        base_currency_amount: baseCurrencyAmount,
        exchange_rate: exchangeRate,
        vendor_name: data.vendor_name ?? null,
        merchant_address: data.merchant_address ?? null,
        receipt_summary: data.receipt_summary ?? null,
        ai_confidence_score: data.ai_confidence_score ?? null,
        is_reimbursable: data.is_reimbursable,
        project_code: data.project_code ?? null,
        cost_center: data.cost_center ?? null,
      }).select().single();

      if (expenseError) {
        console.error("Expense insert error:", expenseError);
        // Additional logging for RLS debugging
        if (expenseError.code === "42501" || expenseError.code === "PGRST401") { // RLS violation or Unauthorized
          console.warn("Potential RLS violation. Current user ID (from profile):", currentUserId);
          const { data: authUser, error: authError } = await supabase.auth.getUser();
          if (authError) {
            console.error("Error fetching auth user for RLS debug:", authError);
          } else {
            console.log("Supabase auth.user.id (from client-side getUser):", authUser.user?.id);
          }
        }
        throw expenseError;
      }

      // 3. Insert receipt record if a file was uploaded
      let newReceiptId: string | null = null;
      if (receiptFileUrl && newExpense) {
        const { data: newReceipt, error: receiptRecordError } = await supabase.from("receipts").insert({
          expense_id: newExpense.id,
          file_url: receiptFileUrl,
          file_name: receiptFileName,
          mime_type: receiptMimeType,
          uploaded_by: currentUserId,
          ai_extracted_text: aiExtractedText,
          ai_raw_json: aiRawJson,
          text_hash: textHash, // Store hash
          document_type_classification: documentTypeClassification, // Store classification
          document_type_confidence: documentTypeConfidence, // Store confidence
        }).select('id').single();
        if (receiptRecordError) console.error("Error inserting receipt record:", receiptRecordError);
        newReceiptId = newReceipt?.id ?? null;
      }

      // 4. Insert line items
      if (data.line_items && newExpense) {
        const lineItemsToInsert = data.line_items.map(item => ({
          ...item,
          expense_id: newExpense.id,
          extracted_from_receipt_id: newReceiptId, // Link line items to the new receipt
        }));
        const { error: lineItemsError } = await supabase.from("expense_line_items").insert(lineItemsToInsert);
        if (lineItemsError) console.error("Error inserting line items:", lineItemsError);
      }

      return newExpense;
    },
    onSuccess: (newExpense) => {
      queryClient.invalidateQueries({ queryKey: ["expenses-with-submitter"] }); // Invalidate the correct query
      // Invalidate specific expense if it was an update
      if (newExpense?.id) {
        queryClient.invalidateQueries({ queryKey: ["expense", newExpense.id] });
      }
      toast({
        title: `Expense ${currentSubmissionType === 'draft' ? 'Saved as Draft' : 'Submitted'}`,
        description: `Your expense has been successfully ${currentSubmissionType === 'draft' ? 'saved as a draft.' : 'submitted for review.'}`,
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: `Error ${currentSubmissionType === 'draft' ? 'saving draft' : 'submitting expense'}`,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormValues & { status: 'draft' | 'submitted' }) => { // Added status to data type
      if (!currentUserId || !editingExpense) throw new Error("User not authenticated or no expense to edit.");

      // 1. Handle receipt upload/update/delete if new file is present or existing is removed
      let receiptFileUrl: string | null = editingExpense.receipts?.[0]?.file_url ?? null;
      let receiptFileName: string | null = editingExpense.receipts?.[0]?.file_name ?? null;
      let receiptMimeType: string | null = editingExpense.receipts?.[0]?.mime_type ?? null;
      let aiExtractedText: string | null = editingExpense.receipts?.[0]?.ai_extracted_text ?? null;
      let aiRawJson: Record<string, unknown> | null = editingExpense.receipts?.[0]?.ai_raw_json ?? null;
      let textHash: string | null = editingExpense.receipts?.[0]?.text_hash ?? null;
      let documentTypeClassification: string | null = editingExpense.receipts?.[0]?.document_type_classification ?? null;
      let documentTypeConfidence: number | null = editingExpense.receipts?.[0]?.document_type_confidence ?? null;
      let existingReceiptId: string | null = editingExpense.receipts?.[0]?.id ?? null;

      if (uploadedFile) { // New file selected
        const fileExtension = uploadedFile.name.split('.').pop();
        const filePath = `${currentUserId}/receipts/${Date.now()}.${fileExtension}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(filePath, uploadedFile, {
            upsert: true,
          });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('expense-receipts')
          .getPublicUrl(uploadData.path);

        receiptFileUrl = publicUrlData.publicUrl;
        receiptFileName = uploadedFile.name;
        receiptMimeType = uploadedFile.type;
        aiExtractedText = aiAnalysisResult?.ai_extracted_text ?? null;
        aiRawJson = aiAnalysisResult?.ai_raw_json ?? null;
        textHash = aiAnalysisResult?.text_hash ?? null;
        documentTypeClassification = aiAnalysisResult?.document_type_classification ?? null;
        documentTypeConfidence = aiAnalysisResult?.document_type_confidence ?? null;

        // If there was an old receipt, delete it from storage
        if (editingExpense.receipts?.[0]?.file_url) {
          const oldFilePath = editingExpense.receipts[0].file_url.split('/public/expense-receipts/')[1];
          if (oldFilePath) await supabase.storage.from('expense-receipts').remove([oldFilePath]);
        }
      } else if (receiptPreviewUrl === null && editingExpense.receipts?.[0]?.file_url) { // Existing receipt removed
        const oldFilePath = editingExpense.receipts[0].file_url.split('/public/expense-receipts/')[1];
        if (oldFilePath) await supabase.storage.from('expense-receipts').remove([oldFilePath]);
        receiptFileUrl = null;
        receiptFileName = null;
        receiptMimeType = null;
        aiExtractedText = null;
        aiRawJson = null;
        textHash = null;
        documentTypeClassification = null;
        documentTypeConfidence = null;
      }

      // Upsert receipt record
      if (receiptFileUrl && existingReceiptId) { // Update existing receipt record
        const { error: updateReceiptError } = await supabase.from("receipts").update({
          file_url: receiptFileUrl,
          file_name: receiptFileName,
          mime_type: receiptMimeType,
          ai_extracted_text: aiExtractedText,
          ai_raw_json: aiRawJson,
          text_hash: textHash,
          document_type_classification: documentTypeClassification,
          document_type_confidence: documentTypeConfidence,
          uploaded_at: new Date().toISOString(),
        }).eq('id', existingReceiptId);
        if (updateReceiptError) console.error("Error updating receipt record:", updateReceiptError);
      } else if (receiptFileUrl && !existingReceiptId) { // Insert new receipt record
        const { data: newReceipt, error: insertReceiptError } = await supabase.from("receipts").insert({
          expense_id: editingExpense.id,
          file_url: receiptFileUrl,
          file_name: receiptFileName,
          mime_type: receiptMimeType,
          uploaded_by: currentUserId,
          ai_extracted_text: aiExtractedText,
          ai_raw_json: aiRawJson,
          text_hash: textHash,
          document_type_classification: documentTypeClassification,
          document_type_confidence: documentTypeConfidence,
        }).select('id').single();
        if (insertReceiptError) console.error("Error inserting new receipt record:", insertReceiptError);
        existingReceiptId = newReceipt?.id ?? null;
      } else if (!receiptFileUrl && existingReceiptId) { // Delete existing receipt record
        const { error: deleteReceiptError } = await supabase.from("receipts").delete().eq('id', existingReceiptId);
        if (deleteReceiptError) console.error("Error deleting receipt record:", deleteReceiptError);
        existingReceiptId = null;
      }

      // Fetch company's default currency for base_currency_amount calculation
      const { data: companyData, error: companyError } = await supabase.from('companies').select('default_currency').eq('id', currentCompanyId).single();
      if (companyError) console.error("Error fetching company default currency:", companyError);
      const companyDefaultCurrency = companyData?.default_currency ?? 'USD';

      let baseCurrencyAmount: number | null = null;
      let exchangeRate: number | null = null;

      if (data.amount && data.currency_code && companyDefaultCurrency) {
        if (data.currency_code === companyDefaultCurrency) {
          baseCurrencyAmount = data.amount;
          exchangeRate = 1;
        } else {
          // Placeholder for actual currency conversion API call
          console.warn(`DEBUG: Currency conversion from ${data.currency_code} to ${companyDefaultCurrency} is a placeholder.`);
          if (data.currency_code === 'USD' && companyDefaultCurrency === 'CAD') {
            exchangeRate = 1.35;
            baseCurrencyAmount = data.amount * exchangeRate;
          } else if (data.currency_code === 'CAD' && companyDefaultCurrency === 'USD') {
            exchangeRate = 0.74; // 1/1.35
            baseCurrencyAmount = data.amount * exchangeRate;
          } else {
            exchangeRate = 1;
            baseCurrencyAmount = data.amount;
          }
        }
      }

      // 2. Update expense
      const { error: expenseUpdateError } = await supabase.from("expenses").update({
        title: data.title ?? null, // Allow null for draft
        description: data.description ?? null,
        amount: data.amount, // This is original_currency_amount
        expense_date: data.expense_date ? format(data.expense_date, "yyyy-MM-dd") : null, // Allow null for draft
        category_id: data.category_id ?? null,
        gl_account_id: data.gl_account_id ?? null,
        currency_code: data.currency_code ?? null, // Allow null for draft
        base_currency_amount: baseCurrencyAmount,
        exchange_rate: exchangeRate,
        vendor_name: data.vendor_name ?? null,
        merchant_address: data.merchant_address ?? null,
        receipt_summary: data.receipt_summary ?? null,
        ai_confidence_score: data.ai_confidence_score ?? null,
        is_reimbursable: data.is_reimbursable,
        project_code: data.project_code ?? null,
        cost_center: data.cost_center ?? null,
        status: data.status, // Use data.status directly
        updated_at: new Date().toISOString(),
      }).eq("id", editingExpense.id).eq("submitted_by", currentUserId);
      if (expenseUpdateError) throw expenseUpdateError;

      // 3. Update line items: delete existing, insert new
      await supabase.from("expense_line_items").delete().eq('expense_id', editingExpense.id);
      if (data.line_items && data.line_items.length > 0) {
        const lineItemsToInsert = data.line_items.map(item => ({
          ...item,
          expense_id: editingExpense.id,
          extracted_from_receipt_id: existingReceiptId,
        }));
        const { error: lineItemsError } = await supabase.from("expense_line_items").insert(lineItemsToInsert);
        if (lineItemsError) console.error("Error inserting line items during update:", lineItemsError);
      }

      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses-with-submitter"] }); // Invalidate the correct query
      queryClient.invalidateQueries({ queryKey: ["expense", editingExpense?.id] }); // Invalidate detail page
      toast({
        title: `Expense ${currentSubmissionType === 'draft' ? 'Saved as Draft' : 'Submitted'}`,
        description: `Your expense has been successfully ${currentSubmissionType === 'draft' ? 'saved as a draft.' : 'submitted for review.'}`,
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: `Error ${currentSubmissionType === 'draft' ? 'saving draft' : 'submitting expense'}`,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleAiAnalysisComplete = async (result: Record<string, unknown>, file: File, previewUrl: string, docId?: string) => {
    setAiAnalysisResult(result);
    setUploadedFile(file);
    setReceiptPreviewUrl(previewUrl);
    setDocumentId(docId || null); // Store document ID from new document system
    setIsAnalyzing(false);

    // Try to create invoice structure from AI result
    try {
      // TEMPORARY: Always show invoice view for development/demo
      // TODO: Restore original condition: if (result.invoiceData && typeof result.invoiceData === 'object')
      if (true) { // Always trigger invoice view for now
        // Create mock invoice data structure for demonstration
        const mockOcrData: InvoiceOCRData = {
          header: {
            invoiceNumber: result.title || 'INV-001',
            purchaseOrderNumber: null,
            issueDate: result.expense_date || new Date().toISOString(),
            dueDate: null,
            reference: null
          },
          vendor: {
            name: result.vendor_name || 'Demo Vendor',
            address: result.merchant_address || 'Demo Address',
            phone: null,
            email: null,
            website: null,
            taxNumber: null
          },
          billTo: {
            name: 'Your Company',
            address: 'Your Company Address'
          },
          lineItems: result.line_items?.map((item: any, index: number) => ({
            lineNumber: index + 1,
            description: item.description || 'Demo Item',
            quantity: item.quantity || 1,
            unitPrice: item.unit_price || result.original_currency_amount || 0,
            amount: item.line_amount || result.original_currency_amount || 0,
            productCode: null,
            taxRate: 0.13, // Demo tax rate
            taxAmount: (item.line_amount || result.original_currency_amount || 0) * 0.13,
            confidence: 0.85
          })) || [{
            lineNumber: 1,
            description: result.description || 'Expense Item',
            quantity: 1,
            unitPrice: result.original_currency_amount || 0,
            amount: result.original_currency_amount || 0,
            productCode: null,
            taxRate: 0.13,
            taxAmount: (result.original_currency_amount || 0) * 0.13,
            confidence: 0.85
          }],
          taxes: [{
            type: 'HST',
            rate: 0.13,
            baseAmount: result.original_currency_amount || 0,
            taxAmount: (result.original_currency_amount || 0) * 0.13,
            jurisdiction: 'Canada',
            confidence: 0.8
          }],
          totals: {
            subtotal: result.original_currency_amount || 0,
            totalTax: (result.original_currency_amount || 0) * 0.13,
            grandTotal: (result.original_currency_amount || 0) * 1.13,
            currency: result.original_currency_code || 'USD',
            confidence: 0.9
          },
          overallConfidence: 0.85,
          documentQuality: 'good'
        };

        const ocrData = mockOcrData;

        const extractionService = new InvoiceExtractionService({
          companyDefaultCurrency: 'USD', // TODO: Get from company settings
          enableTaxValidation: true,
          strictModeEnabled: false,
          confidenceThreshold: 0.6
        });

        const invoiceStructure = await extractionService.extractInvoiceFromOCR(
          ocrData,
          result.processing_time_ms as number || 0,
          'openai-vision-preview'
        );

        setInvoiceStructure(invoiceStructure);
        setShowInvoiceView(true);

        // Populate form from invoice structure for fallback
        form.setValue("title", result.title ?? invoiceStructure.header.vendorName);
        form.setValue("description", result.description ?? null);
        form.setValue("amount", result.original_currency_amount ?? invoiceStructure.summary.grandTotal);
        form.setValue("currency_code", result.original_currency_code ?? invoiceStructure.summary.currency);
        if (result.expense_date || invoiceStructure.header.issueDate) {
          form.setValue("expense_date", new Date(result.expense_date || invoiceStructure.header.issueDate!));
        }
        form.setValue("vendor_name", result.vendor_name ?? invoiceStructure.header.vendorName);
        form.setValue("merchant_address", result.merchant_address ?? invoiceStructure.header.vendorAddress);

        toast({
          title: "Invoice Extracted Successfully",
          description: "Review the invoice details and make any necessary adjustments.",
        });

        return; // Exit early since we're showing invoice view
      }
    } catch (error) {
      console.error('Failed to create invoice structure:', error);
      // Fall back to traditional form view
      setShowInvoiceView(false);
    }

    // Traditional form population (fallback or when invoice structure not available)
    form.setValue("title", result.title ?? "");
    form.setValue("description", result.description ?? null);
    form.setValue("amount", result.original_currency_amount ?? 0);
    form.setValue("currency_code", result.original_currency_code ?? "USD");
    if (result.expense_date) form.setValue("expense_date", new Date(result.expense_date));
    form.setValue("category_id", result.category_id ?? null);
    form.setValue("gl_account_id", result.gl_account_id ?? null);
    form.setValue("vendor_name", result.vendor_name ?? null);
    form.setValue("merchant_address", result.merchant_address ?? null);
    form.setValue("receipt_summary", result.receipt_summary ?? null);
    form.setValue("ai_confidence_score", result.ai_confidence_score ?? null);
    form.setValue("is_reimbursable", result.is_reimbursable ?? true);
    form.setValue("project_code", result.project_code ?? null);
    form.setValue("cost_center", result.cost_center ?? null);

    // Handle line items
    if (result.line_items && result.line_items.length > 0) {
      form.setValue("line_items", result.line_items.map((item: Partial<ExpenseLineItem>) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_amount: item.line_amount,
        currency_code: item.currency_code,
      })));
    } else {
      form.setValue("line_items", []);
    }

    toast({
      title: "AI Analysis Complete",
      description: "Expense details have been extracted. Please review and adjust as needed.",
    });
  };

  const handleRemoveReceipt = () => {
    setUploadedFile(null);
    setReceiptPreviewUrl(null);
    setAiAnalysisResult(null);
    setDocumentId(null); // Clear document ID
    setInvoiceStructure(null);
    setShowInvoiceView(false);
    setInvoiceEditable(true);
    // Clear AI-filled fields from form, but keep manually entered ones
    form.setValue("vendor_name", null);
    form.setValue("merchant_address", null);
    form.setValue("receipt_summary", null);
    form.setValue("ai_confidence_score", null);
    form.setValue("line_items", []);
    toast({ title: "Receipt Removed", description: "AI analysis data cleared." });
  };

  // Invoice view handlers
  const handleInvoiceFieldEdit = (fieldPath: string, newValue: any) => {
    if (!invoiceStructure) return;

    const updatedInvoice = { ...invoiceStructure };

    // Simple field path handling (could be enhanced with lodash.set)
    if (fieldPath.startsWith('header.')) {
      const field = fieldPath.replace('header.', '');
      (updatedInvoice.header as any)[field] = newValue;
    }

    setInvoiceStructure(updatedInvoice);

    // Also update the form for consistency
    if (fieldPath === 'header.vendorName') {
      form.setValue('vendor_name', newValue);
    } else if (fieldPath === 'header.vendorAddress') {
      form.setValue('merchant_address', newValue);
    }
  };

  const handleInvoiceLineItemEdit = (lineIndex: number, field: string, value: any) => {
    if (!invoiceStructure) return;

    const updatedInvoice = { ...invoiceStructure };
    if (updatedInvoice.lineItems[lineIndex]) {
      (updatedInvoice.lineItems[lineIndex] as any)[field] = value;

      // Recalculate totals if amounts change
      if (field === 'line_amount') {
        const newSubtotal = updatedInvoice.lineItems.reduce((sum, item) => sum + item.line_amount, 0);
        updatedInvoice.summary.subtotal = newSubtotal;
        updatedInvoice.summary.grandTotal = newSubtotal + updatedInvoice.summary.totalTax;

        // Update form total as well
        form.setValue('amount', updatedInvoice.summary.grandTotal);
      }
    }

    setInvoiceStructure(updatedInvoice);
  };

  const handleInvoiceTaxEdit = (taxIndex: number, field: string, value: any) => {
    if (!invoiceStructure) return;

    const updatedInvoice = { ...invoiceStructure };
    if (updatedInvoice.taxBreakdown[taxIndex]) {
      (updatedInvoice.taxBreakdown[taxIndex] as any)[field] = value;

      // Recalculate total tax
      const newTotalTax = updatedInvoice.taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0);
      updatedInvoice.summary.totalTax = newTotalTax;
      updatedInvoice.summary.grandTotal = updatedInvoice.summary.subtotal + newTotalTax;

      // Update form total as well
      form.setValue('amount', updatedInvoice.summary.grandTotal);
    }

    setInvoiceStructure(updatedInvoice);
  };

  const handleSwitchToForm = () => {
    setShowInvoiceView(false);
    toast({
      title: "Switched to Form View",
      description: "You can now edit the expense using the traditional form.",
    });
  };

  const handleBackToInvoice = () => {
    if (invoiceStructure) {
      setShowInvoiceView(true);
      toast({
        title: "Returned to Invoice View",
        description: "Continue reviewing the invoice-style layout.",
      });
    }
  };

  const onSubmit = (data: ExpenseFormValues, submissionType: 'draft' | 'submitted') => { // Corrected submissionType type
    setCurrentSubmissionType(submissionType); // Set the submission type for UI feedback

    // Manually trigger validation based on submissionType
    if (submissionType === 'submitted') { // Changed to 'submitted'
      const validationResult = currentDynamicSchema.safeParse(data); // Use currentDynamicSchema for validation
      if (!validationResult.success) {
        // Map Zod errors to react-hook-form errors
        validationResult.error.errors.forEach(err => {
          form.setError(err.path.join('.') as keyof ExpenseFormValues, {
            type: "manual",
            message: err.message,
          });
        });
        toast({
          title: "Validation Error",
          description: "Please fill out all required fields before submitting.",
          variant: "destructive",
        });
        return; // Stop submission if validation fails
      }
    }

    if (editingExpense) {
      updateExpenseMutation.mutate({ ...data, status: submissionType }); // Pass status explicitly
    } else {
      createExpenseMutation.mutate({ ...data, status: submissionType }); // Pass status explicitly
    }
  };

  const isLoadingPage = isLoadingSession || isLoadingExpenseModuleId || isLoadingConfig;
  const isSaving = createExpenseMutation.isPending || updateExpenseMutation.isPending;
  const canViewGLAccounts = ['admin', 'controller', 'super-admin'].includes(userRole ?? '');

  const amount = form.watch("amount");
  const currencyCode = form.watch("currency_code");
  const aiConfidence = form.watch("ai_confidence_score");

  // Helper to get field visibility and required status
  const getFieldConfig = (fieldKey: string): FieldSetting => {
    return userFieldsConfig[fieldKey] ?? { visible: true, required: false }; // Default to visible, not required
  };

  if (isLoadingPage) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading expense form configuration...</p>
      </div>
    );
  }

  return (
    <DialogContent variant="full-width">
      <DialogHeader>
        <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
        <DialogDescription>
          {editingExpense ? "Update your expense details." : "Create a new expense by uploading a receipt or entering details manually."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-6">
        {/* Receipt Upload Section - Hidden in AI Mode */}
        {!aiMode && getFieldConfig("receipt_upload").visible && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Smart Receipt Upload
              </CardTitle>
              <CardDescription>
                Upload an image or PDF of your receipt for automatic data extraction.
                {getFieldConfig("receipt_upload").required && <span className="text-destructive ml-1">* Required</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReceiptUpload
                onFileSelected={handleAiAnalysisComplete}
                onRemoveFile={handleRemoveReceipt}
                isLoading={isAnalyzing}
                currentPreviewUrl={receiptPreviewUrl}
                companyId={currentCompanyId ?? ""}
                userId={currentUserId ?? ""}
                expenseId={editingExpense?.id} // Pass expense ID for document association
                setIsAnalyzing={setIsAnalyzing}
              />

              {aiConfidence !== null && (aiConfidence ?? 0) < 0.5 && (
                <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <p>AI confidence is low ({Math.round((aiConfidence ?? 0) * 100)}%). Please review extracted details carefully.</p>
                </div>
              )}
              {getFieldConfig("receipt_upload").required && !uploadedFile && !editingExpense?.receipts?.length && currentSubmissionType === 'submitted' && ( // Changed to 'submitted'
                <p className="text-sm text-destructive flex items-center gap-1 mt-2">
                  <AlertCircle className="h-3 w-3" />
                  A receipt upload is required.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoice View Section */}
        {showInvoiceView && invoiceStructure && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Invoice Review</h3>
                <p className="text-sm text-muted-foreground">
                  Review the extracted invoice data and make any necessary adjustments.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSwitchToForm}
                  disabled={isSaving}
                >
                  Switch to Form
                </Button>
              </div>
            </div>

            {aiMode ? (
              <DualColumnInvoiceView
                invoiceData={invoiceStructure}
                documentUrl={receiptPreviewUrl}
                documentFile={aiUploadedFile}
                onFieldEdit={handleInvoiceFieldEdit}
                onLineItemEdit={handleInvoiceLineItemEdit}
                onTaxEdit={handleInvoiceTaxEdit}
                editable={invoiceEditable}
                className="h-[600px]"
              />
            ) : (
              <InvoiceView
                invoiceData={invoiceStructure}
                onFieldEdit={handleInvoiceFieldEdit}
                onLineItemEdit={handleInvoiceLineItemEdit}
                onTaxEdit={handleInvoiceTaxEdit}
                editable={invoiceEditable}
                showConfidence={true}
                compact={false}
              />
            )}

            {/* Invoice View Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={form.handleSubmit((data) => onSubmit(data, 'draft'))}
                disabled={isSaving}
              >
                {isSaving && currentSubmissionType === 'draft' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={form.handleSubmit((data) => onSubmit(data, 'submitted'))}
                disabled={isSaving}
              >
                {isSaving && currentSubmissionType === 'submitted' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" /> Submit Expense
              </Button>
            </div>
          </div>
        )}

        {/* Traditional Expense Form (shown when not in invoice view) */}
        {!showInvoiceView && (
          <>
            {invoiceStructure && (
              <div className="mb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToInvoice}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Back to Invoice View
                </Button>
              </div>
            )}

            <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expense Details</CardTitle>
            <CardDescription>
              Fill in the expense information below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4">
              {getFieldConfig("title").visible && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title {getFieldConfig("title").required && "*"}</Label>
                    <Input
                      id="title"
                      {...form.register("title")}
                      disabled={isSaving}
                    />
                    {form.formState.errors.title && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {form.formState.errors.title.message}
                      </p>
                    )}
                  </div>

                  {getFieldConfig("expense_date").visible && (
                    <div className="space-y-2">
                      <Label htmlFor="expense_date">Expense Date {getFieldConfig("expense_date").required && "*"}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !form.watch("expense_date") && "text-muted-foreground"
                            )}
                            disabled={isSaving}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.watch("expense_date") ? (
                              format(form.watch("expense_date") as Date, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={form.watch("expense_date") ?? undefined}
                            onSelect={(date) => form.setValue("expense_date", date ?? null)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {form.formState.errors.expense_date && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {form.formState.errors.expense_date.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {getFieldConfig("description").visible && (
                <div className="space-y-2">
                  <Label htmlFor="description">Description {getFieldConfig("description").required && "*"}</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    disabled={isSaving}
                    rows={3}
                  />
                  {form.formState.errors.description && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {form.formState.errors.description.message}
                    </p>
                  )}
                </div>
              )}

              {(getFieldConfig("amount").visible || getFieldConfig("currency_code").visible) && (
                <>
                  <Separator />
                  <h4 className="text-md font-semibold">Amount Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getFieldConfig("amount").visible && (
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount {getFieldConfig("amount").required && "*"}</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          {...form.register("amount", { valueAsNumber: true })}
                          disabled={isSaving}
                        />
                        {form.formState.errors.amount && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {form.formState.errors.amount.message}
                          </p>
                        )}
                      </div>
                    )}

                    {getFieldConfig("currency_code").visible && (
                      <div className="space-y-2">
                        <Label htmlFor="currency_code">Currency {getFieldConfig("currency_code").required && "*"}</Label>
                        <Select
                          onValueChange={(value) => form.setValue("currency_code", value)}
                          value={form.watch("currency_code") ?? ""}
                          disabled={isSaving}
                        >
                          <SelectTrigger id="currency_code">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {allCurrencies?.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.code} - {currency.name} ({currency.symbol})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.currency_code && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {form.formState.errors.currency_code.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {amount > 0 && currencyCode && (
                    <div className="text-sm text-muted-foreground mt-2">
                      Expense Amount: <FormattedCurrencyDisplay amount={amount} currencyCode={currencyCode} />
                    </div>
                  )}
                </>
              )}

              {(getFieldConfig("vendor_name").visible || getFieldConfig("merchant_address").visible || getFieldConfig("project_code").visible || getFieldConfig("cost_center").visible) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getFieldConfig("vendor_name").visible && (
                      <div className="space-y-2">
                        <Label htmlFor="vendor_name">Vendor Name {getFieldConfig("vendor_name").required && "*"}</Label>
                        <Input
                          id="vendor_name"
                          {...form.register("vendor_name")}
                          disabled={isSaving}
                        />
                        {form.formState.errors.vendor_name && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {form.formState.errors.vendor_name.message}
                          </p>
                        )}
                      </div>
                    )}
                    {getFieldConfig("merchant_address").visible && (
                      <div className="space-y-2">
                        <Label htmlFor="merchant_address">Merchant Address {getFieldConfig("merchant_address").required && "*"}</Label>
                        <Input
                          id="merchant_address"
                          {...form.register("merchant_address")}
                          disabled={isSaving}
                        />
                        {form.formState.errors.merchant_address && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {form.formState.errors.merchant_address.message}
                          </p>
                        )}
                      </div>
                    )}
                    {getFieldConfig("project_code").visible && (
                      <div className="space-y-2">
                        <Label htmlFor="project_code">Project Code {getFieldConfig("project_code").required && "*"}</Label>
                        <Input
                          id="project_code"
                          {...form.register("project_code")}
                          disabled={isSaving}
                        />
                        {form.formState.errors.project_code && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {form.formState.errors.project_code.message}
                          </p>
                        )}
                      </div>
                    )}
                    {getFieldConfig("cost_center").visible && (
                      <div className="space-y-2">
                        <Label htmlFor="cost_center">Cost Center {getFieldConfig("cost_center").required && "*"}</Label>
                        <Input
                          id="cost_center"
                          {...form.register("cost_center")}
                          disabled={isSaving}
                        />
                        {form.formState.errors.cost_center && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {form.formState.errors.cost_center.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {(getFieldConfig("category_id").visible || (getFieldConfig("gl_account_id").visible && canViewGLAccounts)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getFieldConfig("category_id").visible && (
                    <div className="space-y-2">
                      <Label htmlFor="category_id">Category {getFieldConfig("category_id").required && "*"}</Label>
                      <Select
                        onValueChange={(value) => form.setValue("category_id", value)}
                        value={form.watch("category_id") ?? ""}
                        disabled={isSaving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                          <SelectContent>
                            {categories?.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                      </Select>
                      {form.formState.errors.category_id && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {form.formState.errors.category_id.message}
                        </p>
                      )}
                    </div>
                  )}

                  {getFieldConfig("gl_account_id").visible && canViewGLAccounts && (
                    <div className="space-y-2">
                      <Label htmlFor="gl_account_id">GL Account {getFieldConfig("gl_account_id").required && "*"}</Label>
                      <Select
                        onValueChange={(value) => form.setValue("gl_account_id", value)}
                        value={form.watch("gl_account_id") ?? ""}
                        disabled={isSaving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a GL account" />
                        </SelectTrigger>
                        <SelectContent>
                          {glAccounts?.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_code} - {account.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.gl_account_id && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {form.formState.errors.gl_account_id.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {getFieldConfig("is_reimbursable").visible && (
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="is_reimbursable"
                    checked={form.watch("is_reimbursable")}
                    onCheckedChange={(checked) => form.setValue("is_reimbursable", checked as boolean)}
                    disabled={isSaving}
                  />
                  <Label htmlFor="is_reimbursable">Is Reimbursable {getFieldConfig("is_reimbursable").required && "*"}</Label>
                  {form.formState.errors.is_reimbursable && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {form.formState.errors.is_reimbursable.message}
                    </p>
                  )}
                </div>
              )}

              {getFieldConfig("line_items").visible && (
                <>
                  <Separator />
                  <h4 className="text-md font-semibold flex items-center gap-2">
                    Line Items {getFieldConfig("line_items").required && "*"}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendLineItem({ description: "", line_amount: 0, currency_code: form.watch("currency_code") ?? "USD" })} disabled={isSaving}>
                      <PlusCircle className="h-3 w-3 mr-1" /> Add Line Item
                    </Button>
                  </h4>
                  {form.formState.errors.line_items && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {form.formState.errors.line_items.message}
                    </p>
                  )}
                  {lineItemFields.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No line items extracted or added yet. Click "Add Line Item" to manually add one.</p>
                  ) : (
                    <div className="space-y-3">
                      {lineItemFields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border p-3 rounded-md">
                          <div className="col-span-full md:col-span-2 space-y-1">
                            <Label htmlFor={`line_items.${index}.description`}>Description *</Label>
                            <Input
                              id={`line_items.${index}.description`}
                              {...form.register(`line_items.${index}.description`)}
                              disabled={isSaving}
                            />
                            {form.formState.errors.line_items?.[index]?.description && (
                              <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {form.formState.errors.line_items[index]?.description?.message}
                              </p>
                            )}
                          </div>
                          <div className="col-span-full md:col-span-1 space-y-1">
                            <Label htmlFor={`line_items.${index}.quantity`}>Qty</Label>
                            <Input
                              id={`line_items.${index}.quantity`}
                              type="number"
                              step="0.01"
                              {...form.register(`line_items.${index}.quantity`, { valueAsNumber: true })}
                              disabled={isSaving}
                            />
                          </div>
                          <div className="col-span-full md:col-span-1 space-y-1">
                            <Label htmlFor={`line_items.${index}.unit_price`}>Unit Price</Label>
                            <FormattedCurrencyInput
                              id={`line_items.${index}.unit_price`}
                              value={form.watch(`line_items.${index}.unit_price`) ?? 0}
                              onChange={(val) => form.setValue(`line_items.${index}.unit_price`, val)}
                              disabled={isSaving}
                              currencyCode={form.watch(`line_items.${index}.currency_code`) || "USD"}
                            />
                          </div>
                          <div className="col-span-full md:col-span-1 space-y-1">
                            <Label htmlFor={`line_items.${index}.line_amount`}>Amount *</Label>
                            <FormattedCurrencyInput
                              id={`line_items.${index}.line_amount`}
                              value={form.watch(`line_items.${index}.line_amount`) ?? 0}
                              onChange={(val) => form.setValue(`line_items.${index}.line_amount`, val)}
                              disabled={isSaving}
                              currencyCode={form.watch(`line_items.${index}.currency_code`) || "USD"}
                            />
                            {form.formState.errors.line_items?.[index]?.line_amount && (
                              <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {form.formState.errors.line_items[index]?.line_amount?.message}
                              </p>
                            )}
                          </div>
                          <div className="col-span-full md:col-span-1 flex justify-end items-center">
                            <Button type="button" variant="destructive" size="icon" onClick={() => removeLineItem(index)} disabled={isSaving}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, 'draft'))} disabled={isSaving}>
                  {isSaving && currentSubmissionType === 'draft' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Draft
                </Button>
                <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, 'submitted'))} disabled={isSaving}> {/* Changed to 'submitted' */}
                  {isSaving && currentSubmissionType === 'submitted' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {/* Changed to 'submitted' */}
                  <Send className="mr-2 h-4 w-4" /> Submit Expense
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </DialogContent>
  );
};

export default AddEditExpenseDialog;