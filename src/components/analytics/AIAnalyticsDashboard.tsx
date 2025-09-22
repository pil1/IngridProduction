/**
 * AI Analytics Dashboard Component
 *
 * Provides comprehensive analytics on AI processing efficiency,
 * accuracy trends, and field-level insights for administrators.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Clock,
  Target,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  CheckCircle,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Expense, ProcessingMethod, FieldSource } from '@/types/expenses';

export interface AIAnalyticsDashboardProps {
  expenses: Expense[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  companyId?: string;
}

// Calculate AI efficiency metrics
const calculateAIMetrics = (expenses: Expense[]) => {
  const totalExpenses = expenses.length;
  const aiProcessed = expenses.filter(e => e.ingrid_processed).length;
  const manualExpenses = totalExpenses - aiProcessed;

  // Confidence distribution
  const confidenceRanges = { high: 0, medium: 0, low: 0 };
  const fieldSourceCounts = { ai: 0, manual: 0, mixed: 0, override: 0 };

  let totalConfidence = 0;
  let totalProcessingTime = 0;
  let processedCount = 0;

  expenses.forEach(expense => {
    if (expense.ingrid_processed && expense.ingrid_confidence_score !== null) {
      totalConfidence += expense.ingrid_confidence_score;
      processedCount++;

      // Confidence ranges
      if (expense.ingrid_confidence_score >= 0.9) confidenceRanges.high++;
      else if (expense.ingrid_confidence_score >= 0.7) confidenceRanges.medium++;
      else confidenceRanges.low++;
    }

    if (expense.processing_time_ms) {
      totalProcessingTime += expense.processing_time_ms;
    }

    // Field source analysis
    if (expense.field_sources) {
      Object.values(expense.field_sources).forEach(source => {
        fieldSourceCounts[source]++;
      });
    }
  });

  const avgConfidence = processedCount > 0 ? totalConfidence / processedCount : 0;
  const avgProcessingTime = aiProcessed > 0 ? totalProcessingTime / aiProcessed : 0;
  const aiAdoptionRate = totalExpenses > 0 ? (aiProcessed / totalExpenses) * 100 : 0;

  return {
    totalExpenses,
    aiProcessed,
    manualExpenses,
    avgConfidence,
    avgProcessingTime,
    aiAdoptionRate,
    confidenceRanges,
    fieldSourceCounts
  };
};

// Generate time series data for trends
const generateTimeSeriesData = (expenses: Expense[], days: number = 30) => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const timeSeriesData = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dayExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.expense_date).toISOString().split('T')[0];
      return expenseDate === dateStr;
    });

    const aiProcessed = dayExpenses.filter(e => e.ingrid_processed).length;
    const manual = dayExpenses.length - aiProcessed;
    const avgConfidence = dayExpenses.length > 0 ?
      dayExpenses.reduce((sum, e) => sum + (e.ingrid_confidence_score || 0), 0) / dayExpenses.length * 100 : 0;

    timeSeriesData.push({
      date: dateStr,
      ai: aiProcessed,
      manual,
      confidence: Math.round(avgConfidence)
    });
  }

  return timeSeriesData;
};

// Color schemes
const CONFIDENCE_COLORS = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#ef4444'
};

const METHOD_COLORS = {
  ai: '#3b82f6',
  manual: '#6b7280',
  hybrid: '#8b5cf6'
};

export const AIAnalyticsDashboard: React.FC<AIAnalyticsDashboardProps> = ({
  expenses,
  dateRange,
  companyId
}) => {
  const metrics = useMemo(() => calculateAIMetrics(expenses), [expenses]);
  const timeSeriesData = useMemo(() => generateTimeSeriesData(expenses), [expenses]);

  // Confidence distribution data for pie chart
  const confidenceData = [
    { name: 'High Confidence (90%+)', value: metrics.confidenceRanges.high, color: CONFIDENCE_COLORS.high },
    { name: 'Medium Confidence (70-89%)', value: metrics.confidenceRanges.medium, color: CONFIDENCE_COLORS.medium },
    { name: 'Low Confidence (<70%)', value: metrics.confidenceRanges.low, color: CONFIDENCE_COLORS.low }
  ].filter(item => item.value > 0);

  // Field source distribution
  const fieldSourceData = [
    { name: 'AI Generated', value: metrics.fieldSourceCounts.ai, color: METHOD_COLORS.ai },
    { name: 'Manual Entry', value: metrics.fieldSourceCounts.manual, color: METHOD_COLORS.manual },
    { name: 'AI + Manual', value: metrics.fieldSourceCounts.mixed, color: METHOD_COLORS.hybrid },
    { name: 'Manual Override', value: metrics.fieldSourceCounts.override, color: '#f97316' }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Brain className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">AI Analytics Dashboard</h2>
          <p className="text-gray-600">
            Ingrid AI performance insights and efficiency metrics
          </p>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Adoption Rate</p>
                <p className="text-2xl font-bold text-blue-600">
                  {Math.round(metrics.aiAdoptionRate)}%
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-2">
              <Progress value={metrics.aiAdoptionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {Math.round(metrics.avgConfidence * 100)}%
                </p>
              </div>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-2">
              <Progress value={metrics.avgConfidence * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
                <p className="text-2xl font-bold text-purple-600">
                  {Math.round(metrics.avgProcessingTime)}ms
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Per expense processed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Processed</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {metrics.aiProcessed}
                </p>
              </div>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              of {metrics.totalExpenses} total
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="confidence" className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Confidence
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Field Sources
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                AI vs Manual Processing Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ai" fill={METHOD_COLORS.ai} name="AI Processed" />
                  <Bar dataKey="manual" fill={METHOD_COLORS.manual} name="Manual Entry" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Daily Confidence Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Confidence']} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="confidence"
                    stroke={CONFIDENCE_COLORS.high}
                    strokeWidth={2}
                    name="Average Confidence %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="confidence" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Confidence Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={confidenceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {confidenceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Confidence Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium">High Confidence</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-600">
                        {metrics.confidenceRanges.high}
                      </div>
                      <div className="text-xs text-gray-500">90%+ accuracy</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Medium Confidence</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-amber-600">
                        {metrics.confidenceRanges.medium}
                      </div>
                      <div className="text-xs text-gray-500">70-89% accuracy</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Low Confidence</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {metrics.confidenceRanges.low}
                      </div>
                      <div className="text-xs text-gray-500">&lt;70% accuracy</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Field Source Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fieldSourceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8">
                    {fieldSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Efficiency Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {Math.round((metrics.avgConfidence * metrics.aiAdoptionRate) / 100 * 100)}
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    Overall AI Efficiency Score
                  </div>
                  <Progress
                    value={(metrics.avgConfidence * metrics.aiAdoptionRate) / 100 * 100}
                    className="h-3"
                  />
                  <div className="mt-3 text-xs text-gray-500">
                    Based on adoption rate × average confidence
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Manual Intervention Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-amber-600 mb-2">
                    {Math.round((1 - metrics.aiAdoptionRate / 100) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    Requires Manual Processing
                  </div>
                  <Progress
                    value={(1 - metrics.aiAdoptionRate / 100) * 100}
                    className="h-3"
                  />
                  <div className="mt-3 text-xs text-gray-500">
                    Lower is better for AI efficiency
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};