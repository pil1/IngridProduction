/**
 * Invoice View Component
 *
 * Professional invoice-style display for AI-extracted expense data.
 * Presents expense information in a clean, invoice-like format with
 * confidence indicators and inline editing capabilities.
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Building2,
  Calendar,
  FileText,
  Edit3,
  Check,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles,
  Eye,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  InvoiceStructure,
  InvoiceLineItem,
  InvoiceHeader,
  EnhancedTaxLineItem,
  InvoiceSummary,
  FieldSource
} from '@/types/expenses';
import FormattedCurrencyDisplay from '@/components/FormattedCurrencyDisplay';

export interface InvoiceViewProps {
  invoiceData: InvoiceStructure;
  onFieldEdit?: (fieldPath: string, newValue: any) => void;
  onLineItemEdit?: (lineIndex: number, field: string, value: any) => void;
  onTaxEdit?: (taxIndex: number, field: string, value: any) => void;
  editable?: boolean;
  showConfidence?: boolean;
  compact?: boolean;
  className?: string;
}

interface FieldEditState {
  path: string;
  value: any;
  originalValue: any;
}

// Helper component for confidence indicators
const ConfidenceIndicator: React.FC<{
  confidence: number;
  className?: string;
  size?: 'sm' | 'md';
}> = ({ confidence, className, size = 'md' }) => {
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'bg-green-500';
    if (conf >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 0.8) return 'High';
    if (conf >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div
        className={cn(
          'rounded-full',
          getConfidenceColor(confidence),
          size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
        )}
      />
      <span className={cn('text-xs text-muted-foreground', size === 'sm' && 'text-xs')}>
        {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
      </span>
    </div>
  );
};

// Editable field component
const EditableField: React.FC<{
  value: any;
  confidence?: number;
  onSave: (newValue: any) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  displayClassName?: string;
}> = ({
  value,
  confidence,
  onSave,
  placeholder,
  multiline = false,
  className,
  displayClassName
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || '');

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="min-h-[60px]"
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
        )}
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-between hover:bg-muted/50 px-2 py-1 rounded cursor-pointer',
        displayClassName
      )}
      onClick={() => setIsEditing(true)}
    >
      <span className={cn(!value && 'text-muted-foreground')}>
        {value || placeholder || 'Click to edit'}
      </span>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {confidence !== undefined && (
          <ConfidenceIndicator confidence={confidence} size="sm" />
        )}
        <Edit3 className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
};

export const InvoiceView: React.FC<InvoiceViewProps> = ({
  invoiceData,
  onFieldEdit,
  onLineItemEdit,
  onTaxEdit,
  editable = false,
  showConfidence = true,
  compact = false,
  className
}) => {
  const { header, lineItems, taxBreakdown, summary, metadata } = invoiceData;

  const handleFieldEdit = useCallback((fieldPath: string, newValue: any) => {
    onFieldEdit?.(fieldPath, newValue);
  }, [onFieldEdit]);

  const formatCurrency = (amount: number, currency?: string) => {
    return <FormattedCurrencyDisplay
      amount={amount}
      currencyCode={currency || summary.currency || 'USD'}
    />;
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Invoice Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice
            </CardTitle>
            {showConfidence && metadata && (
              <div className="flex items-center gap-4">
                <Badge variant={metadata.documentQuality === 'excellent' ? 'default' : 'secondary'}>
                  {metadata.documentQuality} quality
                </Badge>
                <ConfidenceIndicator confidence={header.confidence.overallConfidence} />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vendor Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Building2 className="h-4 w-4" />
                VENDOR
              </div>
              <div className="space-y-2">
                {editable ? (
                  <EditableField
                    value={header.vendorName}
                    confidence={showConfidence ? header.confidence.vendorName : undefined}
                    onSave={(value) => handleFieldEdit('header.vendorName', value)}
                    placeholder="Vendor name"
                    className="font-semibold text-lg"
                  />
                ) : (
                  <div className="font-semibold text-lg">{header.vendorName}</div>
                )}

                {header.vendorAddress && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    {editable ? (
                      <EditableField
                        value={header.vendorAddress}
                        confidence={showConfidence ? header.confidence.vendorAddress : undefined}
                        onSave={(value) => handleFieldEdit('header.vendorAddress', value)}
                        placeholder="Vendor address"
                        multiline
                      />
                    ) : (
                      <span className="whitespace-pre-line">{header.vendorAddress}</span>
                    )}
                  </div>
                )}

                {header.vendorPhone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {editable ? (
                      <EditableField
                        value={header.vendorPhone}
                        onSave={(value) => handleFieldEdit('header.vendorPhone', value)}
                        placeholder="Phone number"
                      />
                    ) : (
                      <span>{header.vendorPhone}</span>
                    )}
                  </div>
                )}

                {header.vendorEmail && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {editable ? (
                      <EditableField
                        value={header.vendorEmail}
                        onSave={(value) => handleFieldEdit('header.vendorEmail', value)}
                        placeholder="Email address"
                      />
                    ) : (
                      <span>{header.vendorEmail}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Details */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground">INVOICE DETAILS</div>
              <div className="space-y-2">
                {header.invoiceNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Invoice #:</span>
                    {editable ? (
                      <EditableField
                        value={header.invoiceNumber}
                        confidence={showConfidence ? header.confidence.invoiceNumber : undefined}
                        onSave={(value) => handleFieldEdit('header.invoiceNumber', value)}
                        placeholder="Invoice number"
                      />
                    ) : (
                      <span className="font-mono">{header.invoiceNumber}</span>
                    )}
                  </div>
                )}

                {header.issueDate && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Date:</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {editable ? (
                        <EditableField
                          value={format(header.issueDate, 'yyyy-MM-dd')}
                          confidence={showConfidence ? header.confidence.issueDate : undefined}
                          onSave={(value) => handleFieldEdit('header.issueDate', new Date(value))}
                          placeholder="YYYY-MM-DD"
                        />
                      ) : (
                        <span>{format(header.issueDate, 'PPP')}</span>
                      )}
                    </div>
                  </div>
                )}

                {header.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Due Date:</span>
                    <span className="text-sm">{format(header.dueDate, 'PPP')}</span>
                  </div>
                )}

                {header.purchaseOrderNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">PO #:</span>
                    <span className="font-mono text-sm">{header.purchaseOrderNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Description</TableHead>
                {!compact && <TableHead className="text-right">Qty</TableHead>}
                {!compact && <TableHead className="text-right">Unit Price</TableHead>}
                <TableHead className="text-right">Amount</TableHead>
                {showConfidence && <TableHead className="w-20">Confidence</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">{item.lineNumber || index + 1}</TableCell>
                  <TableCell>
                    {editable ? (
                      <EditableField
                        value={item.description}
                        onSave={(value) => onLineItemEdit?.(index, 'description', value)}
                        placeholder="Item description"
                      />
                    ) : (
                      <div>
                        <div className="font-medium">{item.description}</div>
                        {item.productCode && (
                          <div className="text-xs text-muted-foreground">SKU: {item.productCode}</div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  {!compact && (
                    <TableCell className="text-right">
                      {item.quantity ? (
                        editable ? (
                          <EditableField
                            value={item.quantity}
                            onSave={(value) => onLineItemEdit?.(index, 'quantity', parseFloat(value))}
                            placeholder="Qty"
                          />
                        ) : (
                          item.quantity
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  {!compact && (
                    <TableCell className="text-right">
                      {item.unit_price ? (
                        editable ? (
                          <EditableField
                            value={item.unit_price}
                            onSave={(value) => onLineItemEdit?.(index, 'unit_price', parseFloat(value))}
                            placeholder="Unit price"
                          />
                        ) : (
                          formatCurrency(item.unit_price, item.currency_code)
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-medium">
                    {editable ? (
                      <EditableField
                        value={item.line_amount}
                        onSave={(value) => onLineItemEdit?.(index, 'line_amount', parseFloat(value))}
                        placeholder="Amount"
                      />
                    ) : (
                      formatCurrency(item.line_amount, item.currency_code)
                    )}
                  </TableCell>
                  {showConfidence && (
                    <TableCell>
                      <ConfidenceIndicator confidence={item.confidence} size="sm" />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tax Breakdown & Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tax Breakdown */}
          {taxBreakdown.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Tax Breakdown</h4>
              {taxBreakdown.map((tax, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span>{tax.taxType} ({(tax.rate * 100).toFixed(1)}%)</span>
                    {tax.jurisdiction && (
                      <Badge variant="outline" className="text-xs">
                        {tax.jurisdiction}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {formatCurrency(tax.taxAmount, summary.currency)}
                    {showConfidence && (
                      <ConfidenceIndicator confidence={tax.confidence} size="sm" />
                    )}
                  </div>
                </div>
              ))}
              <Separator />
            </div>
          )}

          {/* Summary Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(summary.subtotal, summary.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Tax:</span>
              <span>{formatCurrency(summary.totalTax, summary.currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total:</span>
              <span>{formatCurrency(summary.grandTotal, summary.currency)}</span>
            </div>
          </div>

          {/* Processing Information */}
          {metadata && showConfidence && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {metadata.processingMethod === 'ai_extracted' ? 'AI Extracted' :
                     metadata.processingMethod === 'manual_entry' ? 'Manual Entry' : 'Hybrid'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {metadata.processingTime}ms
                  </div>
                </div>
                {metadata.reviewRequired && (
                  <div className="flex items-center gap-1 text-orange-600">
                    <AlertTriangle className="h-3 w-3" />
                    Review Required
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceView;