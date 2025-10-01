/**
 * FilterBar - Universal filter component with MynaUI styling
 *
 * Features:
 * - Quick filter chips
 * - Advanced search toggle
 * - Active filter display with clear options
 * - Saved filter presets
 * - Mobile-friendly responsive design
 * - Date range pickers
 * - Select dropdowns
 *
 * @example Basic usage:
 * <FilterBar
 *   onSearch={handleSearch}
 *   filters={[
 *     { id: 'status', label: 'Status', value: 'pending' },
 *     { id: 'date', label: 'This Month', value: 'this-month' }
 *   ]}
 *   onClearFilter={handleClearFilter}
 * />
 */

import React, { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { SearchIcon, CloseIcon, ChevronDownIcon, FilterIcon, SaveIcon } from '@/lib/icons';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EnhancedButton } from '@/components/myna/elements/enhanced-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export interface ActiveFilter {
  id: string;
  label: string;
  value: any;
  removable?: boolean;
}

export interface FilterPreset {
  id: string;
  label: string;
  description?: string;
  filters: Record<string, any>;
}

export interface QuickFilter {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  count?: number;
}

interface FilterBarProps {
  // Search
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (query: string) => void;
  showSearch?: boolean;

  // Quick filters (chips)
  quickFilters?: QuickFilter[];
  onQuickFilterClick?: (filterId: string) => void;

  // Active filters
  activeFilters?: ActiveFilter[];
  onClearFilter?: (filterId: string) => void;
  onClearAll?: () => void;

  // Advanced filters
  advancedFilters?: ReactNode;
  showAdvancedToggle?: boolean;
  advancedOpen?: boolean;
  onAdvancedToggle?: (open: boolean) => void;

  // Presets
  presets?: FilterPreset[];
  activePreset?: string;
  onPresetSelect?: (presetId: string) => void;
  onSavePreset?: () => void;

  // Layout
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearch,
  showSearch = true,
  quickFilters = [],
  onQuickFilterClick,
  activeFilters = [],
  onClearFilter,
  onClearAll,
  advancedFilters,
  showAdvancedToggle = true,
  advancedOpen = false,
  onAdvancedToggle,
  presets = [],
  activePreset,
  onPresetSelect,
  onSavePreset,
  className,
}) => {
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(advancedOpen);

  const handleSearchChange = (value: string) => {
    setLocalSearchValue(value);
    onSearch?.(value);
  };

  const handleAdvancedToggle = () => {
    const newState = !isAdvancedOpen;
    setIsAdvancedOpen(newState);
    onAdvancedToggle?.(newState);
  };

  const hasActiveFilters = activeFilters.length > 0 || localSearchValue.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        {showSearch && (
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={localSearchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-9 h-10 bg-white dark:bg-slate-900"
            />
            {localSearchValue && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Preset Filters */}
        {presets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <EnhancedButton variant="outline" size="sm" animation="subtle">
                <FilterIcon className="h-4 w-4 mr-2" />
                {activePreset ? presets.find(p => p.id === activePreset)?.label : 'Filters'}
                <ChevronDownIcon className="h-4 w-4 ml-2" />
              </EnhancedButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Saved Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => onPresetSelect?.(preset.id)}
                  className={cn(activePreset === preset.id && 'bg-blue-50 dark:bg-blue-950')}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{preset.label}</span>
                    {preset.description && (
                      <span className="text-xs text-muted-foreground">{preset.description}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              {onSavePreset && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSavePreset}>
                    <SaveIcon className="h-4 w-4 mr-2" />
                    Save current filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Advanced Filter Toggle */}
        {showAdvancedToggle && advancedFilters && (
          <EnhancedButton
            variant="outline"
            size="sm"
            onClick={handleAdvancedToggle}
            className={cn(isAdvancedOpen && 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800')}
            animation="subtle"
          >
            <FilterIcon className="h-4 w-4 mr-2" />
            Advanced
            {activeFilters.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {activeFilters.length}
              </Badge>
            )}
          </EnhancedButton>
        )}

        {/* Clear All */}
        {hasActiveFilters && onClearAll && (
          <EnhancedButton
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            animation="subtle"
          >
            <CloseIcon className="h-4 w-4 mr-2" />
            Clear all
          </EnhancedButton>
        )}
      </div>

      {/* Quick Filters */}
      {quickFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Quick filters:</span>
          {quickFilters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => onQuickFilterClick?.(filter.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  filter.active
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:from-blue-700 hover:to-blue-800'
                    : 'bg-white dark:bg-slate-900 text-foreground border border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {filter.label}
                {filter.count !== undefined && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'ml-1 h-5 min-w-[20px] px-1.5 text-xs',
                      filter.active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    {filter.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active:</span>
          {activeFilters.map((filter) => (
            <Badge
              key={filter.id}
              variant="secondary"
              className="gap-1.5 pr-1 bg-gradient-to-r from-slate-100 to-blue-100 dark:from-slate-800 dark:to-blue-900 text-foreground"
            >
              <span className="font-medium">{filter.label}</span>
              {filter.removable !== false && onClearFilter && (
                <button
                  onClick={() => onClearFilter(filter.id)}
                  className="ml-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 p-0.5 transition-colors"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {isAdvancedOpen && advancedFilters && (
        <div className="pt-4 border-t border-border space-y-4 animate-in slide-in-from-top-2 duration-200">
          {advancedFilters}
        </div>
      )}
    </div>
  );
};

/**
 * FilterGroup - Container for organizing filter controls
 */
interface FilterGroupProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export const FilterGroup: React.FC<FilterGroupProps> = ({
  label,
  children,
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
};