/**
 * Invoice Style Expense Modal
 *
 * A comprehensive invoice-style interface for expense entry that mimics
 * the familiar look and feel of professional invoices with line items,
 * tax breakdowns, and intelligent currency handling.
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Calendar,
  FileText,
  Plus,
  Trash2,
  Edit,
  Receipt,
  Save,
  X,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaxBreakdownSection } from './TaxBreakdownSection';
import {
  ExpenseLineItem,
  TaxLineItem,
  InvoiceSummary,
  CurrencyDetectionInfo,
  Expense
} from '@/types/expenses';
import { format } from 'date-fns';

interface InvoiceStyleExpenseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  onSave: (expenseData: Partial<Expense>) => Promise<void>;
  isLoading?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

interface InvoiceFormData {
  // Header information
  vendor_name: string;
  expense_date: string;
  title: string;
  description: string;

  // Line items
  lineItems: ExpenseLineItem[];

  // Tax information
  taxLines: TaxLineItem[];

  // Currency and totals
  currency_code: string;
  subtotal: number;
  total_tax: number;
  amount: number; // Grand total
}

export const InvoiceStyleExpenseModal: React.FC<InvoiceStyleExpenseModalProps> = ({
  isOpen,
  onOpenChange,
  expense,
  onSave,
  isLoading = false,
  mode = 'create'
}) => {
  // Initialize form data
  const [formData, setFormData] = useState<InvoiceFormData>(() => ({
    vendor_name: expense?.vendor_name || '',
    expense_date: expense?.expense_date || format(new Date(), 'yyyy-MM-dd'),
    title: expense?.title || '',
    description: expense?.description || '',
    lineItems: expense?.expense_line_items || [
      {
        id: 'line-1',
        description: '',
        quantity: 1,
        unit_price: 0,
        line_amount: 0,
        currency_code: expense?.currency_code || 'USD'
      }
    ],
    taxLines: expense?.tax_line_items || [],
    currency_code: expense?.currency_code || 'USD',
    subtotal: 0,
    total_tax: 0,
    amount: expense?.amount || 0
  }));

  const [editingLineItem, setEditingLineItem] = useState<string | null>(null);

  // Calculate invoice summary
  const invoiceSummary = useMemo<InvoiceSummary>(() => {
    const subtotal = formData.lineItems.reduce((sum, item) => sum + item.line_amount, 0);
    const totalTax = formData.taxLines.reduce((sum, tax) => sum + tax.taxAmount, 0);
    const grandTotal = subtotal + totalTax;

    return {
      subtotal,
      taxLines: formData.taxLines,
      totalTax,
      grandTotal,
      currency: formData.currency_code,
      currencyConfidence: expense?.currency_detection_info?.confidence || 0.8,
      currencyReason: expense?.currency_detection_info?.reason || 'User specified',
      hasCompanyMismatch: expense?.currency_detection_info?.hasMismatch || false
    };
  }, [formData.lineItems, formData.taxLines, formData.currency_code, expense?.currency_detection_info]);

  // Format currency
  const formatCurrency = (amount: number, currencyCode: string = formData.currency_code) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Add new line item
  const addLineItem = () => {
    const newLineItem: ExpenseLineItem = {
      id: `line-${Date.now()}`,
      description: '',
      quantity: 1,
      unit_price: 0,
      line_amount: 0,
      currency_code: formData.currency_code
    };

    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newLineItem]
    }));
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(item => item.id !== id)
    }));
  };

  // Update line item
  const updateLineItem = (id: string, updates: Partial<ExpenseLineItem>) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          // Recalculate line amount if quantity or unit price changed
          if ('quantity' in updates || 'unit_price' in updates) {
            updated.line_amount = (updated.quantity || 0) * (updated.unit_price || 0);
          }
          return updated;
        }
        return item;
      })
    }));
  };

  // Calculate tax automatically based on subtotal
  const calculateTax = () => {
    const subtotal = formData.lineItems.reduce((sum, item) => sum + item.line_amount, 0);

    // Simple tax calculation - in real implementation, this would use CurrencyIntelligenceService
    if (subtotal > 0 && formData.taxLines.length === 0) {
      const taxRate = 0.13; // Default HST rate
      const taxAmount = subtotal * taxRate;

      const newTaxLine: TaxLineItem = {
        id: `tax-${Date.now()}`,
        taxType: 'HST',
        rate: taxRate,
        baseAmount: subtotal,
        taxAmount,
        jurisdiction: 'Canada',
        confidence: 0.8,
        isCalculated: true
      };

      setFormData(prev => ({
        ...prev,
        taxLines: [newTaxLine]
      }));
    }
  };

  // Handle save
  const handleSave = async () => {
    const expenseData: Partial<Expense> = {
      vendor_name: formData.vendor_name,
      expense_date: formData.expense_date,
      title: formData.title,
      description: formData.description,
      amount: invoiceSummary.grandTotal,
      currency_code: formData.currency_code,
      expense_line_items: formData.lineItems,
      tax_line_items: formData.taxLines,
      invoice_summary: invoiceSummary
    };

    await onSave(expenseData);
  };

  const isViewMode = mode === 'view';
  const canEdit = mode === 'create' || mode === 'edit';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl lg:max-w-6xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-0 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-500" />
            {mode === 'create' ? 'New Expense Invoice' :
             mode === 'edit' ? 'Edit Expense Invoice' :
             'Expense Invoice Details'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 p-6 pt-0">
            {/* Invoice Header */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Invoice Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor_name">Vendor/Supplier</Label>
                  <Input
                    id="vendor_name"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                    placeholder="Enter vendor name"
                    disabled={isViewMode}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense_date">Invoice Date</Label>
                  <Input
                    id="expense_date"
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                    disabled={isViewMode}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="currency"
                      value={formData.currency_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency_code: e.target.value }))}
                      placeholder="USD"
                      maxLength={3}
                      className="w-24"
                      disabled={isViewMode}
                    />
                    {expense?.currency_detection_info?.hasMismatch && (
                      <Badge variant="outline" className="text-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Foreign
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="title">Title/Description</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Brief description of the expense"
                    disabled={isViewMode}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      Draft
                    </Badge>
                    {expense?.ingrid_processed && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        AI Processed
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Line Items
                </CardTitle>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addLineItem}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Description</TableHead>
                        <TableHead className="w-20 text-center">Qty</TableHead>
                        <TableHead className="w-28 text-right">Unit Price</TableHead>
                        <TableHead className="w-28 text-right">Total</TableHead>
                        {canEdit && <TableHead className="w-12"></TableHead>}
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {formData.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {editingLineItem === item.id && canEdit ? (
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                              onBlur={() => setEditingLineItem(null)}
                              onKeyDown={(e) => e.key === 'Enter' && setEditingLineItem(null)}
                              placeholder="Item description"
                              autoFocus
                            />
                          ) : (
                            <div
                              className={cn(
                                "min-h-[20px] cursor-text",
                                canEdit && "hover:bg-gray-50 rounded px-2 py-1"
                              )}
                              onClick={() => canEdit && setEditingLineItem(item.id)}
                            >
                              {item.description || 'Click to add description...'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {canEdit ? (
                            <Input
                              type="number"
                              value={item.quantity || ''}
                              onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                              className="text-center w-20"
                              min="0"
                              step="0.01"
                            />
                          ) : (
                            <span>{item.quantity || 0}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit ? (
                            <Input
                              type="number"
                              value={item.unit_price || ''}
                              onChange={(e) => updateLineItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                              className="text-right w-28"
                              min="0"
                              step="0.01"
                            />
                          ) : (
                            <span>{formatCurrency(item.unit_price || 0)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.line_amount)}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            {formData.lineItems.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(item.id)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>

                {canEdit && formData.lineItems.length > 0 && invoiceSummary.subtotal > 0 && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={calculateTax}
                      disabled={formData.taxLines.length > 0}
                    >
                      Calculate Tax
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tax Breakdown */}
            <TaxBreakdownSection
              invoiceSummary={invoiceSummary}
              currencyDetectionInfo={expense?.currency_detection_info}
              showDetailed={true}
            />
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>
              {expense?.created_at ?
                `Created ${format(new Date(expense.created_at), 'MMM d, yyyy')}` :
                'New expense'
              }
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              {isViewMode ? 'Close' : 'Cancel'}
            </Button>

            {canEdit && (
              <Button
                onClick={handleSave}
                disabled={isLoading || invoiceSummary.grandTotal <= 0}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isLoading ? 'Saving...' : 'Save Expense'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};