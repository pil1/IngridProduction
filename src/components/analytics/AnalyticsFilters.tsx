import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Filter, RotateCcw, Download } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export interface AnalyticsFilters {
  dateRange: {
    from?: Date;
    to?: Date;
  };
  period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  category: string[];
  status: string[];
  department: string[];
  comparison: 'previous_period' | 'previous_year' | 'none';
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  onExport?: () => void;
  availableCategories?: Array<{ id: string; name: string }>;
  availableDepartments?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
];

const COMPARISON_OPTIONS = [
  { value: 'none', label: 'No Comparison' },
  { value: 'previous_period', label: 'Previous Period' },
  { value: 'previous_year', label: 'Previous Year' },
];

export const AnalyticsFilters = ({
  filters,
  onFiltersChange,
  onExport,
  availableCategories = [],
  availableDepartments = [],
  isLoading = false,
}: AnalyticsFiltersProps) => {

  const handlePeriodChange = (period: string) => {
    const newFilters = { ...filters, period: period as AnalyticsFilters['period'] };

    // Auto-set date range based on period
    const now = new Date();
    switch (period) {
      case 'today':
        newFilters.dateRange = { from: now, to: now };
        break;
      case 'week':
        newFilters.dateRange = { from: subDays(now, 7), to: now };
        break;
      case 'month':
        newFilters.dateRange = { from: startOfMonth(now), to: endOfMonth(now) };
        break;
      case 'quarter':
        newFilters.dateRange = { from: subMonths(now, 3), to: now };
        break;
      case 'year':
        newFilters.dateRange = { from: startOfYear(now), to: endOfYear(now) };
        break;
      case 'custom':
        // Keep existing date range for custom
        break;
    }

    onFiltersChange(newFilters);
  };

  const handleDateRangeChange = (dateRange: { from?: Date; to?: Date }) => {
    onFiltersChange({
      ...filters,
      dateRange,
      period: 'custom'
    });
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = filters.category.includes(categoryId)
      ? filters.category.filter(id => id !== categoryId)
      : [...filters.category, categoryId];

    onFiltersChange({ ...filters, category: newCategories });
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];

    onFiltersChange({ ...filters, status: newStatuses });
  };

  const handleDepartmentToggle = (departmentId: string) => {
    const newDepartments = filters.department.includes(departmentId)
      ? filters.department.filter(id => id !== departmentId)
      : [...filters.department, departmentId];

    onFiltersChange({ ...filters, department: newDepartments });
  };

  const resetFilters = () => {
    onFiltersChange({
      dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
      period: 'month',
      category: [],
      status: [],
      department: [],
      comparison: 'none',
    });
  };

  const hasActiveFilters =
    filters.category.length > 0 ||
    filters.status.length > 0 ||
    filters.department.length > 0 ||
    filters.comparison !== 'none';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Analytics Filters
          </CardTitle>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} disabled={isLoading}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Time Period */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Time Period</label>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filters.period === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePeriodChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        {filters.period === 'custom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Date Range</label>
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {filters.dateRange.from ? format(filters.dateRange.from, 'MMM dd') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.from}
                    onSelect={(date) => handleDateRangeChange({ ...filters.dateRange, from: date })}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground">to</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {filters.dateRange.to ? format(filters.dateRange.to, 'MMM dd') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.to}
                    onSelect={(date) => handleDateRangeChange({ ...filters.dateRange, to: date })}
                    disabled={(date) => date > new Date() || (filters.dateRange.from && date < filters.dateRange.from)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Comparison */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Comparison</label>
          <Select value={filters.comparison} onValueChange={(value) =>
            onFiltersChange({ ...filters, comparison: value as AnalyticsFilters['comparison'] })
          }>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPARISON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <Badge
                key={status.value}
                variant={filters.status.includes(status.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleStatusToggle(status.value)}
              >
                {status.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        {availableCategories.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Categories</label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((category) => (
                <Badge
                  key={category.id}
                  variant={filters.category.includes(category.id) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleCategoryToggle(category.id)}
                >
                  {category.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Department Filter */}
        {availableDepartments.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Departments</label>
            <div className="flex flex-wrap gap-2">
              {availableDepartments.map((department) => (
                <Badge
                  key={department.id}
                  variant={filters.department.includes(department.id) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleDepartmentToggle(department.id)}
                >
                  {department.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              <Badge variant="secondary">
                {filters.category.length + filters.status.length + filters.department.length + (filters.comparison !== 'none' ? 1 : 0)} active
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsFilters;