"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CompanyAutomationsTab from "@/components/CompanyAutomationsTab";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2, Workflow } from "lucide-react"; // Import Workflow icon

const ProcessAutomationPage = () => {
  const { profile, isLoading: isLoadingSession } = useSession();

  const companyId = profile?.company_id;
  const userRole = profile?.role;

  // Determine if the current user has permission to view/manage automations
  const canAccess = userRole && (
    userRole === 'super-admin' ||
    userRole === 'admin' ||
    userRole === 'controller'
  );

  if (isLoadingSession) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading process automation module...</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to access Process Automation.</p>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error: Company ID not found for Process Automation. Please ensure your profile is linked to a company.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" /> Process Automation
        </CardTitle>
        <CardDescription>
          Automate tasks and notifications based on triggers and scheduled events.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* For now, we'll directly embed the CompanyAutomationsTab */}
        <CompanyAutomationsTab companyId={companyId} />
      </CardContent>
    </Card>
  );
};

export default ProcessAutomationPage;