import React, { memo, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, Edit, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, truncateText, cn } from "@/lib/utils";
import ExpenseSummaryCard from "@/components/ExpenseSummaryCard";

export interface ExpenseWithSubmitter {
  id: string;
  description: string;
  amount: number;
  status: string;
  expense_date: string;
  created_at: string;
  submitted_by?: string;
  submitter_full_name?: string;
  submitter_email?: string;
  category_name?: string;
  vendor_name?: string;
  receipt_url?: string;
  is_reimbursable?: boolean;
}

interface SelectableExpenseTableProps {
  expenses: ExpenseWithSubmitter[];
  selectedExpenseIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onEditClick?: (expenseId: string) => void;
  onRowClick?: (expenseId: string) => void;
  onToggleExpand?: (expenseId: string) => void;
  expandedExpenseId?: string | null;
  isLoading?: boolean;
  isMobile?: boolean;
  showSubmitterColumn?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "submitted":
      return "bg-blue-100 text-blue-800";
    case "approved":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "info_requested":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const SelectableExpenseTableComponent = ({
  expenses,
  selectedExpenseIds,
  onSelectionChange,
  onEditClick,
  onRowClick,
  onToggleExpand,
  expandedExpenseId,
  isLoading = false,
  isMobile = false,
  showSubmitterColumn = true,
}: SelectableExpenseTableProps) => {
  const isAllSelected = expenses.length > 0 && selectedExpenseIds.length === expenses.length;
  const isIndeterminate = selectedExpenseIds.length > 0 && selectedExpenseIds.length < expenses.length;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(expenses.map(expense => expense.id));
    }
  }, [isAllSelected, expenses, onSelectionChange]);

  const handleSelectExpense = useCallback((expenseId: string) => {
    const newSelection = selectedExpenseIds.includes(expenseId)
      ? selectedExpenseIds.filter(id => id !== expenseId)
      : [...selectedExpenseIds, expenseId];
    onSelectionChange(newSelection);
  }, [selectedExpenseIds, onSelectionChange]);

  const handleRowClick = useCallback((expenseId: string, event: React.MouseEvent) => {
    // Don't trigger row click if clicking on checkbox or action buttons
    if (
      event.target instanceof Element &&
      (event.target.closest('[data-checkbox]') || event.target.closest('[data-action]'))
    ) {
      return;
    }
    onRowClick?.(expenseId);
  }, [onRowClick]);

  if (isMobile) {
    return (
      <div className="space-y-4">
        {expenses.map((expense) => (
          <Card key={expense.id} className="p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                data-checkbox
                checked={selectedExpenseIds.includes(expense.id)}
                onCheckedChange={() => handleSelectExpense(expense.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <ExpenseSummaryCard
                  expense={expense}
                  onRowClick={onRowClick}
                  onEditClick={onEditClick}
                  expandedExpenseId={expandedExpenseId}
                  onToggleExpand={onToggleExpand}
                  showSubmitterColumn={showSubmitterColumn}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                data-checkbox
                checked={isAllSelected}
                ref={(ref) => {
                  if (ref) ref.indeterminate = isIndeterminate;
                }}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            {showSubmitterColumn && <TableHead>Submitter</TableHead>}
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow
              key={expense.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={(e) => handleRowClick(expense.id, e)}
            >
              <TableCell>
                <Checkbox
                  data-checkbox
                  checked={selectedExpenseIds.includes(expense.id)}
                  onCheckedChange={() => handleSelectExpense(expense.id)}
                />
              </TableCell>
              <TableCell>
                <div className="font-medium">{truncateText(expense.description, 40)}</div>
                {expense.vendor_name && (
                  <div className="text-sm text-muted-foreground">{expense.vendor_name}</div>
                )}
              </TableCell>
              <TableCell>
                <div className="font-medium">{formatCurrency(expense.amount)}</div>
                {expense.is_reimbursable && (
                  <Badge variant="outline" className="text-xs">Reimbursable</Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge className={cn("text-xs", getStatusColor(expense.status))}>
                  {expense.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {new Date(expense.expense_date).toLocaleDateString()}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">{expense.category_name ?? "Uncategorized"}</div>
              </TableCell>
              {showSubmitterColumn && (
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {expense.submitter_full_name
                          ? expense.submitter_full_name.split(' ').map(n => n[0]).join('')
                          : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      {expense.submitter_full_name ?? expense.submitter_email ?? 'Unknown'}
                    </div>
                  </div>
                </TableCell>
              )}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button data-action variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onRowClick?.(expense.id);
                    }}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    {onEditClick && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onEditClick(expense.id);
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {onToggleExpand && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(expense.id);
                      }}>
                        {expandedExpenseId === expense.id ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Collapse
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Expand
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {expenses.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No expenses found</p>
        </div>
      )}
    </div>
  );
};

export const SelectableExpenseTable = memo(SelectableExpenseTableComponent);
export default SelectableExpenseTable;