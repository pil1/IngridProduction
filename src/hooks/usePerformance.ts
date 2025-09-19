import { useCallback, useMemo, useRef, useState, useEffect } from 'react';

/**
 * Custom hook for optimized search/filtering with debouncing
 */
export const useOptimizedSearch = <T>(
  data: T[],
  searchFields: (keyof T)[],
  debounceMs = 300
) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounce the search term
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  // Optimized filtering with memoization
  const filteredData = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return data;
    }

    const searchLower = debouncedSearchTerm.toLowerCase();

    return data.filter(item => {
      return searchFields.some(field => {
        const fieldValue = item[field];
        if (fieldValue == null) return false;
        return String(fieldValue).toLowerCase().includes(searchLower);
      });
    });
  }, [data, debouncedSearchTerm, searchFields]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  return {
    searchTerm,
    debouncedSearchTerm,
    filteredData,
    handleSearchChange,
    clearSearch,
    isSearching: searchTerm !== debouncedSearchTerm
  };
};

/**
 * Custom hook for optimized pagination
 */
export const useOptimizedPagination = <T>(
  data: T[],
  itemsPerPage = 50
) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginationData = useMemo(() => {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentData = data.slice(startIndex, endIndex);

    return {
      currentData,
      totalItems,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      startIndex: startIndex + 1, // Display index (1-based)
      endIndex
    };
  }, [data, currentPage, itemsPerPage]);

  const goToPage = useCallback((page: number) => {
    const maxPage = Math.ceil(data.length / itemsPerPage);
    const validPage = Math.max(1, Math.min(page, maxPage));
    setCurrentPage(validPage);
  }, [data.length, itemsPerPage]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const previousPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  return {
    ...paginationData,
    goToPage,
    nextPage,
    previousPage,
    resetPagination
  };
};

/**
 * Custom hook for optimized sorting
 */
export const useOptimizedSorting = <T>(
  data: T[],
  initialSortKey?: keyof T,
  initialSortDirection: 'asc' | 'desc' = 'asc'
) => {
  const [sortKey, setSortKey] = useState<keyof T | null>(initialSortKey ?? null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      // Handle different data types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // Default string comparison
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (sortDirection === 'asc') {
        return aString.localeCompare(bString);
      } else {
        return bString.localeCompare(aString);
      }
    });
  }, [data, sortKey, sortDirection]);

  const handleSort = useCallback((key: keyof T) => {
    if (sortKey === key) {
      // Toggle direction if same key
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New key, default to ascending
      setSortKey(key);
      setSortDirection('asc');
    }
  }, [sortKey]);

  const clearSort = useCallback(() => {
    setSortKey(null);
    setSortDirection('asc');
  }, []);

  return {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
    clearSort
  };
};

/**
 * Custom hook for combining search, pagination, and sorting optimally
 */
export const useOptimizedDataProcessing = <T>(
  data: T[],
  searchFields: (keyof T)[],
  options: {
    itemsPerPage?: number;
    debounceMs?: number;
    initialSortKey?: keyof T;
    initialSortDirection?: 'asc' | 'desc';
  } = {}
) => {
  const {
    itemsPerPage = 50,
    debounceMs = 300,
    initialSortKey,
    initialSortDirection = 'asc'
  } = options;

  // Step 1: Search/Filter
  const {
    searchTerm,
    debouncedSearchTerm,
    filteredData,
    handleSearchChange,
    clearSearch,
    isSearching
  } = useOptimizedSearch(data, searchFields, debounceMs);

  // Step 2: Sort
  const {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
    clearSort
  } = useOptimizedSorting(filteredData, initialSortKey, initialSortDirection);

  // Step 3: Paginate
  const paginationResult = useOptimizedPagination(sortedData, itemsPerPage);

  // Performance stats
  const stats = useMemo(() => ({
    totalItems: data.length,
    filteredItems: filteredData.length,
    currentPageItems: paginationResult.currentData.length,
    isFiltered: filteredData.length !== data.length,
    isSorted: sortKey !== null
  }), [data.length, filteredData.length, paginationResult.currentData.length, sortKey]);

  return {
    // Data
    processedData: paginationResult.currentData,

    // Search
    searchTerm,
    debouncedSearchTerm,
    handleSearchChange,
    clearSearch,
    isSearching,

    // Sort
    sortKey,
    sortDirection,
    handleSort,
    clearSort,

    // Pagination
    ...paginationResult,

    // Stats
    stats,

    // Combined actions
    resetAll: useCallback(() => {
      clearSearch();
      clearSort();
      paginationResult.resetPagination();
    }, [clearSearch, clearSort, paginationResult.resetPagination])
  };
};