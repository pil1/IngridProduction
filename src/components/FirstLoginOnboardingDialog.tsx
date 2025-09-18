"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/components/SessionContextProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, User, Package, CalendarIcon, Save, ChevronRight, ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AvatarUpload from "@/components/AvatarUpload";
import CompanyLogoUpload from "@/components/CompanyLogoUpload"; // Import CompanyLogoUpload
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox

// --- Schemas ---
const profileSetupSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  avatar_file: z.any().optional().nullable(),
});
type ProfileSetupFormValues = z.infer<typeof profileSetupSchema>;

const companySetupSchema = z.object({
  name: z.string().min(1, "Company name is required"), // Prefilled
  logo_file: z.any().optional().nullable(),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  website: z.string().url("Invalid URL").or(z.literal('')).optional().nullable(),
  industry: z.string().optional().nullable(),
  address_line_1: z.string().optional().nullable(),
  address_line_2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state_province: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  fiscal_year_end_date: z.date().nullable().optional(),
});
type CompanySetupFormValues = z.infer<typeof companySetupSchema>;

// --- Interfaces ---
interface Company {
  id: string;
  name: string;
  logo_url: string | null;
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
  fiscal_year_end_date: string | null;
}

interface CompanyModule {
  id: string;
  module_id: string;
  is_enabled: boolean;
  is_locked_by_system: boolean;
  modules: { // Corrected to be a single object, not an array
    name: string;
    description: string | null;
  } | null;
}

