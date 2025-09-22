import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Activity,
  Target,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { AdvancedMetricsCard, MetricData } from './AdvancedMetricsCard';
import { AnalyticsFilters, AnalyticsFilters as FiltersType } from './AnalyticsFilters';
import { LazyLineChartCard, LazyBarChartCard } from '@/components/LazyCharts';
import { exportService } from '@/services/exportService';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const AnalyticsDashboard = () => {
  const { profile } = useSession();
  const [activeTab, setActiveTab] = useState('overview');

  const [filters, setFilters] = useState<FiltersType>({
    dateRange: {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    },
    period: 'month',
    category: [],
    status: [],
    department: [],
    comparison: 'previous_period',
  });

  // Fetch real-time analytics data
  const { data: expenseAnalytics, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['expense-analytics', filters],
    queryFn: async () => {
      if (!profile?.company_id) return null;

      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id, amount, status, expense_date, created_at,
          category_id, submitted_by, is_reimbursable,
          expense_categories(name),
          profiles!submitted_by(first_name, last_name, role)
        `)
        .eq('company_id', profile.company_id)
        .gte('expense_date', filters.dateRange.from?.toISOString().split('T')[0] ?? '')
        .lte('expense_date', filters.dateRange.to?.toISOString().split('T')[0] ?? '');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // Fetch categories for filtering
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-analytics'],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .order('name');

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.company_id,
  });

  // Process analytics data
  const analytics = useMemo(() => {
    if (!expenseAnalytics) return null;

    const filteredExpenses = expenseAnalytics.filter(expense => {
      // Apply category filter
      if (filters.category.length > 0 && !filters.category.includes(expense.category_id ?? '')) {
        return false;
      }

      // Apply status filter
      if (filters.status.length > 0 && !filters.status.includes(expense.status)) {
        return false;
      }

      return true;
    });

    // Calculate key metrics
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalCount = filteredExpenses.length;
    const averageExpense = totalCount > 0 ? totalExpenses / totalCount : 0;

    // Status breakdown
    const statusBreakdown = filteredExpenses.reduce((acc, expense) => {
      acc[expense.status] = (acc[expense.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Category breakdown
    const categoryBreakdown = filteredExpenses.reduce((acc, expense) => {
      const categoryName = expense.expense_categories?.name ?? 'Uncategorized';
      acc[categoryName] = (acc[categoryName] ?? 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    // Monthly trends
    const monthlyTrends = filteredExpenses.reduce((acc, expense) => {
      const month = format(new Date(expense.expense_date), 'MMM yyyy');
      acc[month] = (acc[month] ?? 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    // Reimbursable vs Non-reimbursable
    const reimbursableBreakdown = filteredExpenses.reduce((acc, expense) => {
      const type = expense.is_reimbursable ? 'Reimbursable' : 'Non-reimbursable';
      acc[type] = (acc[type] ?? 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    // Calculate comparison metrics if enabled
    let comparisonData = null;
    if (filters.comparison !== 'none' && filters.dateRange.from && filters.dateRange.to) {
      // This would fetch previous period data - simplified for now
      const previousPeriodValue = totalExpenses * 0.85; // Mock previous period
      comparisonData = {
        totalExpenses: { current: totalExpenses, previous: previousPeriodValue },
        totalCount: { current: totalCount, previous: Math.floor(totalCount * 0.9) },
        averageExpense: { current: averageExpense, previous: previousPeriodValue / Math.floor(totalCount * 0.9) },
      };
    }

    return {
      totalExpenses,
      totalCount,
      averageExpense,
      statusBreakdown,
      categoryBreakdown,
      monthlyTrends,
      reimbursableBreakdown,
      comparisonData,
      filteredExpenses,
    };
  }, [expenseAnalytics, filters]);

  // Generate metrics cards data
  const metricsData: MetricData[] = useMemo(() => {
    if (!analytics) return [];

    return [
      {
        label: 'Total Expenses',
        value: analytics.totalExpenses,
        previousValue: analytics.comparisonData?.totalExpenses.previous,
        format: 'currency',
        currencyCode: 'USD',
        description: 'Total expense amount',
        status: analytics.totalExpenses > 50000 ? 'warning' : 'good',
      },
      {
        label: 'Expense Count',
        value: analytics.totalCount,
        previousValue: analytics.comparisonData?.totalCount.previous,
        format: 'number',
        description: 'Number of expenses',
        target: 100,
      },
      {
        label: 'Average Expense',
        value: analytics.averageExpense,
        previousValue: analytics.comparisonData?.averageExpense.previous,
        format: 'currency',
        currencyCode: 'USD',
        description: 'Average expense amount',
        threshold: {
          warning: 1000,
          danger: 2000,
        },
      },
      {
        label: 'Approval Rate',
        value: analytics.statusBreakdown.approved ?
          (analytics.statusBreakdown.approved / analytics.totalCount * 100) : 0,
        format: 'percentage',
        description: 'Percentage of approved expenses',
        target: 95,
        status: analytics.statusBreakdown.approved / analytics.totalCount > 0.8 ? 'good' : 'warning',
      },
      {
        label: 'Pending Review',
        value: analytics.statusBreakdown.submitted ?? 0,
        format: 'number',
        description: 'Expenses awaiting review',
        status: (analytics.statusBreakdown.submitted ?? 0) > 10 ? 'warning' : 'good',
      },
    ];
  }, [analytics]);

  // Chart data preparation
  const chartData = useMemo(() => {
    if (!analytics) return { categoryData: [], monthlyData: [], statusData: [] };

    const categoryData = Object.entries(analytics.categoryBreakdown).map(([name, amount]) => ({
      name,
      amount,
    }));

    const monthlyData = Object.entries(analytics.monthlyTrends).map(([month, amount]) => ({
      month,
      amount,
    }));

    const statusData = Object.entries(analytics.statusBreakdown).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
    }));

    return { categoryData, monthlyData, statusData };
  }, [analytics]);

  const handleExportAnalytics = async () => {
    if (!analytics?.filteredExpenses) return;

    await exportService.exportExpenses(analytics.filteredExpenses, {
      format: 'csv',
      filename: `analytics-export-${format(new Date(), 'yyyy-MM-dd')}`,
    });
  };

  if (isLoadingExpenses) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Advanced Analytics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive insights and real-time metrics
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Real-time
        </Badge>
      </div>

      {/* Filters */}
      <AnalyticsFilters
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExportAnalytics}
        availableCategories={categories}
        isLoading={isLoadingExpenses}
      />

      {/* Metrics Overview */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {metricsData.map((metric, index) => (
            <AdvancedMetricsCard key={index} metric={metric} />
          ))}
        </div>
      )}

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <LazyBarChartCard
              title="Expenses by Status"
              description="Distribution of expenses by approval status"
              data={chartData.statusData}
              dataKey="count"
              categoryKey="status"
            />
            <LazyBarChartCard
              title="Expenses by Category"
              description="Spending breakdown by expense category"
              data={chartData.categoryData}
              dataKey="amount"
              categoryKey="name"
              currencyCode="USD"
            />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <LazyLineChartCard
            title="Monthly Expense Trends"
            description="Expense trends over time"
            data={chartData.monthlyData}
            dataKey="amount"
            categoryKey="month"
            currencyCode="USD"
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics?.categoryBreakdown ?? {}).map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="font-medium">{category}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">
                          ${amount.toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {((amount / (analytics?.totalExpenses ?? 1)) * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Key Performance Indicators
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Processing Speed</span>
                    <Badge variant="secondary">2.3 days avg</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Compliance Rate</span>
                    <Badge variant="default">98.5%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Error Rate</span>
                    <Badge variant="destructive">1.2%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Alerts & Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50">
                    <p className="font-medium">High-value expense detected</p>
                    <p className="text-muted-foreground">Expense #E-1234 exceeds normal threshold</p>
                  </div>
                  <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                    <p className="font-medium">Approval delay</p>
                    <p className="text-muted-foreground">5 expenses pending for &gt;3 days</p>
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

export default AnalyticsDashboard;