/**
 * useTabNavigation - Smart tab navigation hook with URL synchronization
 *
 * Features:
 * - URL parameter sync (e.g., ?tab=pending)
 * - Browser history integration
 * - Persistent tab state across page reloads
 * - Optional localStorage caching
 * - TypeScript-safe tab IDs
 *
 * @example Basic usage:
 * const { activeTab, setActiveTab, tabs } = useTabNavigation({
 *   tabs: ['all', 'pending', 'approved'],
 *   defaultTab: 'all',
 * });
 *
 * @example With URL sync:
 * const { activeTab, setActiveTab } = useTabNavigation({
 *   tabs: ['all', 'pending', 'approved'],
 *   defaultTab: 'all',
 *   urlSync: true,
 *   urlParamName: 'tab',
 * });
 *
 * @example With localStorage cache:
 * const { activeTab, setActiveTab } = useTabNavigation({
 *   tabs: ['all', 'pending', 'approved'],
 *   defaultTab: 'all',
 *   cacheKey: 'expense-tab',
 * });
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

interface UseTabNavigationOptions<T extends string> {
  // Tab configuration
  tabs: readonly T[];
  defaultTab?: T;

  // URL synchronization
  urlSync?: boolean;
  urlParamName?: string;
  replaceHistory?: boolean; // Use replace instead of push

  // localStorage caching
  cacheKey?: string;

  // Callbacks
  onTabChange?: (tab: T, previousTab: T) => void;
  validateTab?: (tab: T) => boolean;
}

interface UseTabNavigationReturn<T extends string> {
  activeTab: T;
  setActiveTab: (tab: T) => void;
  tabs: readonly T[];
  isActiveTab: (tab: T) => boolean;
  getTabIndex: (tab: T) => number;
  nextTab: () => void;
  previousTab: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export function useTabNavigation<T extends string>({
  tabs,
  defaultTab,
  urlSync = false,
  urlParamName = 'tab',
  replaceHistory = true,
  cacheKey,
  onTabChange,
  validateTab,
}: UseTabNavigationOptions<T>): UseTabNavigationReturn<T> {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize active tab from URL, cache, or default
  const getInitialTab = useCallback((): T => {
    // 1. Try URL parameter (highest priority)
    if (urlSync) {
      const urlTab = searchParams.get(urlParamName);
      if (urlTab && tabs.includes(urlTab as T)) {
        const tab = urlTab as T;
        if (!validateTab || validateTab(tab)) {
          return tab;
        }
      }
    }

    // 2. Try localStorage cache
    if (cacheKey) {
      try {
        const cachedTab = localStorage.getItem(cacheKey);
        if (cachedTab && tabs.includes(cachedTab as T)) {
          const tab = cachedTab as T;
          if (!validateTab || validateTab(tab)) {
            return tab;
          }
        }
      } catch (error) {
        console.warn('Failed to read tab from localStorage:', error);
      }
    }

    // 3. Use default tab
    if (defaultTab && tabs.includes(defaultTab)) {
      return defaultTab;
    }

    // 4. Fall back to first tab
    return tabs[0];
  }, [tabs, defaultTab, urlSync, searchParams, urlParamName, cacheKey, validateTab]);

  const [activeTab, setActiveTabState] = useState<T>(getInitialTab);

  // Set active tab with all sync options
  const setActiveTab = useCallback(
    (newTab: T) => {
      // Validate tab
      if (!tabs.includes(newTab)) {
        console.warn(`Invalid tab: ${newTab}. Must be one of:`, tabs);
        return;
      }

      if (validateTab && !validateTab(newTab)) {
        console.warn(`Tab validation failed for: ${newTab}`);
        return;
      }

      // Store previous tab for callback
      const previousTab = activeTab;

      // Update state
      setActiveTabState(newTab);

      // Update URL if sync is enabled
      if (urlSync) {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set(urlParamName, newTab);

        if (replaceHistory) {
          setSearchParams(newSearchParams, { replace: true });
        } else {
          setSearchParams(newSearchParams);
        }
      }

      // Update localStorage cache if enabled
      if (cacheKey) {
        try {
          localStorage.setItem(cacheKey, newTab);
        } catch (error) {
          console.warn('Failed to cache tab in localStorage:', error);
        }
      }

      // Call change callback
      onTabChange?.(newTab, previousTab);
    },
    [
      activeTab,
      tabs,
      urlSync,
      searchParams,
      setSearchParams,
      urlParamName,
      replaceHistory,
      cacheKey,
      onTabChange,
      validateTab,
    ]
  );

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    if (urlSync) {
      const urlTab = searchParams.get(urlParamName);
      if (urlTab && tabs.includes(urlTab as T) && urlTab !== activeTab) {
        const tab = urlTab as T;
        if (!validateTab || validateTab(tab)) {
          setActiveTabState(tab);
        }
      }
    }
  }, [searchParams, urlSync, urlParamName, tabs, activeTab, validateTab]);

  // Helper functions
  const isActiveTab = useCallback((tab: T): boolean => activeTab === tab, [activeTab]);

  const getTabIndex = useCallback((tab: T): number => tabs.indexOf(tab), [tabs]);

  const currentIndex = getTabIndex(activeTab);
  const canGoNext = currentIndex < tabs.length - 1;
  const canGoPrevious = currentIndex > 0;

  const nextTab = useCallback(() => {
    if (canGoNext) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  }, [canGoNext, currentIndex, tabs, setActiveTab]);

  const previousTab = useCallback(() => {
    if (canGoPrevious) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  }, [canGoPrevious, currentIndex, tabs, setActiveTab]);

  return {
    activeTab,
    setActiveTab,
    tabs,
    isActiveTab,
    getTabIndex,
    nextTab,
    previousTab,
    canGoNext,
    canGoPrevious,
  };
}

/**
 * usePersistentTab - Simplified hook with automatic localStorage persistence
 */
export function usePersistentTab<T extends string>(
  tabs: readonly T[],
  storageKey: string,
  defaultTab?: T
) {
  return useTabNavigation({
    tabs,
    defaultTab,
    cacheKey: storageKey,
  });
}

/**
 * useUrlTab - Simplified hook with automatic URL synchronization
 */
export function useUrlTab<T extends string>(
  tabs: readonly T[],
  paramName: string = 'tab',
  defaultTab?: T
) {
  return useTabNavigation({
    tabs,
    defaultTab,
    urlSync: true,
    urlParamName: paramName,
  });
}