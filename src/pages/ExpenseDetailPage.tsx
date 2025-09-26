"use client";

import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/components/SessionContextProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, MessageSquare, CheckCircle2, XCircle, Download, FileText, Eye, AlertCircle, Copy } from "lucide-react"; // All icons are now used
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { // All AlertDialog imports are now used
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FormattedCurrencyDisplay from "@/components/FormattedCurrencyDisplay";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // For receipt viewer
import { Expense, ExpenseComment, ExpenseAuditLog, Receipt, ExpenseLineItem, InvoiceStructure } from "@/types/expenses"; // Imported Receipt, ExpenseLineItem, InvoiceStructure
import InvoiceView from "@/components/InvoiceView"; // Import InvoiceView component
import { InvoiceExtractionService } from "@/services/ingrid/InvoiceExtractionService"; // Import extraction service
import { InvoiceOCRData } from "@/services/ingrid/OCRService"; // Import OCR data type
import { LazyPdfViewer } from "@/components/LazyPdfViewer";

// Define the structure for field settings
interface FieldSetting {
  visible: boolean;
  required: boolean;
}

// Define interface for company-wide duplicate receipts
interface CompanyDuplicateReceipt {
  receipt_id: string;
  file_url: string;
  file_name: string;
  uploaded_by_user_id: string;
  uploaded_at: string;
  expense_id: string;
  expense_title: string;
  submitted_by_user_name: string;
}

// Define a minimal Profile type for fetched data
interface ProfileSummary {
  user_id: string;
  full_name: string | null;
  email: string;
}

const ExpenseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const [commentText, setCommentText] = useState("");
  const [reviewNotes, setReviewNotes] = useState(""); // Re-added
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false); // Re-added
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "request_info" | null>(null); // Re-added
  const [expenseToReview, setExpenseToReview] = useState<Expense | null>(null); // Re-added
  const [isReceiptViewerOpen, setIsReceiptViewerOpen] = useState(false);
  const [currentReceiptUrl, setCurrentReceiptUrl] = useState<string | null>(null);
  const [currentReceiptMimeType, setCurrentReceiptMimeType] = useState<string | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [invoiceStructure, setInvoiceStructure] = useState<InvoiceStructure | null>(null);
  const [showInvoiceView, setShowInvoiceView] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);

  const currentUserId = profile?.user_id;
  const userRole = profile?.role;
  const currentCompanyId = profile?.company_id;

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
  const { data: expenseModuleConfig, isLoading: isLoadingConfig } = useQuery<{ settings: { controller_fields: Record<string, FieldSetting> } } | null>({
    queryKey: ["expenseModuleControllerConfig", currentCompanyId, expenseModuleId],
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
      } catch (error: any) {
        // Handle missing module_configurations table gracefully
        if (error.code === 'PGRST205' || error.status === 406) {
          console.warn('Module configurations table not found - using default field settings');
          return null;
        }
        throw error;
      }
    },
    enabled: !!currentCompanyId && !!expenseModuleId && !isLoadingSession,
  });

  // Fetch the core expense data
  const { data: expenseData, isLoading: isLoadingExpense, isError: isErrorExpense } = useQuery<Expense>({
    queryKey: ["expense", id],
    queryFn: async () => {
      if (!id) throw new Error("Expense ID is missing.");
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          expense_categories (name),
          gl_accounts (account_code, account_name),
          receipts (id, file_url, file_name, mime_type),
          expense_line_items (id, description, quantity, unit_price, line_amount, currency_code)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      // Manually flatten nested objects into the main Expense object
      return {
        ...data,
        category_name: data.expense_categories?.name ?? null,
        gl_account_code: data.gl_accounts?.account_code ?? null,
        gl_account_name: data.gl_accounts?.account_name ?? null,
      } as Expense;
    },
    enabled: !!id,
  });

  // Fetch submitter profile separately
  const { data: submitterProfile, isLoading: isLoadingSubmitterProfile } = useQuery<ProfileSummary | null>({
    queryKey: ["submitterProfile", expenseData?.submitted_by],
    queryFn: async () => {
      if (!expenseData?.submitted_by) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_id", expenseData.submitted_by)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!expenseData?.submitted_by,
  });

  // Fetch reviewer profile separately
  const { data: reviewerProfile, isLoading: isLoadingReviewerProfile } = useQuery<ProfileSummary | null>({
    queryKey: ["reviewerProfile", expenseData?.reviewer_id],
    queryFn: async () => {
      if (!expenseData?.reviewer_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_id", expenseData.reviewer_id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!expenseData?.reviewer_id,
  });

  // Fetch controller profile separately
  const { data: controllerProfile, isLoading: isLoadingControllerProfile } = useQuery<ProfileSummary | null>({
    queryKey: ["controllerProfile", expenseData?.controller_id],
    queryFn: async () => {
      if (!expenseData?.controller_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_id", expenseData.controller_id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!expenseData?.controller_id,
  });

  // Fetch company default currency
  const { data: companyDefaultCurrencyData, isLoading: isLoadingCompanyDefaultCurrency } = useQuery<{ default_currency: string } | null>({
    queryKey: ["companyDefaultCurrency", expenseData?.company_id],
    queryFn: async () => {
      if (!expenseData?.company_id) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("default_currency")
        .eq("id", expenseData.company_id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!expenseData?.company_id,
  });
  const companyBaseCurrencyCode = companyDefaultCurrencyData?.default_currency ?? "USD";


  // Combine expense data with fetched profiles for rendering
  const expense = useMemo(() => {
    if (!expenseData) return null;
    return {
      ...expenseData,
      submitter_profile: submitterProfile,
      reviewer_profile: reviewerProfile,
      controller_profile: controllerProfile,
    } as Expense;
  }, [expenseData, submitterProfile, reviewerProfile, controllerProfile]);

  // Try to extract invoice structure from expense AI data
  const extractInvoiceStructure = async (expense: Expense) => {
    if (!expense.receipts?.[0]?.ai_raw_json) return;

    try {
      setIsLoadingInvoice(true);
      const aiData = expense.receipts[0].ai_raw_json;

      // Check if the AI data has structured invoice information
      if (aiData.invoiceData && typeof aiData.invoiceData === 'object') {
        const ocrData = aiData.invoiceData as InvoiceOCRData;

        const extractionService = new InvoiceExtractionService({
          companyDefaultCurrency: companyBaseCurrencyCode || 'USD',
          enableTaxValidation: true,
          strictModeEnabled: false,
          confidenceThreshold: 0.6
        });

        const invoiceData = await extractionService.extractInvoiceFromOCR(
          ocrData,
          aiData.processing_time_ms as number || 0,
          'openai-vision-preview'
        );

        setInvoiceStructure(invoiceData);
        setShowInvoiceView(true);
      }
    } catch (error) {
      console.error('Failed to extract invoice structure:', error);
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  // Extract invoice structure when expense data is available
  useMemo(() => {
    if (expense && !invoiceStructure && !isLoadingInvoice) {
      extractInvoiceStructure(expense);
    }
  }, [expense, companyBaseCurrencyCode]);


  const { data: comments, isLoading: isLoadingComments } = useQuery<ExpenseComment[]>({
    queryKey: ["expense_comments", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("expense_comments")
        .select(`
          *,
          profiles (full_name, email)
        `)
        .eq("expense_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: auditLog, isLoading: isLoadingAuditLog } = useQuery<ExpenseAuditLog[]>({
    queryKey: ["expense_audit_log", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("expense_audit_log")
        .select(`
          *,
          profiles (full_name, email)
        `)
        .eq("expense_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch company-wide duplicate receipts (for controllers)
  const canViewCompanyDuplicates = userRole && ['admin', 'controller', 'super-admin'].includes(userRole);
  const { data: companyDuplicates, isLoading: isLoadingCompanyDuplicates } = useQuery<CompanyDuplicateReceipt[]>({
    queryKey: (id && !!canViewCompanyDuplicates) ? ["companyDuplicates", id] : [], // Conditional queryKey, explicitly boolean
    queryFn: async () => {
      if (!id) return []; // This check is now more for type safety within queryFn
      const { data, error } = await supabase.functions.invoke('check-company-duplicates', {
        body: { expense_id: id },
      });
      if (error) throw error;
      return data.duplicates ?? [];
    },
    enabled: !!id && !!canViewCompanyDuplicates, // Explicitly boolean
  });

  const addCommentMutation = useMutation({
    mutationFn: async (newComment: { comment: string; is_internal: boolean }) => {
      if (!id || !currentUserId) throw new Error("Expense ID or User ID missing.");
      const { error } = await supabase.from("expense_comments").insert({
        expense_id: id,
        user_id: currentUserId,
        comment: newComment.comment,
        is_internal: newComment.is_internal,
      });
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense_comments", id] });
      setCommentText("");
      toast({ title: "Comment Added", description: "Your comment has been added." });
    },
    onError: (error: any) => {
      toast({ title: "Error adding comment", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ expenseId, status, notes }: { expenseId: string; status: string; notes: string | null }) => {
      if (!expenseId) throw new Error("Expense ID missing.");
      const { data, error } = await supabase.rpc("update_expense_status", {
        expense_id: expenseId,
        new_status: status,
        notes: notes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
      queryClient.invalidateQueries({ queryKey: ["expense_audit_log", id] });
      queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] }); // Invalidate user's notifications
      queryClient.invalidateQueries({ queryKey: ["expensesForReview"] }); // Invalidate review page data
      queryClient.invalidateQueries({ queryKey: ["expenses"] }); // Invalidate submitter's expenses
      toast({ title: "Expense Status Updated", description: "Expense status has been updated." });
      setIsReviewDialogOpen(false);
      setReviewNotes("");
      setReviewAction(null);
      // Redirect to expenses page with review-inbox tab if action was 'request_info'
      if (reviewAction === "request_info") {
        navigate('/expenses', { replace: true });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    },
  });

  const canReview = userRole && ['admin', 'controller', 'super-admin'].includes(userRole) && expense?.status === 'submitted';
  const canRequestInfo = userRole && ['admin', 'controller', 'super-admin'].includes(userRole) && (expense?.status === 'submitted' || expense?.status === 'info_requested') && expense?.submitted_by !== currentUserId; // Only reviewers/controllers, not the submitter
  const canRespondToInfoRequest = expense?.status === 'info_requested' && expense?.submitted_by === currentUserId; // Only the submitter, when info is requested

  const handleViewReceipt = async (fileUrl: string, mimeType: string) => {
    setCurrentReceiptMimeType(mimeType);
    const path = fileUrl.split('/storage/v1/object/public/expense-receipts/')[1];

    if (!path) {
      console.error("Could not extract path from file URL:", fileUrl);
      toast({ title: "Error", description: "Invalid receipt file URL.", variant: "destructive" });
      setCurrentReceiptUrl(null);
      setSignedPdfUrl(null);
      return;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from('expense-receipts').createSignedUrl(path, 3600); // URL valid for 1 hour

    if (signedUrlError) {
      console.error("Error creating signed URL:", signedUrlError);
      toast({ title: "Error", description: "Failed to load receipt. Access denied or file not found.", variant: "destructive" });
      setCurrentReceiptUrl(null);
      setSignedPdfUrl(null);
    } else {
      if (mimeType === 'application/pdf') {
        setSignedPdfUrl(signedUrlData.signedUrl);
        setCurrentReceiptUrl(null); // Clear direct URL for PDF
      } else { // For images
        setCurrentReceiptUrl(signedUrlData.signedUrl);
        setSignedPdfUrl(null); // Clear signed PDF URL
      }
    }
    setIsReceiptViewerOpen(true);
  };

  // Helper to get field visibility and required status for controllers
  const getControllerFieldConfig = (fieldKey: string): FieldSetting => {
    return expenseModuleConfig?.settings?.controller_fields?.[fieldKey] ?? { visible: true, required: false }; // Default to visible, not required
  };

  const isLoadingPage = isLoadingSession || isLoadingExpenseModuleId || isLoadingConfig || isLoadingExpense || isLoadingSubmitterProfile || isLoadingReviewerProfile || isLoadingControllerProfile || isLoadingCompanyDefaultCurrency || isLoadingComments || isLoadingAuditLog || isLoadingCompanyDuplicates;

  if (isLoadingPage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading expense details...</p>
      </div>
    );
  }

  if (isErrorExpense || !expense) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading expense or expense not found.</p>
        <Button onClick={() => navigate(-1)} className="ml-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <Button variant="outline" onClick={() => navigate(-1)} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
            </Button>
            <CardTitle className="flex items-center">
              {expense.title}
              <span className={`ml-2 text-sm font-medium px-2.5 py-0.5 rounded-full ${
                expense.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                expense.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                expense.status === 'approved' ? 'bg-brand-green text-brand-green-foreground' :
                expense.status === 'rejected' ? 'bg-destructive text-destructive-foreground' : // Apply destructive variant
                'bg-yellow-100 text-yellow-800'
              }`}>
                {expense.status.charAt(0).toUpperCase() + expense.status.slice(1).replace(/_/g, ' ')}
              </span>
            </CardTitle>
            <CardDescription>
              Submitted by {expense.submitter_profile?.full_name ?? expense.submitter_profile?.email} on {format(new Date(expense.created_at), "PPP")}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {canReview && (
              <>
                <Button
                  className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
                  onClick={() => { setExpenseToReview(expense!); setReviewAction("approve"); setIsReviewDialogOpen(true); }} // Set expenseToReview
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </Button>
                <Button
                  variant="destructive" // Apply destructive variant
                  onClick={() => { setExpenseToReview(expense!); setReviewAction("reject"); setIsReviewDialogOpen(true); }} // Set expenseToReview
                  disabled={updateStatusMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              </>
            )}
            {canRequestInfo && (
              <Button
                variant="outline"
                onClick={() => { setExpenseToReview(expense!); setReviewAction("request_info"); setIsReviewDialogOpen(true); }} // Set expenseToReview
                disabled={updateStatusMutation.isPending}
              >
                <MessageSquare className="h-4 w-4 mr-2" /> Request Info
              </Button>
            )}
            {canRespondToInfoRequest && (
              <Button
                variant="default"
                onClick={() => { /* Logic to focus on comments or open a specific response dialog */ }}
                disabled={updateStatusMutation.isPending}
              >
                <MessageSquare className="h-4 w-4 mr-2" /> Respond to Request
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {getControllerFieldConfig("amount").visible && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Original Amount</p>
                <p className="text-lg font-bold">
                  <FormattedCurrencyDisplay amount={expense.amount} currencyCode={expense.currency_code} />
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Base Currency Amount</p>
                <p className="text-lg font-bold">
                  <FormattedCurrencyDisplay amount={expense.base_currency_amount} currencyCode={companyBaseCurrencyCode} />
                </p>
              </div>
            </div>
          )}
          <Separator />
          {getControllerFieldConfig("expense_date").visible && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expense Date</p>
                <p className="text-lg">{format(new Date(expense.expense_date), "PPP")}</p>
              </div>
              {getControllerFieldConfig("vendor_name").visible && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vendor Name</p>
                  <p>{expense.vendor_name ?? "N/A"}</p>
                </div>
              )}
            </div>
          )}
          {getControllerFieldConfig("merchant_address").visible && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Merchant Address</p>
                <p>{expense.merchant_address ?? "N/A"}</p>
              </div>
              {getControllerFieldConfig("receipt_summary").visible && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Receipt Summary</p>
                  <p>{expense.receipt_summary ?? "N/A"}</p>
                </div>
              )}
            </div>
          )}
          {getControllerFieldConfig("category_id").visible && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Category</p>
                <p>{expense.category_name ?? "N/A"}</p> {/* Fixed: Use flattened category_name */}
              </div>
              {getControllerFieldConfig("gl_account_id").visible && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">GL Account</p>
                  <p>{expense.gl_account_code && expense.gl_account_name ? `${expense.gl_account_code} - ${expense.gl_account_name}` : "N/A"}</p> {/* Fixed: Use flattened gl_account_code and gl_account_name */}
                </div>
              )}
            </div>
          )}
          {getControllerFieldConfig("project_code").visible && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Project Code</p>
                <p>{expense.project_code ?? "N/A"}</p>
              </div>
              {getControllerFieldConfig("cost_center").visible && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cost Center</p>
                  <p>{expense.cost_center ?? "N/A"}</p>
                </div>
              )}
            </div>
          )}
          {getControllerFieldConfig("is_reimbursable").visible && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Is Reimbursable</p>
                <p>{expense.is_reimbursable ? "Yes" : "No"}</p>
              </div>
              {getControllerFieldConfig("ai_confidence_score").visible && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">AI Confidence Score</p>
                  <p>{expense.ai_confidence_score ? `${Math.round(expense.ai_confidence_score * 100)}%` : "N/A"}</p>
                </div>
              )}
            </div>
          )}
          {getControllerFieldConfig("description").visible && expense.description && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p>{expense.description}</p>
              </div>
            </>
          )}

          {/* Invoice View Section (when available) */}
          {showInvoiceView && invoiceStructure && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Invoice Details</p>
                    <p className="text-xs text-muted-foreground mt-1">AI-extracted invoice structure from uploaded receipt</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInvoiceView(false)}
                  >
                    Hide Invoice View
                  </Button>
                </div>
                <InvoiceView
                  invoiceData={invoiceStructure}
                  onFieldEdit={() => {}} // Read-only for controller view
                  onLineItemEdit={() => {}} // Read-only for controller view
                  onTaxEdit={() => {}} // Read-only for controller view
                  editable={false} // Controller view is read-only
                  showConfidence={true}
                  compact={true}
                />
              </div>
            </>
          )}

          {/* Show Invoice View Button (when invoice data is available but not shown) */}
          {!showInvoiceView && invoiceStructure && (
            <>
              <Separator />
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowInvoiceView(true)}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  View Invoice Structure
                </Button>
                <p className="text-sm text-muted-foreground">
                  This expense has AI-extracted invoice data available for review.
                </p>
              </div>
            </>
          )}

          {/* Receipts Section */}
          {getControllerFieldConfig("receipt_upload").visible && expense.receipts && expense.receipts.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Receipts</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {expense.receipts.map((receipt: Receipt) => (
                    <div key={receipt.id} className="relative group border rounded-lg overflow-hidden">
                      {receipt.mime_type.startsWith('image/') ? (
                        <img src={receipt.file_url} alt={receipt.file_name} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-32 bg-gray-100 dark:bg-gray-700 text-muted-foreground">
                          <FileText className="h-8 w-8" />
                          <p className="text-xs text-center mt-1 truncate w-full px-2">{receipt.file_name}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="secondary" size="sm" onClick={() => handleViewReceipt(receipt.file_url, receipt.mime_type)}>
                          <Eye className="h-4 w-4 mr-2" /> View
                        </Button>
                        <a href={receipt.file_url} download={receipt.file_name} target="_blank" rel="noopener noreferrer">
                          <Button variant="secondary" size="sm" className="ml-2">
                            <Download className="h-4 w-4 mr-2" /> Download
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Line Items Section */}
          {getControllerFieldConfig("line_items").visible && expense.expense_line_items && expense.expense_line_items.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Line Items</p>
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-semibold">Description</th>
                        <th className="text-right p-2 font-semibold">Qty</th>
                        <th className="text-right p-2 font-semibold">Unit Price</th>
                        <th className="text-right p-2 font-semibold">Amount</th>
                      </tr>
                    </thead>
                  <tbody>
                    {expense.expense_line_items.map((item: ExpenseLineItem) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.description}</td>
                        <td className="text-right p-2">{item.quantity ?? "N/A"}</td>
                        <td className="text-right p-2">
                          <FormattedCurrencyDisplay amount={item.unit_price} currencyCode={item.currency_code} />
                        </td>
                        <td className="text-right p-2">
                          <FormattedCurrencyDisplay amount={item.line_amount} currencyCode={item.currency_code} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
          )}

          {(expense.reviewer_id || expense.controller_id) && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Review Details</p>
                {expense.reviewer_profile && <p>Reviewed by: {expense.reviewer_profile.full_name ?? expense.reviewer_profile.email}</p>}
                {expense.reviewed_at && <p>Reviewed at: {format(new Date(expense.reviewed_at), "PPP p")}</p>}
                {expense.review_notes && <p>Review Notes: {expense.review_notes}</p>}
                {expense.controller_profile && <p>Controller: {expense.controller_profile.full_name ?? expense.controller_profile.email}</p>}
                {expense.controller_notes && <p>Controller Notes: {expense.controller_notes}</p>}
                {expense.approved_at && <p>Approved at: {format(new Date(expense.approved_at), "PPP p")}</p>}
              </div>
            </>
          )}

          {/* Company-Wide Duplicates Section (for controllers) */}
          {canViewCompanyDuplicates && (companyDuplicates ?? []).length > 0 && (
            <>
              <Separator />
              <Card className="border-orange-300 bg-orange-50/50 dark:bg-orange-950/20">
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <Copy className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-lg text-orange-600">Potential Company-Wide Duplicates</CardTitle>
                </CardHeader>
                <CardDescription className="px-6">
                  Other receipts in your company with the same content hash. Review these carefully.
                </CardDescription>
                <CardContent className="pt-4 grid gap-3">
                  {(companyDuplicates ?? []).map((dup: CompanyDuplicateReceipt) => (
                    <div key={dup.receipt_id} className="flex items-center justify-between p-3 border rounded-md bg-background">
                      <div className="flex flex-col">
                        <Link to={`/expenses/${dup.expense_id}`} className="font-medium text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                          {dup.expense_title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          Submitted by {dup.submitted_by_user_name} on {format(new Date(dup.uploaded_at), "PPP")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Receipt: {dup.file_name}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleViewReceipt(dup.file_url, dup.file_name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')}>
                        <Eye className="h-4 w-4 mr-2" /> View Receipt
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {comments?.length === 0 ? (
              <p className="text-muted-foreground">No comments yet.</p>
            ) : (
              comments?.map((comment: ExpenseComment) => (
                <div key={comment.id} className="border-b pb-2 last:border-b-0 last:pb-0">
                  <p className="text-sm font-medium">
                    {comment.profiles?.full_name ?? comment.profiles?.email}
                    {comment.is_internal && <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">Internal</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{comment.comment}</p>
                  <p className="text-xs text-gray-500 mt-1">{format(new Date(comment.created_at), "PPP p")}</p>
                </div>
              ))
            )}
          </div>
          <Separator className="my-4" />
          <div className="grid gap-2">
            <Label htmlFor="comment">Add a Comment</Label>
            <Textarea
              id="comment"
              placeholder="Type your comment here..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={addCommentMutation.isPending}
            />
            <Button
              onClick={() => addCommentMutation.mutate({ comment: commentText, is_internal: false })}
              disabled={addCommentMutation.isPending || !commentText.trim()}
              className="self-end"
            >
              {addCommentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <MessageSquare className="h-4 w-4 mr-2" /> Post Comment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {auditLog?.length === 0 ? (
              <p className="text-muted-foreground">No audit entries.</p>
            ) : (
              auditLog?.map((log: ExpenseAuditLog) => (
                <div key={log.id} className="border-b pb-2 last:border-b-0 last:pb-0">
                  <p className="text-sm font-medium">
                    {log.action.charAt(0).toUpperCase() + log.action.slice(1)} by {log.profiles?.full_name ?? log.profiles?.email}
                  </p>
                  {log.old_status && log.new_status && (
                    <p className="text-sm text-muted-foreground">
                      Status changed from <span className="font-semibold">{log.old_status}</span> to <span className="font-semibold">{log.new_status}</span>
                    </p>
                  )}
                  {log.notes && <p className="text-sm text-muted-foreground">Notes: {log.notes}</p>}
                  <p className="text-xs text-gray-500 mt-1">{format(new Date(log.created_at), "PPP p")}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review/Reject/Request Info Confirmation Dialog */}
      <AlertDialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewAction === "approve" ? "Approve Expense?" :
               reviewAction === "reject" ? "Reject Expense?" :
               "Request Information?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewAction === "approve"
                ? `Are you sure you want to approve this expense (${expenseToReview?.title})?`
                : reviewAction === "reject"
                ? `Are you sure you want to reject this expense (${expenseToReview?.title})? Please provide a reason.`
                : `Are you sure you want to request more information for this expense (${expenseToReview?.title})? Please provide details for the submitter.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(getControllerFieldConfig("review_notes").visible || reviewAction === "request_info") && (
            <div className="grid gap-2">
              <Label htmlFor="review-notes">
                {reviewAction === "request_info" ? "Message to Submitter" : "Notes"}
                {(getControllerFieldConfig("review_notes").required && reviewAction !== "request_info") || reviewAction === "request_info" ? "*" : ""}
              </Label>
              <Textarea
                id="review-notes"
                placeholder={reviewAction === "request_info" ? "Explain what information is needed..." : "Add any review notes here..."}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                disabled={updateStatusMutation.isPending}
              />
              {((getControllerFieldConfig("review_notes").required && reviewAction === "reject") || reviewAction === "request_info") && !reviewNotes.trim() && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {reviewAction === "request_info" ? "A message is required to request information." : "Review notes are required to reject this expense."}
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatusMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                let newStatus = "";
                if (reviewAction === "approve") newStatus = "approved";
                else if (reviewAction === "reject") newStatus = "rejected";
                else if (reviewAction === "request_info") newStatus = "info_requested";
                
                updateStatusMutation.mutate({ expenseId: expenseToReview!.id, status: newStatus, notes: reviewNotes });
              }}
              disabled={updateStatusMutation.isPending || (
                (reviewAction === "reject" || reviewAction === "request_info") && !reviewNotes.trim()
              )}
              className={reviewAction === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {reviewAction === "approve" ? "Confirm Approve" :
               reviewAction === "reject" ? "Confirm Reject" :
               "Confirm Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Viewer Dialog */}
      <Dialog open={isReceiptViewerOpen} onOpenChange={setIsReceiptViewerOpen}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Receipt: {expense?.receipts?.[0]?.file_name ?? "View Receipt"}</DialogTitle>
            <DialogDescription>
              {currentReceiptMimeType?.startsWith('image/') ? "Image preview" : "PDF document"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
            {currentReceiptUrl && currentReceiptMimeType?.startsWith('image/') && (
              <img src={currentReceiptUrl} alt="Receipt" className="max-w-full max-h-full object-contain" />
            )}
            {signedPdfUrl && currentReceiptMimeType === 'application/pdf' && (
              <LazyPdfViewer pdfUrl={signedPdfUrl} />
            )}
            {!currentReceiptUrl && !signedPdfUrl && <p className="text-muted-foreground">No receipt to display.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExpenseDetailPage;