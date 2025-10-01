/**
 * TabbedPageLayout - Layout for pages with tab navigation
 *
 * Features:
 * - Integrated with page header tab system
 * - URL-synced tabs (optional)
 * - Lazy loading of tab content
 * - Tab badges and counts
 * - Mobile-responsive (tabs in header)
 *
 * @example Basic usage:
 * const tabs = [
 *   { id: 'all', label: 'All', content: <AllTab /> },
 *   { id: 'pending', label: 'Pending', content: <PendingTab />, count: 5 },
 *   { id: 'approved', label: 'Approved', content: <ApprovedTab /> }
 * ];
 *
 * <TabbedPageLayout
 *   title="Expenses"
 *   tabs={tabs}
 *   defaultTab="all"
 * />
 */

import React, { ReactNode, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PageTab } from '@/contexts/PageHeaderContext';
import { LucideIcon } from "@/lib/icons";
import { LoaderIcon } from "@/lib/icons";

interface TabDefinition extends Omit<PageTab, 'id'> {
  id: string;
  content: ReactNode;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
  lazy?: boolean; // Lazy load tab content
}

interface TabbedPageLayoutProps {
  // Page header configuration
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  breadcrumbs?: Array<{ label: string; path?: string; icon?: LucideIcon }>;

  // Tab configuration
  tabs: TabDefinition[];
  defaultTab?: string;

  // URL sync (syncs active tab with URL query param)
  urlSync?: boolean;
  urlParamName?: string;

  // Actions
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  tabActions?: Record<string, ReactNode>; // Tab-specific actions

  // Layout options
  contentPadding?: boolean;
  spacing?: 'compact' | 'normal' | 'relaxed';

  // Callbacks
  onTabChange?: (tabId: string) => void;

  // Additional classes
  className?: string;
}

export const TabbedPageLayout: React.FC<TabbedPageLayoutProps> = ({
  title,
  subtitle,
  icon,
  breadcrumbs,
  tabs,
  defaultTab,
  urlSync = false,
  urlParamName = 'tab',
  primaryAction,
  secondaryActions,
  tabActions,
  contentPadding = true,
  spacing = 'normal',
  onTabChange,
  className,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize active tab from URL or default
  const initialTab = urlSync
    ? searchParams.get(urlParamName) || defaultTab || tabs[0]?.id
    : defaultTab || tabs[0]?.id;

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set([initialTab]));

  // Handle tab change
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setLoadedTabs(prev => new Set(prev).add(tabId));

    // Update URL if sync is enabled
    if (urlSync) {
      setSearchParams({ [urlParamName]: tabId }, { replace: true });
    }

    // Call custom callback
    onTabChange?.(tabId);
  }, [urlSync, urlParamName, onTabChange, setSearchParams]);

  // Get current tab content
  const activeTabDef = tabs.find(tab => tab.id === activeTab);
  const currentActions = tabActions?.[activeTab] || primaryAction;

  // Spacing classes
  const spacingClasses = {
    compact: 'space-y-4',
    normal: 'space-y-6',
    relaxed: 'space-y-8',
  };

  // Memoize tabs config to prevent infinite loops
  const tabsConfig = React.useMemo(
    () => tabs.map(tab => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon,
      count: tab.count,
      disabled: tab.disabled,
    })),
    [tabs]
  );

  // Configure page header with tabs
  usePageTitle({
    title: title || undefined,
    subtitle,
    icon,
    breadcrumbs,
    tabs: tabsConfig,
    activeTab,
    onTabChange: handleTabChange,
    primaryAction: currentActions,
    secondaryActions,
  });

  // Sync URL changes back to active tab
  useEffect(() => {
    if (urlSync) {
      const urlTab = searchParams.get(urlParamName);
      if (urlTab && urlTab !== activeTab && tabs.some(t => t.id === urlTab)) {
        setActiveTab(urlTab);
        setLoadedTabs(prev => new Set(prev).add(urlTab));
      }
    }
  }, [searchParams, urlSync, urlParamName, activeTab, tabs]);

  // Render tab content
  const renderTabContent = () => {
    if (!activeTabDef) {
      return (
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
          Tab not found
        </div>
      );
    }

    // Lazy loading check
    if (activeTabDef.lazy && !loadedTabs.has(activeTab)) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <LoaderIcon className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      );
    }

    return activeTabDef.content;
  };

  return (
    <div className={cn(
      'flex-1',
      spacingClasses[spacing],
      className
    )}>
      <div className={contentPadding ? 'space-y-6' : ''}>
        {renderTabContent()}
      </div>
    </div>
  );
};

/**
 * TabPanel - Wrapper for individual tab content with loading states
 */
interface TabPanelProps {
  children: ReactNode;
  loading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  children,
  loading = false,
  error = null,
  onRetry,
  className,
}) => {
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[300px]', className)}>
        <div className="flex flex-col items-center gap-3">
          <LoaderIcon className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    return (
      <div className={cn('flex items-center justify-center min-h-[300px]', className)}>
        <div className="text-center space-y-3 max-w-md">
          <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};