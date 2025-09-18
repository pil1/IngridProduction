"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import *as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import FormattedCurrencyInput from "@/components/FormattedCurrencyInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components
import { cn } from "@/lib/utils"; // Import cn utility

type ModuleType = "core" | "super" | "add-on"; // Define the union type

interface SystemModule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  default_monthly_price: number;
  default_per_user_price: number;
  module_type: ModuleType; // Use ModuleType here
}

interface CompanyModule {
  id: string;
  company_id: string;
  module_id: string;
  is_enabled: boolean;
  monthly_price: number;
  per_user_price: number;
  is_locked_by_system: boolean; // Added new field
}

interface CompanyModulesTabProps {
  companyId: string;
}

// Schema for individual module settings within the form
const moduleSettingSchema = z.object({
  module_id: z.string(),
  is_enabled: z.boolean(),
  monthly_price: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0, "Monthly price must be non-negative")
  ),
  per_user_price: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0, "Per-user price must be non-negative")
  ),
  is_locked_by_system: z.boolean(), // Added to schema
  module_type: z.enum(["core", "super", "add-on"]), // z.enum already infers the correct literal union
});

const formSchema = z.object({
  modules: z.array(moduleSettingSchema),
});

type FormValues = z.infer<typeof formSchema>;

const CompanyModulesTab = ({ companyId }: CompanyModulesTabProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;
  const isSuperAdmin = userRole === 'super-admin'; // Determine if current user is super-admin

  // Fetch all system modules
  const { data: systemModules, isLoading: isLoadingSystemModules } = useQuery<SystemModule[]>({
    queryKey: ["systemModules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modules").select("*, module_type").order("name", { ascending: true }); // Select module_type
      if (error) throw error;
      return data;
    },
  });

  // Fetch company-specific module settings
  const { data: companyModuleSettings, isLoading: isLoadingCompanyModuleSettings } = useQuery<CompanyModule[]>({
    queryKey: ["companyModuleSettings", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_modules")
        .select("*, is_locked_by_system") // Select new field
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch company's default currency
  const { data: companySettings } = useQuery<{ default_currency: string }>({
    queryKey: ["companyDefaultCurrency", companyId],
    queryFn: async () => {
      if (!companyId) return { default_currency: "USD" };
      const { data, error } = await supabase.from("companies").select("default_currency").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
  const companyDefaultCurrency = companySettings?.default_currency || "USD";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      modules: [],
    },
  });

  // Initialize form with data from queries
  useEffect(() => {
    if (systemModules && companyModuleSettings) {
      const initialModules = systemModules.map(sysMod => {
        const companyMod = companyModuleSettings.find(cm => cm.module_id === sysMod.id);
        return {
          module_id: sysMod.id,
          is_enabled: companyMod?.is_enabled || false,
          monthly_price: companyMod?.monthly_price ?? sysMod.default_monthly_price ?? 0,
          per_user_price: companyMod?.per_user_price ?? sysMod.default_per_user_price ?? 0,
          is_locked_by_system: companyMod?.is_locked_by_system ?? (sysMod.module_type === 'core'), // Use module_type for locked status
          module_type: sysMod.module_type, // Include module_type
        };
      });
      form.reset({ modules: initialModules });
    }
  }, [systemModules, companyModuleSettings, form]);

  const updateCompanyModuleMutation = useMutation({
    mutationFn: async (moduleData: { module_id: string; is_enabled: boolean; monthly_price: number; per_user_price: number; is_locked_by_system: boolean }) => {
      if (!companyId) throw new Error("Company ID not found.");

      // Authorization check: Admins can only manage modules for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage modules for your own company.");
      }

      const { error } = await supabase.functions.invoke('assign-company-module', {
        body: {
          companyId: companyId,
          moduleId: moduleData.module_id,
          isEnabled: moduleData.is_enabled,
          monthly_price: moduleData.monthly_price,
          per_user_price: moduleData.per_user_price,
          // Do NOT send is_locked_by_system from client to prevent client-side manipulation
        },
      });
      if (error) throw error;
      return null;
    },
    // No onSuccess/onError here, as we'll handle batch feedback in onSubmit
  });

  const onSubmit = async (values: FormValues) => {
    const promises = values.modules.map(moduleSetting =>
      updateCompanyModuleMutation.mutateAsync(moduleSetting)
    );

    const results = await Promise.allSettled(promises);

    const successfulUpdates = results.filter(result => result.status === 'fulfilled').length;
    const failedUpdates = results.filter(result => result.status === 'rejected').length;

    if (successfulUpdates > 0 && failedUpdates === 0) {
      toast({ title: "Module Settings Saved", description: "All company module settings have been updated." });
    } else if (successfulUpdates > 0 && failedUpdates > 0) {
      toast({ title: "Partial Update", description: `${successfulUpdates} modules updated, ${failedUpdates} failed.`, variant: "destructive" });
    } else {
      toast({ title: "Error Saving Module Settings", description: "No module settings could be updated.", variant: "destructive" });
    }

    queryClient.invalidateQueries({ queryKey: ["companyModuleSettings", companyId] });
    queryClient.invalidateQueries({ queryKey: ["companyModulesWithPrices", companyId] });
    queryClient.invalidateQueries({ queryKey: ["userMenuPreferences"] }); // Invalidate menu preferences for all users
  };

  const isLoadingPage = isLoadingSession || isLoadingSystemModules || isLoadingCompanyModuleSettings;
  const isSaving = updateCompanyModuleMutation.isPending; // This will now reflect if *any* mutation is pending

  const canManageModules = userRole && (
    isSuperAdmin ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  // NEW: Filter modules based on user role and module type
  const modulesToDisplay = useMemo(() => {
    const allModulesInForm = form.watch("modules");
    if (!allModulesInForm || !systemModules) return [];

    // Augment with system module names and descriptions for filtering/display
    const augmentedModules = allModulesInForm.map(moduleSetting => {
      const systemModule = systemModules.find(sm => sm.id === moduleSetting.module_id);
      return {
        ...moduleSetting,
        systemModuleName: systemModule?.name || '',
        description: systemModule?.description || null,
        module_type: systemModule?.module_type || 'add-on', // Ensure module_type is present
      };
    });

    if (isSuperAdmin) {
      return augmentedModules; // Super Admin sees all modules
    } else {
      // Company Admin only sees modules that are enabled for their company
      return augmentedModules.filter(moduleSetting => moduleSetting.is_enabled);
    }
  }, [form.watch("modules"), isSuperAdmin, systemModules]);


  // Refined getModulesByCategory to ensure correct filtering and sorting
  const getModulesByCategory = (type: ModuleType) => { // Use ModuleType here
    return modulesToDisplay // Use modulesToDisplay here
      .filter(moduleSetting => moduleSetting.module_type === type) // Filter by module_type
      .sort((a, b) => a.systemModuleName.localeCompare(b.systemModuleName));
  };

  const coreModules = getModulesByCategory("core");
  const superModules = getModulesByCategory("super");
  const addOnModules = getModulesByCategory("add-on");


  if (isLoadingPage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading company modules...</p>
      </div>
    );
  }

  if (!canManageModules) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to manage modules for this company.</p>
      </div >
    );
  }

  // Define a type for the augmented module settings for rendering
  type AugmentedModuleSetting = FormValues['modules'][0] & { systemModuleName: string; description: string | null; };

  const renderModuleTable = (modulesToRender: AugmentedModuleSetting[], currentTabType: ModuleType) => {
    // Determine if pricing columns should be hidden for this tab and user role
    const hidePricingColumns = userRole === 'admin' && currentTabType === 'core';
    // Determine if the 'Enabled' column should be hidden for non-super-admins
    const hideEnabledColumn = !isSuperAdmin;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            <TableHead>Description</TableHead>
            {!hideEnabledColumn && <TableHead>Enabled</TableHead>} {/* Conditionally render */}
            {!hidePricingColumns && <TableHead>Monthly Price ({companyDefaultCurrency})</TableHead>}
            {!hidePricingColumns && <TableHead>Per-User Price ({companyDefaultCurrency})</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {modulesToRender.length === 0 ? (
            <TableRow>
              <TableCell colSpan={
                (hideEnabledColumn ? 0 : 1) + // Enabled column
                1 + // Module
                1 + // Description
                (hidePricingColumns ? 0 : 2) // Pricing columns
              } className="text-center text-muted-foreground">
                No modules found in this category.
              </TableCell>
            </TableRow>
          ) : (
            modulesToRender.map((moduleSetting) => {
              const systemModule = systemModules?.find(sm => sm.id === moduleSetting.module_id);
              if (!systemModule) return null;

              const isLocked = moduleSetting.is_locked_by_system;
              // Input disabled if saving, or if locked, or if not super-admin (for enablement)
              const isInputDisabled = isSaving || isLocked || !isSuperAdmin; 

              // Find the correct index in the form's 'modules' array
              const formModuleIndex = form.watch("modules").findIndex(m => m.module_id === moduleSetting.module_id);
              if (formModuleIndex === -1) return null; // Should not happen if data is consistent

              return (
                <TableRow key={moduleSetting.module_id}>
                  <TableCell className="font-medium">{systemModule.name}</TableCell>
                  <TableCell>{systemModule.description || "N/A"}</TableCell>
                  {!hideEnabledColumn && ( // Conditionally render
                    <TableCell>
                      <Checkbox
                        checked={moduleSetting.is_enabled}
                        onCheckedChange={(checked) => form.setValue(`modules.${formModuleIndex}.is_enabled`, checked as boolean)}
                        disabled={isInputDisabled} // Disable if not super-admin
                      />
                    </TableCell>
                  )}
                  {!hidePricingColumns && (
                    <TableCell>
                      <FormattedCurrencyInput
                        value={moduleSetting.monthly_price}
                        onChange={(val) => form.setValue(`modules.${formModuleIndex}.monthly_price`, val)}
                        disabled={isInputDisabled || !isSuperAdmin} // Only Super Admin can edit prices
                        currencyCode={companyDefaultCurrency}
                      />
                      {form.formState.errors.modules?.[formModuleIndex]?.monthly_price && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.modules[formModuleIndex]?.monthly_price?.message}
                        </p>
                      )}
                    </TableCell>
                  )}
                  {!hidePricingColumns && (
                    <TableCell>
                      <FormattedCurrencyInput
                        value={moduleSetting.per_user_price}
                        onChange={(val) => form.setValue(`modules.${formModuleIndex}.per_user_price`, val)}
                        disabled={isInputDisabled || !isSuperAdmin} // Only Super Admin can edit prices
                        currencyCode={companyDefaultCurrency}
                      />
                      {form.formState.errors.modules?.[formModuleIndex]?.per_user_price && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.modules[formModuleIndex]?.per_user_price?.message}
                        </p>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    );
  };

  // Determine the number of columns for TabsList
  const tabListCols = isSuperAdmin ? 3 : 2;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Company Modules</CardTitle>
        <CardDescription>
          {isSuperAdmin
            ? "Enable or disable modules for this company and set custom pricing. If custom pricing is not set, the system default price will be used."
            : "These are the modules currently enabled for your company. Contact a Super Admin to enable or disable additional modules."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
          <Tabs defaultValue="core">
            <TabsList className={cn("grid w-full", `grid-cols-${tabListCols}`)}>
              <TabsTrigger value="core">Core Modules</TabsTrigger>
              {isSuperAdmin && <TabsTrigger value="super">Super Modules</TabsTrigger>}
              <TabsTrigger value="addon">Add-On Modules</TabsTrigger>
            </TabsList>

            <TabsContent value="core" className="mt-4">
              {renderModuleTable(coreModules as AugmentedModuleSetting[], "core" as ModuleType)}
            </TabsContent>

            {isSuperAdmin && (
              <TabsContent value="super" className="mt-4">
                {renderModuleTable(superModules as AugmentedModuleSetting[], "super" as ModuleType)}
              </TabsContent>
            )}

            <TabsContent value="addon" className="mt-4">
              {renderModuleTable(addOnModules as AugmentedModuleSetting[], "addon" as ModuleType)}
            </TabsContent>
          </Tabs>
          {isSuperAdmin && ( // Only Super Admin can see the save button
            <Button type="submit" disabled={isSaving} className="mt-4">
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Module Settings
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default CompanyModulesTab;