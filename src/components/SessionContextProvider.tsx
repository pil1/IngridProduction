"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Profile {
  id: string;
  user_id: string;
  company_id: string | null;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  avatar_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  impersonatedProfile: Profile | null;
  setImpersonatedProfile: (profile: Profile | null) => void;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize setImpersonatedProfile to prevent unnecessary re-renders
  const handleSetImpersonatedProfile = useCallback((profile: Profile | null) => {
    setImpersonatedProfile(profile);
  }, []);

  const { data: fetchedProfile, isLoading: isProfileLoading } = useQuery<Profile | null>({
    queryKey: ["profiles", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return null;
      }
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error("Error fetching profile with react-query:", error);
        throw error; // Let react-query handle the error state
      }
      return data;
    },
    enabled: !!user?.id, // Only run query if user ID is available
    staleTime: 1000 * 60 * 5, // Profile data is relatively stable, re-fetch every 5 minutes
    refetchOnWindowFocus: true, // Re-fetch when window regains focus
  });

  useEffect(() => {
    const handleAuthStateChange = async (event: string, currentSession: Session | null) => { // Added event parameter
      setIsAuthLoading(true);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      
      // Clear any existing refresh timeout to prevent multiple refreshes
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      if (currentSession?.user?.id) {
        // Only invalidate/refetch profile for events that indicate a new user state
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
          queryClient.invalidateQueries({ queryKey: ["profiles", currentSession.user.id] });
          // No need to await refetchQueries here, useQuery handles it.
        }

        // Only attempt to refresh session for specific events to avoid loops
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // Debounce the refresh call to prevent rate limiting
          refreshTimeoutRef.current = setTimeout(async () => {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error("Error refreshing session:", refreshError);
            } else if (refreshData.session) {
              // Session refreshed, new JWT should be available.
              setSession(refreshData.session);
            }
            refreshTimeoutRef.current = null; // Clear timeout ref after execution
          }, 500); // 500ms debounce
        }
      } else {
        // If no user, ensure profile data is cleared from cache
        queryClient.removeQueries({ queryKey: ["profiles"] });
      }

      setIsAuthLoading(false);
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => { // Passed event
      handleAuthStateChange(event, currentSession); // Passed event
    });

    // Fetch initial session and process it
    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        handleAuthStateChange('INITIAL_SESSION', initialSession); // Custom event for initial load
      })
      .catch(error => {
        console.error("Error fetching initial session:", error);
        setSession(null);
        setUser(null);
        setIsAuthLoading(false);
      });

    return () => {
      if (refreshTimeoutRef.current) { // Clean up timeout on unmount
        clearTimeout(refreshTimeoutRef.current);
      }
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Memoize computed values
  const isLoading = useMemo(() => isAuthLoading || isProfileLoading, [isAuthLoading, isProfileLoading]);
  const activeProfile = useMemo(() => impersonatedProfile || fetchedProfile || null, [impersonatedProfile, fetchedProfile]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    session,
    user,
    profile: activeProfile,
    impersonatedProfile,
    setImpersonatedProfile: handleSetImpersonatedProfile,
    isLoading
  }), [session, user, activeProfile, impersonatedProfile, handleSetImpersonatedProfile, isLoading]);

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionContextProvider");
  }
  return context;
};