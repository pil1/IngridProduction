/**
 * Tax Breakdown Section Component
 *
 * Displays tax information in a professional invoice-style format with
 * individual tax lines, calculations, and confidence indicators.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calculator,
  AlertTriangle,
  CheckCircle,
  Info,
  Banknote,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaxLineItem, InvoiceSummary, CurrencyDetectionInfo } from '@/types/expenses';

interface TaxBreakdownSectionProps {
  invoiceSummary: InvoiceSummary;
  currencyDetectionInfo?: CurrencyDetectionInfo;
  showDetailed?: boolean;
  className?: string;
}

export const TaxBreakdownSection: React.FC<TaxBreakdownSectionProps> = ({
  invoiceSummary,
  currencyDetectionInfo,
  showDetailed = true,
  className
}) => {
  const { subtotal, taxLines, totalTax, grandTotal, currency, hasCompanyMismatch } = invoiceSummary;

  // Format currency amounts
  const formatCurrency = (amount: number, currencyCode: string = currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Get tax confidence color
  const getTaxConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-emerald-600 bg-emerald-50';
    if (confidence >= 0.7) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  // Get currency status styling
  const getCurrencyStatusStyle = () => {
    if (!currencyDetectionInfo) return {};

    if (currencyDetectionInfo.hasMismatch) {
      return {
        icon: AlertTriangle,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 border-amber-200'
      };
    }

    return {
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-200'
    };
  };

  const currencyStatus = getCurrencyStatusStyle();

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calculator className="h-4 w-4 text-blue-500" />
          Tax Breakdown & Summary
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Currency Detection Info */}
        {currencyDetectionInfo && (
          <Alert className={cn('border', currencyStatus.bgColor)}>
            <div className="flex items-start gap-2">
              {currencyStatus.icon && (
                <currencyStatus.icon className={cn('h-4 w-4 mt-0.5', currencyStatus.color)} />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="h-3 w-3" />
                  <span className="font-medium text-sm">
                    Currency: {currencyDetectionInfo.detectedCurrency}
                  </span>
                  <Badge variant="outline" className={getTaxConfidenceColor(currencyDetectionInfo.confidence)}>
                    {Math.round(currencyDetectionInfo.confidence * 100)}%
                  </Badge>
                </div>
                <AlertDescription className="text-xs">
                  {currencyDetectionInfo.reason}
                </AlertDescription>

                {currencyDetectionInfo.hasMismatch && (
                  <div className="mt-2 text-xs text-amber-700">
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>
                        Company default: {currencyDetectionInfo.companyDefaultCurrency} •
                        Detected: {currencyDetectionInfo.detectedCurrency}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Subtotal */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Subtotal (before tax)</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>

          {subtotal > 0 && <Separator />}
        </div>

        {/* Tax Lines */}
        {taxLines.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Tax Details
            </div>

            {taxLines.map((taxLine, index) => (
              <div key={taxLine.id || index} className="space-y-1">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{taxLine.taxType}</span>
                      <Badge variant="outline" className="text-xs">
                        {(taxLine.rate * 100).toFixed(1)}%
                      </Badge>
                      {showDetailed && (
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getTaxConfidenceColor(taxLine.confidence))}
                        >
                          {Math.round(taxLine.confidence * 100)}%
                        </Badge>
                      )}
                    </div>

                    {showDetailed && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span>{taxLine.jurisdiction}</span>
                        <span>•</span>
                        <span>Base: {formatCurrency(taxLine.baseAmount)}</span>
                        {taxLine.isCalculated && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calculator className="h-3 w-3" />
                              Calculated
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <span className="font-medium text-sm">
                    {formatCurrency(taxLine.taxAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total Tax Summary */}
        {taxLines.length > 1 && (
          <>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Tax</span>
              <span className="font-medium">{formatCurrency(totalTax)}</span>
            </div>
          </>
        )}

        {/* Grand Total */}
        <Separator className="my-3" />
        <div className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
          <span className="font-semibold text-base">Grand Total</span>
          <span className="font-bold text-lg text-gray-900">
            {formatCurrency(grandTotal)}
          </span>
        </div>

        {/* Warnings and Info */}
        {currencyDetectionInfo?.warnings && currencyDetectionInfo.warnings.length > 0 && (
          <div className="space-y-2">
            {currencyDetectionInfo.warnings.map((warning, index) => (
              <Alert key={index} className="border-amber-200 bg-amber-50">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800">
                  {warning}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Tax Calculation Summary for AI */}
        {showDetailed && taxLines.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Tax calculation method:</span>
                <span className="font-medium">
                  {taxLines.some(t => t.isCalculated) ? 'AI Enhanced' : 'Document Extracted'}
                </span>
              </div>

              {taxLines.length > 0 && (
                <div className="flex justify-between">
                  <span>Average tax confidence:</span>
                  <span className="font-medium">
                    {Math.round(taxLines.reduce((sum, tax) => sum + tax.confidence, 0) / taxLines.length * 100)}%
                  </span>
                </div>
              )}

              {hasCompanyMismatch && (
                <div className="flex items-center gap-1 text-amber-600 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Currency differs from company default</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Simplified version for compact displays
export const TaxBreakdownCompact: React.FC<{
  invoiceSummary: InvoiceSummary;
  currencyDetectionInfo?: CurrencyDetectionInfo;
}> = ({ invoiceSummary, currencyDetectionInfo }) => {
  const { subtotal, totalTax, grandTotal, currency } = invoiceSummary;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Subtotal:</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>

      {totalTax > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">Tax:</span>
          <span>{formatCurrency(totalTax)}</span>
        </div>
      )}

      <Separator />
      <div className="flex justify-between font-semibold">
        <span>Total:</span>
        <span>{formatCurrency(grandTotal)}</span>
      </div>

      {currencyDetectionInfo?.hasMismatch && (
        <div className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          <span>Currency: {currency}</span>
        </div>
      )}
    </div>
  );
};