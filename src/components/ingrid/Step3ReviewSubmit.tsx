/**
 * Step 3: Review & Submit Component
 *
 * Final review screen showing all expense details before submission,
 * with Ingrid's analysis summary and confidence metrics.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  Sparkles,
  FileText,
  Calendar,
  DollarSign,
  Building,
  Tag,
  TrendingUp,
  AlertTriangle,
  Brain,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { IngridAvatar } from './IngridAvatar';
import FormattedCurrencyDisplay from '@/components/FormattedCurrencyDisplay';
import type { ProcessedExpenseData } from './IngridExpenseCreationDialog';
import type { IngridResponse } from '@/types/ingrid';

interface Step3ReviewSubmitProps {
  expenseData: ProcessedExpenseData;
  uploadedFile: File | null;
  ingridResponse: IngridResponse | null;
  onSubmit: (data: ProcessedExpenseData) => void;
  isSubmitting: boolean;
}

export const Step3ReviewSubmit: React.FC<Step3ReviewSubmitProps> = ({
  expenseData,
  uploadedFile,
  ingridResponse,
  onSubmit,
  isSubmitting
}) => {
  const [agreesToSubmit, setAgreesToSubmit] = useState(false);

  // Calculate overall data quality score
  const getDataQualityScore = () => {
    const confidences = Object.values(expenseData.field_confidences);
    if (confidences.length === 0) return expenseData.confidence_score;

    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    return (expenseData.confidence_score + avgConfidence) / 2;
  };

  const dataQualityScore = getDataQualityScore();

  // Get quality assessment
  const getQualityAssessment = () => {
    if (dataQualityScore >= 0.85) {
      return {
        level: 'excellent',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        message: 'Excellent data quality - ready for submission'
      };
    } else if (dataQualityScore >= 0.7) {
      return {
        level: 'good',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: TrendingUp,
        message: 'Good data quality - minor verification recommended'
      };
    } else {
      return {
        level: 'needs-review',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: AlertTriangle,
        message: 'Requires careful review - some data may need verification'
      };
    }
  };

  const quality = getQualityAssessment();

  const handleSubmit = () => {
    onSubmit(expenseData);
  };

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <IngridAvatar size="sm" />
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Review & Submit Expense
          </h3>
          <p className="text-sm text-muted-foreground">
            Final review of your expense before submission
          </p>
        </div>
      </div>

      {/* Data Quality Assessment */}
      <Card className={`${quality.bgColor} ${quality.borderColor}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <quality.icon className={`h-5 w-5 ${quality.color}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`font-medium ${quality.color}`}>
                  Data Quality Score
                </span>
                <span className={`font-bold ${quality.color}`}>
                  {Math.round(dataQualityScore * 100)}%
                </span>
              </div>
              <p className={`text-sm ${quality.color}`}>
                {quality.message}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Expense Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground">
                    Description
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((expenseData.field_confidences.description || 0) * 100)}% confidence
                  </Badge>
                </div>
                <p className="font-medium">{expenseData.description}</p>
              </div>

              <Separator />

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Amount
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((expenseData.field_confidences.amount || 0) * 100)}% confidence
                  </Badge>
                </div>
                <p className="text-xl font-bold">
                  <FormattedCurrencyDisplay
                    amount={expenseData.amount}
                    currency={expenseData.currency_code}
                  />
                </p>
              </div>

              <Separator />

              {/* Vendor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    Vendor
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((expenseData.field_confidences.vendor_name || 0) * 100)}% confidence
                  </Badge>
                </div>
                <p className="font-medium">{expenseData.vendor_name}</p>
              </div>

              <Separator />

              {/* Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Date
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((expenseData.field_confidences.expense_date || 0) * 100)}% confidence
                  </Badge>
                </div>
                <p className="font-medium">
                  {format(new Date(expenseData.expense_date), 'PPPP')}
                </p>
              </div>

              <Separator />

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Category
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((expenseData.field_confidences.category || 0) * 100)}% confidence
                  </Badge>
                </div>
                <p className="font-medium">{expenseData.category}</p>
              </div>

              {/* GL Account (if present) */}
              {expenseData.gl_account_code && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        GL Account
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round((expenseData.field_confidences.gl_account_code || 0) * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="font-medium">{expenseData.gl_account_code}</p>
                  </div>
                </>
              )}

              {/* Tax Amount (if present) */}
              {expenseData.tax_amount && expenseData.tax_amount > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        Tax Amount
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round((expenseData.field_confidences.tax_amount || 0) * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="font-medium">
                      <FormattedCurrencyDisplay
                        amount={expenseData.tax_amount}
                        currency={expenseData.currency_code}
                      />
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ingrid Analysis Summary */}
        <div className="space-y-4">
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-500" />
                Ingrid's Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Info */}
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Document Processed
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">{expenseData.document_name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Document type: {expenseData.document_type}
                </p>
              </div>

              <Separator />

              {/* Processing Results */}
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Processing Results
                </span>
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Confidence:</span>
                    <span className="font-medium">
                      {Math.round(expenseData.confidence_score * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Fields Extracted:</span>
                    <span className="font-medium">
                      {Object.keys(expenseData.field_confidences).length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>High Confidence Fields:</span>
                    <span className="font-medium">
                      {Object.values(expenseData.field_confidences).filter(c => c >= 0.8).length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              {expenseData.ingrid_suggestions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Recommendations
                    </span>
                    <ul className="text-sm space-y-1 mt-2">
                      {expenseData.ingrid_suggestions.slice(0, 3).map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Sparkles className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Action Summary */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-900">Ready for Submission</span>
              </div>
              <p className="text-sm text-green-800">
                Your expense has been processed and is ready to be submitted.
                {dataQualityScore >= 0.85
                  ? " All data looks accurate and complete."
                  : " Please verify any fields with lower confidence scores."}
              </p>
            </CardContent>
          </Card>

          {/* Compliance Check */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              By submitting this expense, you confirm that all information is accurate
              and complies with your company's expense policies.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-white px-8"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Creating Expense...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Create Expense
            </>
          )}
        </Button>
      </div>
    </div>
  );
};