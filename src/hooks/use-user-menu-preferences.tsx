"use client";

import { useCallback, useMemo } from "react"; // Removed useEffect, useState
import { apiClient } from "@/integrations/api/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Removed useToast
import { Building, Users, Settings, BarChart, Package, DollarSign, Receipt, ClipboardCheck, ListChecks, Landmark, Mail, User, Building2, CreditCard, Workflow, Truck, UsersRound, LayoutDashboard, Bell, Key, Bot } from "lucide-react"; // All icons are now used
import { PermissionKey, CORE_PERMISSIONS, OPERATIONS_PERMISSIONS, ACCOUNTING_PERMISSIONS, ANALYTICS_PERMISSIONS, AI_PERMISSIONS } from "@/types/permissions";
import usePermissions from "@/hooks/usePermissions";
import { tablePreferencesService } from "@/services/api/tablePreferences";

export interface MenuItem {
  id: string;
  label: string;
  path?: string; // Optional for parent items
  icon: React.ElementType;
  roles?: string[]; // Keep for backward compatibility during transition
  permissions?: PermissionKey[]; // NEW: Permission-based access control
  companyRequired?: boolean;
  isHidden?: boolean;
  isLocked?: boolean;
  children?: MenuItem[];
}

// Define the default order and properties of menu items with new nested structure
export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    isHidden: false,
    roles: ['admin', 'controller', 'super-admin'],
    permissions: [CORE_PERMISSIONS.DASHBOARD_VIEW],
    companyRequired: true
  },
  {
    id: "users",
    label: "User Management",
    icon: Users,
    roles: ['admin', 'super-admin'],
    permissions: [CORE_PERMISSIONS.USERS_VIEW],
    isHidden: false,
    isLocked: true,
    children: [
      {
        id: "manage-users",
        label: "Manage Users",
        path: "/users",
        icon: Users,
        roles: ['admin', 'super-admin'],
        permissions: [CORE_PERMISSIONS.USERS_VIEW],
        isHidden: false
      },
      {
        id: "provision-company",
        label: "Provision New Company",
        path: "/users/provision-company",
        icon: Building,
        roles: ['super-admin'],
        isHidden: false
      },
    ]
  },
  {
    id: "vendors",
    label: "Vendors",
    path: "/vendors",
    icon: Truck,
    roles: ['admin', 'controller', 'super-admin'],
    permissions: [OPERATIONS_PERMISSIONS.VENDORS_VIEW],
    companyRequired: true,
    isHidden: false
  },
  {
    id: "customers",
    label: "Customers",
    path: "/customers",
    icon: UsersRound,
    roles: ['admin', 'controller', 'super-admin'],
    permissions: [OPERATIONS_PERMISSIONS.CUSTOMERS_VIEW],
    companyRequired: true,
    isHidden: false
  },
  {
    id: "expenses",
    label: "Expenses",
    path: "/expenses",
    icon: Receipt,
    permissions: [OPERATIONS_PERMISSIONS.EXPENSES_VIEW],
    companyRequired: true,
    isHidden: false
  },
  {
    id: "ingrid-ai",
    label: "Ingrid AI Assistant",
    path: "/ingrid-ai",
    icon: Bot,
    permissions: [AI_PERMISSIONS.INGRID_VIEW],
    companyRequired: true,
    isHidden: false
  },
  {
    id: "notifications-page",
    label: "Notifications",
    path: "/notifications",
    icon: Bell,
    permissions: [CORE_PERMISSIONS.NOTIFICATIONS_VIEW],
    companyRequired: true,
    isHidden: false
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: Landmark,
    roles: ['admin', 'controller', 'super-admin'],
    permissions: [ACCOUNTING_PERMISSIONS.GL_ACCOUNTS_VIEW, ACCOUNTING_PERMISSIONS.EXPENSE_CATEGORIES_VIEW],
    companyRequired: true,
    isHidden: false,
    children: [
      {
        id: "expense-categories",
        label: "Expense Categories",
        path: "/expense-categories",
        icon: ListChecks,
        roles: ['admin', 'controller', 'super-admin'],
        permissions: [ACCOUNTING_PERMISSIONS.EXPENSE_CATEGORIES_VIEW],
        companyRequired: true,
        isHidden: false
      },
      {
        id: "gl-accounts",
        label: "GL Accounts",
        path: "/gl-accounts",
        icon: Landmark,
        roles: ['admin', 'controller', 'super-admin'],
        permissions: [ACCOUNTING_PERMISSIONS.GL_ACCOUNTS_VIEW],
        companyRequired: true,
        isHidden: false
      },
    ]
  },
  {
    id: "billing",
    label: "Billing",
    path: "/billing",
    icon: DollarSign,
    roles: ['super-admin'],
    isHidden: false
  },
  {
    id: "api-key-manager",
    label: "API Key Manager",
    path: "/api-key-manager",
    icon: Key,
    roles: ['super-admin'],
    isHidden: false
  },
  {
    id: "analytics",
    label: "Analytics",
    path: "/analytics",
    icon: BarChart,
    permissions: [ANALYTICS_PERMISSIONS.ANALYTICS_VIEW],
    isHidden: false
  },
  {
    id: "system-notification-settings",
    label: "System Notifications",
    path: "/system-notification-settings",
    icon: Mail,
    roles: ['super-admin'],
    isHidden: false,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    isHidden: false,
    children: [
      {
        id: "profile-settings",
        label: "Profile",
        path: "/settings",
        icon: User,
        isHidden: false
      },
      {
        id: "company-settings",
        label: "Company",
        path: "/company-settings",
        icon: Building2,
        roles: ['admin', 'super-admin'],
        permissions: [CORE_PERMISSIONS.COMPANY_SETTINGS_VIEW],
        companyRequired: true,
        isHidden: false
      },
      {
        id: "system-billing-settings",
        label: "System Billing",
        path: "/system-billing-settings",
        icon: CreditCard,
        roles: ['super-admin'],
        isHidden: false
      },
    ]
  },
];

