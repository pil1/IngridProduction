"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import CompanyModulesTab from "@/components/CompanyModulesTab"; // Import the CompanyModulesTab

const CompanyModulesOverviewPage = () => {
  const { profile, isLoading: isLoadingSession } = useSession();
  const companyId = profile?.company_id;
  const userRole = profile?.role;

  const isLoadingPage = isLoadingSession;

  const canAccess = userRole && (
    userRole === 'super-admin' ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  if (isLoadingPage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading modules overview...</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to manage modules for this company.</p>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error: Company ID not found. Please ensure your profile is linked to a company.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" /> Company Modules
        </CardTitle>
        <CardDescription>
          Manage and configure the modules enabled for your company.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Render the CompanyModulesTab directly */}
        <CompanyModulesTab companyId={companyId} />
      </CardContent>
    </Card>
  );
};

export default CompanyModulesOverviewPage;