/**
 * Dual Column Invoice View Component
 *
 * Sleek dual-column layout with source document on the left and
 * AI-extracted invoice data on the right. Compact yet legible design.
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Mail,
  CreditCard,
  Hash,
  DollarSign,
  PlusCircle,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  InvoiceStructure,
  InvoiceLineItem,
  InvoiceHeader,
  EnhancedTaxLineItem,
  InvoiceSummary
} from '@/types/expenses';
import FormattedCurrencyDisplay from '@/components/FormattedCurrencyDisplay';

export interface DualColumnInvoiceViewProps {
  invoiceData: InvoiceStructure;
  documentUrl?: string | null;
  documentFile?: File | null;
  onFieldEdit?: (fieldPath: string, newValue: any) => void;
  onLineItemEdit?: (lineIndex: number, field: string, value: any) => void;
  onTaxEdit?: (taxIndex: number, field: string, value: any) => void;
  onAddLineItem?: () => void;
  onRemoveLineItem?: (lineIndex: number) => void;
  editable?: boolean;
  className?: string;
}

// Document Preview Component
const DocumentPreview: React.FC<{
  documentUrl?: string | null;
  documentFile?: File | null;
  className?: string;
}> = ({ documentUrl, documentFile, className }) => {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (documentFile) {
      const url = URL.createObjectURL(documentFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (documentUrl) {
      setPreviewUrl(documentUrl);
    }
  }, [documentFile, documentUrl]);

  if (!previewUrl) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-muted/30 rounded-lg border-2 border-dashed", className)}>
        <div className="text-center text-muted-foreground">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No document available</p>
        </div>
      </div>
    );
  }

  const isImage = documentFile?.type.startsWith('image/') || previewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  if (isImage) {
    return (
      <div className={cn("h-full rounded-lg overflow-hidden bg-muted/10", className)}>
        <img
          src={previewUrl}
          alt="Document preview"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // For PDFs and other documents
  return (
    <div className={cn("h-full rounded-lg overflow-hidden bg-white", className)}>
      <iframe
        src={previewUrl}
        className="w-full h-full border-0"
        title="Document preview"
      />
    </div>
  );
};

// Confidence Badge Component
const ConfidenceBadge: React.FC<{ confidence: number; className?: string }> = ({ confidence, className }) => {
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return "bg-green-100 text-green-800 border-green-200";
    if (conf >= 0.6) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getConfidenceIcon = (conf: number) => {
    if (conf >= 0.8) return <CheckCircle className="h-3 w-3" />;
    if (conf >= 0.6) return <Clock className="h-3 w-3" />;
    return <AlertTriangle className="h-3 w-3" />;
  };

  return (
    <Badge variant="outline" className={cn(getConfidenceColor(confidence), "text-xs px-1.5 py-0.5", className)}>
      {getConfidenceIcon(confidence)}
      <span className="ml-1">{Math.round(confidence * 100)}%</span>
    </Badge>
  );
};

// Editable Field Component
const EditableField: React.FC<{
  value: string | number | null;
  onEdit?: (newValue: any) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'date' | 'textarea';
  confidence?: number;
  editable?: boolean;
  className?: string;
  compact?: boolean;
}> = ({
  value,
  onEdit,
  placeholder = "Not specified",
  type = 'text',
  confidence,
  editable = true,
  className,
  compact = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || '');

  const handleSave = useCallback(() => {
    if (onEdit) {
      const processedValue = type === 'number' ? parseFloat(editValue) || 0 : editValue;
      onEdit(processedValue);
    }
    setIsEditing(false);
  }, [editValue, onEdit, type]);

  const handleCancel = useCallback(() => {
    setEditValue(value?.toString() || '');
    setIsEditing(false);
  }, [value]);

  if (!editable || !onEdit) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className={cn("text-sm", value ? "text-foreground" : "text-muted-foreground italic")}>
          {value || placeholder}
        </span>
        {confidence && <ConfidenceBadge confidence={confidence} />}
      </div>
    );
  }

  if (isEditing) {
    const inputClass = compact ? "h-7 text-xs" : "h-8 text-sm";

    return (
      <div className={cn("flex items-center gap-1", className)}>
        {type === 'textarea' ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className={cn("min-h-[60px] text-xs", compact && "min-h-[50px]")}
            placeholder={placeholder}
          />
        ) : (
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className={inputClass}
            placeholder={placeholder}
          />
        )}
        <Button size="sm" variant="ghost" onClick={handleSave} className="h-6 w-6 p-0">
          <Check className="h-3 w-3 text-green-600" />
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel} className="h-6 w-6 p-0">
          <X className="h-3 w-3 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <span
        className={cn(
          "text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded transition-colors",
          value ? "text-foreground" : "text-muted-foreground italic"
        )}
        onClick={() => setIsEditing(true)}
      >
        {value || placeholder}
      </span>
      {confidence && <ConfidenceBadge confidence={confidence} />}
      <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity cursor-pointer" onClick={() => setIsEditing(true)} />
    </div>
  );
};

export const DualColumnInvoiceView: React.FC<DualColumnInvoiceViewProps> = ({
  invoiceData,
  documentUrl,
  documentFile,
  onFieldEdit,
  onLineItemEdit,
  onTaxEdit,
  onAddLineItem,
  onRemoveLineItem,
  editable = true,
  className
}) => {
  const { header, lineItems, taxBreakdown, summary, metadata } = invoiceData;

  const handleFieldEdit = useCallback((fieldPath: string, newValue: any) => {
    onFieldEdit?.(fieldPath, newValue);
  }, [onFieldEdit]);

  return (
    <div className={cn("h-full flex gap-4", className)}>
      {/* Left Column - Document Preview */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Source Document</span>
        </div>
        <DocumentPreview
          documentUrl={documentUrl}
          documentFile={documentFile}
          className="flex-1 min-h-0"
        />
      </div>

      {/* Right Column - Invoice Data */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-muted-foreground">
            {header.confidence.overallConfidence > 0.3 ? 'AI Extracted Data' : 'Manual Entry Required'}
          </span>
          {header.confidence.overallConfidence > 0.3 && (
            <ConfidenceBadge confidence={header.confidence.overallConfidence} />
          )}
        </div>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4">
            {/* Manual entry prompt when AI confidence is low */}
            {header.confidence.overallConfidence <= 0.3 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Manual Entry Mode</span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  AI couldn't extract data from your document. Please fill in the fields below by clicking on them.
                </p>
              </div>
            )}
            {/* Invoice Header */}
            <Card className="p-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-2">
                  <div>
                    <label className="text-muted-foreground flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      Invoice #
                    </label>
                    <EditableField
                      value={header.invoiceNumber}
                      onEdit={(val) => handleFieldEdit('header.invoiceNumber', val)}
                      placeholder="No invoice number"
                      confidence={header.confidence.invoiceNumber}
                      editable={editable}
                      compact
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Issue Date
                    </label>
                    <EditableField
                      value={header.issueDate ? format(header.issueDate, 'MMM dd, yyyy') : null}
                      onEdit={(val) => handleFieldEdit('header.issueDate', val)}
                      placeholder="No date"
                      type="date"
                      confidence={header.confidence.issueDate}
                      editable={editable}
                      compact
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-muted-foreground">PO Number</label>
                    <EditableField
                      value={header.purchaseOrderNumber}
                      onEdit={(val) => handleFieldEdit('header.purchaseOrderNumber', val)}
                      placeholder="No PO number"
                      confidence={header.confidence.purchaseOrderNumber}
                      editable={editable}
                      compact
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground">Due Date</label>
                    <EditableField
                      value={header.dueDate ? format(header.dueDate, 'MMM dd, yyyy') : null}
                      onEdit={(val) => handleFieldEdit('header.dueDate', val)}
                      placeholder="No due date"
                      type="date"
                      confidence={header.confidence.dueDate}
                      editable={editable}
                      compact
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Vendor Information */}
            <Card className="p-3">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Vendor Information
                </CardTitle>
              </CardHeader>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-muted-foreground">Company Name</label>
                  <EditableField
                    value={header.vendorName}
                    onEdit={(val) => handleFieldEdit('header.vendorName', val)}
                    placeholder="Unknown vendor"
                    confidence={header.confidence.vendorName}
                    editable={editable}
                    compact
                  />
                </div>
                {header.vendorAddress && (
                  <div>
                    <label className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Address
                    </label>
                    <EditableField
                      value={header.vendorAddress}
                      onEdit={(val) => handleFieldEdit('header.vendorAddress', val)}
                      placeholder="No address"
                      type="textarea"
                      confidence={header.confidence.vendorAddress}
                      editable={editable}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {header.vendorPhone && (
                    <div>
                      <label className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Phone
                      </label>
                      <EditableField
                        value={header.vendorPhone}
                        onEdit={(val) => handleFieldEdit('header.vendorPhone', val)}
                        placeholder="No phone"
                        confidence={header.confidence.vendorContact}
                        editable={editable}
                        compact
                      />
                    </div>
                  )}
                  {header.vendorEmail && (
                    <div>
                      <label className="text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Email
                      </label>
                      <EditableField
                        value={header.vendorEmail}
                        onEdit={(val) => handleFieldEdit('header.vendorEmail', val)}
                        placeholder="No email"
                        confidence={header.confidence.vendorContact}
                        editable={editable}
                        compact
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Line Items */}
            {(lineItems.length > 0 || editable) && (
              <Card className="p-3">
                <CardHeader className="p-0 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Line Items</CardTitle>
                    {editable && onAddLineItem && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddLineItem}
                        className="h-7 px-2 text-xs"
                      >
                        <PlusCircle className="h-3 w-3 mr-1" />
                        Add Line Item
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <div className="space-y-2">
                  {lineItems.length > 0 ? (
                    lineItems.map((item, index) => (
                      <div key={index} className="border rounded-lg p-2 bg-muted/5">
                        <div className="grid grid-cols-12 gap-2 items-center text-xs">
                          <div className="col-span-5">
                            <EditableField
                              value={item.description}
                              onEdit={(val) => onLineItemEdit?.(index, 'description', val)}
                              placeholder="Item description"
                              confidence={item.confidence}
                              editable={editable}
                              compact
                            />
                          </div>
                          <div className="col-span-2 text-center">
                            <EditableField
                              value={item.quantity}
                              onEdit={(val) => onLineItemEdit?.(index, 'quantity', val)}
                              placeholder="Qty"
                              type="number"
                              editable={editable}
                              compact
                            />
                          </div>
                          <div className="col-span-2 text-right">
                            <FormattedCurrencyDisplay
                              amount={item.unit_price || 0}
                              currencyCode={item.currency_code}
                              className="text-xs"
                            />
                          </div>
                          <div className="col-span-2 text-right font-medium">
                            <FormattedCurrencyDisplay
                              amount={item.line_amount}
                              currencyCode={item.currency_code}
                              className="text-xs"
                            />
                          </div>
                          {editable && onRemoveLineItem && (
                            <div className="col-span-1 flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveLineItem(index)}
                                className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                                title="Remove line item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      {editable ? 'No line items found. Click "Add Line Item" to manually add items.' : 'No line items found.'}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Summary */}
            <Card className="p-3">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Invoice Summary
                </CardTitle>
              </CardHeader>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <FormattedCurrencyDisplay
                    amount={summary.subtotal}
                    currencyCode={summary.currency}
                    className="text-xs"
                  />
                </div>
                {summary.taxLines.map((tax, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      {tax.taxType} ({(tax.rate * 100).toFixed(1)}%)
                      <ConfidenceBadge confidence={tax.confidence} />
                    </span>
                    <FormattedCurrencyDisplay
                      amount={tax.taxAmount}
                      currencyCode={summary.currency}
                      className="text-xs"
                    />
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between font-medium text-sm">
                  <span>Total</span>
                  <div className="flex items-center gap-2">
                    <FormattedCurrencyDisplay
                      amount={summary.grandTotal}
                      currencyCode={summary.currency}
                      className="text-sm font-semibold"
                    />
                    <ConfidenceBadge confidence={summary.currencyConfidence} />
                  </div>
                </div>
                {summary.hasCompanyMismatch && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    {summary.currencyReason}
                  </div>
                )}
              </div>
            </Card>

            {/* Processing Metadata */}
            <Card className="p-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Processing Method</span>
                  <Badge variant="outline" className="text-xs px-2 py-0">
                    {metadata.processingMethod}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Document Quality</span>
                  <span className="capitalize">{metadata.documentQuality}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing Time</span>
                  <span>{metadata.processingTime}ms</span>
                </div>
                {metadata.extractionWarnings.length > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                    <div className="text-amber-800 text-xs">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Warnings:
                    </div>
                    <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                      {metadata.extractionWarnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default DualColumnInvoiceView;