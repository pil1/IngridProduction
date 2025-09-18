"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings2 } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { ALL_EXPENSE_FIELDS } from "@/types/expenses"; // Import ALL_EXPENSE_FIELDS

// Define the schema for the configuration settings
const expenseManagementConfigSchema = z.object({
  user_fields: z.record(z.string(), z.object({
    visible: z.boolean(),
    required: z.boolean(),
  })),
  controller_fields: z.record(z.string(), z.object({
    visible: z.boolean(),
    required: z.boolean(),
  })),
});

type ExpenseManagementConfigFormValues = z.infer<typeof expenseManagementConfigSchema>;

interface ModuleConfiguration {
  id: string;
  company_id: string;
  module_id: string;
  config_key: string;
  settings: ExpenseManagementConfigFormValues;
  created_at: string;
  updated_at: string;
}

interface ConfigureExpenseManagementPageProps {
  companyId: string;
  moduleId: string; // The ID of the Expense Management module
}

const ConfigureExpenseManagementPage = ({ companyId, moduleId }: ConfigureExpenseManagementPageProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;

  const form = useForm<ExpenseManagementConfigFormValues>({
    resolver: zodResolver(expenseManagementConfigSchema),
    defaultValues: {
      user_fields: {},
      controller_fields: {},
    },
  });

  // Fetch existing configuration
  const { data: currentConfig, isLoading: isLoadingConfig } = useQuery<ModuleConfiguration | null>({
    queryKey: ["expenseModuleConfig", companyId, moduleId],
    queryFn: async () => {
      if (!companyId || !moduleId) return null;
      const { data, error } = await supabase
        .from("module_configurations")
        .select("*") // Select all fields to match ModuleConfiguration interface
        .eq("company_id", companyId)
        .eq("module_id", moduleId)
        .eq("config_key", "expense_management_fields")
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 means "no rows found"
      return data;
    },
    enabled: !!companyId && !!moduleId && !isLoadingSession,
  });

  // Initialize form with fetched data or defaults
  useEffect(() => {
    if (currentConfig) {
      form.reset(currentConfig.settings); // Access settings property
    } else {
      // Set default values if no config exists
      const defaultUserFields: Record<string, { visible: boolean; required: boolean }> = {};
      const defaultControllerFields: Record<string, { visible: boolean; required: boolean }> = {};

      ALL_EXPENSE_FIELDS.forEach(field => {
        // Sensible defaults for user fields
        defaultUserFields[field.key] = {
          visible: true,
          required: ["title", "amount", "expense_date", "currency_code"].includes(field.key),
        };
        // Sensible defaults for controller fields (all visible, none required by default for review)
        defaultControllerFields[field.key] = {
          visible: true,
          required: false,
        };
      });
      form.reset({
        user_fields: defaultUserFields,
        controller_fields: defaultControllerFields,
      });
    }
  }, [currentConfig, form]);

  const upsertConfigMutation = useMutation({
    mutationFn: async (values: ExpenseManagementConfigFormValues) => {
      if (!companyId || !moduleId) throw new Error("Company ID or Module ID not found.");

      // Authorization check: Admins can only manage modules for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage module configurations for your own company.");
      }

      const payload = {
        company_id: companyId,
        module_id: moduleId,
        config_key: "expense_management_fields",
        settings: values,
      };

      const { error } = await supabase
        .from("module_configurations")
        .upsert(payload, { onConflict: "company_id, module_id, config_key" });
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseModuleConfig", companyId, moduleId] });
      toast({ title: "Configuration Saved", description: "Expense Management settings have been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error Saving Configuration", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: ExpenseManagementConfigFormValues) => {
    upsertConfigMutation.mutate(values);
  };

  const isLoadingPage = isLoadingSession || isLoadingConfig;
  const isSaving = upsertConfigMutation.isPending;

  const canManageConfig = userRole && (
    userRole === 'super-admin' ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  if (isLoadingPage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading Expense Management configuration...</p>
      </div>
    );
  }

  if (!canManageConfig) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to manage this module's configuration.</p>
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" /> Configure Expense Management
        </CardTitle>
        <CardDescription>
          Customize which fields are visible and required for users submitting expenses,
          and for controllers reviewing them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
          {/* User Fields Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">User Expense Submission Fields</h3>
            <p className="text-sm text-muted-foreground">
              Configure fields for users when they create or edit an expense.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_EXPENSE_FIELDS.map(field => (
                <div key={field.key} className="flex items-center justify-between p-2 border rounded-md">
                  <Label htmlFor={`user-${field.key}-visible`} className="flex-1 cursor-pointer">
                    {field.label}
                  </Label>
                  <div className="flex items-center gap-4">
                    <Controller
                      name={`user_fields.${field.key}.visible`}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`user-${field.key}-visible`}
                            checked={controllerField.value}
                            onCheckedChange={controllerField.onChange}
                            disabled={isSaving}
                          />
                          <Label htmlFor={`user-${field.key}-visible`}>Visible</Label>
                        </div>
                      )}
                    />
                    <Controller
                      name={`user_fields.${field.key}.required`}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`user-${field.key}-required`}
                            checked={controllerField.value}
                            onCheckedChange={controllerField.onChange}
                            disabled={isSaving || !form.watch(`user_fields.${field.key}.visible`)} // Required implies visible
                          />
                          <Label htmlFor={`user-${field.key}-required`}>Required</Label>
                        </div>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Controller Fields Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Controller Expense Review Fields</h3>
            <p className="text-sm text-muted-foreground">
              Configure fields visible to admins/controllers during expense review.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_EXPENSE_FIELDS.map(field => (
                <div key={field.key} className="flex items-center justify-between p-2 border rounded-md">
                  <Label htmlFor={`controller-${field.key}-visible`} className="flex-1 cursor-pointer">
                    {field.label}
                  </Label>
                  <div className="flex items-center gap-4">
                    <Controller
                      name={`controller_fields.${field.key}.visible`}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`controller-${field.key}-visible`}
                            checked={controllerField.value}
                            onCheckedChange={controllerField.onChange}
                            disabled={isSaving}
                          />
                          <Label htmlFor={`controller-${field.key}-visible`}>Visible</Label>
                        </div>
                      )}
                    />
                    <Controller
                      name={`controller_fields.${field.key}.required`}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`controller-${field.key}-required`}
                            checked={controllerField.value}
                            onCheckedChange={controllerField.onChange}
                            disabled={isSaving || !form.watch(`controller_fields.${field.key}.visible`)} // Required implies visible
                          />
                          <Label htmlFor={`controller-${field.key}-required`}>Required</Label>
                        </div>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={isSaving} className="mt-4">
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Configuration
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ConfigureExpenseManagementPage;