"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Trash2, UsersRound, Sparkles } from "lucide-react"; // Import UsersRound icon
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
import AddEditCustomerDialog, { CustomerFormValues } from "@/components/AddEditCustomerDialog"; // Import CustomerFormValues
import SmartAddDialog from "@/components/SmartAddDialog";

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
  account_number: string | null; // Spire's 'code'
  tax_exempt: boolean | null;
  credit_limit: number | null;
  payment_method: string | null;
  code: string | null; // Spire's 'code'
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
  udf_data: any | null; // JSONB
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

const CustomersPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isSmartAddDialogOpen, setIsSmartAddDialogOpen] = useState(false);
  const [smartAddPrefillData, setSmartAddPrefillData] = useState<Partial<CustomerFormValues> | null>(null); // Use CustomerFormValues here

  const currentCompanyId = profile?.company_id;
  const userRole = profile?.role;

  const { data: customers, isLoading: isLoadingCustomers, isError: isErrorCustomers } = useQuery<Customer[]>({
    queryKey: ["customers", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", currentCompanyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompanyId && !isLoadingSession,
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      if (!currentCompanyId) throw new Error("Company ID not found.");
      const { error } = await supabase.from("customers").delete().eq("id", customerId).eq("company_id", currentCompanyId);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer Deleted", description: "Customer record has been successfully deleted." });
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error deleting customer", description: error.message ?? "An unexpected error occurred.", variant: "destructive" });
    },
  });

  const handleAddClick = () => {
    setEditingCustomer(null);
    setSmartAddPrefillData(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setSmartAddPrefillData(null);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      deleteCustomerMutation.mutate(customerToDelete.id);
    }
  };

  const handleSmartAddSuccess = (data: Partial<Customer>) => {
    // Explicitly convert nullable fields from Partial<Customer> to Partial<CustomerFormValues>
    const cleanedData: Partial<CustomerFormValues> = {
      ...data,
      default_currency_code: data.default_currency_code ?? undefined, // Convert null to undefined
      is_active: data.is_active ?? true, // Default to true if null/undefined
      tax_exempt: data.tax_exempt ?? false, // Default to false if null/undefined
      credit_limit: data.credit_limit ?? undefined, // Convert null to undefined
      upload_flag: data.upload_flag ?? true, // Default to true if null/undefined
      credit_type: data.credit_type ?? undefined, // Convert null to undefined
      on_hold: data.on_hold ?? false, // Default to false if null/undefined
      apply_finance_charges: data.apply_finance_charges ?? false, // Default to false if null/undefined
      background_color_int: data.background_color_int ?? undefined, // Convert null to undefined
      foreground_color_int: data.foreground_color_int ?? undefined, // Convert null to undefined
      udf_data: data.udf_data === null ? {} : data.udf_data, // Default to empty object if null
      payment_provider_id_int: data.payment_provider_id_int ?? undefined, // Convert null to undefined
    };
    setSmartAddPrefillData(cleanedData);
    setEditingCustomer(null);
    setIsAddEditDialogOpen(true);
  };

  const isActionPending = deleteCustomerMutation.isPending;

  // Determine if the current user has permission to manage customers
  const canManageCustomers = userRole && ['admin', 'controller', 'super-admin'].includes(userRole);

  if (isLoadingSession || isLoadingCustomers) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading customers...</p>
      </div>
    );
  }

  if (!canManageCustomers) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Admins, Controllers, or Super Admins can manage customers.</p>
      </div>
    );
  }

  if (!currentCompanyId) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error: Company ID not found. Please ensure your profile is linked to a company.</p>
      </div>
    );
  }

  if (isErrorCustomers) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading customers. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5" /> Customers
            </CardTitle>
            <CardDescription>
              Manage your company's customer relationships.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsSmartAddDialogOpen(true)} disabled={isLoadingCustomers || !canManageCustomers}>
              <Sparkles className="mr-2 h-4 w-4" /> Smart Add
            </Button>
            <Button onClick={handleAddClick} disabled={isLoadingCustomers || !canManageCustomers}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Customer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCustomers ? (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading customers...
            </div>
          ) : isErrorCustomers ? (
            <div className="text-red-500">Error loading customers.</div>
          ) : !customers || customers.length === 0 ? (
            <div>No customers defined for your company.</div>
          ) : (
            <div className="space-y-2">
              {customers?.map((customer) => (
                <Card key={customer.id} className="p-2 hover:bg-muted cursor-pointer">
                  <div className="flex justify-between items-center" onClick={() => handleEditClick(customer)}>
                    <div className="font-semibold">{customer.name}</div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent opening the dialog when deleting
                        handleDeleteClick(customer);
                      }}
                      disabled={isActionPending}
                    >
                      {isActionPending && customerToDelete?.id === customer.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
        <AddEditCustomerDialog
          isOpen={isAddEditDialogOpen}
          onOpenChange={setIsAddEditDialogOpen}
          editingCustomer={editingCustomer}
          companyId={currentCompanyId ?? ""}
          initialMode={editingCustomer ? "view" : "add"}
          prefillData={smartAddPrefillData} // Pass pre-fill data
        />
      </Dialog>

      <SmartAddDialog
        isOpen={isSmartAddDialogOpen}
        onOpenChange={setIsSmartAddDialogOpen}
        onAnalyzeSuccess={handleSmartAddSuccess}
        entityType="customer"
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer "{customerToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isActionPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isActionPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CustomersPage;