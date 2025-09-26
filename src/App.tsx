import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteObject, useNavigate, useLocation } from "react-router-dom";
import { useSession } from "./components/SessionContextProvider";
import RootLayout from "./layouts/RootLayout.tsx";
import { Loader2 } from "lucide-react";
import { useEffect, useState, lazy, Suspense } from "react";

// Eager loaded components (critical for initial load)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
// New Authentication Components
import AuthPage from "./pages/AuthPage";
import NewCompleteProfilePage from "./pages/NewCompleteProfilePage";
import AuthGuard, { AdminGuard, SuperAdminGuard } from "./components/AuthGuard";

// Lazy loaded components (loaded on demand)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const IngridAIPage = lazy(() => import("./pages/IngridAIPage"));

const EnhancedExpensesPage = lazy(() => import("./pages/EnhancedExpensesPage"));
const ExpenseDetailPage = lazy(() => import("./pages/ExpenseDetailPage"));
const EnhancedVendorsPage = lazy(() => import("./pages/EnhancedVendorsPage"));
const EnhancedCustomersPage = lazy(() => import("./pages/EnhancedCustomersPage"));
const ExpenseCategoriesPage = lazy(() => import("./pages/ExpenseCategoriesPage"));
const GLAccountsPage = lazy(() => import("./pages/GLAccountsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const SuperAdminCompanySetupPage = lazy(() => import("./pages/SuperAdminCompanySetupPage"));
const CompanyNotificationSettingsPage = lazy(() => import("./pages/CompanyNotificationSettingsPage"));
const CompanySettingsPage = lazy(() => import("./pages/CompanySettingsPage"));
const SystemBillingSettingsPage = lazy(() => import("./pages/SystemBillingSettingsPage"));
const SystemNotificationSettingsPage = lazy(() => import("./pages/SystemNotificationSettingsPage"));
const CompanyModuleManager = lazy(() => import("./components/CompanyModuleManager"));
const FirstLoginOnboardingDialog = lazy(() => import("./components/FirstLoginOnboardingDialog"));
const AIAnalyticsPage = lazy(() => import("./pages/AIAnalyticsPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const CompanyProvisioningPage = lazy(() => import("./pages/CompanyProvisioningPage"));
const SuperAdminApiKeys = lazy(() => import("./pages/SuperAdminApiKeys"));

import AsyncErrorBoundary from "./components/AsyncErrorBoundary";

// Helper function to wrap lazy components with Suspense and Error Boundary
const withSuspense = (Component: React.ComponentType, fallbackText?: string, componentName?: string) => (
  <AsyncErrorBoundary fallbackText={fallbackText} componentName={componentName}>
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">{fallbackText ?? "Loading..."}</p>
      </div>
    }>
      <Component />
    </Suspense>
  </AsyncErrorBoundary>
);

// queryClient moved to exports.ts

// Component for "Awaiting Company Assignment"
const AwaitingCompanyAssignment = () => (
  <div className="flex min-h-screen w-full flex-col items-center justify-center">
    <div className="text-center">
      <h3 className="text-2xl font-bold tracking-tight mb-4">
        Awaiting Company Assignment
      </h3>
      <p className="text-lg text-muted-foreground mb-6">
        Your account is active, but you haven't been assigned to a company yet.
        Please contact your administrator to get started.
      </p>
    </div>
  </div>
);

// A component to protect routes and handle redirects
const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { session, profile, impersonatedProfile, isLoading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine which profile to use for routing logic: impersonated or actual
  const activeProfile = impersonatedProfile ?? profile;

  // State to control showing the "Awaiting Company Assignment" message
  const [showAwaitingCompany, setShowAwaitingCompany] = useState(false);
  // State to control showing the FirstLoginOnboardingDialog
  const [showFirstLoginOnboarding, setShowFirstLoginOnboarding] = useState(false);

  // SUPERADMIN COMPLETE BYPASS - Check after hooks
  const isSuperAdmin = session?.user?.email === 'admin@infotrac.com';

  useEffect(() => {
    if (isSuperAdmin) {
      // If on any profile completion page, go to dashboard
      if (location.pathname === "/complete-profile" ||
          location.pathname === "/auth/complete-profile" ||
          location.pathname === "/onboarding") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isSuperAdmin, location.pathname, navigate]);


  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // 1. Still loading session or profile, wait.
      if (isLoading) {
        return;
      }

      let finalTargetPath: string | null = null;
      let currentShouldShowAwaitingCompany = false;
      let currentShouldShowFirstLoginOnboarding = false;

      // SUPERADMIN BYPASS - Check email directly
      if (session?.user?.email === 'admin@infotrac.com') {
        // Superadmin should NEVER be on profile completion or login pages
        if (location.pathname === "/complete-profile" ||
            location.pathname === "/onboarding" ||
            location.pathname === "/auth/complete-profile" ||
            location.pathname === "/" ||
            location.pathname === "/login") {
          navigate("/dashboard", { replace: true });
          return;
        }
        // Superadmin can stay on any other page
        return;
      }

      // 2. User is NOT authenticated
      if (!session) {
        if (location.pathname !== "/login" && location.pathname !== "/accept-invite") {
          finalTargetPath = "/login";
        }
      }
      // 3. User IS authenticated
      else {
        // Check if user has a profile
        if (!activeProfile) {
          // If we are already on /complete-profile or /onboarding, don't redirect again.
          // This prevents infinite loops if profile fetching is genuinely failing.
          if (location.pathname !== "/complete-profile" && location.pathname !== "/onboarding") {
            finalTargetPath = "/complete-profile";
          }
        }
        // 4. Active profile is available, proceed with role/profile completeness checks
        else {
          // Priority A: Super-admin specific logic - they bypass profile completion
          if (activeProfile.role === "super-admin") {
            // Super admins bypass all profile completion requirements
            // If on the root path, login, or profile completion pages, redirect to dashboard
            if (location.pathname === "/" ||
                location.pathname === "/login" ||
                location.pathname === "/complete-profile" ||
                location.pathname === "/onboarding" ||
                location.pathname === "/auth/complete-profile") {
              finalTargetPath = "/dashboard";
            }
            // Super admins can access any page - no additional restrictions
          }
          // Priority B: Profile incomplete (missing first_name/last_name or full_name)
          else if ((!activeProfile.first_name || !activeProfile.last_name) && !activeProfile.full_name) {
            if (activeProfile.role === 'admin' && activeProfile.company_id) {
              // Admin with incomplete profile and company_id should go to /onboarding
              if (location.pathname !== "/onboarding") {
                finalTargetPath = "/onboarding";
                currentShouldShowFirstLoginOnboarding = true;
              }
            } else {
              // Non-admin with incomplete profile, or admin without company_id, should go to /complete-profile
              if (location.pathname !== "/complete-profile") {
                finalTargetPath = "/complete-profile";
              }
            }
          }
          // Priority C: Regular user without a company assigned
          else if (!activeProfile.company_id && activeProfile.role !== "super-admin") {
            if (location.pathname !== "/") {
              finalTargetPath = "/";
            }
            currentShouldShowAwaitingCompany = true;
          }
          // Priority D: All other authenticated users with complete profiles and a company
          // If they are on login, accept-invite, or root, redirect to their appropriate dashboard
          else if (location.pathname === "/login" || location.pathname === "/accept-invite" || location.pathname === "/") {
            finalTargetPath = "/dashboard";
          }
          // Else, user is on a valid page, no redirect needed.
        }
      }

      setShowAwaitingCompany(currentShouldShowAwaitingCompany);
      setShowFirstLoginOnboarding(currentShouldShowFirstLoginOnboarding);

      if (finalTargetPath && location.pathname !== finalTargetPath) {
        navigate(finalTargetPath, { replace: true });
      }
    };

    checkAuthAndRedirect();
  }, [isLoading, session, activeProfile, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading application...</p>
      </div>
    );
  }

  // If superadmin, always render children (skip profile checks)
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // If session exists but activeProfile is still null (and not loading),
  // it means profile creation might have failed or is delayed.
  // Force redirect to /complete-profile to ensure profile is created/updated.
  if (session && !activeProfile && !isLoading) {
    if (location.pathname !== "/complete-profile" && location.pathname !== "/onboarding") {
      navigate("/complete-profile", { replace: true });
    }
    // Still render a loader while the redirect happens or if we're already on the target page
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading profile data...</p>
      </div>
    );
  }

  if (showAwaitingCompany && location.pathname === "/") {
    return <AwaitingCompanyAssignment />;
  }

  if (showFirstLoginOnboarding && location.pathname === "/onboarding") {
    return <FirstLoginOnboardingDialog />;
  }

  if (allowedRoles && activeProfile && !allowedRoles.includes(activeProfile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive">
        <p>Access Denied: You do not have the necessary permissions to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
};

// Define routes as an array of objects
const routes: RouteObject[] = [
  // New Authentication Routes
  {
    path: "/auth",
    element: <Login />,
  },
  {
    path: "/auth/complete-profile",
    element: <NewCompleteProfilePage />,
  },
  // Legacy Routes (kept for compatibility)
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/accept-invite",
    element: <AcceptInvitationPage />,
  },
  {
    path: "/complete-profile",
    element: <NewCompleteProfilePage />,
  },
  {
    path: "/onboarding", // New route for admin first-login onboarding
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <FirstLoginOnboardingDialog />
      </ProtectedRoute>
    ),
  },
  {
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/",
        element: <Index />, // Index page now only shows general welcome for authenticated users with a company
        handle: { pageTitle: "INFOtrac - Welcome" },
      },
      {
        path: "/dashboard", // New dashboard route
        element: withSuspense(Dashboard, "Loading dashboard...", "Dashboard"),
        handle: { pageTitle: "INFOtrac - Dashboard" },
      },
      {
        path: "/ingrid-ai",
        element: withSuspense(IngridAIPage, "Loading Ingrid AI...", "IngridAIPage"),
        handle: { pageTitle: "INFOtrac - Ingrid AI Assistant" },
      },
      {
        path: "/super-admin-dashboard",
        element: withSuspense(SuperAdminDashboard, "Loading admin dashboard...", "SuperAdminDashboard"),
        handle: { pageTitle: "INFOtrac - Super Admin Dashboard" },
      },
      {
        path: "/company-setup",
        element: withSuspense(SuperAdminCompanySetupPage, "Loading company setup...", "SuperAdminCompanySetupPage"),
        handle: { pageTitle: "INFOtrac - Company Setup" },
      },
      {
        path: "/vendors",
        element: withSuspense(EnhancedVendorsPage, "Loading vendors...", "EnhancedVendorsPage"),
        handle: { pageTitle: "INFOtrac - Vendors" },
      },
      {
        path: "/customers",
        element: withSuspense(EnhancedCustomersPage, "Loading customers...", "EnhancedCustomersPage"),
        handle: { pageTitle: "INFOtrac - Customers" },
      },
      {
        path: "/expenses",
        element: withSuspense(EnhancedExpensesPage, "Loading expenses...", "EnhancedExpensesPage"),
        handle: { pageTitle: "INFOtrac - Expenses" },
      },
      {
        path: "/expenses/:id",
        element: withSuspense(ExpenseDetailPage, "Loading expense details...", "ExpenseDetailPage"),
        handle: { pageTitle: "INFOtrac - Expense Details" },
      },
      {
        path: "/expense-categories",
        element: withSuspense(ExpenseCategoriesPage, "Loading expense categories...", "ExpenseCategoriesPage"),
        handle: { pageTitle: "INFOtrac - Expense Categories" },
      },
      {
        path: "/gl-accounts",
        element: withSuspense(GLAccountsPage, "Loading GL accounts...", "GLAccountsPage"),
        handle: { pageTitle: "INFOtrac - GL Accounts" },
      },
      {
        path: "/notifications",
        element: withSuspense(NotificationsPage, "Loading notifications...", "NotificationsPage"),
        handle: { pageTitle: "INFOtrac - Notifications" },
      },
      {
        path: "/billing",
        element: withSuspense(BillingPage, "Loading billing...", "BillingPage"),
        handle: { pageTitle: "INFOtrac - Billing" },
      },
      {
        path: "/settings",
        element: withSuspense(SettingsPage, "Loading settings...", "SettingsPage"),
        handle: { pageTitle: "INFOtrac - Profile Settings" },
      },
      {
        path: "/company-settings",
        element: withSuspense(CompanySettingsPage, "Loading company settings...", "CompanySettingsPage"),
        handle: { pageTitle: "INFOtrac - Company Settings" },
      },
      {
        path: "/system-notification-settings", // New unified route
        element: withSuspense(SystemNotificationSettingsPage, "Loading notification settings...", "SystemNotificationSettingsPage"),
        handle: { pageTitle: "INFOtrac - System Notification Settings" },
      },
      {
        path: "/company-modules",
        element: (
          <ProtectedRoute allowedRoles={['super-admin']}>
            {withSuspense(CompanyModuleManager, "Loading company modules...", "CompanyModuleManager")}
          </ProtectedRoute>
        ),
        handle: { pageTitle: "INFOtrac - Company Module Management" },
      },
      {
        path: "/api-key-manager",
        element: (
          <ProtectedRoute allowedRoles={['super-admin']}>
            {withSuspense(SuperAdminApiKeys, "Loading API key manager...", "SuperAdminApiKeys")}
          </ProtectedRoute>
        ),
        handle: { pageTitle: "INFOtrac - API Key Manager" },
      },
      {
        path: "/company-notification-settings",
        element: withSuspense(CompanyNotificationSettingsPage, "Loading notification settings...", "CompanyNotificationSettingsPage"),
        handle: { pageTitle: "INFOtrac - Company Notification Settings" },
      },
      {
        path: "/system-billing-settings",
        element: withSuspense(SystemBillingSettingsPage, "Loading billing settings...", "SystemBillingSettingsPage"),
        handle: { pageTitle: "INFOtrac - System Billing" },
      },
      {
        path: "/analytics",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'controller', 'super-admin']}>
            {withSuspense(AIAnalyticsPage, "Loading AI analytics...", "AIAnalyticsPage")}
          </ProtectedRoute>
        ),
        handle: { pageTitle: "INFOtrac - AI Analytics" },
      },
      {
        path: "/users",
        element: withSuspense(UserManagementPage, "Loading user management...", "UserManagementPage"),
        handle: { pageTitle: "INFOtrac - User Management" },
      },
      {
        path: "/users/provision-company",
        element: (
          <ProtectedRoute allowedRoles={['super-admin']}>
            {withSuspense(CompanyProvisioningPage, "Loading company provisioning...", "CompanyProvisioningPage")}
          </ProtectedRoute>
        ),
        handle: { pageTitle: "INFOtrac - Provision New Company" },
      },
      {
        path: "*",
        element: <NotFound />,
        handle: { pageTitle: "INFOtrac - Page Not Found" },
      },
    ],
  },
];

// Export routes for use in exports.ts
export { routes };

// Export only components for react-refresh compatibility
export { Toaster, Sonner, TooltipProvider, ProtectedRoute };