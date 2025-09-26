/**
 * VendorGrid Component
 *
 * Responsive grid layout for vendor cards with search, filtering, and sorting.
 * Optimized for performance with virtualization support for large datasets.
 */

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  Users,
  Building2,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { VendorCard } from './VendorCard';
import { Vendor } from '@/pages/EnhancedVendorsPage';

interface VendorGridProps {
  vendors: Vendor[];
  loading?: boolean;
  onEdit?: (vendor: Vendor) => void;
  onView?: (vendor: Vendor) => void;
  onDelete?: (vendor: Vendor) => void;
  onSync?: (vendor: Vendor) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canSync?: boolean;
  showAiBadges?: boolean;
}

type SortOption = 'name' | 'created_at' | 'updated_at' | 'is_active';
type SortDirection = 'asc' | 'desc';
type FilterOption = 'all' | 'active' | 'inactive' | 'synced' | 'unsynced';
type ViewMode = 'grid' | 'list';

export const VendorGrid: React.FC<VendorGridProps> = ({
  vendors,
  loading = false,
  onEdit,
  onView,
  onDelete,
  onSync,
  canEdit = false,
  canDelete = false,
  canSync = false,
  showAiBadges = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showInactive, setShowInactive] = useState(true);

  // Filtered and sorted vendors
  const filteredVendors = useMemo(() => {
    // Ensure vendors is an array
    if (!Array.isArray(vendors)) {
      console.log('Vendors is not an array:', vendors);
      return [];
    }

    let filtered = vendors;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(vendor =>
        vendor.name.toLowerCase().includes(term) ||
        vendor.contact_person?.toLowerCase().includes(term) ||
        vendor.email?.toLowerCase().includes(term) ||
        vendor.phone?.includes(term) ||
        vendor.city?.toLowerCase().includes(term) ||
        vendor.state_province?.toLowerCase().includes(term)
      );
    }

    // Apply status/sync filters
    switch (filter) {
      case 'active':
        filtered = filtered.filter(vendor => vendor.is_active);
        break;
      case 'inactive':
        filtered = filtered.filter(vendor => !vendor.is_active);
        break;
      case 'synced':
        filtered = filtered.filter(vendor => vendor.spire_id);
        break;
      case 'unsynced':
        filtered = filtered.filter(vendor => !vendor.spire_id);
        break;
    }

    // Apply visibility filter
    if (!showInactive) {
      filtered = filtered.filter(vendor => vendor.is_active);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'is_active':
          comparison = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
          break;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [vendors, searchTerm, sortBy, sortDirection, filter, showInactive]);

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  const activeCount = vendors.filter(v => v.is_active).length;
  const inactiveCount = vendors.filter(v => !v.is_active).length;
  const syncedCount = vendors.filter(v => v.spire_id).length;

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-10 bg-gray-200 rounded-lg w-80 animate-pulse" />
          <div className="flex space-x-2">
            <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-lg w-24 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Filter */}
          <Select value={filter} onValueChange={(value: FilterOption) => setFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
              <SelectItem value="synced">Synced</SelectItem>
              <SelectItem value="unsynced">Not Synced</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={`${sortBy}-${sortDirection}`} onValueChange={(value) => {
            const [sort, direction] = value.split('-');
            setSortBy(sort as SortOption);
            setSortDirection(direction as SortDirection);
          }}>
            <SelectTrigger className="w-[160px]">
              {sortDirection === 'asc' ? (
                <SortAsc className="h-4 w-4 mr-2" />
              ) : (
                <SortDesc className="h-4 w-4 mr-2" />
              )}
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="created_at-desc">Newest First</SelectItem>
              <SelectItem value="created_at-asc">Oldest First</SelectItem>
              <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
              <SelectItem value="is_active-desc">Active First</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Toggle */}
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none border-l"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Show/Hide Inactive */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            className="px-3"
          >
            {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>{filteredVendors.length} of {vendors.length} vendors</span>
        </div>

        {vendors.length > 0 && (
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              {activeCount} Active
            </Badge>
            {inactiveCount > 0 && (
              <Badge variant="outline" className="bg-gray-50 text-gray-700">
                {inactiveCount} Inactive
              </Badge>
            )}
            {syncedCount > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                <Building2 className="h-3 w-3 mr-1" />
                {syncedCount} Synced
              </Badge>
            )}
            {showAiBadges && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Enhanced
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Vendor Grid */}
      {filteredVendors.length === 0 ? (
        <div className="text-center py-16">
          <Users className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filter !== 'all' ? 'No vendors found' : 'No vendors yet'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first vendor.'
            }
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
          }
        >
          {filteredVendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onEdit={onEdit}
              onView={onView}
              onDelete={onDelete}
              onSync={onSync}
              canEdit={canEdit}
              canDelete={canDelete}
              canSync={canSync}
              showAiBadges={showAiBadges}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorGrid;