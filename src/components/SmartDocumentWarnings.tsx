/**
 * Smart Document Warnings Component
 *
 * Displays intelligent warnings and suggestions for document uploads based on
 * AI analysis including duplicate detection, relevance analysis, and content quality.
 * Provides actionable insights to help users make better upload decisions.
 */

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  CheckCircle,
  Copy,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Sparkles,
  Shield
} from 'lucide-react';

export interface DocumentWarning {
  type: 'duplicate' | 'relevance' | 'quality' | 'security';
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
  actionable: boolean;
}

export interface DocumentAnalysisResult {
  overallScore: number; // 0.0 to 1.0
  recommendedAction: 'accept' | 'warn' | 'reject';
  warnings: DocumentWarning[];
  suggestions: string[];
  contentAnalysis?: {
    confidence: number;
    extractedText: string;
    businessEntities: any;
  };
  duplicateAnalysis?: {
    hasDuplicates: boolean;
    exactMatch: boolean;
    confidence: number;
    matches: Array<{
      id: string;
      smartFileName: string;
      similarity: number;
      uploadedAt: string;
    }>;
  };
  relevanceAnalysis?: {
    overallScore: number;
    contextMatch: boolean;
    businessRelevance: number;
    indicators: Array<{
      type: 'positive' | 'negative' | 'neutral';
      factor: string;
      score: number;
      description: string;
    }>;
  };
}

export interface SmartDocumentWarningsProps {
  analysis: DocumentAnalysisResult | null;
  isLoading?: boolean;
  context?: string;
  fileName?: string;
  onRetry?: () => void;
  onViewDuplicate?: (duplicateId: string) => void;
  onProceedAnyway?: () => void;
  onCancel?: () => void;
  showDetailedAnalysis?: boolean;
}

