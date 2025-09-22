/**
 * AI Analytics Page
 *
 * Provides comprehensive AI analytics and insights for administrators.
 * Shows AI processing efficiency, accuracy trends, and field-level metrics.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Brain,
  Download,
  Settings,
  ArrowLeft,
  Calendar,
  Building2,
  Filter
} from 'lucide-react';
import { useExpensesWithSubmitter } from '@/hooks/useExpensesWithSubmitter';
import { useProfile } from '@/hooks/useProfile';
import { AIAnalyticsDashboard } from '@/components/analytics/AIAnalyticsDashboard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';

const AIAnalyticsPage = () => {
  const navigate = useNavigate();
  const { data: profile } = useProfile();

  // State for filtering
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');

  // Fetch companies for super-admin
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: profile?.role === 'super-admin',
  });

  // Determine which company to analyze
  const targetCompanyId = useMemo(() => {
    if (profile?.role === 'super-admin') {
      return selectedCompanyId === 'all' ? undefined : selectedCompanyId;
    }
    return profile?.company_id;
  }, [profile, selectedCompanyId]);

  // Fetch expenses for analysis
  const { data: expenses = [], isLoading, error } = useExpensesWithSubmitter(
    targetCompanyId
  );

  // Filter expenses by date range
  const filteredExpenses = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return expenses;

    return expenses.filter(expense => {
      const expenseDate = new Date(expense.expense_date);
      return expenseDate >= dateRange.from! && expenseDate <= dateRange.to!;
    });
  }, [expenses, dateRange]);

  // Check authorization
  if (!profile || !['admin', 'controller', 'super-admin'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Access denied. Administrator privileges required.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading AI analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Error loading analytics: {error.message}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Analytics</h1>
            <p className="text-muted-foreground">
              Ingrid AI performance insights and efficiency metrics
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Analytics Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </label>
              <DatePickerWithRange
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                placeholder="Select date range"
              />
            </div>

            {/* Company Selection (Super Admin only) */}
            {profile?.role === 'super-admin' && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company
                </label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Summary Stats */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Summary</label>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Expenses:</span>
                  <Badge variant="secondary">{filteredExpenses.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AI Processed:</span>
                  <Badge variant="default">
                    {filteredExpenses.filter(e => e.ingrid_processed).length}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date Range:</span>
                  <span className="text-xs text-gray-500">
                    {dateRange?.from && dateRange?.to ? (
                      `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`
                    ) : (
                      'All time'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Dashboard */}
      {filteredExpenses.length > 0 ? (
        <AIAnalyticsDashboard
          expenses={filteredExpenses}
          dateRange={dateRange ? { start: dateRange.from!, end: dateRange.to! } : undefined}
          companyId={targetCompanyId}
        />
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Data Available</h3>
              <p className="text-muted-foreground mb-4">
                No expenses found for the selected filters. Try adjusting your date range or company selection.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setDateRange({
                    from: addDays(new Date(), -90),
                    to: new Date(),
                  });
                  setSelectedCompanyId('all');
                }}
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIAnalyticsPage;