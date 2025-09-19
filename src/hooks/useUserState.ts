import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  role: string;
  company_id: string | null;
  last_login: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type UserState = 
  | "LOADING"
  | "UNAUTHENTICATED" 
  | "NEEDS_PROFILE_COMPLETION"
  | "NEEDS_COMPANY_ASSIGNMENT"
  | "NEEDS_ONBOARDING"
  | "READY";

export interface UserStateData {
  state: UserState;
  user: User | null;
  profile: Profile | null;
  redirectTo?: string;
}

export const useUserState = (): UserStateData => {
  const { data, isLoading } = useQuery({
    queryKey: ["user-state"],
    queryFn: async () => {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { state: "UNAUTHENTICATED" as const, user: null, profile: null };
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return { 
          state: "NEEDS_PROFILE_COMPLETION" as const, 
          user, 
          profile: null,
          redirectTo: "/complete-profile"
        };
      }

      // Check if profile is complete
      if (!profile.first_name || !profile.last_name) {
        return { 
          state: "NEEDS_PROFILE_COMPLETION" as const, 
          user, 
          profile,
          redirectTo: "/complete-profile"
        };
      }

      // Check if user needs company assignment (non-super-admin without company)
      if (profile.role !== "super-admin" && !profile.company_id) {
        return { 
          state: "NEEDS_COMPANY_ASSIGNMENT" as const, 
          user, 
          profile,
          redirectTo: "/onboarding"
        };
      }

      // Check if user needs onboarding (first login)
      if (!profile.last_login) {
        return { 
          state: "NEEDS_ONBOARDING" as const, 
          user, 
          profile,
          redirectTo: "/onboarding"
        };
      }

      return { 
        state: "READY" as const, 
        user, 
        profile 
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return { state: "LOADING", user: null, profile: null };
  }

  return data || { state: "UNAUTHENTICATED", user: null, profile: null };
};