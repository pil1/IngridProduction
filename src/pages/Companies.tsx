"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Building } from "lucide-react";
import { Link } from "react-router-dom";
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
import { useSession } from "@/components/SessionContextProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import React from "react";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  default_currency: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

const CompaniesPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();
  const companyRole = profile?.role;
  const isSuperAdmin = companyRole === 'super-admin';

  const [search, setSearch] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const {
    data: companies,
    isLoading: isLoadingCompanies,
    isError: isErrorCompanies,
  } = useQuery<Company[]>({
    queryKey: ["companies", search],
    queryFn: async () => {
      let query = supabase.from("companies").select("*").order("name");

      if (search) {
        query = query.or(`name.ilike.%${search}%,domain.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      // Call the new Edge Function to handle company and user deletion
      const { data, error } = await supabase.functions.invoke('delete-company-and-users', {
        body: { company_id: companyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["users"] }); // Invalidate users query to reflect deleted users
      toast({
        title: "Company Deleted",
        description: data.message || "The company and associated users have been successfully deleted.",
      });
      setIsDeleteDialogOpen(false);
      setCompanyToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting company",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (companyToDelete) {
      deleteCompanyMutation.mutate(companyToDelete.id);
    }
  };

  if (!isSuperAdmin || isLoadingSession || isLoadingCompanies) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading companies...</p>
      </div>
    );
  }

  if (isErrorCompanies) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading companies. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={handleSearch}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" /> Companies
            </CardTitle>
            <CardDescription>
              A list of all registered companies on the platform.
            </CardDescription>
          </div>
          {isSuperAdmin && (
            <Link to="/company-setup">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Company
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Default Currency</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No companies found.
                  </TableCell>
                </TableRow>
              ) : (
                companies?.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.domain || "N/A"}</TableCell>
                    <TableCell>{company.default_currency}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link to={`/company-settings?companyId=${company.id}`}>
                        <Button variant="outline" size="icon">
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteClick(company)}
                        disabled={deleteCompanyMutation.isPending}
                      >
                        {deleteCompanyMutation.isPending && companyToDelete?.id === company.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
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
              This action cannot be undone. This will permanently delete the company "{companyToDelete?.name}" AND all associated user accounts and their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCompanyMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteCompanyMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteCompanyMutation.isPending ? (
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

export default CompaniesPage;