/**
 * Review Inbox Tab Component
 *
 * Provides a unified inbox interface for expense reviewers to:
 * - View submitted expenses requiring review
 * - Approve, reject, or request more information
 * - Perform bulk actions on multiple expenses
 * - Create and assign expenses to other users
 */

import React, { useState, useMemo, useCallback, startTransition } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/components/SessionContextProvider";
import { useIsMobile } from "@/hooks/use-mobile";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Input } from "@/components/ui/input";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Icons
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Eye,
  UserPlus,
  Loader2,
  AlertCircle,
  Calendar,
  RefreshCw,
  Filter,
  Plus,
  Search,
  ChevronDown,
  X
} from "lucide-react";

// Components
import { ResizableTable, TableColumn } from "@/components/ResizableTable";
import { SelectableExpenseTable } from "@/components/expenses/SelectableExpenseTable";
import FormattedCurrencyDisplay from "@/components/FormattedCurrencyDisplay";
import ExpenseSummaryCard from "@/components/ExpenseSummaryCard";
import BulkActionsToolbar from "@/components/BulkActionsToolbar";

// Types
import { Expense } from "@/types/expenses";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReviewInboxTabProps {
  companyId: string;
  currentUserId: string;
  userRole: string;
  expenses: Expense[];
  isLoadingExpenses: boolean;
  onRefresh: () => void;
}

interface FieldSetting {
  visible: boolean;
  required: boolean;
}