export interface UserMenuItemPreference {
  id: string;
  isHidden: boolean;
}

interface UserMenuPreferences {
  id: string;
  user_id: string;
  menu_items_order: UserMenuItemPreference[]; // Explicitly define as array of UserMenuItemPreference
}

interface CompanyModule {
  id: string;
  company_id: string;
  module_id: string;
  is_enabled: boolean;
  is_locked_by_system: boolean; // Added new field
}

// NEW: Interface for user_modules table
interface UserModule {
  id: string;
  user_id: string;
  company_id: string;
  module_id: string;
  is_enabled: boolean;
}

interface SystemModule { // New interface for system modules
  id: string;
  name: string;
  module_type: "core" | "super" | "add-on"; // Added module_type
  roles?: string[] | null; // Added roles
}

export function useUserMenuPreferences() {
  const queryClient = useQueryClient();
  const { user, profile, isLoading: isLoadingSession, impersonatedProfile } = useSession();
  const { hasPermission, hasAnyPermission } = usePermissions();

  // Use the active user's ID for preferences and module access
  const activeUserId = impersonatedProfile?.user_id ?? user?.id;
  const activeProfile = impersonatedProfile ?? profile;

  // FIXED: Re-enable user preferences with better error handling
  const { data: userPreferences, isLoading: isLoadingPreferences } = useQuery<UserMenuPreferences | null>({
    queryKey: ["userMenuPreferences", activeUserId],
    queryFn: async () => {
      if (!activeUserId) return null;

      try {
        console.log("Attempting to fetch user preferences for:", activeUserId);

        // Use our localStorage-based table preferences service
        const { data, error } = await tablePreferencesService.getTablePreferences("menu_preferences");

        if (error) {
          console.warn("Error fetching user preferences:", error.message);
          return null; // Gracefully fallback to defaults
        }

        if (data && data.preferences) {
          // Extract menu_items_order from preferences
          const prefs = data.preferences as any;
          return {
            id: data.id,
            user_id: data.user_id,
            menu_items_order: prefs.menu_items_order || [],
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
        }

        return null; // No preferences found, use defaults
      } catch (fetchError: any) {
        console.warn("Failed to fetch user preferences, using defaults:", fetchError.message);
        return null;
      }
    },
    enabled: !!activeUserId && !isLoadingSession,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false, // Reduce queries
    retry: 1, // Only retry once on failure
  });

  // UPDATED: Use UserModule[] for userModules query
  const { data: userModules = [], isLoading: isLoadingUserModules } = useQuery<UserModule[]>({
    queryKey: ["userModulesForMenu", activeUserId],
    queryFn: async () => {
      if (!activeUserId) return [];
      try {
        // Select all fields required by the UserModule interface
        const response = await apiClient
          .from("user_modules")
          .select("id, user_id, company_id, module_id, is_enabled")
          .eq("user_id", activeUserId);
        return response.data || [];
      } catch (error) {
        console.error("Error fetching user modules:", error);
        return [];
      }
    },
    enabled: !!activeUserId && !isLoadingSession,
  });

  // NEW: Fetch company-level module settings
  const { data: companyModules = [], isLoading: isLoadingCompanyModules } = useQuery<CompanyModule[]>({
    queryKey: ["companyModulesForMenu", activeProfile?.company_id],
    queryFn: async () => {
      if (!activeProfile?.company_id) return [];
      try {
        const response = await apiClient
          .from("company_modules")
          .select("id, company_id, module_id, is_enabled, is_locked_by_system") // Select all fields required by CompanyModule interface
          .eq("company_id", activeProfile.company_id);
        return response.data || [];
      } catch (error) {
        console.error("Error fetching company modules:", error);
        return [];
      }
    },
    enabled: !!activeProfile?.company_id && !isLoadingSession,
  });

  // NEW: Fetch all system modules via our backend API
  const { data: systemModules, isLoading: isLoadingSystemModules } = useQuery<SystemModule[]>({
    queryKey: ["allSystemModulesForMenu"],
    queryFn: async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.warn('No access token available for modules fetch');
          return [];
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch modules:', response.status, response.statusText);
          return [];
        }

        const data = await response.json();
        if (data.success && data.data?.modules && Array.isArray(data.data.modules)) {
          return data.data.modules.map((module: any) => ({
            id: module.id,
            name: module.name,
            module_type: module.module_type || 'add-on',
            roles: module.roles
          }));
        }

        console.warn('Invalid modules response:', data);
        return [];
      } catch (error) {
        console.error('Error fetching system modules:', error);
        return []; // Return empty array instead of undefined
      }
    },
    enabled: !isLoadingSession, // Always fetch if session is not loading
    staleTime: Infinity, // System modules are static
  });

  const savePreferencesMutation = useMutation({
    mutationFn: async (newOrder: UserMenuItemPreference[]) => {
      if (!activeUserId) throw new Error("User not authenticated.");

      // Use our localStorage table preferences service
      const { data, error } = await tablePreferencesService.saveTablePreferences({
        table_name: "menu_preferences",
        preferences: { menu_items_order: newOrder }
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userMenuPreferences", activeUserId] });
    },
  });

  // Helper to map MenuItem.id to actual module UUID
  const getModuleIdForMenuItem = useCallback((menuItemId: string, systemModules: SystemModule[] | undefined): string | undefined => {
    if (!systemModules) return undefined;

    // Create a map from module name to ID for efficient lookup
    const moduleNameToIdMap = new Map<string, string>();
    systemModules.forEach(mod => moduleNameToIdMap.set(mod.name, mod.id));

    // Map menu item IDs to their corresponding system module names
    // Ensure these names match the 'name' column in your 'modules' table
    switch (menuItemId) {
      case "dashboard": return moduleNameToIdMap.get("Dashboard");
      case "vendors": return moduleNameToIdMap.get("Vendors");
      case "customers": return moduleNameToIdMap.get("Customers");
      case "expenses": return moduleNameToIdMap.get("Expense Management"); // Maps to Expense Management module
      case "enhanced-expenses": return moduleNameToIdMap.get("Expense Management"); // Maps to Expense Management module
      case "notifications-page": return moduleNameToIdMap.get("Notifications");
      case "expense-categories": return moduleNameToIdMap.get("Expense Categories");
      case "gl-accounts": return moduleNameToIdMap.get("GL Accounts");
      case "billing": return moduleNameToIdMap.get("Billing");
      case "api-key-manager": return moduleNameToIdMap.get("API Key Manager");
      case "analytics": return moduleNameToIdMap.get("Advanced Analytics");
      case "ingrid-ai": return moduleNameToIdMap.get("Ingrid AI");
      case "system-notification-settings": return moduleNameToIdMap.get("System Notification Settings"); // New unified module
      case "profile-settings": return moduleNameToIdMap.get("Profile Settings");
      case "company-settings": return moduleNameToIdMap.get("Company Settings");
      case "users": return moduleNameToIdMap.get("User Management");
      case "manage-users": return moduleNameToIdMap.get("User Management");
      case "provision-company": return moduleNameToIdMap.get("User Management");
      case "system-billing-settings": return moduleNameToIdMap.get("System Billing Settings");
      case "company-notification-settings": return moduleNameToIdMap.get("Company Notification Settings"); // Assuming this is a module
      // Parent items like "accounting", "process-automation", "system-notification-settings", "settings" don't have a direct module_id
      default: return undefined;
    }
  }, []); // Dependencies for useCallback

  const orderedMenuItems = useMemo(() => {
    // Helper to deep clone menu items, preserving icon references and structure
    const deepCloneMenuItems = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        const newItem: MenuItem = { ...item };
        if (item.children) {
          newItem.children = deepCloneMenuItems(item.children);
        }
        return newItem;
      });
    };

    const mutableDefaultItems = deepCloneMenuItems(DEFAULT_MENU_ITEMS);

    const userPrefMap = new Map<string, UserMenuItemPreference>();
    (userPreferences?.menu_items_order ?? []).forEach((pref: UserMenuItemPreference) => {
      userPrefMap.set(pref.id, pref);
    });

    // Map for quick lookup of system module ID and type by menu item ID
    const menuItemIdToSystemModuleInfoMap = new Map<string, { id: string, type: "core" | "super" | "add-on", roles?: string[] | null }>();
    if (systemModules) {
      systemModules.forEach(mod => {
        const menuItemId = DEFAULT_MENU_ITEMS.find(item => item.label === mod.name)?.id; // Find menu item by module name
        if (menuItemId) {
          menuItemIdToSystemModuleInfoMap.set(menuItemId, { id: mod.id, type: mod.module_type, roles: mod.roles });
        }
        // Also check children
        DEFAULT_MENU_ITEMS.forEach(parentItem => {
          parentItem.children?.forEach(childItem => {
            if (childItem.label === mod.name) {
              menuItemIdToSystemModuleInfoMap.set(childItem.id, { id: mod.id, type: mod.module_type, roles: mod.roles });
            }
          });
        });
      });
    }

    // Map for quick lookup of company module settings by module ID
    const companyModuleSettingsMap = new Map<string, CompanyModule>();
    if (companyModules) {
      companyModules.forEach(cm => companyModuleSettingsMap.set(cm.module_id, cm));
    }

    // Apply isHidden and isLocked status to the mutable items recursively
    const applyStatus = (items: MenuItem[]) => {
      for (const item of items) {
        const pref = userPrefMap.get(item.id);
        if (pref !== undefined) {
          item.isHidden = pref.isHidden;
        }

        const systemModuleInfo = menuItemIdToSystemModuleInfoMap.get(item.id);
        if (systemModuleInfo) {
          const companyModule = companyModuleSettingsMap.get(systemModuleInfo.id);
          // A module is locked if its system module type is 'core' OR if the company_modules entry explicitly marks it as locked
          item.isLocked = (systemModuleInfo.type === 'core') || (companyModule?.is_locked_by_system ?? false);
        }

        if (item.children) {
          applyStatus(item.children);
        }
      }
    };
    applyStatus(mutableDefaultItems);

    // Now, reconstruct the top-level items based on user preferences
    const finalOrderedTopLevelItems: MenuItem[] = [];
    const seenTopLevelIds = new Set<string>();

    for (const pref of userPreferences?.menu_items_order ?? []) {
      const item = mutableDefaultItems.find(dItem => dItem.id === pref.id);
      if (item && !seenTopLevelIds.has(item.id)) {
        finalOrderedTopLevelItems.push(item);
        seenTopLevelIds.add(item.id);
      }
    }

    for (const defaultItem of mutableDefaultItems) {
      if (!seenTopLevelIds.has(defaultItem.id)) {
        finalOrderedTopLevelItems.push(defaultItem);
      }
    }

    return finalOrderedTopLevelItems;
  }, [userPreferences, companyModules, systemModules]); // Added companyModules, systemModules to dependencies

  // This function filters items based on permissions (roles, company required, module enablement)
  // It also respects the item.isHidden property for the *display* menu, unless ignoreIsHidden is true.
  const filterItems = useCallback((
    items: MenuItem[],
    role: string | undefined,
    companyId: string | null | undefined,
    userModuleSettings: UserModule[], // Corrected to UserModule[]
    companyModuleSettings: CompanyModule[], // Still needed for module enablement check
    systemModules: SystemModule[] | undefined,
    ignoreIsHidden: boolean = false, // New parameter to control if isHidden is ignored
    permissionChecker?: { hasAnyPermission: (permissions: PermissionKey[]) => boolean } // NEW: Permission checker
  ): MenuItem[] => {
    const userModuleMap = new Map<string, boolean>();
    userModuleSettings.forEach(um => userModuleMap.set(um.module_id, um.is_enabled));

    const companyModuleMap = new Map<string, { is_enabled: boolean; is_locked_by_system: boolean }>();
    companyModuleSettings.forEach(cm => companyModuleMap.set(cm.module_id, { is_enabled: cm.is_enabled, is_locked_by_system: cm.is_locked_by_system }));

    return items.map(item => {
      const actualModuleId = getModuleIdForMenuItem(item.id);
      const systemModuleInfo = systemModules?.find(mod => mod.id === actualModuleId);

      // 1. Check if item is a module and if it's enabled at the company level
      //    Only apply this if the item has a 'path' (indicating it's a leaf navigation item/module)
      //    and if a companyId is present. Super-admins bypass this check.
      if (item.path && companyId && role !== 'super-admin' && actualModuleId) {
        const companyModuleStatus = companyModuleMap.get(actualModuleId);
        if (companyModuleStatus === undefined || companyModuleStatus.is_enabled === false) {
          return null; // Hide if not enabled at company level
        }
      }

      // 2. Check if module is explicitly disabled for the user (overrides company setting)
      if (actualModuleId) { // Only check if we have an actualModuleId
        const isModuleDisabledForUser = userModuleMap.has(actualModuleId) && !userModuleMap.get(actualModuleId);
        if (isModuleDisabledForUser) return null;
      }

      // 3. Check if the module's `roles` array includes the current user's role
      //    If `systemModuleInfo.roles` is null or empty, it means it's available to all roles.
      if (systemModuleInfo?.roles && systemModuleInfo.roles.length > 0) {
        if (!role || !systemModuleInfo.roles.includes(role)) {
          return null; // Hide if user's role is not in the module's allowed roles
        }
      }

      // 4. Existing checks (role, companyRequired)
      //    Only hide based on item.isHidden if `ignoreIsHidden` is false
      const isLockedAndNotSuperAdmin = item.isLocked && role !== 'super-admin'; // Use item.isLocked directly

      if (!ignoreIsHidden && item.isHidden && !isLockedAndNotSuperAdmin) return null; // Only hide if not locked and not ignoring isHidden

      if (item.companyRequired && !companyId) return null;

      // Permission-based access control (NEW)
      if (item.permissions && item.permissions.length > 0 && permissionChecker) {
        // Check if user has any of the required permissions for this menu item
        if (!permissionChecker.hasAnyPermission(item.permissions)) {
          return null; // Hide if user doesn't have any required permissions
        }
      }

      // Legacy role-based access control (for backward compatibility)
      if (item.roles && (!role || !item.roles.includes(role))) return null;
      
      if (item.children) {
        const visibleChildren = filterItems(item.children, role, companyId, userModuleSettings, companyModuleSettings, systemModules, ignoreIsHidden, permissionChecker);
        if (visibleChildren.length > 0) {
          return { ...item, children: visibleChildren };
        }
        return null;
      }
      return item;
    }).filter((item): item is MenuItem => item !== null);
  }, [getModuleIdForMenuItem]);

  const filteredMenuItems = useMemo(() => {
    if (!activeProfile || isLoadingSystemModules) return [];
    return filterItems(orderedMenuItems, activeProfile.role, activeProfile.company_id, userModules ?? [], companyModules ?? [], systemModules, false, { hasAnyPermission }); // Use false for ignoreIsHidden
  }, [orderedMenuItems, activeProfile, userModules, companyModules, filterItems, isLoadingSystemModules, systemModules, hasAnyPermission]);

  const editableMenuItems = useMemo(() => {
    if (!activeProfile || isLoadingSystemModules) return [];
    // For the editable menu, we want to show all items the user *could* potentially see,
    // regardless of their current 'isHidden' status, so we pass `true` for `ignoreIsHidden`.
    // This allows them to toggle visibility for items they have permission to access.
    return filterItems(orderedMenuItems, activeProfile.role, activeProfile.company_id, userModules ?? [], companyModules ?? [], systemModules, true, { hasAnyPermission });
  }, [orderedMenuItems, activeProfile, userModules, companyModules, filterItems, isLoadingSystemModules, systemModules, hasAnyPermission]);

  return {
    menuItems: filteredMenuItems,
    editableMenuItems: editableMenuItems,
    saveMenuPreferences: savePreferencesMutation.mutate,
    isSavingPreferences: savePreferencesMutation.isPending,
    isLoading: isLoadingPreferences || isLoadingSession || isLoadingUserModules || isLoadingCompanyModules || isLoadingSystemModules,
  };
}