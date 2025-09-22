"use client";

import { Loader2, LayoutDashboard } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

const Dashboard = () => {
  const { isLoading: isLoadingSession } = useSession();

  if (isLoadingSession) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" /> Dashboard
        </h2>
      </div>

      <AnalyticsDashboard />
    </div>
  );
};

export default Dashboard;