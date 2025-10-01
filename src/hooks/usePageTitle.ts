import { useEffect } from 'react';
import { usePageHeader, Breadcrumb, PageTab } from '@/contexts/PageHeaderContext';
import { LucideIcon } from "@/lib/icons";
import { ReactNode } from 'react';

/**
 * Enhanced page header configuration hook with full navigation support
 *
 * Features:
 * - Breadcrumb navigation with links and icons
 * - Tab navigation with counts and icons
 * - Primary and secondary action buttons
 * - FilterIcon component integration
 * - Badge/status indicators
 *
 * @example Basic usage:
 * usePageTitle({
 *   title: "Expenses",
 *   subtitle: "Manage expense submissions",
 *   icon: Receipt
 * });
 *
 * @example With breadcrumbs:
 * usePageTitle({
 *   breadcrumbs: [
 *     { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
 *     { label: "Expenses", path: "/expenses", icon: Receipt },
 *     { label: "Review" }
 *   ]
 * });
 *
 * @example With tabs:
 * usePageTitle({
 *   title: "Expenses",
 *   tabs: [
 *     { id: "all", label: "All", count: 45 },
 *     { id: "pending", label: "Pending", count: 12 },
 *     { id: "approved", label: "Approved", count: 33 }
 *   ],
 *   activeTab: currentTab,
 *   onTabChange: setCurrentTab
 * });
 */
interface UsePageTitleOptions {
  // Basic header info
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;

  // Breadcrumb navigation
  breadcrumbs?: Breadcrumb[];

  // Tab navigation
  tabs?: PageTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;

  // Actions (new structured approach)
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;

  // Legacy actions support (for backward compatibility)
  actions?: ReactNode;

  // Filters
  showFilters?: boolean;
  filterComponent?: ReactNode;
  activeFilterCount?: number;

  // Badges/status indicators
  badges?: ReactNode;
}

export const usePageTitle = (options: UsePageTitleOptions) => {
  const { setPageHeader, clearPageHeader } = usePageHeader();

  useEffect(() => {
    // Set all header options at once
    // Note: We intentionally omit ReactNode dependencies (actions, badges, etc)
    // to prevent infinite loops. The entire options object is passed to setPageHeader
    // which will use the current values from the closure.
    setPageHeader({
      ...options,
      // Ensure we always have a title
      title: options.title || '',
    });
  }, [
    options.title,
    options.subtitle,
    options.icon,
    options.activeTab,
    options.showFilters,
    options.activeFilterCount,
    // Note: Intentionally NOT including:
    // - options.breadcrumbs (array, changes on every render)
    // - options.tabs (array, changes on every render)
    // - options.primaryAction (ReactNode, changes on every render)
    // - options.secondaryActions (ReactNode, changes on every render)
    // - options.actions (ReactNode, changes on every render)
    // - options.filterComponent (ReactNode, changes on every render)
    // - options.badges (ReactNode, changes on every render)
    // - options.onTabChange (function, changes on every render)
    // These are accessed from the closure and will always use the latest values
    setPageHeader,
  ]);

  // Cleanup effect only runs on unmount
  useEffect(() => {
    return () => {
      clearPageHeader();
    };
  }, [clearPageHeader]); // Include clearPageHeader for completeness
};