export const ReviewInboxTab: React.FC<ReviewInboxTabProps> = ({
  companyId,
  currentUserId,
  userRole,
  expenses,
  isLoadingExpenses,
  onRefresh,
}) => {
  const queryClient = useQueryClient();
  const { toast: toastHook } = useToast();
  const isMobile = useIsMobile();

  // State management
  const [activeInboxTab, setActiveInboxTab] = useState("pending");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  // Review dialog state
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [expenseToReview, setExpenseToReview] = useState<Expense | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "request_info" | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // Assignment dialog state
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("");
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentExpenseTitle, setAssignmentExpenseTitle] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");

  // Smart filtering state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubmitter, setSelectedSubmitter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<{ min?: number; max?: number }>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Fetch expense module configuration for field visibility
  const { data: expenseModuleConfig } = useQuery({
    queryKey: ["expenseModuleConfig", companyId],
    queryFn: async () => {
      const { data: moduleData, error: moduleError } = await supabase
        .from("modules")
        .select("id")
        .eq("name", "Expense Management")
        .single();

      if (moduleError || !moduleData) return null;

      const { data, error } = await supabase
        .from("module_configurations")
        .select("settings")
        .eq("company_id", companyId)
        .eq("module_id", moduleData.id)
        .eq("config_key", "expense_management_fields")
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!companyId,
  });

  // Get field configuration for controllers
  const getControllerFieldConfig = useCallback((fieldKey: string): FieldSetting => {
    return expenseModuleConfig?.settings?.controller_fields?.[fieldKey] || { visible: true, required: false };
  }, [expenseModuleConfig]);

  // Fetch company users for assignment
  const { data: companyUsers = [] } = useQuery({
    queryKey: ["companyUsers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("company_id", companyId)
        .order("full_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Filter expenses for review based on status and permissions
  const reviewableExpenses = useMemo(() => {
    if (!expenses || !userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) {
      return [];
    }

    return expenses.filter(expense => {
      // Don't show expenses submitted by the current user (unless super-admin)
      if (expense.submitted_by === currentUserId && userRole !== 'super-admin') {
        return false;
      }
      return true;
    });
  }, [expenses, currentUserId, userRole]);

  // Filter expenses by inbox tab
  const filteredInboxExpenses = useMemo(() => {
    let filtered = reviewableExpenses;

    // Status-based filtering
    switch (activeInboxTab) {
      case "pending":
        filtered = filtered.filter(exp => exp.status === "submitted");
        break;
      case "info_requested":
        filtered = filtered.filter(exp => exp.status === "info_requested");
        break;
      case "approved":
        filtered = filtered.filter(exp => exp.status === "approved");
        break;
      case "rejected":
        filtered = filtered.filter(exp => exp.status === "rejected");
        break;
      case "all":
      default:
        break; // No status filtering
    }

    // Smart filtering enhancements
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(exp =>
        exp.vendor_name?.toLowerCase().includes(term) ||
        exp.title?.toLowerCase().includes(term) ||
        exp.description?.toLowerCase().includes(term) ||
        exp.submitter_full_name?.toLowerCase().includes(term) ||
        exp.submitter_email?.toLowerCase().includes(term)
      );
    }

    // Submitter filtering
    if (selectedSubmitter && selectedSubmitter !== "all") {
      filtered = filtered.filter(exp => exp.submitted_by === selectedSubmitter);
    }

    // Amount filtering
    if (amountFilter.min !== undefined) {
      filtered = filtered.filter(exp => exp.amount >= amountFilter.min!);
    }
    if (amountFilter.max !== undefined) {
      filtered = filtered.filter(exp => exp.amount <= amountFilter.max!);
    }

    // Date range filtering
    if (dateRange?.from) {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      filtered = filtered.filter(exp => exp.expense_date >= startDate);
    }
    if (dateRange?.to) {
      const endDate = format(dateRange.to, 'yyyy-MM-dd');
      filtered = filtered.filter(exp => exp.expense_date <= endDate);
    }


    return filtered;
  }, [reviewableExpenses, activeInboxTab, searchTerm, selectedSubmitter, amountFilter, dateRange]);

  // Count expenses by status for badge display
  const statusCounts = useMemo(() => {
    return {
      pending: reviewableExpenses.filter(exp => exp.status === "submitted").length,
      info_requested: reviewableExpenses.filter(exp => exp.status === "info_requested").length,
      approved: reviewableExpenses.filter(exp => exp.status === "approved").length,
      rejected: reviewableExpenses.filter(exp => exp.status === "rejected").length,
    };
  }, [reviewableExpenses]);

  // Expense status update mutation
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
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["expensesWithSubmitter"] });
        queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] });
        toastHook({ title: "Success", description: "Expense status updated successfully." });
        setIsReviewDialogOpen(false);
        setExpenseToReview(null);
        setReviewAction(null);
        setReviewNotes("");
        onRefresh();
      });
    },
    onError: (error: any) => {
      startTransition(() => {
        console.error("Error updating expense status:", error);
        toastHook({ title: "Error", description: error.message, variant: "destructive" });
      });
    },
  });

  // Bulk status update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ expenseIds, status, notes }: { expenseIds: string[]; status: string; notes?: string }) => {
      const promises = expenseIds.map(expenseId =>
        supabase.rpc("update_expense_status", {
          expense_id: expenseId,
          new_status: status,
          notes: notes || null,
        })
      );
      const results = await Promise.all(promises);

      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} expenses`);
      }

      return results;
    },
    onSuccess: (_, { expenseIds, status }) => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["expensesWithSubmitter"] });
        queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] });
        toastHook({
          title: "Success",
          description: `Successfully updated ${expenseIds.length} expense(s) to ${status}.`
        });
        setSelectedExpenseIds([]);
        onRefresh();
      });
    },
    onError: (error: any) => {
      startTransition(() => {
        console.error("Error in bulk update:", error);
        toastHook({ title: "Error", description: error.message, variant: "destructive" });
      });
    },
  });

  // Assignment creation mutation
  const assignmentMutation = useMutation({
    mutationFn: async ({
      assigneeId,
      title,
      message,
      dueDate
    }: {
      assigneeId: string;
      title: string;
      message: string;
      dueDate: string
    }) => {
      // Create a new expense assignment
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          company_id: companyId,
          submitted_by: assigneeId,
          assigned_by: currentUserId,
          title: title,
          description: `Assignment Request: ${message}`,
          status: "assignment_pending",
          expense_date: new Date().toISOString().split('T')[0],
          amount: 0,
          currency_code: "USD",
          assignment_due_date: dueDate,
          assignment_message: message,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Create a notification for the assignee
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: assigneeId,
          title: "New Expense Assignment",
          message: `You have been assigned to submit an expense: ${title}`,
          type: "expense_assignment",
          reference_id: data.id,
          company_id: companyId,
          created_at: new Date().toISOString()
        });

      if (notificationError) {
        console.warn("Failed to create notification:", notificationError);
      }

      return data;
    },
    onSuccess: (data) => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["expensesWithSubmitter"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        toastHook({
          title: "Success",
          description: `Assignment created successfully for "${data.title}".`
        });
        setIsAssignmentDialogOpen(false);
        setSelectedAssigneeId("");
        setAssignmentMessage("");
        setAssignmentExpenseTitle("");
        setAssignmentDueDate("");
        onRefresh();
      });
    },
    onError: (error: any) => {
      startTransition(() => {
        console.error("Error creating assignment:", error);
        toastHook({
          title: "Assignment Failed",
          description: error.message || "Failed to create expense assignment",
          variant: "destructive"
        });
      });
    },
  });

  // Handle individual expense review actions
  const handleReviewAction = useCallback((expense: Expense, action: "approve" | "reject" | "request_info") => {
    startTransition(() => {
      setExpenseToReview(expense);
      setReviewAction(action);
      setIsReviewDialogOpen(true);
    });
  }, []);

  // Handle assignment creation
  const handleCreateAssignment = useCallback(() => {
    startTransition(() => {
      // Reset form and open dialog
      setSelectedAssigneeId("");
      setAssignmentMessage("");
      setAssignmentExpenseTitle("");
      setAssignmentDueDate("");
      setIsAssignmentDialogOpen(true);
    });
  }, []);

  // Handle assignment submission
  const handleAssignmentSubmit = useCallback(() => {
    if (!selectedAssigneeId || !assignmentExpenseTitle || !assignmentMessage) {
      toastHook({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    assignmentMutation.mutate({
      assigneeId: selectedAssigneeId,
      title: assignmentExpenseTitle,
      message: assignmentMessage,
      dueDate: assignmentDueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Default to 1 week from now
    });
  }, [selectedAssigneeId, assignmentExpenseTitle, assignmentMessage, assignmentDueDate, assignmentMutation, toastHook]);

  // Handle bulk actions
  const handleBulkAction = useCallback((action: string) => {
    if (selectedExpenseIds.length === 0) {
      toastHook({ title: "No Selection", description: "Please select expenses to perform bulk actions.", variant: "destructive" });
      return;
    }

    switch (action) {
      case "approve":
        bulkUpdateMutation.mutate({ expenseIds: selectedExpenseIds, status: "approved" });
        break;
      case "reject":
        bulkUpdateMutation.mutate({ expenseIds: selectedExpenseIds, status: "rejected", notes: "Rejected via bulk action" });
        break;
      case "request_info":
        bulkUpdateMutation.mutate({ expenseIds: selectedExpenseIds, status: "info_requested", notes: "Information requested via bulk action" });
        break;
      default:
        console.warn("Unknown bulk action:", action);
    }
  }, [selectedExpenseIds, bulkUpdateMutation, toastHook]);

  // Handle row click for expansion
  const handleRowClick = useCallback((expense: Expense) => {
    startTransition(() => {
      setExpandedExpenseId(prevId => (prevId === expense.id ? null : expense.id));
    });
  }, []);

  // Table columns configuration
  const reviewColumns: TableColumn<Expense>[] = useMemo(() => [
    {
      key: "vendor_name",
      header: "Vendor",
      render: (row) => row.vendor_name ?? "N/A",
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
      initialWidth: 100,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.category_name ?? "N/A",
      initialWidth: 120,
    },
    {
      key: "submitted_by",
      header: "Submitted By",
      render: (row) => row.submitter_full_name ?? row.submitter_email ?? "N/A",
      initialWidth: 150,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        let variant: "default" | "secondary" | "destructive" | "outline" = "default";
        let className = "";

        switch (row.status) {
          case "submitted":
            className = "bg-blue-100 text-blue-800 border-blue-300";
            break;
          case "approved":
            className = "bg-green-100 text-green-800 border-green-300";
            break;
          case "rejected":
            variant = "destructive";
            className = "bg-red-100 text-red-800 border-red-300";
            break;
          case "info_requested":
            variant = "secondary";
            className = "bg-yellow-100 text-yellow-800 border-yellow-300";
            break;
          default:
            variant = "outline";
        }

        return (
          <Badge variant={variant} className={className}>
            {row.status.charAt(0).toUpperCase() + row.status.slice(1).replace(/_/g, ' ')}
          </Badge>
        );
      },
      initialWidth: 110,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex space-x-1">
          <Link to={`/expenses/${row.id}`}>
            <Button variant="outline" size="sm" title="View Details">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          {row.status === 'submitted' && (
            <>
              <Button
                size="sm"
                onClick={() => handleReviewAction(row, "approve")}
                disabled={updateStatusMutation.isPending}
                className="bg-green-500 hover:bg-green-600 text-white"
                title="Approve"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleReviewAction(row, "reject")}
                disabled={updateStatusMutation.isPending}
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReviewAction(row, "request_info")}
                disabled={updateStatusMutation.isPending}
                title="Request Information"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </>
          )}
          {row.status === 'info_requested' && (
            <>
              <Button
                size="sm"
                onClick={() => handleReviewAction(row, "approve")}
                disabled={updateStatusMutation.isPending}
                className="bg-green-500 hover:bg-green-600 text-white"
                title="Approve"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleReviewAction(row, "reject")}
                disabled={updateStatusMutation.isPending}
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
      initialWidth: 200,
      minWidth: 150,
      cellClassName: "text-right",
      headerClassName: "text-right",
    },
  ], [updateStatusMutation.isPending, handleReviewAction]);

  if (!userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-gray-600">You don't have permission to review expenses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-500" />
            Review Inbox
            {statusCounts.pending > 0 && (
              <Badge variant="destructive" className="ml-2">
                {statusCounts.pending} pending
              </Badge>
            )}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Review and manage expense submissions from your team
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isLoadingExpenses}
            size="sm"
          >
            <RefreshCw className={cn("h-4 w-4", isLoadingExpenses && "animate-spin")} />
            Refresh
          </Button>

          <Button
            onClick={handleCreateAssignment}
            size="sm"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create & Assign
          </Button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedExpenseIds.length > 0 && (
        <BulkActionsToolbar
          selectedCount={selectedExpenseIds.length}
          onAction={handleBulkAction}
          isLoading={bulkUpdateMutation.isPending}
          actions={[
            { id: "approve", label: "Approve Selected", variant: "default" },
            { id: "reject", label: "Reject Selected", variant: "destructive" },
            { id: "request_info", label: "Request Info", variant: "outline" },
          ]}
        />
      )}

      {/* Smart Filtering */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expenses, vendors, submitters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Submitter Filter */}
            <div className="lg:w-48">
              <Select value={selectedSubmitter} onValueChange={setSelectedSubmitter}>
                <SelectTrigger>
                  <SelectValue placeholder="All submitters" className={selectedSubmitter === "all" ? "text-muted-foreground" : ""} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All submitters</SelectItem>
                  {companyUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Range */}
            <div className="flex gap-2 lg:w-48">
              <Input
                type="number"
                placeholder="Min $"
                value={amountFilter.min ?? ""}
                onChange={(e) => setAmountFilter(prev => ({ ...prev, min: e.target.value ? parseFloat(e.target.value) : undefined }))}
                className="w-24"
              />
              <Input
                type="number"
                placeholder="Max $"
                value={amountFilter.max ?? ""}
                onChange={(e) => setAmountFilter(prev => ({ ...prev, max: e.target.value ? parseFloat(e.target.value) : undefined }))}
                className="w-24"
              />
            </div>

            {/* Date Range Picker */}
            <DatePickerWithRange
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              placeholder="Date Range"
              className="w-72"
            />

            {/* Clear Filters */}
            {(searchTerm || (selectedSubmitter && selectedSubmitter !== "all") || amountFilter.min || amountFilter.max || dateRange) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedSubmitter("all");
                  setAmountFilter({});
                  setDateRange(undefined);
                  setPriorityFilter("all");
                }}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Active Filter Indicators */}
          {(searchTerm || (selectedSubmitter && selectedSubmitter !== "all") || amountFilter.min || amountFilter.max || dateRange) && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              {searchTerm && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Search: {searchTerm}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchTerm("")} />
                </Badge>
              )}
              {selectedSubmitter && selectedSubmitter !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Submitter: {companyUsers.find(u => u.user_id === selectedSubmitter)?.full_name || "Unknown"}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSubmitter("all")} />
                </Badge>
              )}
              {(amountFilter.min || amountFilter.max) && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Amount: ${amountFilter.min ?? 0} - ${amountFilter.max ?? "∞"}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setAmountFilter({})} />
                </Badge>
              )}
              {dateRange && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Date: {dateRange.from ? format(dateRange.from, 'MMM dd, y') : 'start'}{dateRange.to ? ` - ${format(dateRange.to, 'MMM dd, y')}` : ''}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setDateRange(undefined)} />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeInboxTab} onValueChange={setActiveInboxTab}>
            <div className="border-b">
              <TabsList className="w-full justify-start h-auto p-0 bg-transparent">
                <TabsTrigger
                  value="pending"
                  className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  Pending Review
                  {statusCounts.pending > 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {statusCounts.pending}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="info_requested"
                  className="flex items-center gap-2 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700"
                >
                  Info Requested
                  {statusCounts.info_requested > 0 && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      {statusCounts.info_requested}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="approved"
                  className="flex items-center gap-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700"
                >
                  Approved
                  {statusCounts.approved > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {statusCounts.approved}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="rejected"
                  className="flex items-center gap-2 data-[state=active]:bg-red-50 data-[state=active]:text-red-700"
                >
                  Rejected
                  {statusCounts.rejected > 0 && (
                    <Badge variant="secondary" className="bg-red-100 text-red-800">
                      {statusCounts.rejected}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="pending" className="mt-0">
                {isMobile ? (
                  <div className="space-y-4">
                    {filteredInboxExpenses.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <p className="text-lg font-medium">All caught up!</p>
                        <p className="text-gray-600">No expenses pending your review.</p>
                      </div>
                    ) : (
                      filteredInboxExpenses.map((expense) => (
                        <Card key={expense.id} className="p-4">
                          <ExpenseSummaryCard expense={expense} fieldConfig={{}} />
                          <div className="flex gap-2 mt-4">
                            <Link to={`/expenses/${expense.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              onClick={() => handleReviewAction(expense, "approve")}
                              disabled={updateStatusMutation.isPending}
                              className="bg-green-500 hover:bg-green-600 text-white"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReviewAction(expense, "reject")}
                              disabled={updateStatusMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <SelectableExpenseTable
                    expenses={filteredInboxExpenses}
                    columns={reviewColumns}
                    selectedExpenseIds={selectedExpenseIds}
                    onSelectedExpensesChange={setSelectedExpenseIds}
                    isLoading={isLoadingExpenses}
                    emptyMessage="No expenses pending review"
                    onRowClick={handleRowClick}
                    expandedRowId={expandedExpenseId}
                  />
                )}
              </TabsContent>

              <TabsContent value="info_requested" className="mt-0">
                {isMobile ? (
                  <div className="space-y-4">
                    {filteredInboxExpenses.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-lg font-medium">No information requests</p>
                        <p className="text-gray-600">No expenses with pending information requests.</p>
                      </div>
                    ) : (
                      filteredInboxExpenses.map((expense) => (
                        <Card key={expense.id} className="p-4">
                          <ExpenseSummaryCard expense={expense} fieldConfig={{}} />
                          <div className="flex gap-2 mt-4">
                            <Link to={`/expenses/${expense.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              onClick={() => handleReviewAction(expense, "approve")}
                              disabled={updateStatusMutation.isPending}
                              className="bg-green-500 hover:bg-green-600 text-white"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReviewAction(expense, "reject")}
                              disabled={updateStatusMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <SelectableExpenseTable
                    expenses={filteredInboxExpenses}
                    columns={reviewColumns}
                    selectedExpenseIds={selectedExpenseIds}
                    onSelectedExpensesChange={setSelectedExpenseIds}
                    isLoading={isLoadingExpenses}
                    emptyMessage="No expenses with information requested"
                    onRowClick={handleRowClick}
                    expandedRowId={expandedExpenseId}
                  />
                )}
              </TabsContent>

              <TabsContent value="approved" className="mt-0">
                {isMobile ? (
                  <div className="space-y-4">
                    {filteredInboxExpenses.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-lg font-medium">No approved expenses</p>
                        <p className="text-gray-600">Approved expenses will appear here.</p>
                      </div>
                    ) : (
                      filteredInboxExpenses.map((expense) => (
                        <Card key={expense.id} className="p-4">
                          <ExpenseSummaryCard expense={expense} fieldConfig={{}} />
                          <div className="flex gap-2 mt-4">
                            <Link to={`/expenses/${expense.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </Link>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <SelectableExpenseTable
                    expenses={filteredInboxExpenses}
                    columns={reviewColumns.filter(col => col.key !== "actions" ||
                      filteredInboxExpenses.some(exp => exp.status === "approved"))}
                    selectedExpenseIds={selectedExpenseIds}
                    onSelectedExpensesChange={setSelectedExpenseIds}
                    isLoading={isLoadingExpenses}
                    emptyMessage="No approved expenses"
                    onRowClick={handleRowClick}
                    expandedRowId={expandedExpenseId}
                  />
                )}
              </TabsContent>

              <TabsContent value="rejected" className="mt-0">
                {isMobile ? (
                  <div className="space-y-4">
                    {filteredInboxExpenses.length === 0 ? (
                      <div className="text-center py-8">
                        <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-lg font-medium">No rejected expenses</p>
                        <p className="text-gray-600">Rejected expenses will appear here.</p>
                      </div>
                    ) : (
                      filteredInboxExpenses.map((expense) => (
                        <Card key={expense.id} className="p-4">
                          <ExpenseSummaryCard expense={expense} fieldConfig={{}} />
                          <div className="flex gap-2 mt-4">
                            <Link to={`/expenses/${expense.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </Link>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <SelectableExpenseTable
                    expenses={filteredInboxExpenses}
                    columns={reviewColumns.filter(col => col.key !== "actions" ||
                      filteredInboxExpenses.some(exp => exp.status === "rejected"))}
                    selectedExpenseIds={selectedExpenseIds}
                    onSelectedExpensesChange={setSelectedExpenseIds}
                    isLoading={isLoadingExpenses}
                    emptyMessage="No rejected expenses"
                    onRowClick={handleRowClick}
                    expandedRowId={expandedExpenseId}
                  />
                )}
              </TabsContent>

              <TabsContent value="all" className="mt-0">
                {isMobile ? (
                  <div className="space-y-4">
                    {filteredInboxExpenses.length === 0 ? (
                      <div className="text-center py-8">
                        <ClipboardCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-lg font-medium">No expenses found</p>
                        <p className="text-gray-600">All expenses will appear here once submitted.</p>
                      </div>
                    ) : (
                      filteredInboxExpenses.map((expense) => (
                        <Card key={expense.id} className="p-4">
                          <ExpenseSummaryCard expense={expense} fieldConfig={{}} />
                          <div className="flex gap-2 mt-4">
                            <Link to={`/expenses/${expense.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </Link>
                            {expense.status === 'submitted' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleReviewAction(expense, "approve")}
                                  disabled={updateStatusMutation.isPending}
                                  className="bg-green-500 hover:bg-green-600 text-white"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleReviewAction(expense, "reject")}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <SelectableExpenseTable
                    expenses={filteredInboxExpenses}
                    columns={reviewColumns}
                    selectedExpenseIds={selectedExpenseIds}
                    onSelectedExpensesChange={setSelectedExpenseIds}
                    isLoading={isLoadingExpenses}
                    emptyMessage="No expenses found"
                    onRowClick={handleRowClick}
                    expandedRowId={expandedExpenseId}
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Action Dialog */}
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

          {(reviewAction === "reject" || reviewAction === "request_info") && (
            <div className="space-y-2">
              <Label htmlFor="review-notes">
                {reviewAction === "request_info" ? "Message to Submitter*" : "Reason for Rejection*"}
              </Label>
              <Textarea
                id="review-notes"
                placeholder={reviewAction === "request_info" ?
                  "Explain what information is needed..." :
                  "Please provide a reason for rejection..."}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                disabled={updateStatusMutation.isPending}
              />
              {!reviewNotes.trim() && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {reviewAction === "request_info" ? "A message is required." : "A reason is required."}
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatusMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                let newStatus = "";
                if (reviewAction === "approve") newStatus = "approved";
                else if (reviewAction === "reject") newStatus = "rejected";
                else if (reviewAction === "request_info") newStatus = "info_requested";

                updateStatusMutation.mutate({
                  expenseId: expenseToReview!.id,
                  status: newStatus,
                  notes: reviewNotes
                });
              }}
              disabled={updateStatusMutation.isPending ||
                ((reviewAction === "reject" || reviewAction === "request_info") && !reviewNotes.trim())}
              className={reviewAction === "reject" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {updateStatusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {reviewAction === "approve" ? "Approve" :
               reviewAction === "reject" ? "Reject" :
               "Request Info"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assignment Dialog */}
      <AlertDialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-500" />
              Create & Assign Expense
            </AlertDialogTitle>
            <AlertDialogDescription>
              Create an expense assignment for a team member. They will be notified and can submit the required expense information.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {/* Assignee Selection */}
            <div className="space-y-2">
              <Label htmlFor="assignee">Assign To *</Label>
              <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {companyUsers
                    .filter(user => user.user_id !== currentUserId) // Don't show current user
                    .map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expense Title */}
            <div className="space-y-2">
              <Label htmlFor="expense-title">Expense Title *</Label>
              <Input
                id="expense-title"
                placeholder="e.g., Office supplies receipt, Travel expenses"
                value={assignmentExpenseTitle}
                onChange={(e) => setAssignmentExpenseTitle(e.target.value)}
                disabled={assignmentMutation.isPending}
              />
            </div>

            {/* Assignment Message */}
            <div className="space-y-2">
              <Label htmlFor="assignment-message">Message *</Label>
              <Textarea
                id="assignment-message"
                placeholder="Describe what expense information is needed..."
                value={assignmentMessage}
                onChange={(e) => setAssignmentMessage(e.target.value)}
                disabled={assignmentMutation.isPending}
                rows={3}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date (Optional)</Label>
              <Input
                id="due-date"
                type="date"
                value={assignmentDueDate}
                onChange={(e) => setAssignmentDueDate(e.target.value)}
                disabled={assignmentMutation.isPending}
                min={new Date().toISOString().split('T')[0]} // Prevent past dates
              />
              {!assignmentDueDate && (
                <p className="text-xs text-gray-500">Default: 1 week from now</p>
              )}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={assignmentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAssignmentSubmit}
              disabled={assignmentMutation.isPending || !selectedAssigneeId || !assignmentExpenseTitle || !assignmentMessage}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {assignmentMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};