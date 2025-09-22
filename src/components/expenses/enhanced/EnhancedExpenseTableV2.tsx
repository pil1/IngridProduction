/**
 * Enhanced Expense Table V2
 *
 * Advanced expense table with expandable rows, AI tracking, confidence indicators,
 * and improved visual design for professional expense management.
 */

import React, { memo, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Edit,
  MoreHorizontal,
  Brain,
  User,
  Receipt,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, truncateText, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Expense, FieldSource, ProcessingMethod, UrgencyLevel } from '@/types/expenses';
import { ExpandableExpenseRow } from './ExpandableExpenseRow';
import { ConfidenceBadge } from '../indicators/ConfidenceBadge';
import { ProcessingMethodBadge } from '../indicators/ProcessingMethodBadge';
import { FieldSourceIcon } from '../indicators/FieldSourceIcon';

export interface EnhancedExpenseTableV2Props {
  expenses: Expense[];
  selectedExpenseIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onEditClick?: (expenseId: string) => void;
  onRowClick?: (expenseId: string) => void;
  onToggleExpand?: (expenseId: string) => void;
  expandedExpenseId?: string | null;
  isLoading?: boolean;
  isMobile?: boolean;
  showSubmitterColumn?: boolean;
  showAIIndicators?: boolean;
  compactMode?: boolean;
}

// Enhanced status color system
const getStatusColorScheme = (status: string, aiContext: ProcessingMethod) => {
  const baseColors = {
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    submitted: 'bg-blue-100 text-blue-700 border-blue-200',
    pending_review: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    info_requested: 'bg-orange-100 text-orange-700 border-orange-200',
  };

  const aiModifier = aiContext === 'ai' ? 'ring-1 ring-blue-300' :
                    aiContext === 'hybrid' ? 'ring-1 ring-purple-300' : '';

  return `${baseColors[status as keyof typeof baseColors] || baseColors.draft} ${aiModifier}`;
};

// Urgency level styling
const getUrgencyIndicator = (urgency: UrgencyLevel) => {
  switch (urgency) {
    case 'high':
      return <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />;
    case 'medium':
      return <div className="w-2 h-2 bg-amber-500 rounded-full" />;
    case 'low':
      return <div className="w-2 h-2 bg-green-500 rounded-full" />;
    default:
      return <div className="w-2 h-2 bg-gray-300 rounded-full" />;
  }
};

// Get processing method from expense data
const getProcessingMethod = (expense: Expense): ProcessingMethod => {
  if (expense.ingrid_processed && expense.manual_overrides.length > 0) {
    return 'hybrid';
  }
  return expense.ingrid_processed ? 'ai' : 'manual';
};

// Calculate overall field confidence
const getOverallConfidence = (expense: Expense): number => {
  if (!expense.ingrid_field_confidences || Object.keys(expense.ingrid_field_confidences).length === 0) {
    return 0;
  }

  const confidences = Object.values(expense.ingrid_field_confidences);
  return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
};

