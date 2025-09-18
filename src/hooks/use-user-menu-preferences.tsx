"use client";

import { useCallback, useMemo } from "react"; // Removed useEffect, useState
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Removed useToast
import { Building, Users, Settings, BarChart, Package, DollarSign, Receipt, ClipboardCheck, ListChecks, Landmark, Mail, User, Building2, CreditCard, Workflow, Truck, UsersRound, LayoutDashboard, Bell } from "lucide-react"; // All icons are now used

export interface MenuItem {
  id: string;
  label: string;
  path?: string; // Optional for parent items
  icon: React.ElementType;
  roles?: string[];
  companyRequired?: boolean;
  isHidden?: boolean;
  isLocked?: boolean; // NEW: Add isLocked property
  children?: MenuItem[];
}

// Define the default order and properties of menu items with new nested structure
export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, isHidden: false, roles: ['admin', 'controller', 'super-admin'], companyRequired: true },
  { id: "companies", label: "Companies", path: "/companies", icon: Building, roles: ['super-admin'], isHidden: false },
  { id: "vendors", label: "Vendors", path: "/vendors", icon: Truck, roles: ['admin', 'controller', 'super-admin'], companyRequired: true, isHidden: false },
  { id: "customers", label: "Customers", path: "/customers", icon: UsersRound, roles: ['admin', 'controller', 'super-admin'], companyRequired: true, isHidden: false },
  { id: "expenses", label: "My Expenses", path: "/expenses", icon: Receipt, companyRequired: true, isHidden: false },
  { id: "expense-review", label: "Expense Review", path: "/expense-review", icon: ClipboardCheck, roles: ['admin', 'controller', 'super-admin'], companyRequired: true, isHidden: false },
  { id: "notifications-page", label: "Notifications", path: "/notifications", icon: Bell, companyRequired: true, isHidden: false },
  {
    id: "accounting",
    label: "Accounting",
    icon: Landmark,
    roles: ['admin', 'controller', 'super-admin'],
    companyRequired: true,
    isHidden: false,
    children: [
      { id: "expense-categories", label: "Expense Categories", path: "/expense-categories", icon: ListChecks, roles: ['admin', 'controller', 'super-admin'], companyRequired: true, isHidden: false },
      { id: "gl-accounts", label: "GL Accounts", path: "/gl-accounts", icon: Landmark, roles: ['admin', 'controller', 'super-admin'], companyRequired: true, isHidden: false },
    ]
  },
  {
    id: "process-automation",
    label: "Process Automation",
    icon: Workflow,
    roles: ['admin', 'controller', 'super-admin'],
    companyRequired: true,
    isHidden: false,
    children: [
      { id: "automations", label: "Automations", path: "/process-automation", icon: Workflow, roles: ['admin', 'controller', 'super-admin'], companyRequired: true, isHidden: false },
    ]
  },
  { id: "billing", label: "Billing", path: "/billing", icon: DollarSign, roles: ['super-admin'], isHidden: false },
  { id: "analytics", label: "Analytics", path: "/analytics", icon: BarChart, isHidden: false },
  {
    id: "system-notification-settings", // New unified route for system notifications
    label: "System Notifications",
    path: "/system-notification-settings", // Point to the new unified page
    icon: Mail,
    roles: ['super-admin'],
    isHidden: false,
    // Removed children as it's now a single page with tabs
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    isHidden: false,
    children: [
      { id: "profile-settings", label: "Profile", path: "/settings", icon: User, isHidden: false },
      { id: "company-settings", label: "Company", path: "/company-settings", icon: Building2, roles: ['admin', 'super-admin'], companyRequired: true, isHidden: false },
      { id: "users", label: "Users", path: "/users", icon: Users, roles: ['admin', 'super-admin'], isHidden: false, isLocked: true }, // Marked as locked
      { id: "company-modules-overview", label: "Modules", path: "/company-modules-overview", icon: Package, roles: ['admin', 'super-admin'], companyRequired: true, isHidden: false },
      { id: "system-modules", label: "System Modules", path: "/system-modules", icon: Package, roles: ['super-admin'], isHidden: false },
      { id: "system-billing-settings", label: "System Billing", path: "/system-billing-settings", icon: CreditCard, roles: ['super-admin'], isHidden: false },
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

  // Use the active user's ID for preferences and module access
  const activeUserId = impersonatedProfile?.user_id || user?.id;
  const activeProfile = impersonatedProfile || profile;

  const { data: userPreferences, isLoading: isLoadingPreferences } = useQuery<UserMenuPreferences | null>({
    queryKey: ["userMenuPreferences", activeUserId], // Query key includes user.id for specific profile
    queryFn: async () => {
      if (!activeUserId) return null;
      // Select all columns, let Supabase client handle JSONB parsing
      const { data, error } = await supabase
        .from("user_menu_preferences")
        .select("*") // Select all to avoid 406 if schema changes
        .eq("user_id", activeUserId)
        .single();
      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error("Error fetching user menu preferences:", error);
        throw error; // Let react-query handle the error state
      }
      
      if (data) {
        let processedMenuItemsOrder: UserMenuItemPreference[] = [];
        // Ensure menu_items_order is treated as an array of objects
        if (Array.isArray(data.menu_items_order)) {
          // Check if it's the old string array format (array of strings) or the new object array format
          if (data.menu_items_order.length > 0 && typeof data.menu_items_order[0] === 'string') {
            processedMenuItemsOrder = (data.menu_items_order as string[]).map(id => ({ id, isHidden: false }));
          } else {
            // Assume it's already the correct object array format
            processedMenuItemsOrder = data.menu_items_order as UserMenuItemPreference[];
          }
        } else if (data.menu_items_order === null || data.menu_items_order === undefined) {
            processedMenuItemsOrder = []; // Default to empty array if null/undefined
        } else {
            console.warn("menu_items_order is not an array:", data.menu_items_order);
            processedMenuItemsOrder = []; // Fallback to empty array
        }
        return { ...data, menu_items_order: processedMenuItemsOrder };
      }
      return null;
    },
    enabled: !!activeUserId && !isLoadingSession,
    staleTime: 1000 * 60 * 5, // Profile data is relatively stable, re-fetch every 5 minutes
    refetchOnWindowFocus: true, // Re-fetch when window regains focus
  });

  // UPDATED: Use UserModule[] for userModules query
  const { data: userModules, isLoading: isLoadingUserModules } = useQuery<UserModule[]>({
    queryKey: ["userModulesForMenu", activeUserId],
    queryFn: async () => {
      if (!activeUserId) return [];
      // Select all fields required by the UserModule interface
      const { data, error } = await supabase
        .from("user_modules")
        .select("id, user_id, company_id, module_id, is_enabled")
        .eq("user_id", activeUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!activeUserId && !isLoadingSession,
  });

  // NEW: Fetch company-level module settings
  const { data: companyModules, isLoading: isLoadingCompanyModules } = useQuery<CompanyModule[]>({
    queryKey: ["companyModulesForMenu", activeProfile?.company_id],
    queryFn: async () => {
      if (!activeProfile?.company_id) return [];
      const { data, error } = await supabase
        .from("company_modules")
        .select("id, company_id, module_id, is_enabled, is_locked_by_system") // Select all fields required by CompanyModule interface
        .eq("company_id", activeProfile.company_id);
      if (error) throw error;
      return data;
    },
    enabled: !!activeProfile?.company_id && !isLoadingSession,
  });

  // NEW: Fetch all system modules (id, name, module_type, roles)
  const { data: systemModules, isLoading: isLoadingSystemModules } = useQuery<SystemModule[]>({
    queryKey: ["allSystemModulesForMenu"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modules").select("id, name, module_type, roles"); // Select module_type and roles
      if (error) throw error;
      return data;
    },
    enabled: !isLoadingSession, // Always fetch if session is not loading
    staleTime: Infinity, // System modules are static
  });

  const savePreferencesMutation = useMutation({
    mutationFn: async (newOrder: UserMenuItemPreference[]) => {
      if (!activeUserId) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from("user_menu_preferences")
        .upsert({ user_id: activeUserId, menu_items_order: newOrder }, { onConflict: "user_id" });
      if (error) throw error;
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
      case "companies": return moduleNameToIdMap.get("Companies");
      case "vendors": return moduleNameToIdMap.get("Vendors");
      case "customers": return moduleNameToIdMap.get("Customers");
      case "expenses": return moduleNameToIdMap.get("Expense Management"); // Maps to Expense Management module
      case "expense-review": return moduleNameToIdMap.get("Expense Management"); // Maps to Expense Management module
      case "notifications-page": return moduleNameToIdMap.get("Notifications");
      case "expense-categories": return moduleNameToIdMap.get("Expense Categories");
      case "gl-accounts": return moduleNameToIdMap.get("GL Accounts");
      case "automations": return moduleNameToIdMap.get("Process Automation"); // Maps to Process Automation module
      case "billing": return moduleNameToIdMap.get("Billing");
      case "analytics": return moduleNameToIdMap.get("Analytics");
      case "system-notification-settings": return moduleNameToIdMap.get("System Notification Settings"); // New unified module
      case "profile-settings": return moduleNameToIdMap.get("Profile Settings");
      case "company-settings": return moduleNameToIdMap.get("Company Settings");
      case "users": return moduleNameToIdMap.get("Users");
      case "company-modules-overview": return moduleNameToIdMap.get("Company Modules Overview");
      case "system-modules": return moduleNameToIdMap.get("System Modules");
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
    (userPreferences?.menu_items_order || []).forEach((pref: UserMenuItemPreference) => {
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

    for (const pref of userPreferences?.menu_items_order || []) {
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
    ignoreIsHidden: boolean = false // New parameter to control if isHidden is ignored
  ): MenuItem[] => {
    const userModuleMap = new Map<string, boolean>();
    userModuleSettings.forEach(um => userModuleMap.set(um.module_id, um.is_enabled));

    const companyModuleMap = new Map<string, { is_enabled: boolean; is_locked_by_system: boolean }>();
    companyModuleSettings.forEach(cm => companyModuleMap.set(cm.module_id, { is_enabled: cm.is_enabled, is_locked_by_system: cm.is_locked_by_system }));

    return items.map(item => {
      const systemModuleInfo = systemModules?.find(mod => mod.name === item.label); // Find system module by label
      const actualModuleId = systemModuleInfo?.id;

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
      if (systemModuleInfo && systemModuleInfo.roles && systemModuleInfo.roles.length > 0) {
        if (!role || !systemModuleInfo.roles.includes(role)) {
          return null; // Hide if user's role is not in the module's allowed roles
        }
      }

      // 4. Existing checks (role, companyRequired)
      //    Only hide based on item.isHidden if `ignoreIsHidden` is false
      const isLockedAndNotSuperAdmin = item.isLocked && role !== 'super-admin'; // Use item.isLocked directly

      if (!ignoreIsHidden && item.isHidden && !isLockedAndNotSuperAdmin) return null; // Only hide if not locked and not ignoring isHidden

      if (item.companyRequired && !companyId) return null;
      if (item.roles && (!role || !item.roles.includes(role))) return null; // This is for DEFAULT_MENU_ITEMS roles, not system module roles
      
      if (item.children) {
        const visibleChildren = filterItems(item.children, role, companyId, userModuleSettings, companyModuleSettings, systemModules, ignoreIsHidden);
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
    return filterItems(orderedMenuItems, activeProfile.role, activeProfile.company_id, userModules || [], companyModules || [], systemModules, false); // Use false for ignoreIsHidden
  }, [orderedMenuItems, activeProfile, userModules, companyModules, filterItems, isLoadingSystemModules, systemModules]);

  const editableMenuItems = useMemo(() => {
    if (!activeProfile || isLoadingSystemModules) return [];
    // For the editable menu, we want to show all items the user *could* potentially see,
    // regardless of their current 'isHidden' status, so we pass `true` for `ignoreIsHidden`.
    // This allows them to toggle visibility for items they have permission to access.
    return filterItems(orderedMenuItems, activeProfile.role, activeProfile.company_id, userModules || [], companyModules || [], systemModules, true);
  }, [orderedMenuItems, activeProfile, userModules, companyModules, filterItems, isLoadingSystemModules, systemModules]);

  return {
    menuItems: filteredMenuItems,
    editableMenuItems: editableMenuItems,
    saveMenuPreferences: savePreferencesMutation.mutate,
    isSavingPreferences: savePreferencesMutation.isPending,
    isLoading: isLoadingPreferences || isLoadingSession || isLoadingUserModules || isLoadingCompanyModules || isLoadingSystemModules,
  };
}