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
import CompleteProfilePage from "./pages/CompleteProfilePage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";

// Lazy loaded components (loaded on demand)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const IngridAIPage = lazy(() => import("./pages/IngridAIPage"));

const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const EnhancedExpensesPage = lazy(() => import("./pages/EnhancedExpensesPage"));
const ExpenseDetailPage = lazy(() => import("./pages/ExpenseDetailPage"));
const ExpenseReviewPage = lazy(() => import("./pages/ExpenseReviewPage"));
const CompaniesPage = lazy(() => import("./pages/Companies"));
const UsersPage = lazy(() => import("./pages/Users"));
const EnhancedUsersPage = lazy(() => import("./pages/EnhancedUsersPage"));
const VendorsPage = lazy(() => import("./pages/VendorsPage"));
const EnhancedVendorsPage = lazy(() => import("./pages/EnhancedVendorsPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
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
const ProcessAutomationPage = lazy(() => import("./pages/ProcessAutomationPage"));
const SystemNotificationSettingsPage = lazy(() => import("./pages/SystemNotificationSettingsPage"));
const CompanyModuleManager = lazy(() => import("./components/CompanyModuleManager"));
const FirstLoginOnboardingDialog = lazy(() => import("./components/FirstLoginOnboardingDialog"));
const AIAnalyticsPage = lazy(() => import("./pages/AIAnalyticsPage"));
const PermissionsManagementPage = lazy(() => import("./pages/PermissionsManagementPage"));

import { supabase } from "@/integrations/supabase/client";
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


  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // 1. Still loading session or profile, wait.
      if (isLoading) {
        return;
      }

      let finalTargetPath: string | null = null;
      let currentShouldShowAwaitingCompany = false;
      let currentShouldShowFirstLoginOnboarding = false;

      // 2. User is NOT authenticated
      if (!session) {
        if (location.pathname !== "/login" && location.pathname !== "/accept-invite") {
          finalTargetPath = "/login";
        }
      }
      // 3. User IS authenticated
      else {
        // If session exists but activeProfile is null, it means the profile data is still being fetched
        // or failed to fetch. In this case, we should redirect to /complete-profile as a fallback
        // for all users, and let CompleteProfilePage handle further role-based redirects.
        if (!activeProfile) {
          // If we are already on /complete-profile or /onboarding, don't redirect again.
          // This prevents infinite loops if profile fetching is genuinely failing.
          if (location.pathname !== "/complete-profile" && location.pathname !== "/onboarding") {
            finalTargetPath = "/complete-profile";
          }
        }
        // 4. Active profile is available, proceed with role/profile completeness checks
        else {
          // Priority A: Profile incomplete (missing first_name/last_name)
          if (!activeProfile.first_name || !activeProfile.last_name) {
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
          // Priority B: Super-admin specific logic for company setup
          else if (activeProfile.role === "super-admin") {
            const { count, error } = await supabase.from("companies").select("id", { count: "exact", head: true });
            if (error) {
              console.error("ProtectedRoute: Error checking companies for super-admin:", error);
              finalTargetPath = "/company-setup"; // Default to setup on error
            } else if ((count ?? 0) === 0) {
              // No companies exist, force to company setup page
              if (location.pathname !== "/company-setup") {
                finalTargetPath = "/company-setup";
              }
            } else {
              // Companies exist.
              // If on the root path or login, redirect to super-admin dashboard.
              if (location.pathname === "/" || location.pathname === "/login") {
                finalTargetPath = "/super-admin-dashboard";
              }
              // If on any other valid super-admin page, allow access (don't set finalTargetPath)
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
            if (activeProfile.role === 'super-admin') {
              finalTargetPath = "/super-admin-dashboard";
            } else {
              finalTargetPath = "/dashboard";
            }
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

  // If session exists but activeProfile is still null (and not loading),
  // it means profile creation might have failed or is delayed.
  // Force redirect to /complete-profile to ensure profile is created/updated.
  // This block is now redundant due to the useEffect logic, but kept as a final safeguard.
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
    element: <CompleteProfilePage />,
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
        path: "/companies",
        element: withSuspense(CompaniesPage, "Loading companies...", "CompaniesPage"),
        handle: { pageTitle: "INFOtrac - Companies" },
      },
      {
        path: "/vendors",
        element: withSuspense(EnhancedVendorsPage, "Loading vendors...", "EnhancedVendorsPage"),
        handle: { pageTitle: "INFOtrac - Vendors" },
      },
      {
        path: "/legacy-vendors",
        element: withSuspense(VendorsPage, "Loading legacy vendors...", "VendorsPage"),
        handle: { pageTitle: "INFOtrac - Legacy Vendors" },
      },
      {
        path: "/customers",
        element: withSuspense(CustomersPage, "Loading customers...", "CustomersPage"),
        handle: { pageTitle: "INFOtrac - Customers" },
      },
      {
        path: "/expenses",
        element: withSuspense(EnhancedExpensesPage, "Loading expenses...", "EnhancedExpensesPage"),
        handle: { pageTitle: "INFOtrac - Expenses" },
      },
      {
        path: "/legacy-expenses",
        element: withSuspense(ExpensesPage, "Loading legacy expenses...", "ExpensesPage"),
        handle: { pageTitle: "INFOtrac - Legacy Expenses" },
      },
      {
        path: "/enhanced-expenses",
        element: withSuspense(EnhancedExpensesPage, "Loading enhanced expenses...", "EnhancedExpensesPage"),
        handle: { pageTitle: "INFOtrac - Enhanced Expenses" },
      },
      {
        path: "/expenses/:id",
        element: withSuspense(ExpenseDetailPage, "Loading expense details...", "ExpenseDetailPage"),
        handle: { pageTitle: "INFOtrac - Expense Details" },
      },
      {
        path: "/expense-review",
        element: withSuspense(ExpenseReviewPage, "Loading expense review...", "ExpenseReviewPage"),
        handle: { pageTitle: "INFOtrac - Expense Review" },
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
        path: "/process-automation",
        element: withSuspense(ProcessAutomationPage, "Loading process automation...", "ProcessAutomationPage"),
        handle: { pageTitle: "INFOtrac - Process Automation" },
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
        element: withSuspense(PermissionsManagementPage, "Loading user management...", "PermissionsManagementPage"),
        handle: { pageTitle: "INFOtrac - User Management" },
      },
      {
        path: "/legacy-users",
        element: withSuspense(UsersPage, "Loading legacy users...", "UsersPage"),
        handle: { pageTitle: "INFOtrac - Legacy Users" },
      },
      {
        path: "/enhanced-users",
        element: withSuspense(EnhancedUsersPage, "Loading enhanced users...", "EnhancedUsersPage"),
        handle: { pageTitle: "INFOtrac - Enhanced Users" },
      },
      {
        path: "/permissions",
        element: withSuspense(PermissionsManagementPage, "Loading permissions management...", "PermissionsManagementPage"),
        handle: { pageTitle: "INFOtrac - Permissions Management" },
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