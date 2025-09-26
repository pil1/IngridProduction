"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";

// Updated types for our new backend
interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role?: string;
  companyId?: string;
  lastSignIn?: string;
}

interface AuthSession {
  user: AuthUser;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: string;
  };
}

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
  session: AuthSession | null;
  user: AuthUser | null;
  profile: Profile | null;
  impersonatedProfile: Profile | null;
  setImpersonatedProfile: (profile: Profile | null) => void;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
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
      if (!user?.id || !user?.email) {
        return null;
      }

      // For super-admin users, return profile with INFOtrac company
      const isSuperAdmin = user?.email === 'admin@infotrac.com';

      if (isSuperAdmin) {
        return {
          id: user.id,
          user_id: user.id,
          company_id: '00000000-0000-0000-0000-000000000001', // INFOtrac Solutions Inc.
          email: user.email,
          full_name: 'Super Admin',
          first_name: 'Super',
          last_name: 'Admin',
          role: 'super-admin',
          avatar_url: null,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as Profile;
      }

      try {
        // Call our new backend API to get user profile
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch profile:', response.status, response.statusText);
          return null;
        }

        const data = await response.json();
        if (data.success && data.data?.user) {
          const userData = data.data.user;
          return {
            id: userData.id,
            user_id: userData.id,
            company_id: userData.companyId || null,
            email: userData.email,
            full_name: userData.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
            first_name: userData.firstName || null,
            last_name: userData.lastName || null,
            role: userData.role || 'user',
            avatar_url: userData.avatarUrl || null,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as Profile;
        }

        return null;
      } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
    },
    enabled: !!user?.id && !!user?.email,
    retry: 3,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    const handleAuthStateChange = async (event: string, currentSession: AuthSession | null) => {
      console.log("Auth state changed:", event, currentSession);
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // If we have a user, the profile query will automatically run
        // due to the enabled condition above
        console.log("User authenticated:", currentUser.email);
      } else {
        // If no user, ensure profile data is cleared from cache
        queryClient.removeQueries({ queryKey: ["profiles"] });
      }

      setIsAuthLoading(false);
    };

    // Check for existing token on startup
    const checkExistingAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (token) {
        try {
          // Set token in API client for future requests
          apiClient.setAuthToken(token);

          // Validate token by fetching user profile
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.user) {
              const userData = data.data.user;
              const mockSession: AuthSession = {
                user: {
                  id: userData.id,
                  email: userData.email,
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  fullName: userData.fullName,
                  role: userData.role,
                  companyId: userData.companyId,
                  lastSignIn: userData.lastSignIn,
                },
                tokens: {
                  accessToken: token,
                  refreshToken: refreshToken || undefined,
                }
              };
              handleAuthStateChange('INITIAL_SESSION', mockSession);
              return;
            }
          }

          // Token is invalid, clear it
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          apiClient.setAuthToken(null);
        } catch (error) {
          console.error('Error validating token:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          apiClient.setAuthToken(null);
        }
      }

      handleAuthStateChange('INITIAL_SESSION', null);
    };

    // Since we're using local PostgreSQL with JWT, we don't have Supabase auth state changes
    // Instead, we'll check the session on startup
    checkExistingAuth();

    // For cleanup, return empty function
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [queryClient]);

  // Memoize computed values
  const isLoading = useMemo(() => isAuthLoading || isProfileLoading, [isAuthLoading, isProfileLoading]);
  const activeProfile = useMemo(() => impersonatedProfile ?? fetchedProfile ?? null, [impersonatedProfile, fetchedProfile]);

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