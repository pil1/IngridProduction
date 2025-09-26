// Enhanced Vendors Page with Module-Based Features
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
  Truck,
  Sparkles,
  Lightbulb,
  Bot,
  Package,
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
  useCanManageVendors
} from "@/hooks/useEnhancedPermissions";
import {
  IngridFeature,
  HasPermission,
  ConditionalFeature
} from "@/components/permissions/PermissionWrapper";
import { ALL_PERMISSIONS } from "@/types/permissions";

// Import existing components
import AddEditVendorDialog, { VendorFormValues } from "@/components/AddEditVendorDialog";
import SmartAddDialog from "@/components/SmartAddDialog";
import SuggestedVendorsTab from "@/components/SuggestedVendorsTab";
import VendorGrid from "@/components/vendors/VendorGrid";
import IngridVendorCreation from "@/components/vendors/IngridVendorCreation";
import AIEnhancedVendorCreation from "@/components/vendors/AIEnhancedVendorCreation";

// ================================================================
// INTERFACES
// ================================================================

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
}

// ================================================================
// SIMPLE VENDOR FORM (Non-AI Fallback)
// ================================================================

const SimpleVendorForm: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingVendor?: Vendor | null;
  onSuccess: () => void;
  companyId: string;
}> = ({ isOpen, onOpenChange, editingVendor, onSuccess, companyId }) => {
  return (
    <AddEditVendorDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      editingVendor={editingVendor}
      companyId={companyId}
      initialMode={editingVendor ? "view" : "create"}
      onSuccess={onSuccess}
    />
  );
};

// ================================================================
// AI-ENHANCED VENDOR FORM
// ================================================================

