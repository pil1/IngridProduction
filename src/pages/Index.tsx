"use client";

import { Loader2 } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";

const Index = () => {
  const { isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading dashboard...</p>
      </div>
    );
  }

  // Default content for users with a company or super-admins who have set up companies
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="text-2xl font-bold tracking-tight">
          Welcome to INFOtrac!
        </h3>
        <p className="text-sm text-muted-foreground">
          Select a module from the sidebar to get started.
        </p>
      </div>
    </div>
  );
};

export default Index;