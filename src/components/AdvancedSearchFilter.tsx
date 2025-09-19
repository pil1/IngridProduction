import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export interface SearchFilters {
  search: string;
  status: string[];
  category: string[];
  submitter: string[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
  amountRange: {
    min?: number;
    max?: number;
  };
  isReimbursable?: boolean;
  vendor?: string;
}

interface AdvancedSearchFilterProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  categories?: Array<{ id: string; name: string }>;
  submitters?: Array<{ id: string; name: string; email: string }>;
  vendors?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

const EXPENSE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "info_requested", label: "Info Requested" },
];

export const AdvancedSearchFilter = ({
  filters,
  onFiltersChange,
  categories = [],
  submitters = [],
  vendors = [],
  isLoading = false,
}: AdvancedSearchFilterProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState<"from" | "to" | null>(null);

  const updateFilters = useCallback(
    (updates: Partial<SearchFilters>) => {
      onFiltersChange({ ...filters, ...updates });
    },
    [filters, onFiltersChange]
  );

  const toggleArrayFilter = useCallback(
    (key: keyof Pick<SearchFilters, "status" | "category" | "submitter">, value: string) => {
      const currentValues = filters[key] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      updateFilters({ [key]: newValues });
    },
    [filters, updateFilters]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({
      search: "",
      status: [],
      category: [],
      submitter: [],
      dateRange: {},
      amountRange: {},
      isReimbursable: undefined,
      vendor: "",
    });
  }, [onFiltersChange]);

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length > 0) count++;
    if (filters.category.length > 0) count++;
    if (filters.submitter.length > 0) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.amountRange.min !== undefined || filters.amountRange.max !== undefined) count++;
    if (filters.isReimbursable !== undefined) count++;
    if (filters.vendor) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              {isExpanded ? "Less" : "More"} Filters
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Search */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search expenses by title, description, vendor..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full"
            />
          </div>
          <Select value={filters.status[0] || "__all_statuses__"} onValueChange={(value) => updateFilters({ status: (value && value !== "__all_statuses__") ? [value] : [] })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_statuses__">All Statuses</SelectItem>
              {EXPENSE_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Filters */}
        {isExpanded && (
          <>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex flex-wrap gap-1">
                  {EXPENSE_STATUSES.map((status) => (
                    <Badge
                      key={status.value}
                      variant={filters.status.includes(status.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleArrayFilter("status", status.value)}
                    >
                      {status.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Categories</Label>
                <Select
                  value={filters.category[0] || "__all_categories__"}
                  onValueChange={(value) => updateFilters({ category: (value && value !== "__all_categories__") ? [value] : [] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all_categories__">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Submitter Filter */}
              {submitters.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Submitter</Label>
                  <Select
                    value={filters.submitter[0] || "__all_submitters__"}
                    onValueChange={(value) => updateFilters({ submitter: (value && value !== "__all_submitters__") ? [value] : [] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select submitter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all_submitters__">All Submitters</SelectItem>
                      {submitters.map((submitter) => (
                        <SelectItem key={submitter.id} value={submitter.id}>
                          {submitter.name || submitter.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date Range</Label>
                <div className="flex gap-2">
                  <Popover open={datePickerOpen === "from"} onOpenChange={(open) => setDatePickerOpen(open ? "from" : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !filters.dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.from ? format(filters.dateRange.from, "MMM dd") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.from}
                        onSelect={(date) => {
                          updateFilters({
                            dateRange: { ...filters.dateRange, from: date }
                          });
                          setDatePickerOpen(null);
                        }}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover open={datePickerOpen === "to"} onOpenChange={(open) => setDatePickerOpen(open ? "to" : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !filters.dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.to ? format(filters.dateRange.to, "MMM dd") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.to}
                        onSelect={(date) => {
                          updateFilters({
                            dateRange: { ...filters.dateRange, to: date }
                          });
                          setDatePickerOpen(null);
                        }}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Amount Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Amount Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.amountRange.min ?? ""}
                    onChange={(e) => updateFilters({
                      amountRange: {
                        ...filters.amountRange,
                        min: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.amountRange.max ?? ""}
                    onChange={(e) => updateFilters({
                      amountRange: {
                        ...filters.amountRange,
                        max: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
              </div>

              {/* Vendor Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vendor</Label>
                <Select
                  value={filters.vendor || "__all_vendors__"}
                  onValueChange={(value) => updateFilters({ vendor: (value && value !== "__all_vendors__") ? value : "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all_vendors__">All Vendors</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reimbursable Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reimbursable</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={filters.isReimbursable === true}
                    onCheckedChange={(checked) => updateFilters({ isReimbursable: checked ? true : undefined })}
                  />
                  <Label className="text-sm">Reimbursable only</Label>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdvancedSearchFilter;