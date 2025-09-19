import { useState, useMemo, useCallback } from 'react';
import { SearchFilters } from '@/components/AdvancedSearchFilter';

export interface SearchableItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  category_id?: string | null;
  category_name?: string | null;
  submitted_by?: string;
  submitter_full_name?: string | null;
  submitter_email?: string;
  expense_date: string;
  amount: number;
  vendor_name?: string | null;
  is_reimbursable?: boolean | null;
  created_at: string;
  updated_at: string;
}

interface UseAdvancedSearchOptions {
  defaultFilters?: Partial<SearchFilters>;
  debounceMs?: number;
}

export const useAdvancedSearch = <T extends SearchableItem>(
  items: T[],
  options: UseAdvancedSearchOptions = {}
) => {
  const {
    defaultFilters = {},
    debounceMs = 300,
  } = options;

  const [filters, setFilters] = useState<SearchFilters>({
    search: '',
    status: [],
    category: [],
    submitter: [],
    dateRange: {},
    amountRange: {},
    isReimbursable: undefined,
    vendor: '',
    ...defaultFilters,
  });

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  // Debounce search input
  const updateSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [debounceMs]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Text search
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const searchableText = [
          item.title,
          item.description,
          item.vendor_name,
          item.category_name,
          item.submitter_full_name,
          item.submitter_email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(item.status)) {
        return false;
      }

      // Category filter
      if (filters.category.length > 0 && item.category_id && !filters.category.includes(item.category_id)) {
        return false;
      }

      // Submitter filter
      if (filters.submitter.length > 0 && item.submitted_by && !filters.submitter.includes(item.submitted_by)) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.from || filters.dateRange.to) {
        const itemDate = new Date(item.expense_date);
        if (filters.dateRange.from && itemDate < filters.dateRange.from) {
          return false;
        }
        if (filters.dateRange.to && itemDate > filters.dateRange.to) {
          return false;
        }
      }

      // Amount range filter
      if (filters.amountRange.min !== undefined && item.amount < filters.amountRange.min) {
        return false;
      }
      if (filters.amountRange.max !== undefined && item.amount > filters.amountRange.max) {
        return false;
      }

      // Reimbursable filter
      if (filters.isReimbursable !== undefined && item.is_reimbursable !== filters.isReimbursable) {
        return false;
      }

      // Vendor filter
      if (filters.vendor && item.vendor_name) {
        if (!item.vendor_name.toLowerCase().includes(filters.vendor.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [items, debouncedSearch, filters]);

  const sortedAndFilteredItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      // Default sort by created_at desc
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredItems]);

  const searchStats = useMemo(() => {
    const totalItems = items.length;
    const filteredCount = filteredItems.length;
    const hiddenCount = totalItems - filteredCount;

    return {
      totalItems,
      filteredCount,
      hiddenCount,
      isFiltered: filteredCount !== totalItems,
    };
  }, [items.length, filteredItems.length]);

  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      status: [],
      category: [],
      submitter: [],
      dateRange: {},
      amountRange: {},
      isReimbursable: undefined,
      vendor: '',
      ...defaultFilters,
    });
    setDebouncedSearch('');
  }, [defaultFilters]);

  const updateFilters = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (newFilters.search !== filters.search) {
      const timeoutId = setTimeout(() => {
        setDebouncedSearch(newFilters.search);
      }, debounceMs);
      return () => clearTimeout(timeoutId);
    }
  }, [filters.search, debounceMs]);

  // Quick filter presets
  const applyQuickFilter = useCallback((preset: string) => {
    switch (preset) {
      case 'pending':
        setFilters(prev => ({ ...prev, status: ['submitted', 'info_requested'] }));
        break;
      case 'approved':
        setFilters(prev => ({ ...prev, status: ['approved'] }));
        break;
      case 'rejected':
        setFilters(prev => ({ ...prev, status: ['rejected'] }));
        break;
      case 'reimbursable':
        setFilters(prev => ({ ...prev, isReimbursable: true }));
        break;
      case 'thisMonth':
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setFilters(prev => ({
          ...prev,
          dateRange: { from: startOfMonth, to: endOfMonth }
        }));
        break;
      default:
        break;
    }
  }, []);

  return {
    filters,
    updateFilters,
    resetFilters,
    applyQuickFilter,
    filteredItems: sortedAndFilteredItems,
    searchStats,
    updateSearch,
  };
};