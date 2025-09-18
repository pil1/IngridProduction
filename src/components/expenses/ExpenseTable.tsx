import React, { memo, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Edit, Trash2, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
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
import { Expense } from "@/types/expenses";
import { formatCurrency, truncateText, cn } from "@/lib/utils";
import ExpenseSummaryCard from "@/components/ExpenseSummaryCard";

// Define the structure for field settings
interface FieldSetting {
  visible: boolean;
  required: boolean;
}

interface ExpenseTableProps {
  expenses: Expense[];
  onView: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  showActions?: boolean;
  isMobile?: boolean;
  showSubmitterColumn?: boolean; // New prop
  onRowClick?: (expense: Expense) => void; // New prop
  expandedRowId?: string | null; // New prop
  userFieldsConfig: Record<string, FieldSetting>; // New prop for field config
}

// Memoize status color calculation
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

const ExpenseTableComponent = ({
  expenses,
  onView,
  onEdit,
  onDelete,
  showActions = true,
  isMobile = false,
  showSubmitterColumn = true,
  onRowClick,
  expandedRowId,
  userFieldsConfig
}: ExpenseTableProps) => {

  // Memoize handlers to prevent unnecessary re-renders
  const handleViewClick = useCallback((expense: Expense) => {
    onView(expense);
  }, [onView]);

  const handleEditClick = useCallback((expense: Expense) => {
    onEdit(expense);
  }, [onEdit]);

  const handleDeleteClick = useCallback((expense: Expense) => {
    onDelete(expense);
  }, [onDelete]);

  const handleRowClick = useCallback((expense: Expense) => {
    if (onRowClick) onRowClick(expense);
  }, [onRowClick]);

  // Memoize column count calculation
  const colSpan = useMemo(() => {
    let count = 4; // base columns: amount, date, category, status
    if (showSubmitterColumn) count += 1;
    if (showActions) count += 1;
    return count;
  }, [showSubmitterColumn, showActions]);
  if (isMobile) {
    return (
      <div className="space-y-4">
        {expenses.map((expense) => (
          <Card key={expense.id} className="p-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {expense.title}
                </CardTitle>
                <Badge className={getStatusColor(expense.status)}>
                  {expense.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-2 text-sm">
                {showSubmitterColumn && ( // Conditionally render submitter for mobile
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={expense.submitter_avatar_url || ""} />
                      <AvatarFallback>
                        {expense.submitter_first_name?.[0]}
                        {expense.submitter_last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">
                      {expense.submitter_full_name || expense.submitter_email}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {formatCurrency(expense.amount, expense.currency_code)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                </div>
                {expense.category_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span>{expense.category_name}</span>
                  </div>
                )}
              </div>
              {showActions && (
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView(expense)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(expense)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {expense.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(expense)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
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
            <TableHead className="w-[40px]"></TableHead> {/* For expand/collapse icon */}
            <TableHead>Title</TableHead>
            {showSubmitterColumn && <TableHead>Submitter</TableHead>}
            <TableHead>Amount</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="w-[100px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => {
            const isExpanded = expandedRowId === expense.id;
            const colSpan = showSubmitterColumn ? 8 : 7; // Adjust colspan based on submitter column visibility

            return (
              <React.Fragment key={expense.id}>
                <TableRow
                  className={cn(
                    "h-8 border-b-0 hover:bg-muted/50 cursor-pointer",
                    isExpanded && "bg-muted/50"
                  )}
                  onClick={() => handleRowClick(expense)}
                >
                  <TableCell className="w-[40px] text-center">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{truncateText(expense.title, 50)}</TableCell>
                  {showSubmitterColumn && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={expense.submitter_avatar_url || ""} />
                          <AvatarFallback>
                            {expense.submitter_first_name?.[0]}
                            {expense.submitter_last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {expense.submitter_full_name || expense.submitter_email}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {expense.submitter_email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    {formatCurrency(expense.amount, expense.currency_code)}
                  </TableCell>
                  <TableCell>
                    {new Date(expense.expense_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{expense.category_name || "—"}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(expense.status)}>
                      {expense.status}
                    </Badge>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewClick(expense)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditClick(expense)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {expense.status === "draft" && (
                            <DropdownMenuItem onClick={() => handleDeleteClick(expense)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
                {isExpanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={colSpan} className="p-0">
                      <Card className="w-full rounded-none border-0 border-t bg-muted/50 shadow-none">
                        <CardContent className="p-4">
                          <ExpenseSummaryCard expense={expense} fieldConfig={userFieldsConfig} />
                        </CardContent>
                      </Card>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ExpenseTable = memo(ExpenseTableComponent);