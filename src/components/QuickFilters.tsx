import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  Filter,
  TrendingUp
} from "lucide-react";

interface QuickFiltersProps {
  onApplyFilter: (preset: string) => void;
  searchStats: {
    totalItems: number;
    filteredCount: number;
    hiddenCount: number;
    isFiltered: boolean;
  };
}

const QUICK_FILTERS = [
  {
    id: 'pending',
    label: 'Pending Review',
    icon: Clock,
    description: 'Submitted & Info Requested',
    variant: 'outline' as const,
  },
  {
    id: 'approved',
    label: 'Approved',
    icon: CheckCircle,
    description: 'Ready for payment',
    variant: 'outline' as const,
  },
  {
    id: 'rejected',
    label: 'Rejected',
    icon: XCircle,
    description: 'Needs revision',
    variant: 'outline' as const,
  },
  {
    id: 'reimbursable',
    label: 'Reimbursable',
    icon: DollarSign,
    description: 'Employee expenses',
    variant: 'outline' as const,
  },
  {
    id: 'thisMonth',
    label: 'This Month',
    icon: Calendar,
    description: 'Current month only',
    variant: 'outline' as const,
  },
];

export const QuickFilters = ({ onApplyFilter, searchStats }: QuickFiltersProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Quick Filters
          </CardTitle>
          <div className="flex items-center gap-2">
            {searchStats.isFiltered && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {searchStats.filteredCount} of {searchStats.totalItems}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {QUICK_FILTERS.map((filter) => {
            const Icon = filter.icon;
            return (
              <Button
                key={filter.id}
                variant={filter.variant}
                size="sm"
                onClick={() => onApplyFilter(filter.id)}
                className="flex flex-col h-auto p-3 text-left justify-start"
              >
                <div className="flex items-center gap-2 w-full">
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-sm truncate">{filter.label}</span>
                </div>
                <span className="text-xs text-muted-foreground mt-1 w-full truncate">
                  {filter.description}
                </span>
              </Button>
            );
          })}
        </div>

        {searchStats.isFiltered && searchStats.hiddenCount > 0 && (
          <div className="mt-3 p-2 bg-muted/50 rounded-md">
            <p className="text-sm text-muted-foreground">
              Showing {searchStats.filteredCount} expenses, {searchStats.hiddenCount} hidden by filters
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickFilters;