"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, UserCheck, XCircle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Updated Profile interface to match SessionContextProvider's definition
interface Profile {
  id: string;
  user_id: string;
  company_id: string | null;
  email: string;
  full_name: string | null;
  first_name: string | null; // Added
  last_name: string | null;  // Added
  role: string;
  avatar_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Company {
  id: string;
  name: string;
}

interface ImpersonationDropdownProps {
  isSidebarCollapsed: boolean; // New prop
}

const ImpersonationDropdown = ({ isSidebarCollapsed }: ImpersonationDropdownProps) => {
  const { profile: currentActiveProfile, impersonatedProfile, setImpersonatedProfile, isLoading: isLoadingSession } = useSession();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);

  const isSuperAdmin = currentActiveProfile?.role === 'super-admin';

  // Fetch all companies
  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ["allCompaniesForImpersonation"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Fetch all profiles (users) with all required fields
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery<Profile[]>({
    queryKey: ["allProfilesForImpersonation"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, user_id, company_id, email, full_name, first_name, last_name, role, avatar_url, status, created_at, updated_at").order("email", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Filter profiles based on selected company
  const filteredProfiles = selectedCompanyId
    ? profiles?.filter(p => p.company_id === selectedCompanyId)
    : profiles;

  // Reset user selection if company changes
  useEffect(() => {
    setSelectedUserId(undefined);
  }, [selectedCompanyId]);

  // Set initial dropdown values if already impersonating
  useEffect(() => {
    if (impersonatedProfile) {
      setSelectedCompanyId(impersonatedProfile.company_id ?? undefined);
      setSelectedUserId(impersonatedProfile.user_id);
    } else {
      setSelectedCompanyId(undefined);
      setSelectedUserId(undefined);
    }
  }, [impersonatedProfile]);

  const handleImpersonate = () => {
    if (selectedUserId && profiles) {
      const userToImpersonate = profiles.find(p => p.user_id === selectedUserId);
      if (userToImpersonate) {
        setImpersonatedProfile(userToImpersonate);
      }
    }
  };

  const handleClearImpersonation = () => {
    setImpersonatedProfile(null);
    // No need to reset selectedCompanyId/selectedUserId here, useEffect will handle it based on impersonatedProfile
  };

  if (!isSuperAdmin) {
    return null; // Only show for super-admins
  }

  const isLoadingData = isLoadingSession || isLoadingCompanies || isLoadingProfiles;

  return (
    <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen} className="mt-auto border-t border-gray-300 rounded-none shadow-none">
      <Card className="border-none rounded-none">
        <CardHeader className={cn("p-2 pb-1 flex flex-row items-center", isSidebarCollapsed ? "justify-start" : "justify-between")}>
          <CardTitle className="text-sm flex items-center gap-1">
            <UserCheck className="h-4 w-4 text-brand-accent" />
            {!isSidebarCollapsed && "Impersonate User"} {/* Conditionally render text */}
          </CardTitle>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-7 w-7 p-0">
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", isCollapsibleOpen ? "rotate-0" : "rotate-180")} />
              <span className="sr-only">Toggle Impersonation</span>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-2 pt-1 space-y-2">
            <div className="grid gap-1">
              <Label htmlFor="impersonate-company" className="text-xs text-muted-foreground">Company</Label>
              <Select
                value={selectedCompanyId ?? ""}
                onValueChange={setSelectedCompanyId}
                disabled={isLoadingData}
              >
                <SelectTrigger id="impersonate-company" className="h-8">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="impersonate-user" className="text-xs text-muted-foreground">User</Label>
              <Select
                value={selectedUserId ?? ""}
                onValueChange={setSelectedUserId}
                disabled={isLoadingData || !selectedCompanyId}
              >
                <SelectTrigger id="impersonate-user" className="h-8">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProfiles?.map(profile => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.full_name || profile.email} ({profile.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleImpersonate}
                disabled={isLoadingData || !selectedUserId}
                className="flex-1 h-8"
              >
                {isLoadingData ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                <span className="sr-only">Impersonate</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleClearImpersonation}
                disabled={!impersonatedProfile} // Enabled only if an impersonation is active
                className="flex-1 h-8"
              >
                <XCircle className="h-3 w-3" />
                <span className="sr-only">Clear Impersonation</span>
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default ImpersonationDropdown;