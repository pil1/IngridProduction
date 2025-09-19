"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, TrendingUp, LayoutDashboard } from "lucide-react"; // Import LayoutDashboard icon
import { useSession } from "@/components/SessionContextProvider";
import {
  getSimulatedExpenseCategories,
  getSimulatedMonthlyExpenses,
  getSimulatedMonthlyRevenue,
  getSimulatedVendorSpend,
  getSimulatedCustomerSales,
  getSimulatedARAging,
  getSimulatedAPAging,
  getSimulatedKeyMetrics,
} from "@/lib/dashboard-data";
import DashboardCard from "@/components/dashboard/DashboardCard.tsx";
import { LazyLineChartCard, LazyBarChartCard } from "@/components/LazyCharts";
import FormattedCurrencyDisplay from "@/components/FormattedCurrencyDisplay";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react"; // Removed useEffect

const Dashboard = () => {
  const { profile, isLoading: isLoadingSession } = useSession();
  const userRole = profile?.role;
  // Removed companyId as it's no longer directly used for expense currency logic here

  // Hardcode default currency for simulated data display
  const companyDefaultCurrency = "USD";
  const [activeTab, setActiveTab] = useState("overview");

  const [keyMetrics] = useState(getSimulatedKeyMetrics());
  const [expenseCategories] = useState(getSimulatedExpenseCategories());
  const [monthlyExpenses] = useState(getSimulatedMonthlyExpenses());
  const [monthlyRevenue] = useState(getSimulatedMonthlyRevenue());
  const [vendorSpend] = useState(getSimulatedVendorSpend());
  const [customerSales] = useState(getSimulatedCustomerSales());
  const [arAging] = useState(getSimulatedARAging());
  const [apAging] = useState(getSimulatedAPAging());

  if (isLoadingSession) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading dashboard...</p>
      </div>
    );
  }

  // Content for regular users (not admin/controller/super-admin)
  if (!userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Welcome to INFOtrac!
          </h3>
          <p className="text-sm text-muted-foreground">
            Select a module from the sidebar to get started.
          </p>
        </div>
      </div>
    );
  }

  // Content for Admin/Controller/Super-Admin roles
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6" /> Dashboard
        </h2>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" /> Smart Add Chart
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Classic Overview</TabsTrigger>
          <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6">

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {keyMetrics.map((metric, index) => (
          <DashboardCard key={index} title={metric.label} description={metric.unit === '$' ? 'Month-to-Date' : undefined}>
            <div className="flex flex-col items-center justify-center">
              <p className="text-3xl font-bold">
                {metric.unit === '$' ? (
                  <FormattedCurrencyDisplay amount={metric.value} currencyCode={companyDefaultCurrency} />
                ) : (
                  `${metric.value.toFixed(0)}${metric.unit ?? ''}`
                )}
              </p>
              {metric.trend && (
                <div className={`flex items-center text-sm mt-1 ${metric.trend === 'up' ? 'text-green-500' : metric.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
                  <TrendingUp className={`h-4 w-4 mr-1 ${metric.trend === 'down' ? 'rotate-180' : ''}`} />
                  {metric.trend.charAt(0).toUpperCase() + metric.trend.slice(1)}
                </div>
              )}
            </div>
          </DashboardCard>
        ))}
      </div>

      {/* Financial Trends */}
      <div className="grid gap-4 md:grid-cols-2">
        <LazyLineChartCard
          title="Monthly Expenses"
          description="Total expenses over the last 6 months"
          data={monthlyExpenses}
          dataKey="expenses"
          categoryKey="month"
          currencyCode={companyDefaultCurrency}
        />
        <LazyLineChartCard
          title="Monthly Revenue"
          description="Total revenue over the last 6 months"
          data={monthlyRevenue}
          dataKey="revenue"
          categoryKey="month"
          currencyCode={companyDefaultCurrency}
        />
      </div>

      {/* Expense Breakdown */}
      <LazyBarChartCard
        title="Expenses by Category"
        description="Breakdown of expenses across different categories"
        data={expenseCategories}
        dataKey="amount"
        categoryKey="name"
        currencyCode={companyDefaultCurrency}
      />

      {/* Vendor & Customer Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <LazyBarChartCard
          title="Top Vendor Spend"
          description="Highest spending with vendors"
          data={vendorSpend}
          dataKey="spend"
          categoryKey="vendor"
          currencyCode={companyDefaultCurrency}
        />
        <LazyBarChartCard
          title="Top Customer Sales"
          description="Highest sales from customers"
          data={customerSales}
          dataKey="sales"
          categoryKey="customer"
          currencyCode={companyDefaultCurrency}
        />
      </div>

      {/* Aging Reports */}
      <div className="grid gap-4 md:grid-cols-2">
        <LazyBarChartCard
          title="Accounts Receivable Aging"
          description="Outstanding customer invoices by age"
          data={arAging}
          dataKey="amount"
          categoryKey="label"
          currencyCode={companyDefaultCurrency}
        />
        <LazyBarChartCard
          title="Accounts Payable Aging"
          description="Outstanding vendor bills by age"
          data={apAging}
          dataKey="amount"
          categoryKey="label"
          currencyCode={companyDefaultCurrency}
        />
      </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;