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
import *as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Package, Edit, Save } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormattedCurrencyInput from "@/components/FormattedCurrencyInput";

// Define the schema for a new module
const moduleSchema = z.object({
  name: z.string().min(1, "Module name is required"),
  description: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  default_monthly_price: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0, "Monthly price must be non-negative").default(0)
  ),
  default_per_user_price: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0, "Per-user price must be non-negative").default(0)
  ),
  module_type: z.enum(["core", "super", "add-on"], {
    required_error: "Module type is required",
    invalid_type_error: "Invalid module type",
  }).default("add-on"),
});

type ModuleFormValues = z.infer<typeof moduleSchema>;

interface Module {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  default_monthly_price: number;
  default_per_user_price: number;
  module_type: "core" | "super" | "add-on";
  created_at: string;
  updated_at: string;
}

const SystemModulesPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null); // Changed to store ID

  const isSuperAdmin = profile?.role === 'super-admin';

  const { data: modules, isLoading: isLoadingModules, isError: isErrorModules } = useQuery<Module[]>({
    queryKey: ["modules"],
    queryFn: async () => {
      console.log("SystemModulesPage: Fetching modules from Supabase...");
      const { data, error } = await supabase.from("modules").select("*").order("name", { ascending: true });
      if (error) {
        console.error("SystemModulesPage: Error in modules queryFn:", error);
        throw error;
      }
      console.log("SystemModulesPage: Modules fetched:", data);
      return data;
    },
  });

  // Find the actual editing module object based on editingModuleId
  const editingModule = modules?.find(m => m.id === editingModuleId) || null;

  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      name: "",
      description: "",
      is_active: true,
      default_monthly_price: 0,
      default_per_user_price: 0,
      module_type: "add-on",
    },
  });

  useEffect(() => {
    if (isAddEditDialogOpen) {
      console.log("Dialog opened/reset. Editing module:", editingModule); // ADDED LOG
      form.reset(editingModule ? {
        name: editingModule.name,
        description: editingModule.description || "",
        is_active: editingModule.is_active,
        default_monthly_price: editingModule.default_monthly_price,
        default_per_user_price: editingModule.default_per_user_price,
        module_type: editingModule.module_type,
      } : {
        name: "",
        description: "",
        is_active: true,
        default_monthly_price: 0,
        default_per_user_price: 0,
        module_type: "add-on",
      });
    }
  }, [isAddEditDialogOpen, editingModule, form]); // Depend on editingModule object

  const upsertModuleMutation = useMutation({
    mutationFn: async (moduleData: ModuleFormValues) => {
      if (!isSuperAdmin) throw new Error("Access Denied: Only Super Admins can manage system modules.");

      if (editingModuleId) { // Use editingModuleId for the update query
        const { error } = await supabase.from("modules").update({
          ...moduleData,
          updated_at: new Date().toISOString(),
        }).eq("id", editingModuleId); // Use editingModuleId here
        if (error) throw error;
      } else {
        const { error } = await supabase.from("modules").insert(moduleData);
        if (error) throw error;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["modules"], exact: true }); // Explicitly refetch the query
      queryClient.invalidateQueries({ queryKey: ["allSystemModulesForCompanySetup"] });
      queryClient.invalidateQueries({ queryKey: ["systemModules"] });
      queryClient.invalidateQueries({ queryKey: ["allSystemModulesForMenu"] });
      toast({
        title: "Module Saved",
        description: "System module has been successfully saved.",
      });
      setIsAddEditDialogOpen(false);
      setEditingModuleId(null); // Clear editing ID after save
    },
    onError: (error: any) => {
      toast({
        title: "Error saving module",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ModuleFormValues) => {
    console.log("DEBUG: onSubmit received values:", values); // ADDED LOG
    upsertModuleMutation.mutate(values);
  };

  const handleAddClick = () => {
    setEditingModuleId(null); // Clear editing ID for new module
    setIsAddEditDialogOpen(true);
  };

  const handleEditClick = (moduleId: string) => {
    setEditingModuleId(moduleId); // Set only the ID
    setIsAddEditDialogOpen(true);
  };

  const isActionPending = upsertModuleMutation.isPending;

  if (isLoadingSession || isLoadingModules) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading modules...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Super Admins can access this page.</p>
      </div>
    );
  }

  if (isErrorModules) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading data. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> All System Modules
            </CardTitle>
            <CardDescription>
              Manage all available modules on the INFOtrac platform, including their type and default pricing.
            </CardDescription>
          </div>
          <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddClick}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Module
              </Button>
            </DialogTrigger>
            <DialogContent key={editingModuleId || 'new'} className="sm:max-w-[600px]"> {/* Use editingModuleId for key */}
              <DialogHeader>
                <DialogTitle>{editingModule ? "Edit Module" : "Add New Module"}</DialogTitle>
                <DialogDescription>
                  {editingModule ? "Update the details of this module." : "Define a new module for the INFOtrac platform and its default pricing."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    disabled={isActionPending || !!editingModuleId} // Disable if editing existing module
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    disabled={isActionPending}
                  />
                  {form.formState.errors.description && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.description.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_active"
                    checked={form.watch("is_active")}
                    onCheckedChange={(checked) => form.setValue("is_active", checked as boolean)}
                    disabled={isActionPending}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="module_type">Module Type</Label>
                  <Select
                    onValueChange={(value: "core" | "super" | "add-on") => form.setValue("module_type", value)}
                    value={form.watch("module_type")}
                    disabled={isActionPending}
                  >
                    <SelectTrigger id="module_type">
                      <SelectValue placeholder="Select module type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="core">Core Module</SelectItem>
                      <SelectItem value="super">Super Module</SelectItem>
                      <SelectItem value="add-on">Add-On Module</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.module_type && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.module_type.message}
                    </p>
                  )}
                </div>

                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Default Pricing</CardTitle>
                    <CardDescription>Set the base monthly and per-user prices for this module.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Monthly Price</Label>
                      <FormattedCurrencyInput
                        value={form.watch("default_monthly_price")}
                        onChange={(val) => form.setValue("default_monthly_price", val)}
                        disabled={isActionPending}
                        currencyCode="USD"
                      />
                      {form.formState.errors.default_monthly_price && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.default_monthly_price.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Per-User Price</Label>
                      <FormattedCurrencyInput
                        value={form.watch("default_per_user_price")}
                        onChange={(val) => form.setValue("default_per_user_price", val)}
                        disabled={isActionPending}
                        currencyCode="USD"
                      />
                      {form.formState.errors.default_per_user_price && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.default_per_user_price.message}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Button type="submit" disabled={isActionPending} className="mt-4">
                  {isActionPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {editingModule ? "Update Module" : "Create Module"}
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
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No modules found.
                  </TableCell>
                </TableRow>
              ) : (
                modules?.map((module) => (
                  <TableRow key={module.id}>
                    <TableCell className="font-medium">{module.name}</TableCell>
                    <TableCell>{module.description || "N/A"}</TableCell>
                    <TableCell>{module.module_type.charAt(0).toUpperCase() + module.module_type.slice(1)} Module</TableCell>
                    <TableCell className="text-center">{module.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(module.id)}>
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
};

export default SystemModulesPage;