import { useState, useMemo, useCallback } from "react"; // Added useCallback
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react"; // Import Receipt icon
import { useExpensesWithSubmitter } from "@/hooks/useExpensesWithSubmitter"; // Removed ExpenseWithSubmitter import
import { useProfile } from "@/hooks/useProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import AddEditExpenseDialog from "@/components/AddEditExpenseDialog";
import { Expense, ALL_EXPENSE_FIELDS } from "@/types/expenses"; // Import ALL_EXPENSE_FIELDS
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card components

// Define the structure for field settings
interface FieldSetting {
  visible: boolean;
  required: boolean;
}

const ExpensesPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  
  const { data: profile, isLoading: isLoadingProfile } = useProfile(); // Added isLoadingProfile
  const { data: expenses = [], isLoading, error } = useExpensesWithSubmitter(
    profile?.company_id || undefined
  );

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null); // New state for expanded row

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

  // 2. Fetch Expense Management Configuration for the current company (user fields)
  const { data: expenseModuleConfig, isLoading: isLoadingConfig } = useQuery<{ settings: { user_fields: Record<string, FieldSetting> } } | null>({
    queryKey: ["expenseModuleUserConfig", profile?.company_id, expenseModuleId], // Changed key to user_fields
    queryFn: async () => {
      if (!profile?.company_id || !expenseModuleId) return null;
      const { data, error } = await supabase
        .from("module_configurations")
        .select("settings")
        .eq("company_id", profile.company_id)
        .eq("module_id", expenseModuleId)
        .eq("config_key", "expense_management_fields")
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!profile?.company_id && !!expenseModuleId && !isLoadingProfile,
  });

  // Helper to get field visibility and required status for users
  const getUserFieldConfig = useCallback((fieldKey: string): FieldSetting => {
    return expenseModuleConfig?.settings?.user_fields?.[fieldKey] || { visible: true, required: false }; // Default to visible, not required
  }, [expenseModuleConfig]);

  const userFieldsConfig = useMemo(() => {
    const config: Record<string, FieldSetting> = {};
    ALL_EXPENSE_FIELDS.forEach(field => {
      config[field.key] = getUserFieldConfig(field.key);
    });
    return config;
  }, [getUserFieldConfig]);

  // Fetch the full expense object when editingExpenseId is set
  const { data: fullEditingExpense } = useQuery<Expense | null>({
    queryKey: ["expense", editingExpenseId],
    queryFn: async () => {
      if (!editingExpenseId) return null;
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          expense_categories (id, name),
          gl_accounts (id, account_code, account_name),
          receipts (id, file_url, file_name, mime_type, ai_extracted_text, ai_raw_json, text_hash, document_type_classification, document_type_confidence),
          expense_line_items (id, description, quantity, unit_price, line_amount, currency_code)
        `)
        .eq("id", editingExpenseId)
        .single();
      if (error) throw error;
      return data as Expense;
    },
    enabled: !!editingExpenseId,
  });

  // Filter expenses based on active tab
  const filteredExpenses = useMemo(() => {
    if (activeTab === "all") return expenses;
    return expenses.filter((expense) => expense.status === activeTab);
  }, [expenses, activeTab]);

  // Get counts for each status
  const statusCounts = useMemo(() => {
    const counts = {
      all: expenses.length,
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      info_requested: 0,
    };

    expenses.forEach((expense) => {
      if (expense.status in counts) {
        counts[expense.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [expenses]);

  const handleView = (expense: Expense) => { // Changed type to Expense
    navigate(`/expenses/${expense.id}`);
  };

  const handleAddClick = () => {
    setEditingExpenseId(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEdit = (expense: Expense) => { // Changed type to Expense
    setEditingExpenseId(expense.id);
    setIsAddEditDialogOpen(true);
  };

  const handleDelete = async (expense: Expense) => { // Changed type to Expense
    if (expense.status !== "draft") {
      toast.error("Only draft expenses can be deleted");
      return;
    }

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expense.id);

      if (error) throw error;

      toast.success("Expense deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["expenses-with-submitter"] });
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    }
  };

  const handleRowClick = useCallback((expense: Expense) => { // Changed type to Expense
    setExpandedExpenseId(prevId => (prevId === expense.id ? null : expense.id));
  }, []);

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          Error loading expenses: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Expenses
            </CardTitle>
            <CardDescription>
              Manage and track your expense reports
            </CardDescription>
          </div>
          <Button onClick={handleAddClick} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Expense
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                All ({statusCounts.all})
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs sm:text-sm">
                Draft ({statusCounts.draft})
              </TabsTrigger>
              <TabsTrigger value="submitted" className="text-xs sm:text-sm">
                Submitted ({statusCounts.submitted})
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs sm:text-sm">
                Approved ({statusCounts.approved})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs sm:text-sm">
                Rejected ({statusCounts.rejected})
              </TabsTrigger>
              <TabsTrigger value="info_requested" className="text-xs sm:text-sm">
                Info Requested ({statusCounts.info_requested})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {isLoading || isLoadingProfile || isLoadingExpenseModuleId || isLoadingConfig ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {activeTab === "all" ? "" : activeTab} expenses found
                </div>
              ) : (
                <ExpenseTable
                  expenses={filteredExpenses}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isMobile={isMobile}
                  showSubmitterColumn={false}
                  onRowClick={handleRowClick} // Pass the row click handler
                  expandedRowId={expandedExpenseId} // Pass the expanded state
                  userFieldsConfig={userFieldsConfig} // Pass the user field config
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isAddEditDialogOpen} onOpenChange={(open) => {
        setIsAddEditDialogOpen(open);
        if (!open) {
          setEditingExpenseId(null);
        }
      }}>
        <AddEditExpenseDialog
          isOpen={isAddEditDialogOpen}
          onOpenChange={setIsAddEditDialogOpen}
          editingExpense={fullEditingExpense}
          onSuccess={() => {
            setIsAddEditDialogOpen(false);
            setEditingExpenseId(null);
          }}
        />
      </Dialog>
    </div>
  );
};

export default ExpensesPage;