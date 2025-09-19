import React, { lazy, Suspense } from 'react';
import PageLoader from './PageLoader';

// Lazy load heavy chart components
const BarChartCard = lazy(() => import('./dashboard/BarChartCard'));
const LineChartCard = lazy(() => import('./dashboard/LineChartCard'));

// Chart loading component
const ChartLoader = () => (
  <div className="flex h-[200px] w-full items-center justify-center">
    <PageLoader text="Loading chart..." />
  </div>
);

// Lazy Bar Chart Component
export const LazyBarChartCard: React.FC<React.ComponentProps<typeof BarChartCard>> = (props) => {
  return (
    <Suspense fallback={<ChartLoader />}>
      <BarChartCard {...props} />
    </Suspense>
  );
};

// Lazy Line Chart Component
export const LazyLineChartCard: React.FC<React.ComponentProps<typeof LineChartCard>> = (props) => {
  return (
    <Suspense fallback={<ChartLoader />}>
      <LineChartCard {...props} />
    </Suspense>
  );
};

export default {
  LazyBarChartCard,
  LazyLineChartCard,
};