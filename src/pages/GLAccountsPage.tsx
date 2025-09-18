"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Landmark } from "lucide-react"; // Import Landmark icon
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

const glAccountSchema = z.object({
  account_code: z.string().min(1, "Account code is required"),
  account_name: z.string().min(1, "Account name is required"),
  account_type: z.string().min(1, "Account type is required"),
  is_active: z.boolean().default(true),
});

type GLAccountFormValues = z.infer<typeof glAccountSchema>;

interface GLAccount {
  id: string;
  company_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const GLAccountsPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GLAccount | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<GLAccount | null>(null);

  const currentCompanyId = profile?.company_id;
  const userRole = profile?.role;

  const { data: glAccounts, isLoading: isLoadingGLAccounts, isError: isErrorGLAccounts } = useQuery<GLAccount[]>({
    queryKey: ["gl_accounts", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const { data, error } = await supabase
        .from("gl_accounts")
        .select("*")
        .eq("company_id", currentCompanyId)
        .order("account_code", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompanyId,
  });

  const form = useForm<GLAccountFormValues>({
    resolver: zodResolver(glAccountSchema),
    defaultValues: {
      account_code: "",
      account_name: "",
      account_type: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (isAddEditDialogOpen && editingAccount) {
      form.reset({
        account_code: editingAccount.account_code,
        account_name: editingAccount.account_name,
        account_type: editingAccount.account_type,
        is_active: editingAccount.is_active,
      });
    } else if (!isAddEditDialogOpen) {
      form.reset({
        account_code: "",
        account_name: "",
        account_type: "",
        is_active: true,
      });
    }
  }, [isAddEditDialogOpen, editingAccount, form]);

  const createAccountMutation = useMutation({
    mutationFn: async (newAccountData: GLAccountFormValues) => {
      if (!currentCompanyId) throw new Error("Company ID not found.");
      const { data, error } = await supabase.from("gl_accounts").insert({
        ...newAccountData,
        company_id: currentCompanyId,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gl_accounts"] });
      toast({ title: "GL Account Created", description: "New GL account added." });
      setIsAddEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error creating GL account", description: error.message, variant: "destructive" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async (updatedAccountData: GLAccountFormValues & { id: string }) => {
      if (!currentCompanyId) throw new Error("Company ID not found.");
      const { id, ...rest } = updatedAccountData;
      const { error } = await supabase.from("gl_accounts").update({
        ...rest,
        updated_at: new Date().toISOString(),
      }).eq("id", id).eq("company_id", currentCompanyId);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gl_accounts"] });
      toast({ title: "GL Account Updated", description: "GL account updated." });
      setIsAddEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error updating GL account", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      if (!currentCompanyId) throw new Error("Company ID not found.");
      const { error } = await supabase.from("gl_accounts").delete().eq("id", accountId).eq("company_id", currentCompanyId);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gl_accounts"] });
      toast({ title: "GL Account Deleted", description: "GL account deleted." });
      setIsDeleteDialogOpen(false);
      setAccountToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error deleting GL account", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: GLAccountFormValues) => {
    if (editingAccount) {
      updateAccountMutation.mutate({ ...values, id: editingAccount.id });
    } else {
      createAccountMutation.mutate(values);
    }
  };

  const handleAddClick = () => {
    setEditingAccount(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditClick = (account: GLAccount) => {
    setEditingAccount(account);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteClick = (account: GLAccount) => {
    setAccountToDelete(account);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) {
      deleteAccountMutation.mutate(accountToDelete.id);
    }
  };

  const isActionPending = createAccountMutation.isPending || updateAccountMutation.isPending || deleteAccountMutation.isPending;

  if (isLoadingSession || isLoadingGLAccounts) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading GL accounts...</p>
      </div>
    );
  }

  if (!userRole || !['admin', 'super-admin'].includes(userRole)) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Admins or Super Admins can manage GL accounts.</p>
      </div>
    );
  }

  if (isErrorGLAccounts) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading GL accounts. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" /> General Ledger Accounts
            </CardTitle>
            <CardDescription>
              Manage the General Ledger accounts for your company.
            </CardDescription>
          </div>
          <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddClick}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New GL Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Edit GL Account" : "Add New GL Account"}</DialogTitle>
                <DialogDescription>
                  {editingAccount ? "Update the details of this General Ledger account." : "Define a new General Ledger account for your company."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="account_code" className="text-right">
                    Code
                  </Label>
                  <Input
                    id="account_code"
                    {...form.register("account_code")}
                    className="col-span-3"
                    disabled={isActionPending}
                  />
                  {form.formState.errors.account_code && (
                    <p className="col-span-4 text-right text-sm text-destructive">
                      {form.formState.errors.account_code.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="account_name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="account_name"
                    {...form.register("account_name")}
                    className="col-span-3"
                    disabled={isActionPending}
                  />
                  {form.formState.errors.account_name && (
                    <p className="col-span-4 text-right text-sm text-destructive">
                      {form.formState.errors.account_name.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="account_type" className="text-right">
                    Type
                  </Label>
                  <Select
                    onValueChange={(value) => form.setValue("account_type", value)}
                    value={form.watch("account_type")}
                    disabled={isActionPending}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asset">Asset</SelectItem>
                      <SelectItem value="Liability">Liability</SelectItem>
                      <SelectItem value="Equity">Equity</SelectItem>
                      <SelectItem value="Revenue">Revenue</SelectItem>
                      <SelectItem value="Expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.account_type && (
                    <p className="col-span-4 text-right text-sm text-destructive">
                      {form.formState.errors.account_type.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="is_active" className="text-right">
                    Active
                  </Label>
                  <Checkbox
                    id="is_active"
                    checked={form.watch("is_active")}
                    onCheckedChange={(checked) => form.setValue("is_active", checked as boolean)}
                    className="col-span-3"
                    disabled={isActionPending}
                  />
                </div>
                <Button type="submit" disabled={isActionPending}>
                  {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAccount ? "Update Account" : "Create Account"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {glAccounts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No GL accounts defined.
                  </TableCell>
                </TableRow>
              ) : (
                glAccounts?.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.account_code}</TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell>{account.account_type}</TableCell>
                    <TableCell>{account.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(account)}>
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(account)} disabled={isActionPending}>
                        {isActionPending && accountToDelete?.id === account.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        Delete
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
              This action cannot be undone. This will permanently delete the GL account "{accountToDelete?.account_name}".
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

export default GLAccountsPage;