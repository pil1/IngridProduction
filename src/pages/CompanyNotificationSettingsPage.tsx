"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanySmtpSettingsTab from "@/components/CompanySmtpSettingsTab";
import CompanyEmailTemplatesTab from "@/components/CompanyEmailTemplatesTab";
import CompanyAutomationsTab from "@/components/CompanyAutomationsTab";
import CompanyTestEmailTab from "@/components/CompanyTestEmailTab";
import { useSearchParams, useNavigate } from "react-router-dom"; // Import useNavigate
import { useSession } from "@/components/SessionContextProvider";
import { Loader2, Mail, Building } from "lucide-react"; // Import Building icon
import { useQuery } from "@tanstack/react-query"; // Import useQuery for fetching companies
import { supabase } from "@/integrations/supabase/client"; // Import supabase client
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { Label } from "@/components/ui/label"; // Import Label

interface Company {
  id: string;
  name: string;
}

const CompanyNotificationSettingsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate(); // Initialize useNavigate
  const urlCompanyId = searchParams.get("companyId");
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;
  const isSuperAdmin = userRole === 'super-admin';

  // Fetch all companies if Super Admin and no companyId is in URL
  const { data: allCompanies, isLoading: isLoadingAllCompanies } = useQuery<Company[]>({
    queryKey: ["allCompaniesForNotificationSettings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin && !urlCompanyId, // Only fetch if Super Admin and no companyId in URL
  });

  // Determine the company ID to use for displaying settings
  const targetCompanyId = urlCompanyId || profile?.company_id;

  // Determine if the current user has permission to view/manage settings for this specific company
  const canAccess = userRole && (
    isSuperAdmin || // Super Admins can access if a companyId is selected or present in URL
    (userRole === 'admin' && targetCompanyId === profile?.company_id) // Regular admins can only access their own company's settings
  );

  const handleCompanySelect = (companyId: string) => {
    navigate(`/company-notification-settings?companyId=${companyId}`);
  };

  if (isLoadingSession || isLoadingAllCompanies) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading notification settings...</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to manage these notification settings.</p>
      </div>
    );
  }

  // If Super Admin and no companyId is selected, prompt to select one
  if (isSuperAdmin && !targetCompanyId) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" /> Select a Company
          </CardTitle>
          <CardDescription>
            As a Super Admin, please select a company to manage its notification settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="company-select">Company</Label>
            <Select onValueChange={handleCompanySelect}>
              <SelectTrigger id="company-select">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {allCompanies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If a companyId is determined (either from URL or user's profile), render the tabs
  if (targetCompanyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Notification Settings
            {isSuperAdmin && urlCompanyId && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (Company: {allCompanies?.find(c => c.id === urlCompanyId)?.name || "Loading..."})
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Manage your company's notification configurations, templates, and automated alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="templates">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="automations">Automations</TabsTrigger>
              <TabsTrigger value="smtp">Email Settings</TabsTrigger>
              <TabsTrigger value="test-email">Test Email</TabsTrigger>
            </TabsList>
            <TabsContent value="templates">
              <CompanyEmailTemplatesTab companyId={targetCompanyId} />
            </TabsContent>
            <TabsContent value="automations">
              <CompanyAutomationsTab companyId={targetCompanyId} />
            </TabsContent>
            <TabsContent value="smtp">
              <CompanySmtpSettingsTab companyId={targetCompanyId} />
            </TabsContent>
            <TabsContent value="test-email">
              <CompanyTestEmailTab companyId={targetCompanyId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // Fallback for unexpected states
  return (
    <div className="flex flex-1 items-center justify-center text-destructive">
      <p>Error: Could not determine company for notification settings.</p>
    </div>
  );
};

export default CompanyNotificationSettingsPage;