import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { LucideIcon } from "@/lib/icons";

// Breadcrumb structure
export interface Breadcrumb {
  label: string;
  path?: string;
  icon?: LucideIcon;
}

// Tab structure for tabbed navigation
export interface PageTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

// Filter preset structure
export interface FilterPreset {
  id: string;
  label: string;
  active: boolean;
  count?: number;
}

interface PageHeaderContextType {
  // Basic header info
  title: string;
  subtitle?: string;
  icon?: LucideIcon;

  // Breadcrumb navigation
  breadcrumbs?: Breadcrumb[];

  // Tab navigation
  tabs?: PageTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;

  // Actions
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  actions?: ReactNode; // Legacy support

  // Filters
  showFilters?: boolean;
  filterComponent?: ReactNode;
  activeFilterCount?: number;

  // Quick stats/badges
  badges?: ReactNode;

  // Methods
  setPageHeader: (header: Partial<PageHeaderData>) => void;
  clearPageHeader: () => void;
}

interface PageHeaderData {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  breadcrumbs?: Breadcrumb[];
  tabs?: PageTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  actions?: ReactNode;
  showFilters?: boolean;
  filterComponent?: ReactNode;
  activeFilterCount?: number;
  badges?: ReactNode;
}

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(undefined);

interface PageHeaderProviderProps {
  children: ReactNode;
}

export const PageHeaderProvider: React.FC<PageHeaderProviderProps> = ({ children }) => {
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [icon, setIcon] = useState<LucideIcon | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[] | undefined>(undefined);
  const [tabs, setTabs] = useState<PageTab[] | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [onTabChange, setOnTabChange] = useState<((tabId: string) => void) | undefined>(undefined);
  const [primaryAction, setPrimaryAction] = useState<ReactNode | undefined>(undefined);
  const [secondaryActions, setSecondaryActions] = useState<ReactNode | undefined>(undefined);
  const [actions, setActions] = useState<ReactNode | undefined>(undefined);
  const [showFilters, setShowFilters] = useState<boolean | undefined>(undefined);
  const [filterComponent, setFilterComponent] = useState<ReactNode | undefined>(undefined);
  const [activeFilterCount, setActiveFilterCount] = useState<number | undefined>(undefined);
  const [badges, setBadges] = useState<ReactNode | undefined>(undefined);

  const setPageHeader = useCallback((header: Partial<PageHeaderData>) => {
    // Batch all state updates together to prevent multiple re-renders
    if (header.title !== undefined) setTitle(header.title);
    if (header.subtitle !== undefined) setSubtitle(header.subtitle);
    if (header.icon !== undefined) setIcon(header.icon);
    if (header.breadcrumbs !== undefined) setBreadcrumbs(header.breadcrumbs);
    if (header.tabs !== undefined) setTabs(header.tabs);
    if (header.activeTab !== undefined) setActiveTab(header.activeTab);
    if (header.onTabChange !== undefined) setOnTabChange(() => header.onTabChange);
    if (header.primaryAction !== undefined) setPrimaryAction(header.primaryAction);
    if (header.secondaryActions !== undefined) setSecondaryActions(header.secondaryActions);
    if (header.actions !== undefined) setActions(header.actions);
    if (header.showFilters !== undefined) setShowFilters(header.showFilters);
    if (header.filterComponent !== undefined) setFilterComponent(header.filterComponent);
    if (header.activeFilterCount !== undefined) setActiveFilterCount(header.activeFilterCount);
    if (header.badges !== undefined) setBadges(header.badges);
  }, []); // Empty deps - function never changes

  const clearPageHeader = useCallback(() => {
    setTitle('');
    setSubtitle(undefined);
    setIcon(undefined);
    setBreadcrumbs(undefined);
    setTabs(undefined);
    setActiveTab(undefined);
    setOnTabChange(undefined);
    setPrimaryAction(undefined);
    setSecondaryActions(undefined);
    setActions(undefined);
    setShowFilters(undefined);
    setFilterComponent(undefined);
    setActiveFilterCount(undefined);
    setBadges(undefined);
  }, []); // Empty deps - function never changes

  return (
    <PageHeaderContext.Provider value={{
      title,
      subtitle,
      icon,
      breadcrumbs,
      tabs,
      activeTab,
      onTabChange,
      primaryAction,
      secondaryActions,
      actions,
      showFilters,
      filterComponent,
      activeFilterCount,
      badges,
      setPageHeader,
      clearPageHeader
    }}>
      {children}
    </PageHeaderContext.Provider>
  );
};

export const usePageHeader = (): PageHeaderContextType => {
  const context = useContext(PageHeaderContext);
  if (context === undefined) {
    throw new Error('usePageHeader must be used within a PageHeaderProvider');
  }
  return context;
};