const EnhancedExpenseTableV2Component: React.FC<EnhancedExpenseTableV2Props> = ({
  expenses,
  selectedExpenseIds,
  onSelectionChange,
  onEditClick,
  onRowClick,
  onToggleExpand,
  expandedExpenseId: controlledExpandedId,
  isLoading = false,
  isMobile = false,
  showSubmitterColumn = true,
  showAIIndicators = true,
  compactMode = false
}) => {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [internalExpandedId, setInternalExpandedId] = useState<string | null>(null);

  // Use controlled expansion if provided, otherwise use internal state
  const expandedExpenseId = controlledExpandedId !== undefined ? controlledExpandedId : internalExpandedId;

  const isAllSelected = expenses.length > 0 && selectedExpenseIds.length === expenses.length;
  const isIndeterminate = selectedExpenseIds.length > 0 && selectedExpenseIds.length < expenses.length;

  // Memoized calculations for performance
  const enhancedExpenses = useMemo(() => {
    return expenses.map(expense => ({
      ...expense,
      processingMethod: getProcessingMethod(expense),
      overallConfidence: getOverallConfidence(expense),
      urgencyLevel: expense.urgency_level || 'low' as UrgencyLevel,
      receiptCount: expense.receipt_count || 0,
      hasReceipt: expense.has_receipt || false
    }));
  }, [expenses]);

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
    // Don't trigger row click if clicking on interactive elements
    if (
      event.target instanceof Element &&
      (event.target.closest('[data-checkbox]') ||
       event.target.closest('[data-action]') ||
       event.target.closest('button'))
    ) {
      return;
    }
    onRowClick?.(expenseId);
  }, [onRowClick]);

  const handleToggleExpand = useCallback((expenseId: string) => {
    if (onToggleExpand) {
      // Controlled mode - let parent handle the state
      onToggleExpand(expenseId);
    } else {
      // Uncontrolled mode - manage state internally
      setInternalExpandedId(current => current === expenseId ? null : expenseId);
    }
  }, [onToggleExpand]);

  if (isMobile) {
    return (
      <div className="space-y-3">
        {enhancedExpenses.map((expense) => (
          <motion.div
            key={expense.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="overflow-hidden border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    data-checkbox
                    checked={selectedExpenseIds.includes(expense.id)}
                    onCheckedChange={() => handleSelectExpense(expense.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <ExpandableExpenseRow
                      expense={expense}
                      isExpanded={expandedExpenseId === expense.id}
                      onToggleExpand={() => handleToggleExpand(expense.id)}
                      onEditClick={onEditClick}
                      showAIIndicators={showAIIndicators}
                      compactMode={true}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-gray-50/50">
          <TableRow className="border-b border-gray-200">
            <TableHead className="w-12 pl-6">
              <Checkbox
                data-checkbox
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="w-8"></TableHead> {/* Expand icon */}
            {showAIIndicators && (
              <TableHead className="w-16 text-center">
                <Brain className="h-4 w-4 mx-auto text-blue-500" />
              </TableHead>
            )}
            <TableHead className="font-semibold text-gray-900">Amount</TableHead>
            <TableHead className="font-semibold text-gray-900">Description</TableHead>
            <TableHead className="font-semibold text-gray-900">Vendor</TableHead>
            <TableHead className="font-semibold text-gray-900">Date</TableHead>
            <TableHead className="font-semibold text-gray-900">Status</TableHead>
            {showSubmitterColumn && (
              <TableHead className="font-semibold text-gray-900">Submitter</TableHead>
            )}
            <TableHead className="w-20 text-center font-semibold text-gray-900">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <AnimatePresence>
            {enhancedExpenses.map((expense, index) => (
              <React.Fragment key={expense.id}>
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, delay: index * 0.02 }}
                  className={cn(
                    "group hover:bg-gray-50/50 transition-all duration-150 cursor-pointer border-b border-gray-100",
                    selectedExpenseIds.includes(expense.id) && "bg-blue-50/30 hover:bg-blue-50/50",
                    expandedExpenseId === expense.id && "bg-blue-50/20"
                  )}
                  onMouseEnter={() => setHoveredRowId(expense.id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  onClick={(e) => handleRowClick(expense.id, e)}
                >
                  {/* Selection Checkbox */}
                  <TableCell className="pl-6">
                    <Checkbox
                      data-checkbox
                      checked={selectedExpenseIds.includes(expense.id)}
                      onCheckedChange={() => handleSelectExpense(expense.id)}
                    />
                  </TableCell>

                  {/* Expand Toggle */}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpand(expense.id);
                      }}
                      className="h-6 w-6 p-0 hover:bg-gray-100"
                    >
                      <motion.div
                        animate={{ rotate: expandedExpenseId === expense.id ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </motion.div>
                    </Button>
                  </TableCell>

                  {/* AI Indicator */}
                  {showAIIndicators && (
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <ProcessingMethodBadge method={expense.processingMethod} size="sm" />
                        {expense.ingrid_processed && (
                          <ConfidenceBadge
                            confidence={expense.overallConfidence}
                            size="xs"
                          />
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Amount with AI indicator */}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-lg font-semibold",
                        expense.amount >= 1000 ? "text-red-600" : "text-gray-900"
                      )}>
                        {formatCurrency(expense.amount, expense.currency_code)}
                      </span>
                      {showAIIndicators && expense.field_sources?.amount && (
                        <FieldSourceIcon source={expense.field_sources.amount} size="sm" />
                      )}
                    </div>
                  </TableCell>

                  {/* Description */}
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="truncate text-gray-900">
                        {truncateText(expense.description || expense.title, 40)}
                      </span>
                      {showAIIndicators && expense.field_sources?.description && (
                        <FieldSourceIcon source={expense.field_sources.description} size="sm" />
                      )}
                    </div>
                  </TableCell>

                  {/* Vendor */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">
                        {truncateText(expense.vendor_name || 'Unknown', 25)}
                      </span>
                      {showAIIndicators && expense.field_sources?.vendor_name && (
                        <FieldSourceIcon source={expense.field_sources.vendor_name} size="sm" />
                      )}
                    </div>
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">
                        {format(new Date(expense.expense_date), 'MMM dd, yyyy')}
                      </span>
                      {showAIIndicators && expense.field_sources?.expense_date && (
                        <FieldSourceIcon source={expense.field_sources.expense_date} size="sm" />
                      )}
                    </div>
                  </TableCell>

                  {/* Status with AI context */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getUrgencyIndicator(expense.urgencyLevel)}
                      <Badge
                        className={cn(
                          "text-xs font-medium border",
                          getStatusColorScheme(expense.status, expense.processingMethod)
                        )}
                      >
                        {expense.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </TableCell>

                  {/* Submitter */}
                  {showSubmitterColumn && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {expense.submitter_full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-gray-600 truncate max-w-24">
                          {expense.submitter_full_name || expense.submitter_email}
                        </span>
                      </div>
                    </TableCell>
                  )}

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {expense.hasReceipt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle receipt view
                          }}
                        >
                          <Receipt className="h-3 w-3 text-gray-500" />
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            data-action
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-gray-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => onRowClick?.(expense.id)}>
                            <Eye className="mr-2 h-3 w-3" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditClick?.(expense.id)}>
                            <Edit className="mr-2 h-3 w-3" />
                            Edit
                          </DropdownMenuItem>
                          {expense.ingrid_processed && (
                            <DropdownMenuItem>
                              <Brain className="mr-2 h-3 w-3" />
                              AI Analysis
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </motion.tr>

                {/* Expandable Row Content */}
                {expandedExpenseId === expense.id && (
                  <motion.tr
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <TableCell colSpan={showSubmitterColumn ? 8 + (showAIIndicators ? 1 : 0) : 7 + (showAIIndicators ? 1 : 0)} className="p-0">
                      <ExpandableExpenseRow
                        expense={expense}
                        isExpanded={true}
                        onToggleExpand={() => handleToggleExpand(expense.id)}
                        onEditClick={onEditClick}
                        showAIIndicators={showAIIndicators}
                        compactMode={compactMode}
                      />
                    </TableCell>
                  </motion.tr>
                )}
              </React.Fragment>
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-gray-500">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Clock className="h-5 w-5" />
            </motion.div>
            Loading expenses...
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && expenses.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Receipt className="h-12 w-12 mb-3 text-gray-300" />
          <p className="text-lg font-medium">No expenses found</p>
          <p className="text-sm">Start by creating your first expense with Ingrid AI</p>
        </div>
      )}
    </div>
  );
};

export const EnhancedExpenseTableV2 = memo(EnhancedExpenseTableV2Component);