const FirstLoginOnboardingDialog = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile, isLoading: isLoadingSession } = useSession();

  const [activeTab, setActiveTab] = useState("profile-setup");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);

  // --- Profile Setup Form ---
  const profileForm = useForm<ProfileSetupFormValues>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      avatar_file: null,
    },
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        avatar_file: null,
      });
    }
  }, [profile, profileForm]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileSetupFormValues) => {
      if (!user?.id) throw new Error("User not authenticated.");

      let avatarUrl = profile?.avatar_url;

      if (profileAvatarFile) {
        const fileExtension = profileAvatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, profileAvatarFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      } else if (profileAvatarFile === null && profile?.avatar_url) {
        const oldFilePath = profile.avatar_url.split('/public/avatars/')[1]?.split('?')[0];
        if (oldFilePath) {
          await supabase.storage.from('avatars').remove([oldFilePath]);
        }
        avatarUrl = null;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          full_name: (values.first_name || '') + ' ' + (values.last_name || ''),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Profile Saved", description: "Your profile details have been updated." });
      setProfileAvatarFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Error Saving Profile", description: error.message, variant: "destructive" });
    },
  });

  // --- Company Setup Form ---
  const companyForm = useForm<CompanySetupFormValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      name: "",
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

  // Fetch company details for prefill
  const { data: companyDetails, isLoading: isLoadingCompanyDetails } = useQuery<Company | null>({
    queryKey: ["companyDetailsForOnboarding", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase.from("companies").select("*").eq("id", profile.company_id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!profile?.company_id && !isLoadingSession,
  });

  useEffect(() => {
    if (companyDetails) {
      companyForm.reset({
        name: companyDetails.name,
        logo_file: null,
        legal_name: companyDetails.legal_name || "",
        tax_id: companyDetails.tax_id || "",
        phone_number: companyDetails.phone_number || "",
        website: companyDetails.website || "",
        industry: companyDetails.industry || "",
        address_line_1: companyDetails.address_line_1 || "",
        address_line_2: companyDetails.address_line_2 || "",
        city: companyDetails.city || "",
        state_province: companyDetails.state_province || "",
        postal_code: companyDetails.postal_code || "",
        country: companyDetails.country || "",
        fiscal_year_end_date: companyDetails.fiscal_year_end_date ? new Date(companyDetails.fiscal_year_end_date) : undefined,
      });
      setCompanyLogoFile(null);
    }
  }, [companyDetails, companyForm]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (values: CompanySetupFormValues) => {
      if (!profile?.company_id) throw new Error("Company ID not found.");

      let logoUrl = companyDetails?.logo_url;

      if (companyLogoFile) {
        const fileExtension = companyLogoFile.name.split('.').pop();
        const filePath = `${profile.company_id}/logo.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(filePath, companyLogoFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('company-logos')
          .getPublicUrl(filePath);
        logoUrl = publicUrlData.publicUrl;
      } else if (companyLogoFile === null && companyDetails?.logo_url) {
        const oldFilePath = companyDetails.logo_url.split('/public/company-logos/')[1];
        if (oldFilePath) {
          await supabase.storage.from('company-logos').remove([oldFilePath]);
        }
        logoUrl = null;
      }

      const { error: updateError } = await supabase
        .from("companies")
        .update({
          name: values.name,
          logo_url: logoUrl,
          legal_name: values.legal_name || null,
          tax_id: values.tax_id || null,
          phone_number: values.phone_number || null,
          website: values.website || null,
          industry: values.industry || null,
          address_line_1: values.address_line_1 || null,
          address_line_2: values.address_line_2 || null,
          city: values.city || null,
          state_province: values.state_province || null,
          postal_code: values.postal_code || null,
          country: values.country || null,
          fiscal_year_end_date: values.fiscal_year_end_date ? values.fiscal_year_end_date.toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.company_id);

      if (updateError) throw updateError;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyDetailsForOnboarding", profile?.company_id] });
      queryClient.invalidateQueries({ queryKey: ["companySettings", profile?.company_id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Company Saved", description: "Your company details have been updated." });
      setCompanyLogoFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Error Saving Company", description: error.message, variant: "destructive" });
    },
  });

  // --- Module Access Query ---
  const { data: companyModules, isLoading: isLoadingCompanyModules } = useQuery<CompanyModule[]>({
    queryKey: ["companyModulesForOnboarding", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("company_modules")
        .select(`
          id,
          module_id,
          is_enabled,
          is_locked_by_system,
          modules (name, description)
        `)
        .eq("company_id", profile.company_id);
      if (error) throw error;
      // Ensure modules is a single object or null, not an array
      return (data || []).map((item: any) => ({
        ...item,
        modules: Array.isArray(item.modules) && item.modules.length > 0 ? item.modules[0] : item.modules,
      }));
    },
    enabled: !!profile?.company_id && !isLoadingSession,
  });

  // --- Overall Loading State ---
  const isLoadingPage = isLoadingSession || isLoadingCompanyDetails || isLoadingCompanyModules;
  const isSavingProfile = updateProfileMutation.isPending;
  const isSavingCompany = updateCompanyMutation.isPending;

  const handleCompleteSetup = async () => {
    // Trigger all save mutations
    const profileSavePromise = profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))();
    const companySavePromise = companyForm.handleSubmit((data) => updateCompanyMutation.mutate(data))();

    try {
      await Promise.all([profileSavePromise, companySavePromise]);
      
      // Await refetch of the profile to ensure useSession has the latest data
      await queryClient.refetchQueries({ queryKey: ["profiles", user?.id], exact: true });

      toast({ title: "Setup Complete", description: "Your company and profile setup is complete. Redirecting to dashboard." });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      // Errors are already handled by individual mutations' onError callbacks
      console.error("Error during complete setup:", error);
    }
  };

  if (isLoadingPage) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading onboarding...</p>
      </div>
    );
  }

  // Ensure user is an admin and has a company_id for this onboarding flow
  if (!profile || profile.role !== 'admin' || !profile.company_id) {
    navigate("/", { replace: true }); // Redirect if not the correct user for this flow
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <img src="/infotrac-logo.png" alt="INFOtrac Logo" className="h-16 w-auto object-contain" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          Welcome! Complete Your Company Setup
        </h2>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile-setup">Profile Setup</TabsTrigger>
            <TabsTrigger value="company-details">Company Details</TabsTrigger>
            <TabsTrigger value="module-access">Module Access</TabsTrigger>
          </TabsList>

          {/* Tab 1: Profile Setup */}
          <TabsContent value="profile-setup">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Your Profile</CardTitle>
                <CardDescription>Update your personal information and add an avatar.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="grid gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <AvatarUpload
                      currentAvatarUrl={profile?.avatar_url}
                      onFileSelected={setProfileAvatarFile}
                      isLoading={isSavingProfile}
                      disabled={isSavingProfile}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-first_name">First Name</Label>
                    <Input
                      id="profile-first_name"
                      {...profileForm.register("first_name")}
                      disabled={isSavingProfile}
                    />
                    {profileForm.formState.errors.first_name && (
                      <p className="text-sm text-destructive">{profileForm.formState.errors.first_name.message}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-last_name">Last Name</Label>
                    <Input
                      id="profile-last_name"
                      {...profileForm.register("last_name")}
                      disabled={isSavingProfile}
                    />
                    {profileForm.formState.errors.last_name && (
                      <p className="text-sm text-destructive">{profileForm.formState.errors.last_name.message}</p>
                    )}
                  </div>
                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Profile
                  </Button>
                </form>
              </CardContent>
            </Card>
            <div className="flex justify-end p-6 pt-0">
              <Button type="button" onClick={() => setActiveTab("company-details")} disabled={isSavingProfile}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Tab 2: Company Details */}
          <TabsContent value="company-details">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Company Details</CardTitle>
                <CardDescription>Review and complete your company's information.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={companyForm.handleSubmit((data) => updateCompanyMutation.mutate(data))} className="grid gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <CompanyLogoUpload
                      currentLogoUrl={companyDetails?.logo_url}
                      onFileSelected={setCompanyLogoFile}
                      isLoading={isSavingCompany}
                      disabled={isSavingCompany}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input id="company-name" {...companyForm.register("name")} disabled={isSavingCompany} />
                      {companyForm.formState.errors.name && (
                        <p className="text-sm text-destructive">{companyForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="legal_name">Legal Name (Optional)</Label>
                      <Input id="legal_name" {...companyForm.register("legal_name")} disabled={isSavingCompany} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="tax_id">Tax ID / VAT Number (Optional)</Label>
                      <Input id="tax_id" {...companyForm.register("tax_id")} disabled={isSavingCompany} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone_number">Phone Number (Optional)</Label>
                      <Input id="phone_number" {...companyForm.register("phone_number")} disabled={isSavingCompany} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="website">Website (Optional)</Label>
                      <Input id="website" type="url" {...companyForm.register("website")} disabled={isSavingCompany} />
                      {companyForm.formState.errors.website && (
                        <p className="text-sm text-destructive">{companyForm.formState.errors.website.message}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="industry">Industry (Optional)</Label>
                      <Input id="industry" {...companyForm.register("industry")} disabled={isSavingCompany} />
                    </div>
                  </div>

                  <Separator className="my-4" />
                  <h3 className="text-lg font-semibold">Primary Address (Optional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="address_line_1">Address Line 1</Label>
                      <Input id="address_line_1" {...companyForm.register("address_line_1")} disabled={isSavingCompany} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="address_line_2">Address Line 2 (Optional)</Label>
                      <Input id="address_line_2" {...companyForm.register("address_line_2")} disabled={isSavingCompany} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" {...companyForm.register("city")} disabled={isSavingCompany} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="state_province">State/Province</Label>
                      <Input id="state_province" {...companyForm.register("state_province")} disabled={isSavingCompany} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="postal_code">Zip/Postal Code</Label>
                      <Input id="postal_code" {...companyForm.register("postal_code")} disabled={isSavingCompany} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" {...companyForm.register("country")} disabled={isSavingCompany} />
                    </div>
                  </div>

                  <Separator className="my-4" />
                  <h3 className="text-lg font-semibold">Financial Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="fiscal_year_end_date">Fiscal Year End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !companyForm.watch("fiscal_year_end_date") && "text-muted-foreground"
                            )}
                            disabled={isSavingCompany}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {companyForm.watch("fiscal_year_end_date") ? (
                              format(companyForm.watch("fiscal_year_end_date") as Date, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={companyForm.watch("fiscal_year_end_date") || undefined}
                            onSelect={(date) => companyForm.setValue("fiscal_year_end_date", date || null)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {companyForm.formState.errors.fiscal_year_end_date && (
                        <p className="text-sm text-destructive">{companyForm.formState.errors.fiscal_year_end_date.message}</p>
                      )}
                    </div>
                  </div>
                  <Button type="submit" disabled={isSavingCompany}>
                    {isSavingCompany && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Company Details
                  </Button>
                </form>
              </CardContent>
            </Card>
            <div className="flex justify-between p-6 pt-0">
              <Button type="button" variant="outline" onClick={() => setActiveTab("profile-setup")} disabled={isSavingCompany}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button type="button" onClick={() => setActiveTab("module-access")} disabled={isSavingCompany}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Tab 3: Module Access */}
          <TabsContent value="module-access">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Your Company's Modules</CardTitle>
                <CardDescription>
                  These are the modules enabled for your company, as provisioned by the Super Admin.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(companyModules || []).length === 0 ? (
                  <p className="text-muted-foreground">No modules are currently enabled for your company.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(companyModules || []).map((mod) => (
                        <TableRow key={mod.id}>
                          <TableCell className="font-medium">{mod.modules?.name || "Unknown"}</TableCell>
                          <TableCell>{mod.modules?.description || "N/A"}</TableCell>
                          <TableCell>
                            <Checkbox
                              checked={mod.is_enabled}
                              disabled={true} // Always disabled for company admins in this view
                            />
                            {mod.is_locked_by_system && (
                              <span className="ml-2 text-xs text-muted-foreground">(Locked)</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-between p-6 pt-0">
              <Button type="button" variant="outline" onClick={() => setActiveTab("company-details")} disabled={isSavingProfile || isSavingCompany}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button onClick={handleCompleteSetup} disabled={isSavingProfile || isSavingCompany}>
                <Save className="mr-2 h-4 w-4" /> Complete Setup
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FirstLoginOnboardingDialog;