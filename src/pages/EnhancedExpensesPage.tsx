import { useState, useMemo, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Receipt, Download, Upload, Sparkles, ClipboardCheck } from "lucide-react";
import { useExpensesWithSubmitter } from "@/hooks/useExpensesWithSubmitter";
import { useProfile } from "@/hooks/useProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { EnhancedExpenseTableV2 } from "@/components/expenses/enhanced/EnhancedExpenseTableV2";
import { ReviewInboxTab } from "@/components/expenses/ReviewInboxTab";
import { Dialog } from "@/components/ui/dialog";
import AddEditExpenseDialog from "@/components/AddEditExpenseDialog";
import { IngridExpenseCreationDialog } from "@/components/ingrid/IngridExpenseCreationDialog";
import { InvoiceStyleExpenseModal } from "@/components/expenses/invoice/InvoiceStyleExpenseModal";
import AdvancedSearchFilter from "@/components/AdvancedSearchFilter";
import QuickFilters from "@/components/QuickFilters";
import { useAdvancedSearch } from "@/hooks/useAdvancedSearch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BulkActionsToolbar from "@/components/BulkActionsToolbar";
import ExportDialog from "@/components/ExportDialog";
import { exportService } from "@/services/exportService";
import { useNotificationActions } from "@/hooks/useNotificationActions";
import { usePermissions } from "@/hooks/usePermissions";
import { OPERATIONS_PERMISSIONS } from "@/types/permissions";
import { toast } from "sonner";

const EnhancedExpensesPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const {
    notifyExpenseApproved,
    notifyExpenseRejected,
    notifyExpenseInfoRequested,
    notifyBulkActionCompleted
  } = useNotificationActions();

  const { data: profile, isLoading: isLoadingProfile } = useProfile();
  const { hasPermission } = usePermissions();

  const [activeTab, setActiveTab] = useState(() =>
    hasPermission(OPERATIONS_PERMISSIONS.EXPENSES_REVIEW) &&
    profile?.role && ['admin', 'controller', 'super-admin'].includes(profile.role)
      ? "review-inbox"
      : "all"
  );
  const { data: expenses = [], isLoading, error, refetch: refetchExpenses } = useExpensesWithSubmitter(
    profile?.company_id ?? undefined
  );

  // Check if user has expense review permissions
  const canReview = hasPermission(OPERATIONS_PERMISSIONS.EXPENSES_REVIEW) &&
    profile?.role &&
    ['admin', 'controller', 'super-admin'].includes(profile.role);

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isIngridDialogOpen, setIsIngridDialogOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);


  // Fetch categories for filtering
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: ["expenseCategories", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .order("name");
      if (error) {
        console.error("Error fetching expense categories:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!profile?.company_id,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch submitters for filtering
  const submitters = useMemo(() => {
    const uniqueSubmitters = new Map();
    expenses.forEach(expense => {
      if (expense.submitted_by && !uniqueSubmitters.has(expense.submitted_by)) {
        uniqueSubmitters.set(expense.submitted_by, {
          id: expense.submitted_by,
          name: expense.submitter_full_name ?? "",
          email: expense.submitter_email ?? "",
        });
      }
    });
    return Array.from(uniqueSubmitters.values());
  }, [expenses]);

  // Fetch vendors for filtering
  const { data: vendors = [], error: vendorsError } = useQuery({
    queryKey: ["vendors", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("name");
      if (error) {
        console.error("Error fetching vendors:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!profile?.company_id,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Bulk operations mutation
  const bulkOperationMutation = useMutation({
    mutationFn: async ({ actionId, expenseIds }: { actionId: string; expenseIds: string[] }) => {
      const updates: Record<string, any> = {};

      switch (actionId) {
        case "approve":
          updates.status = "approved";
          updates.approved_at = new Date().toISOString();
          updates.approved_by = profile?.id;
          break;
        case "reject":
          updates.status = "rejected";
          updates.rejected_at = new Date().toISOString();
          updates.rejected_by = profile?.id;
          break;
        case "request_info":
          updates.status = "info_requested";
          updates.info_requested_at = new Date().toISOString();
          updates.info_requested_by = profile?.id;
          break;
        case "archive":
          updates.is_archived = true;
          updates.archived_at = new Date().toISOString();
          updates.archived_by = profile?.id;
          break;
        case "delete":
          // For delete, we'll handle it separately
          const { error: deleteError } = await supabase
            .from("expenses")
            .delete()
            .in("id", expenseIds)
            .eq("status", "draft"); // Only allow deleting draft expenses

          if (deleteError) throw deleteError;
          return;
        case "assign_reviewer":
          // This would typically open a dialog to select a reviewer
          toast.info("Reviewer assignment dialog would open here");
          return;
        case "export":
          // Export is handled separately via the export dialog
          return;
        default:
          throw new Error(`Unknown action: ${actionId}`);
      }

      // For non-delete operations, update the expenses
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("expenses")
          .update(updates)
          .in("id", expenseIds);

        if (error) throw error;
      }
    },
    onSuccess: async (_, { actionId, expenseIds }) => {
      queryClient.invalidateQueries({ queryKey: ["expensesWithSubmitter"] });

      // Send notifications for successful bulk actions
      try {
        const affectedExpenses = expenses.filter(expense => expenseIds.includes(expense.id));

        for (const expense of affectedExpenses) {
          if (expense.submitted_by) {
            switch (actionId) {
              case "approve":
                await notifyExpenseApproved(
                  expense.submitted_by,
                  expense.description,
                  expense.amount
                );
                break;
              case "reject":
                await notifyExpenseRejected(
                  expense.submitted_by,
                  expense.description,
                  expense.amount
                );
                break;
              case "request_info":
                await notifyExpenseInfoRequested(
                  expense.submitted_by,
                  expense.description
                );
                break;
            }
          }
        }

        // Notify the current user about bulk action completion
        if (profile?.id && actionId !== "export") {
          await notifyBulkActionCompleted(
            [profile.id],
            actionId,
            expenseIds.length,
            "expenses"
          );
        }
      } catch (notificationError) {
        console.error('Failed to send notifications:', notificationError);
        // Don't fail the entire operation if notifications fail
      }

      startTransition(() => setSelectedExpenseIds([]));
    },
  });

  // Advanced search and filtering
  const {
    filters,
    updateFilters,
    resetFilters,
    applyQuickFilter,
    filteredItems: filteredExpenses,
    searchStats,
  } = useAdvancedSearch(expenses);

  // Filter by tab and search
  const tabFilteredExpenses = useMemo(() => {
    if (activeTab === "all") return filteredExpenses;
    return filteredExpenses.filter((expense) => expense.status === activeTab);
  }, [filteredExpenses, activeTab]);

  // Get counts for each status
  const statusCounts = useMemo(() => {
    const counts = {
      all: filteredExpenses.length,
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      info_requested: 0,
    };

    filteredExpenses.forEach((expense) => {
      if (expense.status in counts) {
        counts[expense.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [filteredExpenses]);

  const handleAddClick = () => {
    startTransition(() => {
      // Open original Ingrid dialog for AI upload, then it will flow to invoice view
      setIsIngridDialogOpen(true);
    });
  };


  const handleEditClick = (expenseId: string) => {
    startTransition(() => {
      setEditingExpenseId(expenseId);
      setIsAddEditDialogOpen(true);
    });
  };

  const handleRowClick = (expenseId: string) => {
    navigate(`/expenses/${expenseId}`);
  };

  const handleToggleExpand = (expenseId: string) => {
    startTransition(() => {
      setExpandedExpenseId(prev => prev === expenseId ? null : expenseId);
    });
  };

  const handleBulkAction = async (actionId: string, expenseIds: string[]) => {
    if (actionId === "export") {
      startTransition(() => setIsExportDialogOpen(true));
      return;
    }
    return bulkOperationMutation.mutateAsync({ actionId, expenseIds });
  };

  const handleClearSelection = () => {
    startTransition(() => setSelectedExpenseIds([]));
  };

  const handleSelectionChange = (expenseIds: string[]) => {
    startTransition(() => setSelectedExpenseIds(expenseIds));
  };

  const handleExport = async (options: any) => {
    const dataToExport = selectedExpenseIds.length > 0
      ? tabFilteredExpenses.filter(expense => selectedExpenseIds.includes(expense.id))
      : tabFilteredExpenses;

    await exportService.exportExpenses(dataToExport, options);
  };


  if (isLoadingProfile || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading expenses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Error loading expenses: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            Manage and track expense submissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => startTransition(() => setIsExportDialogOpen(true))}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button size="sm" onClick={handleAddClick}>
            <Sparkles className="h-4 w-4 mr-2" />
            New Expense with AI
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsInvoiceModalOpen(true)}>
            <Receipt className="h-4 w-4 mr-2" />
            Invoice Style
          </Button>
        </div>
      </div>

      {/* Quick Filters */}
      <QuickFilters
        onApplyFilter={applyQuickFilter}
        searchStats={searchStats}
      />

      {/* Advanced Search & Filter */}
      <AdvancedSearchFilter
        filters={filters}
        onFiltersChange={updateFilters}
        categories={categories}
        submitters={submitters}
        vendors={vendors}
        isLoading={isLoading}
      />

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedItems={selectedExpenseIds}
        onClearSelection={handleClearSelection}
        onBulkAction={handleBulkAction}
        totalItems={tabFilteredExpenses.length}
        itemType="expenses"
        isLoading={bulkOperationMutation.isPending}
        userRole={profile?.role ?? "user"}
      />

      {/* Summary Stats */}
      {searchStats.isFiltered && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{statusCounts.all}</div>
                <div className="text-sm text-muted-foreground">Total Filtered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statusCounts.submitted}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{statusCounts.approved}</div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{statusCounts.rejected}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs and Table */}
      <Tabs value={activeTab} onValueChange={(value) => startTransition(() => setActiveTab(value))} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            {canReview && (
              <TabsTrigger value="review-inbox" className="relative">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Review Inbox
                {statusCounts.submitted > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5">
                    {statusCounts.submitted}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="all" className="relative">
              All
              {statusCounts.all > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5">
                  {statusCounts.all}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="draft" className="relative">
              Draft
              {statusCounts.draft > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5">
                  {statusCounts.draft}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="submitted" className="relative">
              Submitted
              {statusCounts.submitted > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5">
                  {statusCounts.submitted}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="relative">
              Approved
              {statusCounts.approved > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5">
                  {statusCounts.approved}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="relative">
              Rejected
              {statusCounts.rejected > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5">
                  {statusCounts.rejected}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
            {searchStats.isFiltered && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        </div>

        {/* Review Inbox Tab Content */}
        {canReview && (
          <TabsContent value="review-inbox" className="space-y-4">
            <ReviewInboxTab
              companyId={profile?.company_id ?? ''}
              currentUserId={profile?.id ?? ''}
              userRole={profile?.role ?? ''}
              expenses={expenses}
              isLoadingExpenses={isLoading}
              onRefresh={refetchExpenses}
            />
          </TabsContent>
        )}

        {/* Standard Expense Management Tabs */}
        <TabsContent value="all" className="space-y-4">
          <EnhancedExpenseTableV2
            expenses={tabFilteredExpenses}
            selectedExpenseIds={selectedExpenseIds}
            onSelectionChange={handleSelectionChange}
            showAIIndicators={true}
            compactMode={isMobile}
          />
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          <EnhancedExpenseTableV2
            expenses={tabFilteredExpenses}
            selectedExpenseIds={selectedExpenseIds}
            onSelectionChange={handleSelectionChange}
            showAIIndicators={true}
            compactMode={isMobile}
          />
        </TabsContent>

        <TabsContent value="submitted" className="space-y-4">
          <EnhancedExpenseTableV2
            expenses={tabFilteredExpenses}
            selectedExpenseIds={selectedExpenseIds}
            onSelectionChange={handleSelectionChange}
            showAIIndicators={true}
            compactMode={isMobile}
          />
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <EnhancedExpenseTableV2
            expenses={tabFilteredExpenses}
            selectedExpenseIds={selectedExpenseIds}
            onSelectionChange={handleSelectionChange}
            showAIIndicators={true}
            compactMode={isMobile}
          />
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <EnhancedExpenseTableV2
            expenses={tabFilteredExpenses}
            selectedExpenseIds={selectedExpenseIds}
            onSelectionChange={handleSelectionChange}
            showAIIndicators={true}
            compactMode={isMobile}
          />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddEditDialogOpen} onOpenChange={(open) => startTransition(() => setIsAddEditDialogOpen(open))}>
        <AddEditExpenseDialog
          editingExpenseId={editingExpenseId}
          isOpen={isAddEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) setEditingExpenseId(null);
            startTransition(() => setIsAddEditDialogOpen(open));
          }}
        />
      </Dialog>

      {/* Ingrid AI Expense Creation Dialog */}
      <IngridExpenseCreationDialog
        isOpen={isIngridDialogOpen}
        onOpenChange={(open) => startTransition(() => setIsIngridDialogOpen(open))}
        onExpenseCreated={(expenseId) => {
          console.log('New expense created with Ingrid:', expenseId);
          toast({
            title: "Success!",
            description: "Your expense has been created with Ingrid's assistance.",
          });
        }}
      />

      {/* Invoice Style Expense Modal */}
      <InvoiceStyleExpenseModal
        isOpen={isInvoiceModalOpen}
        onOpenChange={(open) => startTransition(() => setIsInvoiceModalOpen(open))}
        mode="create"
        onSave={async (expenseData) => {
          console.log('Saving expense with invoice style:', expenseData);
          // TODO: Implement save logic using existing expense mutation
          toast({
            title: "Success!",
            description: "Your expense has been saved with invoice-style formatting.",
          });
          setIsInvoiceModalOpen(false);
        }}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onOpenChange={(open) => startTransition(() => setIsExportDialogOpen(open))}
        onExport={handleExport}
        dataType="expenses"
        itemCount={selectedExpenseIds.length > 0 ? selectedExpenseIds.length : tabFilteredExpenses.length}
      />
    </div>
  );
};

export default EnhancedExpensesPage;