const AIEnhancedVendorForm: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingVendor?: Vendor | null;
  onSuccess: () => void;
}> = ({ isOpen, onOpenChange, editingVendor, onSuccess }) => {
  const [showSmartAdd, setShowSmartAdd] = useState(false);

  return (
    <>
      {/* Smart Add Dialog with AI */}
      <SmartAddDialog
        isOpen={showSmartAdd}
        onOpenChange={setShowSmartAdd}
        onSuccess={() => {
          setShowSmartAdd(false);
          onSuccess();
        }}
      />

      {/* Regular Add/Edit Dialog */}
      <AddEditVendorDialog
        isOpen={isOpen && !showSmartAdd}
        onOpenChange={onOpenChange}
        editingVendor={editingVendor}
        onSuccess={onSuccess}
        // Enhanced with AI features
        showAIFeatures={true}
      />

      {/* Show Smart Add option for new vendors */}
      {isOpen && !editingVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-500" />
                Add Vendor with AI
              </CardTitle>
              <CardDescription>
                Choose how you'd like to add this vendor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => setShowSmartAdd(true)}
                className="w-full"
                variant="default"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Smart Add with AI
              </Button>
              <Button
                onClick={() => {/* Continue with regular form */}}
                className="w-full"
                variant="outline"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full"
                variant="ghost"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

// ================================================================
// MAIN COMPONENT
// ================================================================

const EnhancedVendorsPage: React.FC = () => {
  const { profile } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);

  // Permission and module access checks
  const canAccessIngrid = useCanAccessIngrid();
  const hasIngridModule = useHasModuleAccess('Ingrid AI');
  const canManageVendors = useCanManageVendors();
  const canCreateVendors = useHasPermission(ALL_PERMISSIONS.VENDORS_CREATE);
  const canEditVendors = useHasPermission(ALL_PERMISSIONS.VENDORS_EDIT);
  const canDeleteVendors = useHasPermission(ALL_PERMISSIONS.VENDORS_DELETE);

  // ================================================================
  // DATA FETCHING
  // ================================================================

  const { data: vendors = [], isLoading, error } = useQuery<Vendor[]>({
    queryKey: ["vendors", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      const response = await apiClient.get('/vendors');
      return response.data?.vendors || [];
    },
    enabled: !!profile?.company_id,
  });

  // ================================================================
  // MUTATIONS
  // ================================================================

  const deleteVendorMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      await apiClient.delete(`/vendors/${vendorId}`);
    },
    onSuccess: () => {
      toast({ title: "Vendor deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setVendorToDelete(null);
    },
    onError: () => {
      toast({
        title: "Failed to delete vendor",
        variant: "destructive"
      });
    },
  });

  // ================================================================
  // HANDLERS
  // ================================================================

  const handleAddVendor = () => {
    setEditingVendor(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteVendor = (vendor: Vendor) => {
    setVendorToDelete(vendor);
  };

  const confirmDelete = () => {
    if (vendorToDelete) {
      deleteVendorMutation.mutate(vendorToDelete.id);
    }
  };

  const handleSuccess = () => {
    setIsAddEditDialogOpen(false);
    setEditingVendor(null);
    queryClient.invalidateQueries({ queryKey: ["vendors"] });
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
            Error loading vendors: {(error as Error).message}
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
              <Truck className="h-5 w-5" />
              Vendors
              {canAccessIngrid && (
                <Badge variant="secondary" className="ml-2">
                  <Bot className="h-3 w-3 mr-1" />
                  AI Enhanced
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {canAccessIngrid
                ? "Manage vendors with AI-powered suggestions and data enrichment"
                : "Manage your vendor information and contacts"
              }
            </CardDescription>
          </div>

          <HasPermission permission={ALL_PERMISSIONS.VENDORS_CREATE}>
            <Button onClick={handleAddVendor} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Vendor
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
                Contact your administrator to enable Ingrid AI for advanced vendor suggestions and data enrichment.
              </AlertDescription>
            </Alert>
          )}

          <ConditionalFeature
            condition={canAccessIngrid}
            whenTrue={
              <Tabs defaultValue="vendors" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="vendors" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Vendors
                  </TabsTrigger>
                  <TabsTrigger value="suggestions" className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Ingrid Suggestions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="vendors" className="mt-6">
                  <VendorGrid
                    vendors={vendors}
                    loading={isLoading}
                    onEdit={handleEditVendor}
                    onView={handleEditVendor}
                    onDelete={handleDeleteVendor}
                    canEdit={canEditVendors}
                    canDelete={canDeleteVendors}
                    canSync={profile?.role === 'super-admin'}
                    showAiBadges={canAccessIngrid}
                  />
                </TabsContent>

                <TabsContent value="suggestions" className="mt-6">
                  <IngridFeature>
                    <SuggestedVendorsTab />
                  </IngridFeature>
                </TabsContent>
              </Tabs>
            }
            whenFalse={
              <VendorGrid
                vendors={vendors}
                loading={isLoading}
                onEdit={handleEditVendor}
                onView={handleEditVendor}
                onDelete={handleDeleteVendor}
                canEdit={canEditVendors}
                canDelete={canDeleteVendors}
                canSync={false}
                showAiBadges={false}
              />
            }
          />
        </CardContent>
      </Card>

      {/* Conditional Vendor Dialog */}
      {isAddEditDialogOpen && (
        editingVendor ? (
          <AddEditVendorDialog
            isOpen={isAddEditDialogOpen}
            onOpenChange={setIsAddEditDialogOpen}
            editingVendor={editingVendor}
            companyId={profile?.company_id || ''}
            initialMode="view"
            onSuccess={handleSuccess}
          />
        ) : canAccessIngrid ? (
          <AIEnhancedVendorCreation
            isOpen={isAddEditDialogOpen}
            onOpenChange={setIsAddEditDialogOpen}
            onSuccess={handleSuccess}
            companyId={profile?.company_id || ''}
          />
        ) : (
          <SimpleVendorForm
            isOpen={isAddEditDialogOpen}
            onOpenChange={setIsAddEditDialogOpen}
            editingVendor={editingVendor}
            companyId={profile?.company_id || ''}
            onSuccess={handleSuccess}
          />
        )
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!vendorToDelete} onOpenChange={() => setVendorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{vendorToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVendorMutation.isPending && (
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

export default EnhancedVendorsPage;