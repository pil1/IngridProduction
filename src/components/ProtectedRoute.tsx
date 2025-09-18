import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserState } from "@/hooks/useUserState";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, redirectTo } = useUserState();

  useEffect(() => {
    // Handle redirects based on user state
    switch (state) {
      case "UNAUTHENTICATED":
        if (location.pathname !== "/login") {
          navigate("/login", { replace: true });
        }
        break;
        
      case "NEEDS_PROFILE_COMPLETION":
        if (location.pathname !== "/complete-profile") {
          navigate("/complete-profile", { replace: true });
        }
        break;
        
      case "NEEDS_COMPANY_ASSIGNMENT":
      case "NEEDS_ONBOARDING":
        if (location.pathname !== "/onboarding") {
          navigate("/onboarding", { replace: true });
        }
        break;
        
      case "READY":
        // User is ready - allow access to protected routes
        // If they're on login/onboarding pages, redirect to dashboard
        if (["/login", "/complete-profile", "/onboarding"].includes(location.pathname)) {
          navigate("/", { replace: true });
        }
        break;
    }
  }, [state, location.pathname, navigate, redirectTo]);

  // Show loading spinner while determining user state
  if (state === "LOADING") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show loading for unauthenticated users (while redirecting)
  if (state === "UNAUTHENTICATED") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Only render children when user is in the correct state for the current route
  const currentPath = location.pathname;
  
  if (state === "NEEDS_PROFILE_COMPLETION" && currentPath === "/complete-profile") {
    return <>{children}</>;
  }
  
  if ((state === "NEEDS_COMPANY_ASSIGNMENT" || state === "NEEDS_ONBOARDING") && currentPath === "/onboarding") {
    return <>{children}</>;
  }
  
  if (state === "READY" && !["/login", "/complete-profile", "/onboarding"].includes(currentPath)) {
    return <>{children}</>;
  }

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
};