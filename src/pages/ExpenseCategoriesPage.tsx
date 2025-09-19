"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, ListChecks } from "lucide-react"; // Import ListChecks icon
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

const expenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

type ExpenseCategoryFormValues = z.infer<typeof expenseCategorySchema>;

interface ExpenseCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ExpenseCategoriesPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);

  const currentCompanyId = profile?.company_id;
  const userRole = profile?.role;

  const { data: categories, isLoading: isLoadingCategories, isError: isErrorCategories } = useQuery<ExpenseCategory[]>({
    queryKey: ["expense_categories", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("company_id", currentCompanyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompanyId,
  });

  const form = useForm<ExpenseCategoryFormValues>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (isAddEditDialogOpen && editingCategory) {
      form.reset({
        name: editingCategory.name,
        description: editingCategory.description ?? "",
        is_active: editingCategory.is_active,
      });
    } else if (!isAddEditDialogOpen) {
      form.reset({
        name: "",
        description: "",
        is_active: true,
      });
    }
  }, [isAddEditDialogOpen, editingCategory, form]);

  const createCategoryMutation = useMutation({
    mutationFn: async (newCategoryData: ExpenseCategoryFormValues) => {
      if (!currentCompanyId) throw new Error("Company ID not found.");
      const { data, error } = await supabase.from("expense_categories").insert({
        ...newCategoryData,
        company_id: currentCompanyId,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
      toast({ title: "Category Created", description: "New expense category added." });
      setIsAddEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error creating category", description: error.message, variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (updatedCategoryData: ExpenseCategoryFormValues & { id: string }) => {
      if (!currentCompanyId) throw new Error("Company ID not found.");
      const { id, ...rest } = updatedCategoryData;
      const { error } = await supabase.from("expense_categories").update({
        ...rest,
        updated_at: new Date().toISOString(),
      }).eq("id", id).eq("company_id", currentCompanyId);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
      toast({ title: "Category Updated", description: "Expense category updated." });
      setIsAddEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error updating category", description: error.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!currentCompanyId) throw new Error("Company ID not found.");
      const { error } = await supabase.from("expense_categories").delete().eq("id", categoryId).eq("company_id", currentCompanyId);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
      toast({ title: "Category Deleted", description: "Expense category deleted." });
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error deleting category", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: ExpenseCategoryFormValues) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ ...values, id: editingCategory.id });
    } else {
      createCategoryMutation.mutate(values);
    }
  };

  const handleAddClick = () => {
    setEditingCategory(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditClick = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteClick = (category: ExpenseCategory) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete.id);
    }
  };

  const isActionPending = createCategoryMutation.isPending || updateCategoryMutation.isPending || deleteCategoryMutation.isPending;

  if (isLoadingSession || isLoadingCategories) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading expense categories...</p>
      </div>
    );
  }

  if (!userRole || !['admin', 'super-admin'].includes(userRole)) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Admins or Super Admins can manage expense categories.</p>
      </div>
    );
  }

  if (isErrorCategories) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading expense categories. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" /> Expense Categories
            </CardTitle>
            <CardDescription>
              Manage the categories used for classifying expenses in your company.
            </CardDescription>
          </div>
          <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddClick}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Category
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit Expense Category" : "Add New Expense Category"}</DialogTitle>
                <DialogDescription>
                  {editingCategory ? "Update the details of this expense category." : "Define a new category for your company's expenses."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    className="col-span-3"
                    disabled={isActionPending}
                  />
                  {form.formState.errors.name && (
                    <p className="col-span-4 text-right text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    className="col-span-3"
                    disabled={isActionPending}
                  />
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
                  {editingCategory ? "Update Category" : "Create Category"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No expense categories defined.
                  </TableCell>
                </TableRow>
              ) : (
                categories?.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.description ?? "N/A"}</TableCell>
                    <TableCell>{category.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(category)}>
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(category)} disabled={isActionPending}>
                        {isActionPending && categoryToDelete?.id === category.id ? (
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
              This action cannot be undone. This will permanently delete the expense category "{categoryToDelete?.name}".
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

export default ExpenseCategoriesPage;