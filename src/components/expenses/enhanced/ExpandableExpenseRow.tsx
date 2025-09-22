/**
 * Expandable Expense Row Component
 *
 * Detailed view component that shows expanded expense information including
 * AI analysis, receipt previews, and field-level confidence indicators.
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Brain,
  Receipt,
  Edit,
  Eye,
  Calendar,
  DollarSign,
  Building,
  Tag,
  FileText,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  User,
  MapPin,
  CreditCard,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { Expense, FieldSource } from '@/types/expenses';
import { ConfidenceBadge } from '../indicators/ConfidenceBadge';
import { FieldSourceIcon } from '../indicators/FieldSourceIcon';
import { AIAnalysisCard } from './AIAnalysisCard';
import { ReceiptThumbnail } from './ReceiptThumbnail';

export interface ExpandableExpenseRowProps {
  expense: Expense & {
    processingMethod: 'ai' | 'manual' | 'hybrid';
    overallConfidence: number;
    urgencyLevel: 'low' | 'medium' | 'high';
    receiptCount: number;
    hasReceipt: boolean;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditClick?: (expenseId: string) => void;
  showAIIndicators?: boolean;
  compactMode?: boolean;
}

// Field display component with AI indicators
const FieldDisplay: React.FC<{
  label: string;
  value: string | number | null;
  source?: FieldSource;
  confidence?: number;
  icon?: React.ReactNode;
  showAIIndicators?: boolean;
  format?: 'currency' | 'date' | 'text';
  currency?: string;
}> = ({ label, value, source, confidence, icon, showAIIndicators, format, currency }) => {
  const formatValue = () => {
    if (!value) return 'Not specified';

    switch (format) {
      case 'currency':
        return formatCurrency(Number(value), currency || 'USD');
      case 'date':
        return format ? format(new Date(value), 'PPP') : String(value);
      default:
        return String(value);
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {icon && <span className="text-gray-400 flex-shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-sm font-medium text-gray-900 truncate">
            {formatValue()}
          </p>
        </div>
      </div>

      {showAIIndicators && source && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <FieldSourceIcon source={source} size="sm" />
          {confidence !== undefined && (
            <ConfidenceBadge confidence={confidence} size="xs" />
          )}
        </div>
      )}
    </div>
  );
};

const ExpandableExpenseRowComponent: React.FC<ExpandableExpenseRowProps> = ({
  expense,
  isExpanded,
  onToggleExpand,
  onEditClick,
  showAIIndicators = true,
  compactMode = false
}) => {
  const {
    processingMethod,
    overallConfidence,
    urgencyLevel,
    receiptCount,
    hasReceipt
  } = expense;

  // Determine if this is a mobile/compact card view or expanded table row
  const isCardView = !isExpanded;

  if (isCardView) {
    // Compact card view for mobile or summary display
    return (
      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {expense.title || expense.description}
                </h3>
                {showAIIndicators && processingMethod === 'ai' && (
                  <Brain className="h-4 w-4 text-blue-500" />
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="font-medium">
                  {formatCurrency(expense.amount, expense.currency_code)}
                </span>
                <span>{expense.vendor_name || 'Unknown vendor'}</span>
                <span>{format(new Date(expense.expense_date), 'MMM dd')}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {expense.status.replace('_', ' ').toUpperCase()}
              </Badge>

              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showAIIndicators && processingMethod === 'ai' && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-gray-500">
                Processed by Ingrid AI
              </span>
              <ConfidenceBadge confidence={overallConfidence} size="xs" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full expanded view
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="bg-gradient-to-r from-gray-50 to-white border-t border-gray-100"
    >
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {expense.title || expense.description}
                </h3>
                <p className="text-sm text-gray-600">
                  Expense ID: {expense.id.slice(0, 8)}...
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditClick?.(expense.id)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpand}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Collapse
                </Button>
              </div>
            </div>

            {/* Expense Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <FieldDisplay
                label="Amount"
                value={expense.amount}
                source={expense.field_sources?.amount}
                confidence={expense.ingrid_field_confidences?.amount}
                icon={<DollarSign className="h-4 w-4" />}
                showAIIndicators={showAIIndicators}
                format="currency"
                currency={expense.currency_code}
              />

              <FieldDisplay
                label="Expense Date"
                value={expense.expense_date}
                source={expense.field_sources?.expense_date}
                confidence={expense.ingrid_field_confidences?.expense_date}
                icon={<Calendar className="h-4 w-4" />}
                showAIIndicators={showAIIndicators}
                format="date"
              />

              <FieldDisplay
                label="Vendor"
                value={expense.vendor_name}
                source={expense.field_sources?.vendor_name}
                confidence={expense.ingrid_field_confidences?.vendor_name}
                icon={<Building className="h-4 w-4" />}
                showAIIndicators={showAIIndicators}
              />

              <FieldDisplay
                label="Category"
                value={expense.category_name}
                source={expense.field_sources?.category}
                confidence={expense.ingrid_field_confidences?.category}
                icon={<Tag className="h-4 w-4" />}
                showAIIndicators={showAIIndicators}
              />

              {expense.gl_account_code && (
                <FieldDisplay
                  label="GL Account"
                  value={`${expense.gl_account_code} - ${expense.gl_account_name}`}
                  source={expense.field_sources?.gl_account_code}
                  confidence={expense.ingrid_field_confidences?.gl_account_code}
                  icon={<CreditCard className="h-4 w-4" />}
                  showAIIndicators={showAIIndicators}
                />
              )}

              <FieldDisplay
                label="Status"
                value={expense.status.replace('_', ' ').toUpperCase()}
                icon={<CheckCircle className="h-4 w-4" />}
                showAIIndicators={false}
              />

              {expense.project_code && (
                <FieldDisplay
                  label="Project Code"
                  value={expense.project_code}
                  icon={<FileText className="h-4 w-4" />}
                  showAIIndicators={false}
                />
              )}

              {expense.merchant_address && (
                <FieldDisplay
                  label="Merchant Address"
                  value={expense.merchant_address}
                  icon={<MapPin className="h-4 w-4" />}
                  showAIIndicators={false}
                />
              )}
            </div>

            {/* Description */}
            {expense.description && expense.description !== expense.title && (
              <div className="space-y-2">
                <Separator />
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {expense.description}
                  </p>
                </div>
              </div>
            )}

            {/* Tags */}
            {expense.tags && expense.tags.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {expense.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submitter Info */}
            <div className="space-y-2">
              <Separator />
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-sm">
                    {expense.submitter_full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {expense.submitter_full_name || 'Unknown User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Submitted on {format(new Date(expense.created_at), 'PPP')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Receipt Preview */}
            {hasReceipt && (
              <ReceiptThumbnail
                expense={expense}
                showCount={receiptCount > 1}
              />
            )}

            {/* AI Analysis */}
            {showAIIndicators && expense.ingrid_processed && (
              <AIAnalysisCard
                expense={expense}
                overallConfidence={overallConfidence}
                processingMethod={processingMethod}
              />
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onEditClick?.(expense.id)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Expense
                </Button>

                {hasReceipt && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    View Receipt
                  </Button>
                )}

                {expense.ingrid_processed && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI Analysis
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Processing Info */}
            <Card className="border-blue-100 bg-blue-50/30">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Processing Method</span>
                    <Badge variant={processingMethod === 'ai' ? 'default' : 'secondary'}>
                      {processingMethod.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Urgency Level</span>
                    <Badge variant={urgencyLevel === 'high' ? 'destructive' :
                                  urgencyLevel === 'medium' ? 'default' : 'secondary'}>
                      {urgencyLevel.toUpperCase()}
                    </Badge>
                  </div>

                  {expense.processing_time_ms && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Processing Time</span>
                      <span className="font-medium">
                        {expense.processing_time_ms}ms
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ExpandableExpenseRow = memo(ExpandableExpenseRowComponent);