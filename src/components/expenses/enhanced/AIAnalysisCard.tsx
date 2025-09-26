/**
 * AI Analysis Card Component
 *
 * Displays comprehensive AI processing information including confidence scores,
 * processing method, field accuracy, and Ingrid suggestions.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Sparkles,
  Lightbulb,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Expense, ProcessingMethod } from '@/types/expenses';
import { ConfidenceBadge } from '../indicators/ConfidenceBadge';

export interface AIAnalysisCardProps {
  expense: Expense;
  overallConfidence: number;
  processingMethod: ProcessingMethod;
  compact?: boolean;
}

// Calculate field confidence stats
const getFieldStats = (fieldConfidences: Record<string, number>) => {
  const confidences = Object.values(fieldConfidences);
  if (confidences.length === 0) return { high: 0, medium: 0, low: 0 };

  return confidences.reduce(
    (acc, confidence) => {
      if (confidence >= 0.9) acc.high++;
      else if (confidence >= 0.7) acc.medium++;
      else acc.low++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
};

// Get processing quality assessment
const getQualityAssessment = (overallConfidence: number, fieldStats: { high: number; medium: number; low: number }) => {
  if (overallConfidence >= 0.9 && fieldStats.low === 0) {
    return {
      level: 'excellent',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      icon: CheckCircle,
      message: 'Excellent AI processing quality'
    };
  } else if (overallConfidence >= 0.8 && fieldStats.low <= 1) {
    return {
      level: 'good',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      icon: TrendingUp,
      message: 'Good AI processing quality'
    };
  } else {
    return {
      level: 'needs-review',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      icon: AlertTriangle,
      message: 'Review recommended'
    };
  }
};

export const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({
  expense,
  overallConfidence,
  processingMethod,
  compact = false
}) => {
  const fieldStats = getFieldStats(expense.ingrid_field_confidences || {});
  const quality = getQualityAssessment(overallConfidence, fieldStats);
  const totalFields = Object.keys(expense.ingrid_field_confidences || {}).length;
  const isManual = processingMethod === 'manual';

  // For manual entries, show a simple manual entry card
  if (isManual) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-sm">Manual Entry</span>
          </div>

          <div className="text-sm text-gray-600">
            This expense was entered manually without AI processing. All information was provided directly by the user.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-blue-500" />
            <span className="font-medium text-sm">AI Analysis</span>
            <ConfidenceBadge confidence={overallConfidence} size="xs" isManual={isManual} />
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Processing:</span>
              <span className="font-medium capitalize">{processingMethod}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Quality:</span>
              <span className={cn("font-medium", quality.color)}>
                {quality.level.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>

            {totalFields > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Fields:</span>
                <span className="font-medium">{totalFields} processed</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-500" />
          Ingrid AI Analysis
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Quality Assessment - Only show for AI-processed expenses */}
        {!isManual && (
          <div className={cn("p-3 rounded-lg", quality.bgColor)}>
            <div className="flex items-center gap-2 mb-2">
              <quality.icon className={cn("h-4 w-4", quality.color)} />
              <span className={cn("font-medium text-sm", quality.color)}>
                {quality.message}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Overall Confidence:</span>
                <span className="font-medium">
                  {Math.round(overallConfidence * 100)}%
                </span>
              </div>
              <Progress value={overallConfidence * 100} className="h-2" />
            </div>
          </div>
        )}

        {/* Processing Details */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Processing Method:</span>
            <Badge variant={processingMethod === 'ai' ? 'default' : 'secondary'}>
              {processingMethod.toUpperCase()}
            </Badge>
          </div>

          {expense.processing_time_ms && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Processing Time:</span>
              <span className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {expense.processing_time_ms}ms
              </span>
            </div>
          )}

          {totalFields > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fields Processed:</span>
              <span className="font-medium">{totalFields}</span>
            </div>
          )}

          {expense.manual_overrides.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Manual Overrides:</span>
              <span className="font-medium text-amber-600">
                {expense.manual_overrides.length}
              </span>
            </div>
          )}
        </div>

        {/* Field Confidence Breakdown */}
        {totalFields > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-3 w-3 text-gray-500" />
                Field Confidence Breakdown
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-emerald-50 rounded">
                  <div className="font-bold text-emerald-700">{fieldStats.high}</div>
                  <div className="text-emerald-600">High (90%+)</div>
                </div>
                <div className="text-center p-2 bg-amber-50 rounded">
                  <div className="font-bold text-amber-700">{fieldStats.medium}</div>
                  <div className="text-amber-600">Medium (70-89%)</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="font-bold text-red-700">{fieldStats.low}</div>
                  <div className="text-red-600">Low (&lt;70%)</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* AI Suggestions */}
        {expense.ingrid_suggestions && expense.ingrid_suggestions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-3 w-3 text-amber-500" />
                Ingrid's Insights
              </div>

              <div className="space-y-1">
                {expense.ingrid_suggestions.slice(0, 3).map((suggestion, index) => (
                  <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{suggestion}</span>
                    </div>
                  </div>
                ))}

                {expense.ingrid_suggestions.length > 3 && (
                  <div className="text-xs text-gray-500 text-center pt-1">
                    +{expense.ingrid_suggestions.length - 3} more insights
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Response ID for debugging */}
        {expense.ingrid_response_id && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400 font-mono">
              ID: {expense.ingrid_response_id.slice(0, 8)}...
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};