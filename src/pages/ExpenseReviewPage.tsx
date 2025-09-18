"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Eye, ClipboardCheck, MessageSquare, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"; // Added ChevronDown, ChevronUp
import { useSession } from "@/components/SessionContextProvider";
import { Link } from "react-router-dom"; // Re-added Link as it's needed for navigation
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ResizableTable, TableColumn } from "@/components/ResizableTable";
import FormattedCurrencyDisplay from "@/components/FormattedCurrencyDisplay";
import { Expense } from "@/types/expenses"; // Updated Expense type
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import ExpenseSummaryCard from "@/components/ExpenseSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TableRow, TableCell } from "@/components/ui/table"; // Import TableRow and TableCell
import { truncateText } from "@/lib/utils"; // Import truncateText

// Define the structure for field settings
interface FieldSetting {
  visible: boolean;
  required: boolean;
}

const ExpenseReviewPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession, user: currentUser } = useSession();
  const isMobile = useIsMobile();

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [expenseToReview, setExpenseToReview] = useState<Expense | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "request_info" | null>(null); // Added 'request_info'
  const [reviewNotes, setReviewNotes] = useState("");
  const [activeTab, setActiveTab] = useState("submitted");
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null); // New state for expanded row

  // Removed: State for Receipt Viewer Dialog (now handled by ExpenseDetailPage)
  // const [isReceiptViewerOpen, setIsReceiptViewerOpen] = useState(false);
  // const [currentReceiptUrl, setCurrentReceiptUrl] = useState<string | null>(null);
  // const [currentReceiptMimeType, setCurrentReceiptMimeType = useState<string | null>(null);
  // const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  const currentCompanyId = profile?.company_id;
  const userRole = profile?.role;
  const currentUserId = currentUser?.id;

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
      return data?.id || null;
    },
  });

  // 2. Fetch Expense Management Configuration for the current company (controller fields)
  const { data: expenseModuleConfig, isLoading: isLoadingConfig } = useQuery<{ settings: { controller_fields: Record<string, FieldSetting> } } | null>({
    queryKey: ["expenseModuleControllerConfig", currentCompanyId, expenseModuleId],
    queryFn: async () => {
      if (!currentCompanyId || !expenseModuleId) return null;
      const { data, error } = await supabase
        .from("module_configurations")
        .select("settings")
        .eq("company_id", currentCompanyId)
        .eq("module_id", expenseModuleId)
        .eq("config_key", "expense_management_fields")
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!currentCompanyId && !!expenseModuleId && !isLoadingSession,
  });

  // Helper to get field visibility and required status for controllers (defined AFTER expenseModuleConfig)
  const getControllerFieldConfig = useCallback((fieldKey: string): FieldSetting => {
    return expenseModuleConfig?.settings?.controller_fields?.[fieldKey] || { visible: true, required: false }; // Default to visible, not required
  }, [expenseModuleConfig]);

  // Default field config if not loaded or not present
  const defaultFieldConfig: Record<string, FieldSetting> = useMemo(() => {
    const config: Record<string, FieldSetting> = {};
    const commonFields = ["title", "description", "amount", "expense_date", "currency_code", "vendor_name", "merchant_address", "receipt_summary", "category_id", "gl_account_id", "is_reimbursable", "project_code", "cost_center", "line_items", "receipt_upload", "review_notes"];
    commonFields.forEach(key => {
      config[key] = { visible: true, required: false };
    });
    return config;
  }, []);

  const controllerFieldsConfig = expenseModuleConfig?.settings?.controller_fields || defaultFieldConfig;

  // 1. Fetch expenses without joining profiles
  const { data: expensesData, isLoading: isLoadingExpenses, error: expensesError, refetch } = useQuery<Expense[], Error>({
    queryKey: ["expensesForReview", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId || !userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          expense_categories (name),
          gl_accounts (account_code, account_name),
          receipts (id, file_url, file_name, mime_type),
          expense_line_items (id, description, quantity, unit_price, line_amount, currency_code)
        `)
        .eq("company_id", currentCompanyId)
        .order("expense_date", { ascending: false }); // Fetch all for filtering by tabs
      if (error) {
        console.error("Supabase error fetching expenses for review:", error);
        throw new Error(error.message);
      }
      // Manually flatten nested objects into the main Expense object
      return (data as any[]).map(item => ({
        ...item,
        category_name: item.expense_categories?.name || null,
        gl_account_code: item.gl_accounts?.account_code || null,
        gl_account_name: item.gl_accounts?.account_name || null,
      })) as Expense[];
    },
    enabled: !!currentCompanyId && !!userRole && ['admin', 'controller', 'super-admin'].includes(userRole) && !isLoadingConfig,
  });

  // 2. Fetch profiles for the submitted_by users from the fetched expenses
  const { data: profilesMap, isLoading: isLoadingProfiles } = useQuery<Map<string, { full_name: string | null; email: string }>>({
    queryKey: ["submitterProfiles", expensesData?.map((e: Expense) => e.submitted_by)], // Explicitly type 'e'
    queryFn: async () => {
      if (!expensesData || expensesData.length === 0) return new Map();
      const userIds = [...new Set(expensesData.map((e: Expense) => e.submitted_by))]; // Explicitly type 'e'
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (error) {
        console.error("Supabase error fetching submitter profiles for expenses page:", error);
        throw new Error(error.message);
      }
      const map = new Map<string, { full_name: string | null; email: string }>();
      data.forEach(p => map.set(p.user_id, { full_name: p.full_name, email: p.email }));
      return map;
    },
    enabled: !!expensesData && expensesData.length > 0,
  });

  // 3. Combine expenses with their profiles for rendering
  const expensesForReviewWithProfiles = useMemo(() => {
    if (!expensesData || !profilesMap) return [];
    return expensesData.map((expense: Expense) => ({ // Explicitly type 'expense'
      ...expense,
      submitter_profile: profilesMap.get(expense.submitted_by) || null,
      submitter_full_name: profilesMap.get(expense.submitted_by)?.full_name || null, // Add for direct access
      submitter_email: profilesMap.get(expense.submitted_by)?.email || null, // Add for direct access
    }));
  }, [expensesData, profilesMap]);

  // Filter expenses based on active tab
  const filteredExpenses = useMemo(() => {
    if (!expensesForReviewWithProfiles) return [];
    switch (activeTab) {
      case "approved":
        return expensesForReviewWithProfiles.filter((exp: Expense) => exp.status === "approved"); // Explicitly type 'exp'
      case "rejected":
        return expensesForReviewWithProfiles.filter((exp: Expense) => exp.status === "rejected"); // Explicitly type 'exp'
      case "submitted":
        return expensesForReviewWithProfiles.filter((exp: Expense) => exp.status === "submitted"); // Explicitly type 'exp'
      case "info_requested": // New filter for info_requested
        return expensesForReviewWithProfiles.filter((exp: Expense) => exp.status === "info_requested"); // Explicitly type 'exp'
      case "all":
      default:
        return expensesForReviewWithProfiles;
    }
  }, [expensesForReviewWithProfiles, activeTab]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ expenseId, status, notes }: { expenseId: string; status: string; notes: string | null }) => {
      const { data, error } = await supabase.rpc("update_expense_status", {
        expense_id: expenseId,
        new_status: status,
        notes: notes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expensesForReview"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] });
      toast({ title: "Expense Status Updated", description: "Expense status has been updated." });
      setIsReviewDialogOpen(false);
      setExpenseToReview(null);
      setReviewAction(null);
      setReviewNotes("");
    },
    onError: (error: any) => {
      console.error("Error updating expense status:", error);
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    },
  });

  const handleReviewAction = useCallback((expense: Expense, action: "approve" | "reject" | "request_info") => {
    setExpenseToReview(expense);
    setReviewAction(action);
    setIsReviewDialogOpen(true);
  }, []);

  const columns: TableColumn<Expense>[] = useMemo(() => [
    {
      key: "expand",
      header: "",
      render: (row, { expandedRowId }) => (
        <Button variant="ghost" size="icon" className="h-6 w-6">
          {expandedRowId === row.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      ),
      initialWidth: 40,
      minWidth: 40,
      cellClassName: "text-center",
      headerClassName: "text-center",
    },
    {
      key: "vendor_name",
      header: "Vendor",
      render: (row) => row.vendor_name || "N/A",
      initialWidth: 150,
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => (
        <FormattedCurrencyDisplay amount={row.amount} currencyCode={row.currency_code} />
      ),
      initialWidth: 120,
    },
    {
      key: "expense_date",
      header: "Date",
      render: (row) => format(new Date(row.expense_date), "MM-dd-yy"),
      initialWidth: 120,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.category_name || "N/A", // Fixed: Use flattened category_name
      initialWidth: 150,
    },
    {
      key: "submitted_by",
      header: "Submitted By",
      render: (row) => row.submitter_full_name || row.submitter_email || "N/A",
      initialWidth: 180,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex space-x-2">
          <Link to={`/expenses/${row.id}`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          {row.status === 'submitted' && (
            <>
              <Button
                className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
                size="sm"
                onClick={() => handleReviewAction(row, "approve")}
                disabled={updateStatusMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive" // Changed to destructive variant
                size="sm"
                onClick={() => handleReviewAction(row, "reject")}
                disabled={updateStatusMutation.isPending}
              >
                <XCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReviewAction(row, "request_info")}
                disabled={updateStatusMutation.isPending}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </>
          )}
          {row.status === 'info_requested' && (
            <Button
              className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
              size="sm"
              onClick={() => handleReviewAction(row, "approve")} // Can still approve/reject from info_requested
              disabled={updateStatusMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      initialWidth: 200, // Adjusted width for more actions
      minWidth: 150,
      cellClassName: "text-right",
      headerClassName: "text-right",
    },
  ], [updateStatusMutation.isPending, handleReviewAction, expandedExpenseId]); // Added expandedExpenseId to dependencies

  // Conditionally add the status column based on activeTab
  const displayColumns = useMemo(() => {
    if (activeTab === 'all') {
      return [
        columns[0], // Expand column
        ...columns.slice(1, 6), // All columns before actions
        {
          key: "status",
          header: "Status",
          render: (row: Expense) => {
            let variant: "default" | "secondary" | "destructive" | "outline" | null = null;
            let className = "";
            switch (row.status) {
              case "draft": // Should not appear in review, but for completeness
                variant = "outline";
                className = "bg-gray-100 text-gray-800 border-gray-300";
                break;
              case "submitted":
                variant = "default";
                className = "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200";
                break;
              case "approved":
                variant = "default";
                className = "bg-green-100 text-green-800 border-green-300 hover:bg-green-200";
                break;
              case "rejected":
                variant = "destructive";
                className = "bg-red-100 text-red-800 border-red-300 hover:bg-red-200";
                break;
              case "info_requested":
                variant = "secondary";
                className = "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200";
                break;
              default:
                variant = "secondary";
                break;
            }
            return (
              <Badge variant={variant} className={className}>
                {row.status.charAt(0).toUpperCase() + row.status.slice(1).replace(/_/g, ' ')}
              </Badge>
            );
          },
          initialWidth: 100,
        },
        columns[columns.length - 1] // The actions column
      ];
    }
    return columns;
  }, [columns, activeTab]);

  const handleRowClick = useCallback((expense: Expense) => {
    setExpandedExpenseId(prevId => (prevId === expense.id ? null : expense.id));
  }, []);

  const renderCustomRow = useCallback((
    expense: Expense,
    _rowIndex: number, // Renamed to _rowIndex
    cols: TableColumn<Expense>[],
    colWidths: Record<string, number>,
    dynamicProps: any // This will contain onRowClick, expandedRowId etc.
  ) => {
    const isExpanded = dynamicProps.expandedRowId === expense.id;
    const totalColumns = cols.length;

    return (
      <React.Fragment key={expense.id}>
        <TableRow
          className={cn(
            "h-8 border-b-0 hover:bg-muted/50 cursor-pointer",
            isExpanded && "bg-muted/50"
          )}
          onClick={() => dynamicProps.onRowClick(expense)}
        >
          {cols.map((column) => (
            <TableCell
              key={column.key}
              className={cn(
                "h-8 px-2 py-1 align-middle [&:has([role=checkbox])]:pr-0",
                "whitespace-nowrap overflow-hidden text-ellipsis",
                column.cellClassName,
                column.className
              )}
              style={{ width: colWidths[column.key], minWidth: column.minWidth || 50 }}
              title={typeof column.render(expense, dynamicProps) === 'string' ? column.render(expense, dynamicProps) as string : undefined}
            >
              {truncateText(column.render(expense, dynamicProps), colWidths[column.key] - (8 + 10))}
            </TableCell>
          ))}
        </TableRow>
        {isExpanded && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={totalColumns} className="p-0">
              <Card className="w-full rounded-none border-0 border-t bg-muted/50 shadow-none">
                <CardContent className="p-4">
                  <ExpenseSummaryCard expense={expense} fieldConfig={controllerFieldsConfig} />
                </CardContent>
            </Card>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  }, [expandedExpenseId, controllerFieldsConfig]); // Dependencies for renderCustomRow


  if (isLoadingSession || isLoadingExpenses || isLoadingProfiles || isLoadingExpenseModuleId || isLoadingConfig) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading expenses for review...</p>
      </div>
    );
  }

  if (!userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Admins, Controllers, or Super Admins can access this page.</p>
      </div>
    );
  }

  if (expensesError) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading expenses for review: {expensesError.message}</p>
        <Button onClick={() => refetch()} className="ml-4">Refresh</Button>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            <CardTitle>Expenses for Review</CardTitle>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoadingExpenses || isLoadingProfiles}>
            <Loader2 className={cn("mr-2 h-4 w-4", { "animate-spin": isLoadingExpenses || isLoadingProfiles })} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            A list of expenses submitted by users in your company awaiting your review.
          </CardDescription>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="submitted">Submitted</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="info_requested">Info Requested</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {isMobile ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredExpenses.length === 0 ? (
                    <p className="text-center text-muted-foreground">No expenses found.</p>
                  ) : (
                    filteredExpenses.map((expense: Expense) => ( // Explicitly type 'expense'
                      <Card key={expense.id} className="p-4">
                        <ExpenseSummaryCard expense={expense} fieldConfig={controllerFieldsConfig} />
                        <div className="flex justify-end gap-2 mt-4">
                          <Link to={`/expenses/${expense.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {expense.status === 'submitted' && (
                            <>
                              <Button
                                className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
                                size="sm"
                                onClick={() => handleReviewAction(expense, "approve")}
                                disabled={updateStatusMutation.isPending}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Approve
                              </Button>
                              <Button
                                variant="destructive" // Changed to destructive variant
                                size="sm"
                                onClick={() => handleReviewAction(expense, "reject")}
                                disabled={updateStatusMutation.isPending}
                              >
                                <XCircle className="h-4 w-4" /> Reject
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReviewAction(expense, "request_info")}
                                disabled={updateStatusMutation.isPending}
                              >
                                <MessageSquare className="h-4 w-4" /> Request Info
                              </Button>
                            </>
                          )}
                          {expense.status === 'info_requested' && (
                            <Button
                              className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
                              size="sm"
                              onClick={() => handleReviewAction(expense, "approve")} // Can still approve/reject from info_requested
                              disabled={updateStatusMutation.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4" /> Approve
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <ResizableTable
                  tableId="expense-review-table-all"
                  columns={displayColumns} // Use displayColumns here
                  data={filteredExpenses || []}
                  isLoading={isLoadingExpenses || isLoadingProfiles}
                  emptyMessage="No expenses found."
                  renderRow={renderCustomRow} // Pass the custom render function
                  onRowClick={handleRowClick} // Pass the row click handler
                  expandedRowId={expandedExpenseId} // Pass the expanded state
                />
              )}
            </TabsContent>
            <TabsContent value="submitted" className="mt-4">
              {isMobile ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredExpenses.length === 0 ? (
                    <p className="text-center text-muted-foreground">No submitted expenses found.</p>
                  ) : (
                    filteredExpenses.map((expense: Expense) => ( // Explicitly type 'expense'
                      <Card key={expense.id} className="p-4">
                        <ExpenseSummaryCard expense={expense} fieldConfig={controllerFieldsConfig} />
                        <div className="flex justify-end gap-2 mt-4">
                          <Link to={`/expenses/${expense.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
                            size="sm"
                            onClick={() => handleReviewAction(expense, "approve")}
                            disabled={updateStatusMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                          <Button
                            variant="destructive" // Changed to destructive variant
                            size="sm"
                            onClick={() => handleReviewAction(expense, "reject")}
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReviewAction(expense, "request_info")}
                            disabled={updateStatusMutation.isPending}
                          >
                            <MessageSquare className="h-4 w-4" /> Request Info
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <ResizableTable
                  tableId="expense-review-table-submitted"
                  columns={displayColumns} // Use displayColumns here
                  data={filteredExpenses || []}
                  isLoading={isLoadingExpenses || isLoadingProfiles}
                  emptyMessage="No submitted expenses found."
                  renderRow={renderCustomRow} // Pass the custom render function
                  onRowClick={handleRowClick} // Pass the row click handler
                  expandedRowId={expandedExpenseId} // Pass the expanded state
                />
              )}
            </TabsContent>
            <TabsContent value="approved" className="mt-4">
              {isMobile ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredExpenses.length === 0 ? (
                    <p className="text-center text-muted-foreground">No approved expenses found.</p>
                  ) : (
                    filteredExpenses.map((expense: Expense) => ( // Explicitly type 'expense'
                      <Card key={expense.id} className="p-4">
                        <ExpenseSummaryCard expense={expense} fieldConfig={controllerFieldsConfig} />
                        <div className="flex justify-end gap-2 mt-4">
                          <Link to={`/expenses/${expense.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
                            size="sm"
                            onClick={() => handleReviewAction(expense, "approve")}
                            disabled={updateStatusMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                          <Button
                            variant="destructive" // Changed to destructive variant
                            size="sm"
                            onClick={() => handleReviewAction(expense, "reject")}
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <ResizableTable
                  tableId="expense-review-table-approved"
                  columns={displayColumns} // Use displayColumns here
                  data={filteredExpenses || []}
                  isLoading={isLoadingExpenses || isLoadingProfiles}
                  emptyMessage="No approved expenses found."
                  renderRow={renderCustomRow} // Pass the custom render function
                  onRowClick={handleRowClick} // Pass the row click handler
                  expandedRowId={expandedExpenseId} // Pass the expanded state
                />
              )}
            </TabsContent>
            <TabsContent value="rejected" className="mt-4">
              {isMobile ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredExpenses.length === 0 ? (
                    <p className="text-center text-muted-foreground">No rejected expenses found.</p>
                  ) : (
                    filteredExpenses.map((expense: Expense) => ( // Explicitly type 'expense'
                      <Card key={expense.id} className="p-4">
                        <ExpenseSummaryCard expense={expense} fieldConfig={controllerFieldsConfig} />
                        <div className="flex justify-end gap-2 mt-4">
                          <Link to={`/expenses/${expense.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
                            size="sm"
                            onClick={() => handleReviewAction(expense, "approve")}
                            disabled={updateStatusMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                          <Button
                            variant="destructive" // Changed to destructive variant
                            size="sm"
                            onClick={() => handleReviewAction(expense, "reject")}
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <ResizableTable
                  tableId="expense-review-table-rejected"
                  columns={displayColumns} // Use displayColumns here
                  data={filteredExpenses || []}
                  isLoading={isLoadingExpenses || isLoadingProfiles}
                  emptyMessage="No rejected expenses found."
                  renderRow={renderCustomRow} // Pass the custom render function
                  onRowClick={handleRowClick} // Pass the row click handler
                  expandedRowId={expandedExpenseId} // Pass the expanded state
                />
              )}
            </TabsContent>
            <TabsContent value="info_requested" className="mt-4">
              {isMobile ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredExpenses.length === 0 ? (
                    <p className="text-center text-muted-foreground">No expenses with information requested.</p>
                  ) : (
                    filteredExpenses.map((expense: Expense) => ( // Explicitly type 'expense'
                      <Card key={expense.id} className="p-4">
                        <ExpenseSummaryCard expense={expense} fieldConfig={controllerFieldsConfig} />
                        <div className="flex justify-end gap-2 mt-4">
                          <Link to={`/expenses/${expense.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            className="bg-brand-green hover:bg-brand-green/90 text-brand-green-foreground" // Apply brand-green
                            size="sm"
                            onClick={() => handleReviewAction(expense, "approve")} // Can still approve/reject from info_requested
                            disabled={updateStatusMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                          <Button
                            variant="destructive" // Changed to destructive variant
                            size="sm"
                            onClick={() => handleReviewAction(expense, "reject")}
                            disabled={updateStatusMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <ResizableTable
                  tableId="expense-review-table-info-requested"
                  columns={displayColumns} // Use displayColumns here
                  data={filteredExpenses || []}
                  isLoading={isLoadingExpenses || isLoadingProfiles}
                  emptyMessage="No expenses with information requested."
                  renderRow={renderCustomRow} // Pass the custom render function
                  onRowClick={handleRowClick} // Pass the row click handler
                  expandedRowId={expandedExpenseId} // Pass the expanded state
                />
              )}
            </TabsContent>
          </Tabs>
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

      {/* Removed Receipt Viewer Dialog from here */}
    </>
  );
};

export default ExpenseReviewPage;