/**
 * DataTableLayout - Specialized layout for data tables with filters and bulk actions
 *
 * Features:
 * - Integrated filter bar with active filter display
 * - Bulk action toolbar
 * - SearchIcon and sort controls
 * - Export functionality
 * - Mobile-responsive card/table toggle
 * - Empty state handling
 *
 * @example Basic usage:
 * <DataTableLayout
 *   title="UsersIcon"
 *   data={users}
 *   columns={columns}
 *   renderRow={(user) => <UserRow user={user} />}
 * />
 */

import React, { ReactNode, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { usePageTitle } from '@/hooks/usePageTitle';
import { LucideIcon, SearchIcon, FilterIcon, DownloadIcon, UploadIcon, CloseIcon } from "@/lib/icons";
import { EnhancedCard } from '@/components/myna/elements/enhanced-card';
import { EnhancedButton } from '@/components/myna/elements/enhanced-button';
import { EnhancedDataTable } from '@/components/myna/dashboard/enhanced-data-table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface DataTableLayoutProps<T = any> {
  // Page header
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  breadcrumbs?: Array<{ label: string; path?: string; icon?: LucideIcon }>;

  // Data
  data: T[];
  loading?: boolean;
  error?: Error | string | null;

  // Table configuration
  columns?: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    render?: (item: T) => ReactNode;
  }>;

  // Or custom render
  renderTable?: (data: T[]) => ReactNode;

  // Search
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  searchable?: boolean;

  // Filters
  filterComponent?: ReactNode;
  activeFilters?: Array<{ id: string; label: string; value: any }>;
  onClearFilter?: (filterId: string) => void;
  onClearAllFilters?: () => void;

  // Bulk actions
  selectable?: boolean;
  selectedItems?: Set<any>;
  onSelectionChange?: (selected: Set<any>) => void;
  bulkActions?: ReactNode;

  // Actions
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;

  // Export/Import
  onExport?: () => void;
  onImport?: () => void;
  exportLabel?: string;
  importLabel?: string;

  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;

  // Layout
  spacing?: 'compact' | 'normal' | 'relaxed';
  className?: string;
}

export function DataTableLayout<T = any>({
  title,
  subtitle,
  icon,
  breadcrumbs,
  data,
  loading = false,
  error = null,
  columns,
  renderTable,
  searchPlaceholder = 'SearchIcon...',
  onSearch,
  searchable = true,
  filterComponent,
  activeFilters = [],
  onClearFilter,
  onClearAllFilters,
  selectable = false,
  selectedItems = new Set(),
  onSelectionChange,
  bulkActions,
  primaryAction,
  secondaryActions,
  onExport,
  onImport,
  exportLabel = 'Export',
  importLabel = 'Import',
  emptyTitle = 'No data available',
  emptyDescription = 'There are no items to display.',
  emptyAction,
  spacing = 'normal',
  className,
}: DataTableLayoutProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Build actions
  const actions = useMemo(() => (
    <div className="flex items-center gap-2">
      {onImport && (
        <EnhancedButton variant="outline" size="sm" onClick={onImport}>
          <UploadIcon className="h-4 w-4 mr-2" />
          {importLabel}
        </EnhancedButton>
      )}
      {onExport && (
        <EnhancedButton variant="outline" size="sm" onClick={onExport}>
          <DownloadIcon className="h-4 w-4 mr-2" />
          {exportLabel}
        </EnhancedButton>
      )}
      {secondaryActions}
      {primaryAction}
    </div>
  ), [onImport, onExport, importLabel, exportLabel, secondaryActions, primaryAction]);

  // Build filter bar
  const filterBar = useMemo(() => {
    if (!filterComponent && !searchable) return null;

    return (
      <div className="space-y-4">
        {/* SearchIcon and filter toggle */}
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch?.(e.target.value);
                }}
                className="pl-9"
              />
            </div>
          )}

          {filterComponent && (
            <EnhancedButton
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-blue-50 dark:bg-blue-950')}
            >
              <FilterIcon className="h-4 w-4 mr-2" />
              Filters
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {activeFilters.length}
                </Badge>
              )}
            </EnhancedButton>
          )}
        </div>

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {activeFilters.map((filter) => (
              <Badge
                key={filter.id}
                variant="secondary"
                className="gap-1 pr-1 bg-gradient-to-r from-slate-100 to-blue-100 dark:from-slate-800 dark:to-blue-900"
              >
                {filter.label}
                {onClearFilter && (
                  <button
                    onClick={() => onClearFilter(filter.id)}
                    className="ml-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 p-0.5"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
            {onClearAllFilters && (
              <button
                onClick={onClearAllFilters}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* FilterIcon component */}
        {showFilters && filterComponent && (
          <div className="pt-2 border-t border-border">
            {filterComponent}
          </div>
        )}
      </div>
    );
  }, [
    filterComponent,
    searchable,
    searchQuery,
    searchPlaceholder,
    onSearch,
    showFilters,
    activeFilters,
    onClearFilter,
    onClearAllFilters,
  ]);

  // Spacing classes
  const spacingClasses = {
    compact: 'space-y-4',
    normal: 'space-y-6',
    relaxed: 'space-y-8',
  };

  // Configure page header
  usePageTitle({
    title,
    subtitle,
    icon,
    breadcrumbs,
    primaryAction: selectedItems.size > 0 ? bulkActions : primaryAction,
    secondaryActions: selectedItems.size > 0 ? null : actions,
    showFilters: !!filterBar,
    filterComponent: filterBar,
    activeFilterCount: activeFilters.length,
  });

  // Empty state
  if (!loading && data.length === 0 && !error) {
    return (
      <div className={cn('flex-1', spacingClasses[spacing], className)}>
        <EnhancedCard variant="elevated" className="max-w-2xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 p-6">
            <div className="p-4 bg-gradient-to-br from-slate-100 to-blue-100 dark:from-slate-800 dark:to-blue-900 rounded-2xl">
              <SearchIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-slate-700 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent">
                {emptyTitle}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {emptyDescription}
              </p>
            </div>
            {emptyAction && <div className="pt-2">{emptyAction}</div>}
          </div>
        </EnhancedCard>
      </div>
    );
  }

  // Main layout
  return (
    <div className={cn('flex-1', spacingClasses[spacing], className)}>
      <EnhancedCard variant="elevated">
        {renderTable ? renderTable(data) : (
          <EnhancedDataTable
            data={data}
            columns={columns || []}
            loading={loading}
          />
        )}
      </EnhancedCard>
    </div>
  );
}