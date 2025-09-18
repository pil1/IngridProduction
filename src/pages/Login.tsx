"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { useEffect } from "react"; // Import useEffect

const Login = () => {
  const { session, isLoading } = useSession(); // Get session from useSession
  const navigate = useNavigate(); // Initialize useNavigate

  useEffect(() => {
    // Listen for auth state changes to explicitly navigate after sign-in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === 'SIGNED_IN' && currentSession) {
        // User has successfully signed in, navigate to the root.
        // ProtectedRoute will then handle the specific redirect based on profile/role.
        navigate('/', { replace: true });
      }
    });

    // Cleanup subscription on component unmount
    return () => subscription.unsubscribe();
  }, [navigate]); // Depend on navigate to ensure effect re-runs if it changes (though it's stable)

  // If a session already exists and we're not loading,
  // ProtectedRoute should handle the redirect, so this component doesn't need to render Auth UI.
  // However, the ProtectedRoute will handle the redirect from `/`
  if (session && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md relative">
          <Loader2 className="h-10 w-10 animate-spin text-brand-accent" />
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            Redirecting...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 z-10 rounded-lg">
            <Loader2 className="h-10 w-10 animate-spin text-brand-accent" />
          </div>
        )}
        <div className="flex justify-center mb-6">
          <img src="/infotrac-logo.png" alt="INFOtrac Logo" className="h-16 w-auto object-contain" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          Welcome to INFOtrac
        </h2>
        <Auth
          supabaseClient={supabase}
          providers={[]}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--brand-accent))',
                  brandAccent: 'hsl(var(--brand-accent-foreground))',
                },
              },
            }}
          }
          theme="light"
          // Removed redirectTo here, as we'll handle it with onAuthStateChange
          view="sign_in"
        />
      </div>
    </div>
  );
};

export default Login;