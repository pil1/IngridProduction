"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Trash2, Truck, Sparkles } from "lucide-react"; // Import Truck icon
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
import AddEditVendorDialog, { VendorFormValues } from "@/components/AddEditVendorDialog";
import SmartAddDialog from "@/components/SmartAddDialog";

export interface Vendor {
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
  spire_id: string | null;
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
  credit_limit: number;
  payment_method: string | null;
  shipping_address_line_1: string | null;
  shipping_address_line_2: string | null;
  shipping_city: string | null;
  shipping_state_province: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  shipping_addresses_data: Record<string, unknown> | null;
}

const VendorsPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
  const [isSmartAddDialogOpen, setIsSmartAddDialogOpen] = useState(false);
  const [smartAddPrefillData, setSmartAddPrefillData] = useState<Partial<VendorFormValues> | null>(null);

  const currentCompanyId = profile?.company_id;
  const userRole = profile?.role;

  const { data: vendors, isLoading: isLoadingVendors, isError: isErrorVendors } = useQuery<Vendor[]>({
    queryKey: ["vendors", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("company_id", currentCompanyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompanyId && !isLoadingSession,
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      if (!currentCompanyId) throw new Error("Company ID not found.");
      const { error } = await supabase.from("vendors").delete().eq("id", vendorId).eq("company_id", currentCompanyId);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast({ title: "Vendor Deleted", description: "Vendor record has been successfully deleted." });
      setIsDeleteDialogOpen(false);
      setVendorToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting vendor", description: error.message ?? "An unexpected error occurred.", variant: "destructive" });
    },
  });

  const handleAddClick = () => {
    setEditingVendor(null);
    setSmartAddPrefillData(null);
    setIsAddEditDialogOpen(true);
  };

  const handleViewEditClick = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setSmartAddPrefillData(null);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteClick = (vendor: Vendor) => {
    setVendorToDelete(vendor);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (vendorToDelete) {
      deleteVendorMutation.mutate(vendorToDelete.id);
    }
  };

  const handleSmartAddSuccess = (data: Partial<Vendor>) => {
    // Explicitly convert nullable fields from Partial<Vendor> to Partial<VendorFormValues>
    const cleanedData: Partial<VendorFormValues> = {
      ...data,
      default_currency_code: data.default_currency_code ?? undefined, // Convert null to undefined
      is_active: data.is_active ?? true, // Default to true if null/undefined
      tax_exempt: data.tax_exempt ?? false, // Default to false if null/undefined
      credit_limit: data.credit_limit ?? 0, // Default to 0 if null/undefined
      shipping_addresses_data: data.shipping_addresses_data === null ? undefined : data.shipping_addresses_data, // Convert null to undefined
    };
    setSmartAddPrefillData(cleanedData);
    setEditingVendor(null);
    setIsAddEditDialogOpen(true);
  };

  const isActionPending = deleteVendorMutation.isPending;

  // Determine if the current user has permission to manage vendors
  const canManageVendors = userRole && ['admin', 'controller', 'super-admin'].includes(userRole);
  const hasVendors = useMemo(() => vendors && vendors.length > 0, [vendors]);

  if (isLoadingSession || isLoadingVendors) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading vendors...</p>
      </div>
    );
  }

  if (!canManageVendors) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Admins, Controllers, or Super Admins can manage vendors.</p>
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

  if (isErrorVendors) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading vendors. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" /> Vendors
            </CardTitle>
            <CardDescription>
              Manage your company's vendor relationships.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsSmartAddDialogOpen(true)} disabled={isLoadingVendors || !canManageVendors}>
              <Sparkles className="mr-2 h-4 w-4" /> Smart Add
            </Button>
            <Button onClick={handleAddClick} disabled={isLoadingVendors || !canManageVendors}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Vendor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingVendors ? (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading vendors...
            </div>
          ) : isErrorVendors ? (
            <div className="text-red-500">Error loading vendors.</div>
          ) : !hasVendors ? (
            <div>No vendors defined for your company.</div>
          ) : (
            <div className="space-y-2">
              {vendors?.map((vendor) => (
                <Card key={vendor.id} className="p-2 hover:bg-muted cursor-pointer">
                  <div className="flex justify-between items-center" onClick={() => handleViewEditClick(vendor)}>
                    <div className="font-semibold">{vendor.name}</div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent opening the dialog when deleting
                        handleDeleteClick(vendor);
                      }}
                      disabled={isActionPending}
                    >
                      {isActionPending && vendorToDelete?.id === vendor.id ? (
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
        <AddEditVendorDialog
          isOpen={isAddEditDialogOpen}
          onOpenChange={setIsAddEditDialogOpen}
          editingVendor={editingVendor}
          companyId={currentCompanyId ?? ""}
          initialMode={editingVendor ? "view" : "add"}
          prefillData={smartAddPrefillData} // Pass pre-fill data
        />
      </Dialog>

      <SmartAddDialog
        isOpen={isSmartAddDialogOpen}
        onOpenChange={setIsSmartAddDialogOpen}
        onAnalyzeSuccess={handleSmartAddSuccess}
        entityType="vendor"
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the vendor "{vendorToDelete?.name}".
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

export default VendorsPage;