"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, ChevronRight, ChevronLeft, UserPlus } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import FormattedCurrencyInput from "@/components/FormattedCurrencyInput";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Imported missing UI components

// Define the schema for company creation and initial admin invitation
const companySetupSchema = z.object({
  // Step 1: Company Details
  companyName: z.string().min(1, "Company name is required"),
  companyDomain: z.string().optional().nullable(),
  defaultCurrency: z.string().min(1, "Default currency is required"),

  // Step 2: Module Assignment (handled as an array of objects)
  modules: z.array(z.object({
    module_id: z.string(),
    name: z.string(), // For display
    description: z.string().optional().nullable(), // For display
    is_enabled: z.boolean(),
    monthly_price: z.preprocess(
      (val) => (val === "" ? 0 : Number(val)),
      z.number().min(0, "Monthly price must be non-negative").default(0)
    ),
    per_user_price: z.preprocess(
      (val) => (val === "" ? 0 : Number(val)),
      z.number().min(0, "Per-user price must be non-negative").default(0)
    ),
    is_locked_by_system: z.boolean(),
    module_type: z.enum(["core", "super", "add-on"]), // Added module_type
  })),

  // Step 3: New Company Admin Details
  adminFirstName: z.string().min(1, "Admin first name is required"),
  adminLastName: z.string().min(1, "Admin last name is required"),
  adminEmail: z.string().email("Invalid email address for admin"),
  adminPassword: z.string().min(6, "Password must be at least 6 characters long"), // NEW: Admin password
  adminRole: z.string().default("admin"), // Fixed to admin
  // Removed selectedTemplateName as it's no longer an invitation
});

type CompanySetupFormValues = z.infer<typeof companySetupSchema>;

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

interface SystemModule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean; // Added missing property
  default_monthly_price: number;
  default_per_user_price: number;
  module_type: "core" | "super" | "add-on"; // Added module_type
}

const SuperAdminCompanySetupPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser, profile, isLoading: isLoadingSession } = useSession();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("company-details");

  const form = useForm<CompanySetupFormValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      companyName: "",
      companyDomain: "",
      defaultCurrency: "USD",
      modules: [], // Will be populated by useEffect
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPassword: "", // NEW: Default password
      adminRole: "admin",
      // Removed selectedTemplateName
    },
  });

  // Fetch available currencies
  const { data: currencies, isLoading: isLoadingCurrencies } = useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("id, code, name, symbol").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all system modules to get their IDs for default enablement
  const { data: allSystemModules, isLoading: isLoadingAllSystemModules } = useQuery<SystemModule[]>({
    queryKey: ["allSystemModulesForCompanySetup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modules").select("id, name, description, is_active, default_monthly_price, default_per_user_price, module_type"); // Select module_type
      if (error) throw error;
      return data || []; // Ensure it returns an array
    },
    enabled: profile?.role === 'super-admin',
  });

  // Initialize modules in form when system modules are loaded
  useEffect(() => {
    if (allSystemModules && form.getValues("modules").length === 0) {
      const initialModules = allSystemModules.map(sysMod => {
        const isCoreModule = sysMod.module_type === 'core'; // Use module_type for core check
        return {
          module_id: sysMod.id,
          name: sysMod.name,
          description: sysMod.description,
          is_enabled: isCoreModule, // Core modules are enabled by default
          monthly_price: sysMod.default_monthly_price ?? 0,
          per_user_price: sysMod.default_per_user_price ?? 0,
          is_locked_by_system: isCoreModule, // Core modules are locked
          module_type: sysMod.module_type, // Include module_type
        };
      });
      form.setValue("modules", initialModules);
    }
  }, [allSystemModules, form]);

  useEffect(() => {
    if (profile && !form.formState.isDirty) {
      form.reset({
        ...form.getValues(),
        adminEmail: "",
        adminFirstName: "",
        adminLastName: "",
        adminPassword: "", // NEW: Reset password field
      });
    }
  }, [profile, form]);

  const createCompanyAndInviteAdminMutation = useMutation({
    mutationFn: async (values: CompanySetupFormValues) => {
      if (profile?.role !== 'super-admin') {
        throw new Error("Only super-admins can perform this action.");
      }
      if (!currentUser?.id) {
        throw new Error("Current user ID is missing.");
      }

      // 1. Create the company
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: values.companyName,
          domain: values.companyDomain,
          default_currency: values.defaultCurrency,
        })
        .select()
        .single();

      if (companyError) {
        console.error("Supabase company insert error:", companyError);
        throw companyError;
      }
      if (!companyData) throw new Error("Failed to create company.");

      // 2. Enable and lock default modules for the new company based on form selections
      const modulesToInsert = values.modules
        .filter(moduleSetting => moduleSetting.is_enabled) // Only insert enabled modules
        .map(moduleSetting => ({
          company_id: companyData.id,
          module_id: moduleSetting.module_id,
          is_enabled: true, // Always true for inserted modules
          is_locked_by_system: moduleSetting.is_locked_by_system,
          monthly_price: moduleSetting.monthly_price,
          per_user_price: moduleSetting.per_user_price,
        }));

      if (modulesToInsert && modulesToInsert.length > 0) {
        const { error: insertModulesError } = await supabase
          .from("company_modules")
          .insert(modulesToInsert);
        if (insertModulesError) {
          console.error("Error inserting default company modules:", insertModulesError);
          // Don't throw, allow company creation to proceed but log the module error
        }
      }

      // Get current session token to explicitly pass it
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Authentication token missing. Please log in again.");
      }

      // 3. Create the initial admin for this new company directly
      const { data: adminCreationResponse, error: adminCreationError } = await supabase.functions.invoke('create-user-by-admin', {
        body: {
          email: values.adminEmail,
          password: values.adminPassword, // NEW: Pass the manually set password
          first_name: values.adminFirstName,
          last_name: values.adminLastName,
          role: values.adminRole,
          company_id: companyData.id,
          // Removed selectedTemplateName as it's not an invitation
        },
        // Explicitly pass the Authorization header
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (adminCreationError) {
        console.error("Supabase create-user-by-admin Edge Function error:", adminCreationError);
        throw adminCreationError;
      }

      return { company: companyData, adminUserId: adminCreationResponse.userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      // NEW: Invalidate the Super Admin's own profile to ensure it's refetched
      if (profile?.user_id) {
        queryClient.invalidateQueries({ queryKey: ["profiles", profile.user_id] });
      }
      toast({
        title: "Company & Admin Created",
        description: `Company "${data.company.name}" created and admin user "${form.getValues("adminEmail")}" set up.`,
      });
      navigate("/companies", { replace: true });
    },
    onError: (error: any) => {
      console.error("SuperAdminCompanySetupPage: Error during company setup mutation:", error);
      toast({
        title: "Error during company setup",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CompanySetupFormValues) => {
    createCompanyAndInviteAdminMutation.mutate(values);
  };

  const isLoadingPage = isLoadingSession || isLoadingCurrencies || isLoadingAllSystemModules;
  const isSaving = createCompanyAndInviteAdminMutation.isPending;

  // Use module_type for categorization
  const getModulesByCategory = (type: "core" | "super" | "add-on") => {
    return form.watch("modules")
      .filter(moduleSetting => moduleSetting.module_type === type)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const coreModules = getModulesByCategory("core");
  const superModules = getModulesByCategory("super");
  const addOnModules = getModulesByCategory("add-on");

  const renderModuleTable = (modulesToRender: CompanySetupFormValues['modules']) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Module</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead>Monthly Price (USD)</TableHead>
          <TableHead>Per-User Price (USD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {modulesToRender.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              No modules found in this category.
            </TableCell>
          </TableRow>
        ) : (
          modulesToRender.map((moduleSetting) => {
            // Find the actual index in the form's 'modules' array
            const formModuleIndex = form.watch("modules").findIndex(m => m.module_id === moduleSetting.module_id);
            if (formModuleIndex === -1) return null; // Should not happen if data is consistent

            const isLocked = moduleSetting.is_locked_by_system;
            const isInputDisabled = isSaving || !form.watch(`modules.${formModuleIndex}.is_enabled`) || isLocked;

            return (
              <TableRow key={moduleSetting.module_id}>
                <TableCell className="font-medium">{moduleSetting.name}</TableCell>
                <TableCell>{moduleSetting.description || "N/A"}</TableCell>
                <TableCell>
                  <Checkbox
                    checked={form.watch(`modules.${formModuleIndex}.is_enabled`)}
                    onCheckedChange={(checked) => form.setValue(`modules.${formModuleIndex}.is_enabled`, checked as boolean)}
                    disabled={isSaving || isLocked}
                  />
                </TableCell>
                <TableCell>
                  <FormattedCurrencyInput
                    value={form.watch(`modules.${formModuleIndex}.monthly_price`)}
                    onChange={(val) => form.setValue(`modules.${formModuleIndex}.monthly_price`, val)}
                    disabled={isInputDisabled}
                    currencyCode="USD"
                  />
                  {form.formState.errors.modules?.[formModuleIndex]?.monthly_price && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.modules[formModuleIndex]?.monthly_price?.message}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <FormattedCurrencyInput
                    value={form.watch(`modules.${formModuleIndex}.per_user_price`)}
                    onChange={(val) => form.setValue(`modules.${formModuleIndex}.per_user_price`, val)}
                    disabled={isInputDisabled}
                    currencyCode="USD"
                  />
                  {form.formState.errors.modules?.[formModuleIndex]?.per_user_price && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.modules[formModuleIndex]?.per_user_price?.message}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  if (isLoadingPage) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading...</p>
      </div>
    );
  }

  if (profile?.role !== 'super-admin') {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Super Admins can access this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md my-8">
        <div className="flex justify-center mb-6">
          <img src="/infotrac-logo.png" alt="INFOtrac Logo" className="h-16 w-auto object-contain" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white flex items-center justify-center gap-2">
          <Building2 className="h-6 w-6" /> Add New Company to INFOtrac
        </h2>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company-details">Step 1: Company Details</TabsTrigger>
            <TabsTrigger value="module-assignment">Step 2: Module Assignment</TabsTrigger>
            <TabsTrigger value="admin-details">Step 3: Admin Details</TabsTrigger>
          </TabsList>

          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            {/* Step 1: Company Details */}
            <TabsContent value="company-details">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Company Information</CardTitle>
                  <CardDescription>
                    Enter the basic details for the new company.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      {...form.register("companyName")}
                      disabled={isSaving}
                    />
                    {form.formState.errors.companyName && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.companyName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyDomain">Company Domain (Optional)</Label>
                    <Input
                      id="companyDomain"
                      {...form.register("companyDomain")}
                      disabled={isSaving}
                    />
                    {form.formState.errors.companyDomain && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.companyDomain.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultCurrency">Default Currency</Label>
                    <Select
                      onValueChange={(value) => form.setValue("defaultCurrency", value)}
                      value={form.watch("defaultCurrency")}
                      disabled={isSaving}
                    >
                      <SelectTrigger id="defaultCurrency">
                        <SelectValue placeholder="Select default currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies?.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name} ({currency.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.defaultCurrency && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.defaultCurrency.message}
                      </p>
                    )}
                  </div>
                </CardContent>
                <div className="flex justify-end p-6 pt-0">
                  <Button type="button" onClick={() => setActiveTab("module-assignment")} disabled={isSaving}>
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </TabsContent>

            {/* Step 2: Module Assignment */}
            <TabsContent value="module-assignment">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Module Assignment</CardTitle>
                  <CardDescription>
                    Select which modules this new company will have access to. Core modules are enabled and locked by default.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <Tabs defaultValue="core-modules">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="core-modules">Core Modules</TabsTrigger>
                      <TabsTrigger value="super-modules">Super Modules</TabsTrigger>
                      <TabsTrigger value="add-on-modules">Add-On Modules</TabsTrigger>
                    </TabsList>

                    <TabsContent value="core-modules" className="mt-4">
                      {renderModuleTable(coreModules)}
                    </TabsContent>

                    <TabsContent value="super-modules" className="mt-4">
                      {renderModuleTable(superModules)}
                    </TabsContent>

                    <TabsContent value="add-on-modules" className="mt-4">
                      {renderModuleTable(addOnModules)}
                    </TabsContent>
                  </Tabs>
                </CardContent>
                <div className="flex justify-between p-6 pt-0">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("company-details")} disabled={isSaving}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                  </Button>
                  <Button type="button" onClick={() => setActiveTab("admin-details")} disabled={isSaving}>
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </TabsContent>

            {/* Step 3: New Company Admin Details */}
            <TabsContent value="admin-details">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">New Company Admin Details</CardTitle>
                  <CardDescription>
                    Create the first administrator account for this new company.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminFirstName">Admin First Name</Label>
                    <Input
                      id="adminFirstName"
                      {...form.register("adminFirstName")}
                      disabled={isSaving}
                    />
                    {form.formState.errors.adminFirstName && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.adminFirstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminLastName">Admin Last Name</Label>
                    <Input
                      id="adminLastName"
                      {...form.register("adminLastName")}
                      disabled={isSaving}
                    />
                    {form.formState.errors.adminLastName && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.adminLastName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Admin Email</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      {...form.register("adminEmail")}
                      disabled={isSaving}
                    />
                    {form.formState.errors.adminEmail && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.adminEmail.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Admin Password</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      {...form.register("adminPassword")}
                      disabled={isSaving}
                    />
                    {form.formState.errors.adminPassword && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.adminPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminRole">Admin Role</Label>
                    <Input
                      id="adminRole"
                      value="admin"
                      readOnly
                      disabled
                    />
                  </div>
                  {/* Removed template selection as it's no longer an invitation */}
                </CardContent>
                <div className="flex justify-between p-6 pt-0">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("module-assignment")} disabled={isSaving}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Add Company & Admin
                  </Button>
                </div>
              </Card>
            </TabsContent>
          </form>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdminCompanySetupPage;