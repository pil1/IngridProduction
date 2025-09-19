"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Save, CalendarIcon } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import CompanyLogoUpload from "@/components/CompanyLogoUpload";
import CompanyLocationsTable from "@/components/CompanyLocationsTable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanyModulesTab from "@/components/CompanyModulesTab";
import CompanyNotificationSettingsPage from "./CompanyNotificationSettingsPage"; // Import the notification settings page

const companySettingsSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  domain: z.string().optional().nullable(),
  // subscription_tier removed
  default_currency: z.string().min(1, "Default currency is required"),
  logo_file: z.any().optional().nullable(), // For file upload
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  website: z.string().url("Invalid URL").or(z.literal('')).optional().nullable(), // FIX: Allow empty string
  industry: z.string().optional().nullable(),
  address_line_1: z.string().optional().nullable(),
  address_line_2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state_province: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  fiscal_year_end_date: z.date().nullable().optional(), // Changed to date
});

type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;

interface Company {
  id: string;
  name: string;
  domain: string | null;
  // subscription_tier removed
  default_currency: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  legal_name: string | null;
  tax_id: string | null;
  phone_number: string | null;
  website: string | null;
  industry: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  fiscal_year_end_date: string | null; // Changed to string for date
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

const CompanySettingsPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [searchParams] = useSearchParams();
  const urlCompanyId = searchParams.get("companyId");
  const targetCompanyId = urlCompanyId || profile?.company_id;

  const userRole = profile?.role;
  const isSuperAdmin = userRole === 'super-admin';

  const { data: company, isLoading: isLoadingCompany, isError: isErrorCompany } = useQuery<Company | null>({
    queryKey: ["companySettings", targetCompanyId],
    queryFn: async () => {
      if (!targetCompanyId) return null;
      const { data, error } = await supabase.from("companies").select("*").eq("id", targetCompanyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetCompanyId && !isLoadingSession,
  });

  const { data: currencies, isLoading: isLoadingCurrencies } = useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("id, code, name, symbol").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      name: "",
      domain: "",
      // subscription_tier removed
      default_currency: "USD",
      logo_file: null,
      legal_name: "",
      tax_id: "",
      phone_number: "",
      website: "",
      industry: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state_province: "",
      postal_code: "",
      country: "",
      fiscal_year_end_date: undefined,
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        domain: company.domain,
        // subscription_tier removed
        default_currency: company.default_currency,
        logo_file: null,
        legal_name: company.legal_name ?? "",
        tax_id: company.tax_id ?? "",
        phone_number: company.phone_number ?? "",
        website: company.website ?? "",
        industry: company.industry ?? "",
        address_line_1: company.address_line_1 ?? "",
        address_line_2: company.address_line_2 ?? "",
        city: company.city ?? "",
        state_province: company.state_province ?? "",
        postal_code: company.postal_code ?? "",
        country: company.country ?? "",
        fiscal_year_end_date: company.fiscal_year_end_date ? new Date(company.fiscal_year_end_date) : undefined,
      });
      setLogoFile(null);
    }
  }, [company, form]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (values: CompanySettingsFormValues) => {
      if (!targetCompanyId) throw new Error("Company ID not found.");

      // Authorization check: Admins can only edit their own company
      if (userRole === 'admin' && targetCompanyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage your own company's settings.");
      }

      let logoUrl = company?.logo_url;

      // 1. Handle logo file upload if a new one is selected
      if (logoFile) {
        const fileExtension = logoFile.name.split('.').pop();
        const filePath = `${targetCompanyId}/logo.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(filePath, logoFile, {
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('company-logos')
          .getPublicUrl(filePath);

        logoUrl = publicUrlData.publicUrl;
      } else if (logoFile === null && company?.logo_url) {
        // If logoFile is explicitly set to null (cleared by user) and there was a previous logo
        const oldFilePath = company.logo_url.split('/public/company-logos/')[1];
        if (oldFilePath) {
          await supabase.storage.from('company-logos').remove([oldFilePath]);
        }
        logoUrl = null;
      }

      // 2. Update company details in the database
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          name: values.name,
          domain: values.domain,
          // subscription_tier removed
          default_currency: values.default_currency,
          logo_url: logoUrl,
          legal_name: values.legal_name ?? null,
          tax_id: values.tax_id ?? null,
          phone_number: values.phone_number ?? null,
          website: values.website ?? null,
          industry: values.industry ?? null,
          address_line_1: values.address_line_1 ?? null,
          address_line_2: values.address_line_2 ?? null,
          city: values.city ?? null,
          state_province: values.state_province ?? null,
          postal_code: values.postal_code ?? null,
          country: values.country ?? null,
          fiscal_year_end_date: values.fiscal_year_end_date ? values.fiscal_year_end_date.toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetCompanyId);

      if (updateError) throw updateError;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings", targetCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["companyLogo", targetCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({
        title: "Company Settings Saved",
        description: "Your company details have been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Saving Settings",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CompanySettingsFormValues) => {
    updateCompanyMutation.mutate(values);
  };

  const isLoadingPage = isLoadingSession || isLoadingCompany || isLoadingCurrencies;
  const isSaving = updateCompanyMutation.isPending;

  // Determine if the current user has permission to edit this specific company
  const canEdit = userRole && (
    isSuperAdmin ||
    (userRole === 'admin' && targetCompanyId === profile?.company_id)
  );

  if (isLoadingPage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading company settings...</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to manage these company settings.</p>
      </div>
    );
  }

  if (isErrorCompany || !company) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading company details or company not found.</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="grid w-full grid-cols-4"> {/* Increased grid-cols to 4 */}
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="locations">Locations</TabsTrigger>
        <TabsTrigger value="modules" disabled={!isSuperAdmin && targetCompanyId !== profile?.company_id}>Modules</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger> {/* New Tab */}
      </TabsList>
      <TabsContent value="details">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Company Details
            </CardTitle>
            <CardDescription>Manage your company's general information and branding.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
              <div className="flex flex-col items-center gap-4">
                <CompanyLogoUpload
                  currentLogoUrl={company.logo_url}
                  onFileSelected={setLogoFile}
                  isLoading={isSaving}
                  disabled={isSaving}
                />
              </div>

              {/* Two-column layout for Company Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input id="name" {...form.register("name")} disabled={isSaving} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="legal_name">Legal Name (Optional)</Label>
                  <Input id="legal_name" {...form.register("legal_name")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="domain">Company Domain (Optional)</Label>
                  <Input id="domain" {...form.register("domain")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tax_id">Tax ID / VAT Number (Optional)</Label>
                  <Input id="tax_id" {...form.register("tax_id")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone_number">Phone Number (Optional)</Label>
                  <Input id="phone_number" {...form.register("phone_number")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="website">Website (Optional)</Label>
                  <Input id="website" type="url" {...form.register("website")} disabled={isSaving} />
                  {form.formState.errors.website && (
                    <p className="text-sm text-destructive">{form.formState.errors.website.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="industry">Industry (Optional)</Label>
                  <Input id="industry" {...form.register("industry")} disabled={isSaving} />
                </div>
              </div>

              <Separator className="my-4" />
              <h3 className="text-lg font-semibold">Primary Address (Optional)</h3>
              {/* Two-column layout for Primary Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="address_line_1">Address Line 1</Label>
                  <Input id="address_line_1" {...form.register("address_line_1")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address_line_2">Address Line 2 (Optional)</Label>
                  <Input id="address_line_2" {...form.register("address_line_2")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...form.register("city")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="state_province">State/Province</Label>
                  <Input id="state_province" {...form.register("state_province")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postal_code">Zip/Postal Code</Label>
                  <Input id="postal_code" {...form.register("postal_code")} disabled={isSaving} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...form.register("country")} disabled={isSaving} />
                </div>
              </div>

              <Separator className="my-4" />
              <h3 className="text-lg font-semibold">Financial Settings</h3>
              {/* Two-column layout for Financial Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="default_currency">Default Currency</Label>
                  <Select
                    onValueChange={(value) => form.setValue("default_currency", value)}
                    value={form.watch("default_currency")}
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies?.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name} ({currency.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.default_currency && (
                    <p className="text-sm text-destructive">{form.formState.errors.default_currency.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fiscal_year_end_date">Fiscal Year End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.watch("fiscal_year_end_date") && "text-muted-foreground"
                        )}
                        disabled={isSaving}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch("fiscal_year_end_date") ? (
                          format(form.watch("fiscal_year_end_date") as Date, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.watch("fiscal_year_end_date") ?? undefined}
                        onSelect={(date) => form.setValue("fiscal_year_end_date", date ?? null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.fiscal_year_end_date && (
                    <p className="text-sm text-destructive">{form.formState.errors.fiscal_year_end_date.message}</p>
                  )}
                </div>
              </div>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Company Details
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="locations">
        {targetCompanyId ? (
          <CompanyLocationsTable companyId={targetCompanyId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground py-8">
            Select a company to manage its locations.
          </div>
        )}
      </TabsContent>
      <TabsContent value="modules">
        {targetCompanyId ? (
          <CompanyModulesTab companyId={targetCompanyId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground py-8">
            Select a company to manage its modules.
          </div>
        )}
      </TabsContent>
      <TabsContent value="notifications"> {/* New Tab Content */}
        {targetCompanyId ? (
          <CompanyNotificationSettingsPage />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground py-8">
            Select a company to manage its notification settings.
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default CompanySettingsPage;