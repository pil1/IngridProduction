// Enhanced Customers Page with Module-Based Features
// Conditionally shows AI features based on Ingrid AI module access

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiClient } from "@/integrations/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  PlusCircle,
  Trash2,
  Building2,
  Sparkles,
  Lightbulb,
  Bot,
  Users,
  AlertCircle,
  Info
} from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
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

// Import permission hooks and components
import {
  useCanAccessIngrid,
  useHasModuleAccess,
  useHasPermission,
  useCanManageCustomers
} from "@/hooks/useEnhancedPermissions";
import {
  IngridFeature,
  HasPermission,
  ConditionalFeature
} from "@/components/permissions/PermissionWrapper";
import { ALL_PERMISSIONS } from "@/types/permissions";

// Import existing components
import AddEditCustomerDialog, { CustomerFormValues } from "@/components/AddEditCustomerDialog";
import CustomerGrid from "@/components/customers/CustomerGrid";
import AIEnhancedCustomerCreation from "@/components/customers/AIEnhancedCustomerCreation";

// ================================================================
// INTERFACES
// ================================================================

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  spire_customer_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  website: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  default_currency_code: string | null;
  notes: string | null;
  account_number: string | null;
  tax_exempt: boolean;
  credit_limit: number | null;
  payment_method: string | null;
  code: string | null;
  receivable_account: string | null;
  upload_flag: boolean | null;
  discount_code: string | null;
  credit_type: number | null;
  on_hold: boolean | null;
  reference_code: string | null;
  apply_finance_charges: boolean | null;
  user_def_1: string | null;
  background_color_int: number | null;
  default_ship_to_code: string | null;
  foreground_color_int: number | null;
  user_def_2: string | null;
  udf_data: any | null;
  statement_type: string | null;
  payment_provider_id_int: number | null;
  special_code: string | null;
  spire_status: string | null;
  shipping_address_line_1: string | null;
  shipping_address_line_2: string | null;
  shipping_city: string | null;
  shipping_state_province: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
}

// ================================================================
// SIMPLE CUSTOMER FORM (Non-AI Fallback)
// ================================================================

const SimpleCustomerForm: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer?: Customer | null;
  onSuccess: () => void;
}> = ({ isOpen, onOpenChange, editingCustomer, onSuccess }) => {
  return (
    <AddEditCustomerDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      editingCustomer={editingCustomer}
      onSuccess={onSuccess}
    />
  );
};

// ================================================================
// MAIN COMPONENT
// ================================================================

const EnhancedCustomersPage: React.FC = () => {
  const { profile } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Permission and module access checks
  const canAccessIngrid = useCanAccessIngrid();
  const hasIngridModule = useHasModuleAccess('Ingrid AI');
  const canManageCustomers = useCanManageCustomers();
  const canCreateCustomers = useHasPermission(ALL_PERMISSIONS.CUSTOMERS_CREATE);
  const canEditCustomers = useHasPermission(ALL_PERMISSIONS.CUSTOMERS_EDIT);
  const canDeleteCustomers = useHasPermission(ALL_PERMISSIONS.CUSTOMERS_DELETE);

  // ================================================================
  // DATA FETCHING
  // ================================================================

  const { data: customers = [], isLoading, error } = useQuery<Customer[]>({
    queryKey: ["customers", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      const response = await apiClient.get('/customers');
      return response.data?.customers || [];
    },
    enabled: !!profile?.company_id,
  });

  // ================================================================
  // MUTATIONS
  // ================================================================

  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      await apiClient.delete(`/customers/${customerId}`);
    },
    onSuccess: () => {
      toast({ title: "Customer deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerToDelete(null);
    },
    onError: () => {
      toast({
        title: "Failed to delete customer",
        variant: "destructive"
      });
    },
  });

  // ================================================================
  // HANDLERS
  // ================================================================

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      deleteCustomerMutation.mutate(customerToDelete.id);
    }
  };

  const handleSuccess = () => {
    setIsAddEditDialogOpen(false);
    setEditingCustomer(null);
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  // ================================================================
  // RENDER
  // ================================================================

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading customers: {(error as Error).message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Customers
              {canAccessIngrid && (
                <Badge variant="secondary" className="ml-2">
                  <Bot className="h-3 w-3 mr-1" />
                  AI Enhanced
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {canAccessIngrid
                ? "Manage customers with AI-powered document processing and data enrichment"
                : "Manage your customer information and relationships"
              }
            </CardDescription>
          </div>

          <HasPermission permission={ALL_PERMISSIONS.CUSTOMERS_CREATE}>
            <Button onClick={handleAddCustomer} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </HasPermission>
        </CardHeader>

        <CardContent>
          {/* Module Status Alert */}
          {!hasIngridModule && (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Basic Mode:</strong> AI features are not available.
                Contact your administrator to enable Ingrid AI for advanced customer processing and data enrichment.
              </AlertDescription>
            </Alert>
          )}

          <ConditionalFeature
            condition={canAccessIngrid}
            whenTrue={
              <Tabs defaultValue="customers" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="customers" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Customers
                  </TabsTrigger>
                  <TabsTrigger value="suggestions" className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Ingrid Suggestions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="customers" className="mt-6">
                  <CustomerGrid
                    customers={customers}
                    loading={isLoading}
                    onEdit={handleEditCustomer}
                    onView={handleEditCustomer}
                    onDelete={handleDeleteCustomer}
                    canEdit={canEditCustomers}
                    canDelete={canDeleteCustomers}
                    showAiBadges={canAccessIngrid}
                  />
                </TabsContent>

                <TabsContent value="suggestions" className="mt-6">
                  <IngridFeature>
                    <div className="text-center py-12">
                      <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Customer Suggestions</h3>
                      <p className="text-muted-foreground">
                        AI-powered customer suggestions will be available here in a future update.
                      </p>
                    </div>
                  </IngridFeature>
                </TabsContent>
              </Tabs>
            }
            whenFalse={
              <CustomerGrid
                customers={customers}
                loading={isLoading}
                onEdit={handleEditCustomer}
                onView={handleEditCustomer}
                onDelete={handleDeleteCustomer}
                canEdit={canEditCustomers}
                canDelete={canDeleteCustomers}
                showAiBadges={false}
              />
            }
          />
        </CardContent>
      </Card>

      {/* Conditional Customer Dialog */}
      {isAddEditDialogOpen && (
        editingCustomer ? (
          <AddEditCustomerDialog
            isOpen={isAddEditDialogOpen}
            onOpenChange={setIsAddEditDialogOpen}
            editingCustomer={editingCustomer}
            companyId={profile?.company_id || ''}
            initialMode="view"
            onSuccess={handleSuccess}
          />
        ) : canAccessIngrid ? (
          <AIEnhancedCustomerCreation
            isOpen={isAddEditDialogOpen}
            onOpenChange={setIsAddEditDialogOpen}
            onSuccess={handleSuccess}
            companyId={profile?.company_id || ''}
          />
        ) : (
          <AddEditCustomerDialog
            isOpen={isAddEditDialogOpen}
            onOpenChange={setIsAddEditDialogOpen}
            editingCustomer={editingCustomer}
            companyId={profile?.company_id || ''}
            initialMode="create"
            onSuccess={handleSuccess}
          />
        )
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{customerToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCustomerMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EnhancedCustomersPage;