const SmartDocumentWarnings: React.FC<SmartDocumentWarningsProps> = ({
  analysis,
  isLoading = false,
  context,
  fileName,
  onRetry,
  onViewDuplicate,
  onProceedAnyway,
  onCancel,
  showDetailedAnalysis = true
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  if (isLoading) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-700">
              Analyzing document with AI intelligence...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  const getRecommendationIcon = () => {
    switch (analysis.recommendedAction) {
      case 'accept':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warn':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'reject':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getRecommendationColor = () => {
    switch (analysis.recommendedAction) {
      case 'accept':
        return 'border-green-200 bg-green-50';
      case 'warn':
        return 'border-yellow-200 bg-yellow-50';
      case 'reject':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const getWarningIcon = (warning: DocumentWarning) => {
    if (warning.severity === 'error') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else if (warning.severity === 'warning') {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    } else {
      return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getWarningTypeIcon = (type: string) => {
    switch (type) {
      case 'duplicate':
        return <Copy className="h-4 w-4" />;
      case 'relevance':
        return <Sparkles className="h-4 w-4" />;
      case 'quality':
        return <FileText className="h-4 w-4" />;
      case 'security':
        return <Shield className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const duplicateWarnings = analysis.warnings.filter(w => w.type === 'duplicate');
  const relevanceWarnings = analysis.warnings.filter(w => w.type === 'relevance');
  const qualityWarnings = analysis.warnings.filter(w => w.type === 'quality');
  const securityWarnings = analysis.warnings.filter(w => w.type === 'security');

  return (
    <div className="space-y-4">
      {/* Main Analysis Card */}
      <Card className={getRecommendationColor()}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getRecommendationIcon()}
              <CardTitle className="text-base">Document Intelligence Analysis</CardTitle>
              <Badge variant="outline">
                Score: {Math.round(analysis.overallScore * 100)}%
              </Badge>
            </div>
            {fileName && (
              <Badge variant="secondary" className="text-xs">
                {fileName}
              </Badge>
            )}
          </div>
          {context && (
            <CardDescription>
              Analyzed for {context.replace('_', ' ')} upload context
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Recommendation Summary */}
          <div className="flex items-start space-x-3">
            {getRecommendationIcon()}
            <div className="flex-1">
              <p className="font-medium">
                {analysis.recommendedAction === 'accept' && 'Document looks good to upload'}
                {analysis.recommendedAction === 'warn' && 'Document has potential issues'}
                {analysis.recommendedAction === 'reject' && 'Document upload not recommended'}
              </p>
              {analysis.warnings.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {analysis.warnings.length} issue{analysis.warnings.length !== 1 ? 's' : ''} detected
                </p>
              )}
            </div>
          </div>

          {/* Warnings List */}
          {analysis.warnings.length > 0 && (
            <div className="space-y-2">
              {analysis.warnings.slice(0, 3).map((warning, index) => (
                <Alert key={index} className="py-2">
                  <div className="flex items-start space-x-2">
                    {getWarningIcon(warning)}
                    <div className="flex-1">
                      <AlertDescription className="text-sm">
                        <div className="flex items-center space-x-2 mb-1">
                          {getWarningTypeIcon(warning.type)}
                          <span className="font-medium capitalize">{warning.type}</span>
                        </div>
                        {warning.message}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}

              {analysis.warnings.length > 3 && (
                <p className="text-xs text-gray-500 text-center">
                  and {analysis.warnings.length - 3} more issue{analysis.warnings.length - 3 !== 1 ? 's' : ''}...
                </p>
              )}
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="bg-white bg-opacity-50 rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2 flex items-center space-x-1">
                <Sparkles className="h-4 w-4" />
                <span>Suggestions</span>
              </h4>
              <ul className="text-sm text-gray-700 space-y-1">
                {analysis.suggestions.slice(0, 3).map((suggestion, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            {analysis.recommendedAction === 'reject' && onCancel && (
              <Button
                onClick={onCancel}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel Upload
              </Button>
            )}

            {(analysis.recommendedAction === 'warn' || analysis.recommendedAction === 'reject') && onProceedAnyway && (
              <Button
                onClick={onProceedAnyway}
                variant={analysis.recommendedAction === 'reject' ? 'destructive' : 'default'}
                size="sm"
                className="flex-1"
              >
                Proceed Anyway
              </Button>
            )}

            {analysis.recommendedAction === 'accept' && onProceedAnyway && (
              <Button
                onClick={onProceedAnyway}
                variant="default"
                size="sm"
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Continue Upload
              </Button>
            )}

            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Re-analyze
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Details */}
      {duplicateWarnings.length > 0 && analysis.duplicateAnalysis?.matches && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Copy className="h-4 w-4 text-orange-600" />
              <span>Potential Duplicates Found</span>
              <Badge variant="outline">
                {analysis.duplicateAnalysis.matches.length} match{analysis.duplicateAnalysis.matches.length !== 1 ? 'es' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysis.duplicateAnalysis.matches.slice(0, 3).map((match, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-white bg-opacity-50 rounded"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{match.smartFileName}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round(match.similarity * 100)}% similar • Uploaded {new Date(match.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                {onViewDuplicate && (
                  <Button
                    onClick={() => onViewDuplicate(match.id)}
                    variant="outline"
                    size="sm"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Detailed Analysis (Collapsible) */}
      {showDetailedAnalysis && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>Detailed Analysis</span>
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 pt-4">
            {/* Content Analysis */}
            {analysis.contentAnalysis && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Content Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">OCR Confidence:</span>
                      <span className="ml-2">{Math.round(analysis.contentAnalysis.confidence * 100)}%</span>
                    </div>
                    <div>
                      <span className="font-medium">Text Length:</span>
                      <span className="ml-2">{analysis.contentAnalysis.extractedText.length} chars</span>
                    </div>
                  </div>
                  {analysis.contentAnalysis.businessEntities && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-gray-600">Business Entities:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {analysis.contentAnalysis.businessEntities.amounts?.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {analysis.contentAnalysis.businessEntities.amounts.length} Amount{analysis.contentAnalysis.businessEntities.amounts.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {analysis.contentAnalysis.businessEntities.dates?.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {analysis.contentAnalysis.businessEntities.dates.length} Date{analysis.contentAnalysis.businessEntities.dates.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {analysis.contentAnalysis.businessEntities.vendors?.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {analysis.contentAnalysis.businessEntities.vendors.length} Vendor{analysis.contentAnalysis.businessEntities.vendors.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Relevance Analysis */}
            {analysis.relevanceAnalysis && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Relevance Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Overall Score:</span>
                      <span className="ml-2">{Math.round(analysis.relevanceAnalysis.overallScore * 100)}%</span>
                    </div>
                    <div>
                      <span className="font-medium">Context Match:</span>
                      <span className="ml-2">{analysis.relevanceAnalysis.contextMatch ? '✓' : '✗'}</span>
                    </div>
                    <div>
                      <span className="font-medium">Business Relevance:</span>
                      <span className="ml-2">{Math.round(analysis.relevanceAnalysis.businessRelevance * 100)}%</span>
                    </div>
                  </div>

                  {analysis.relevanceAnalysis.indicators && analysis.relevanceAnalysis.indicators.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-gray-600 mb-2 block">Key Indicators:</span>
                      <div className="space-y-1">
                        {analysis.relevanceAnalysis.indicators.slice(0, 5).map((indicator, index) => (
                          <div key={index} className="text-xs flex items-center justify-between">
                            <span className={indicator.type === 'positive' ? 'text-green-600' : indicator.type === 'negative' ? 'text-red-600' : 'text-gray-600'}>
                              {indicator.description}
                            </span>
                            <span className="font-mono text-gray-500">
                              {indicator.score > 0 ? '+' : ''}{indicator.score.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* All Warnings by Category */}
            {(qualityWarnings.length > 0 || securityWarnings.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Additional Issues</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {qualityWarnings.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
                        <FileText className="h-3 w-3" />
                        <span>Quality Issues</span>
                      </h5>
                      <div className="space-y-1">
                        {qualityWarnings.map((warning, index) => (
                          <p key={index} className="text-xs text-gray-700">
                            • {warning.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {securityWarnings.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
                        <Shield className="h-3 w-3" />
                        <span>Security Concerns</span>
                      </h5>
                      <div className="space-y-1">
                        {securityWarnings.map((warning, index) => (
                          <p key={index} className="text-xs text-gray-700">
                            • {warning.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default SmartDocumentWarnings;