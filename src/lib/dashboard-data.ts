// src/lib/dashboard-data.ts

import { format, subMonths, eachMonthOfInterval } from 'date-fns';

// Helper to generate random numbers within a range
const getRandom = (min: number, max: number) => Math.random() * (max - min) + min;
const getRandomInt = (min: number, max: number) => Math.floor(getRandom(min, max));

// --- Simulated Expense Data ---
interface ExpenseCategoryData {
  name: string;
  amount: number;
}

export const getSimulatedExpenseCategories = (): ExpenseCategoryData[] => {
  return [
    { name: 'Travel', amount: getRandom(500, 2000) },
    { name: 'Office Supplies', amount: getRandom(200, 800) },
    { name: 'Software Subscriptions', amount: getRandom(1000, 3000) },
    { name: 'Marketing', amount: getRandom(300, 1500) },
    { name: 'Utilities', amount: getRandom(100, 500) },
    { name: 'Meals & Entertainment', amount: getRandom(400, 1200) },
  ].sort((a, b) => b.amount - a.amount); // Sort by amount descending
};

interface MonthlyExpenseData {
  month: string;
  expenses: number;
}

export const getSimulatedMonthlyExpenses = (numMonths: number = 6): MonthlyExpenseData[] => {
  const endDate = new Date();
  const startDate = subMonths(endDate, numMonths - 1);
  const months = eachMonthOfInterval({ start: startDate, end: endDate });

  return months.map(date => ({
    month: format(date, 'MMM yy'),
    expenses: getRandom(5000, 15000),
  }));
};

// --- Simulated Revenue Data ---
interface MonthlyRevenueData {
  month: string;
  revenue: number;
}

export const getSimulatedMonthlyRevenue = (numMonths: number = 6): MonthlyRevenueData[] => {
  const endDate = new Date();
  const startDate = subMonths(endDate, numMonths - 1);
  const months = eachMonthOfInterval({ start: startDate, end: endDate });

  return months.map(date => ({
    month: format(date, 'MMM yy'),
    revenue: getRandom(20000, 50000),
  }));
};

// --- Simulated Vendor Spend Data ---
interface VendorSpendData {
  vendor: string;
  spend: number;
}

export const getSimulatedVendorSpend = (): VendorSpendData[] => {
  return [
    { vendor: 'Cloud Services Inc.', spend: getRandom(3000, 8000) },
    { vendor: 'Office Depot', spend: getRandom(1000, 2500) },
    { vendor: 'Marketing Agency X', spend: getRandom(2000, 6000) },
    { vendor: 'Travel Solutions', spend: getRandom(1500, 4000) },
    { vendor: 'Utility Co.', spend: getRandom(500, 1500) },
  ].sort((a, b) => b.spend - a.spend);
};

// --- Simulated Customer Sales Data ---
interface CustomerSalesData {
  customer: string;
  sales: number;
}

export const getSimulatedCustomerSales = (): CustomerSalesData[] => {
  return [
    { customer: 'Acme Corp', sales: getRandom(10000, 30000) },
    { customer: 'Globex Inc.', sales: getRandom(8000, 25000) },
    { customer: 'Soylent Corp', sales: getRandom(5000, 15000) },
    { customer: 'Initech', sales: getRandom(3000, 10000) },
    { customer: 'Umbrella Corp', sales: getRandom(2000, 8000) },
  ].sort((a, b) => b.sales - a.sales);
};

// --- Simulated AR/AP Aging Data ---
interface AgingBucket {
  label: string;
  amount: number;
}

export const getSimulatedARAging = (): AgingBucket[] => {
  return [
    { label: 'Current', amount: getRandom(15000, 40000) },
    { label: '1-30 Days Overdue', amount: getRandom(5000, 15000) },
    { label: '31-60 Days Overdue', amount: getRandom(2000, 8000) },
    { label: '61-90 Days Overdue', amount: getRandom(1000, 5000) },
    { label: '90+ Days Overdue', amount: getRandom(500, 3000) },
  ];
};

export const getSimulatedAPAging = (): AgingBucket[] => {
  return [
    { label: 'Current', amount: getRandom(10000, 30000) },
    { label: '1-30 Days Overdue', amount: getRandom(3000, 10000) },
    { label: '31-60 Days Overdue', amount: getRandom(1000, 5000) },
    { label: '61-90 Days Overdue', amount: getRandom(500, 2000) },
    { label: '90+ Days Overdue', amount: getRandom(100, 1000) },
  ];
};

// --- Simulated Key Metrics ---
interface KeyMetric {
  label: string;
  value: number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
}

export const getSimulatedKeyMetrics = (): KeyMetric[] => {
  return [
    { label: 'Total Revenue (MTD)', value: getRandom(15000, 30000), unit: '$', trend: 'up' },
    { label: 'Total Expenses (MTD)', value: getRandom(5000, 10000), unit: '$', trend: 'down' },
    { label: 'Profit Margin', value: getRandom(20, 40), unit: '%', trend: 'up' },
    { label: 'Open Invoices', value: getRandomInt(10, 50), trend: 'stable' },
    { label: 'Overdue Bills', value: getRandomInt(2, 15), trend: 'up' },
  ];
};