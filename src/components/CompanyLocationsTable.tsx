"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, MapPin } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import AddEditLocationDialog, { CompanyLocation } from "./AddEditLocationDialog";
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

interface CompanyLocationsTableProps {
  companyId: string | null;
}

const CompanyLocationsTable = ({ companyId }: CompanyLocationsTableProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CompanyLocation | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<CompanyLocation | null>(null);

  const userRole = profile?.role;

  const { data: locations, isLoading: isLoadingLocations, isError: isErrorLocations } = useQuery<CompanyLocation[]>({
    queryKey: ["companyLocations", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_locations")
        .select("*")
        .eq("company_id", companyId)
        .order("is_main_location", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isLoadingSession, // Enable only if companyId is available and session is not loading
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      if (!companyId) throw new Error("Company ID not found.");

      // Authorization check: Admins can only delete locations from their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only delete locations from your own company.");
      }

      const { error } = await supabase.from("company_locations").delete().eq("id", locationId).eq("company_id", companyId);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyLocations", companyId] });
      toast({ title: "Location Deleted", description: "Company location has been successfully deleted." });
      setIsDeleteDialogOpen(false);
      setLocationToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error deleting location", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    },
  });

  const handleAddClick = () => {
    setEditingLocation(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditClick = (location: CompanyLocation) => {
    setEditingLocation(location);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteClick = (location: CompanyLocation) => {
    setLocationToDelete(location);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (locationToDelete) {
      deleteLocationMutation.mutate(locationToDelete.id);
    }
  };

  const isActionPending = deleteLocationMutation.isPending;
  
  // Determine if the current user has permission to manage locations for this specific company
  const canManageLocations = userRole && (
    userRole === 'super-admin' ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  if (isLoadingSession || isLoadingLocations) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading locations...</p>
      </div>
    );
  }

  if (isErrorLocations) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading locations. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Company Locations</CardTitle>
          {canManageLocations && (
            <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleAddClick}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Location
                </Button>
              </DialogTrigger>
              <AddEditLocationDialog
                isOpen={isAddEditDialogOpen}
                onOpenChange={setIsAddEditDialogOpen}
                editingLocation={editingLocation}
                companyId={companyId} // Pass companyId to dialog
              />
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Main</TableHead>
                {canManageLocations && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageLocations ? 7 : 6} className="text-center text-muted-foreground">
                    No locations defined for your company.
                  </TableCell>
                </TableRow>
              ) : (
                locations?.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {location.is_main_location && <MapPin className="h-4 w-4 text-primary" />}
                      {location.name}
                    </TableCell>
                    <TableCell>{location.address || "N/A"}</TableCell>
                    <TableCell>{location.city || "N/A"}</TableCell>
                    <TableCell>{location.state || "N/A"}</TableCell>
                    <TableCell>{location.country || "N/A"}</TableCell>
                    <TableCell>{location.is_main_location ? "Yes" : "No"}</TableCell>
                    {canManageLocations && (
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditClick(location)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(location)} disabled={isActionPending}>
                          {isActionPending && locationToDelete?.id === location.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the location "{locationToDelete?.name}".
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

export default CompanyLocationsTable;