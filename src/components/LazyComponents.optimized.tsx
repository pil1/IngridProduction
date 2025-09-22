/**
 * Optimized lazy loading with advanced chunking strategies
 * Focuses on existing components with performance-optimized loading
 */

import { lazy } from 'react';
import { createOptimizedImport } from '@/utils/chunkOptimizer';
import { LazyLoader } from './LazyLoader';

// High-priority components (preload immediately)
export const OptimizedExpenseDialog = lazy(
  createOptimizedImport(
    'AddEditExpenseDialog',
    () => import('./AddEditExpenseDialog'),
    { priority: 'high', preload: true, prefetchOnHover: true }
  )
);

// Medium-priority components (preload on interaction)
export const OptimizedAiDialog = lazy(
  createOptimizedImport(
    'AiRedesignTemplateDialog',
    () => import('./AiRedesignTemplateDialog'),
    { priority: 'medium', prefetchOnHover: true }
  )
);

export const OptimizedSmartAddDialog = lazy(
  createOptimizedImport(
    'SmartAddDialog',
    () => import('./SmartAddDialog'),
    { priority: 'medium' }
  )
);

// Low-priority components (load only when needed)
export const OptimizedAnalytics = lazy(
  createOptimizedImport(
    'AnalyticsDashboard',
    () => import('./analytics/AnalyticsDashboard'),
    { priority: 'low' }
  )
);

// Enhanced wrapper components with optimized loading
export const LazyExpenseDialog = (props: Record<string, unknown>) => (
  <LazyLoader componentName="Expense Dialog" minDelay={100}>
    <OptimizedExpenseDialog {...props} />
  </LazyLoader>
);

export const LazyAiDialog = (props: Record<string, unknown>) => (
  <LazyLoader componentName="AI Template Designer" minDelay={300}>
    <OptimizedAiDialog {...props} />
  </LazyLoader>
);

export const LazySmartAddDialog = (props: Record<string, unknown>) => (
  <LazyLoader componentName="Smart Add Dialog" minDelay={200}>
    <OptimizedSmartAddDialog {...props} />
  </LazyLoader>
);

export const LazyAnalytics = (props: Record<string, unknown>) => (
  <LazyLoader componentName="Analytics Dashboard" minDelay={400}>
    <OptimizedAnalytics {...props} />
  </LazyLoader>
);

// Preloading utilities for common user flows
export const preloadExpenseFlow = () => {
  createOptimizedImport(
    'ExpenseFlow',
    () => Promise.all([
      import('./AddEditExpenseDialog'),
      import('../pages/ExpenseReviewPage')
    ]),
    { priority: 'high', preload: true }
  );
};

export const preloadAdminFlow = () => {
  createOptimizedImport(
    'AdminFlow',
    () => Promise.all([
      import('../pages/SystemNotificationSettingsPage'),
      import('./AiRedesignTemplateDialog')
    ]),
    { priority: 'medium' }
  );
};

// Preload strategy based on user role
export const initializePreloading = (userRole: string) => {
  switch (userRole) {
    case 'admin':
    case 'super-admin':
      preloadExpenseFlow();
      setTimeout(preloadAdminFlow, 2000); // Delay admin components
      break;
    case 'user':
      preloadExpenseFlow();
      break;
    default:
      // Guest or unknown - minimal preloading
      break;
  }
};