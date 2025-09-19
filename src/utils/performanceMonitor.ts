/**
 * Advanced Performance Monitoring System
 * Tracks bundle loading, component rendering, and user experience metrics
 */

import React from 'react';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'loading' | 'rendering' | 'interaction' | 'bundle';
  metadata?: Record<string, any>;
}

interface ComponentMetric {
  name: string;
  mountTime: number;
  renderTime: number;
  propsChanges: number;
  lastRender: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private componentMetrics = new Map<string, ComponentMetric>();
  private observers: PerformanceObserver[] = [];
  private startTimes = new Map<string, number>();

  constructor() {
    this.initializeObservers();
    this.trackVitals();
  }

  /**
   * Initialize performance observers
   */
  private initializeObservers() {
    if (!('PerformanceObserver' in window)) return;

    // Track resource loading (chunks, images, etc.)
    const resourceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('chunk') || entry.name.includes('assets')) {
          this.recordMetric({
            name: `resource_load_${this.getResourceType(entry.name)}`,
            value: entry.duration,
            timestamp: Date.now(),
            category: 'loading',
            metadata: {
              url: entry.name,
              size: 'transferSize' in entry ? (entry as any).transferSize : 0,
              cached: 'transferSize' in entry ? (entry as any).transferSize === 0 : false
            }
          });
        }
      });
    });

    // Track layout shifts and cumulative layout shift
    const layoutObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        this.recordMetric({
          name: 'layout_shift',
          value: entry.value,
          timestamp: Date.now(),
          category: 'rendering',
          metadata: {
            hadRecentInput: entry.hadRecentInput,
            sources: entry.sources?.map((s: any) => s.node?.tagName)
          }
        });
      });
    });

    // Track long tasks (> 50ms)
    const longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        this.recordMetric({
          name: 'long_task',
          value: entry.duration,
          timestamp: Date.now(),
          category: 'interaction',
          metadata: {
            startTime: entry.startTime,
            attribution: 'attribution' in entry ? (entry as any).attribution : []
          }
        });
      });
    });

    try {
      resourceObserver.observe({ entryTypes: ['resource', 'navigation'] });
      this.observers.push(resourceObserver);

      if ('layout-shift' in PerformanceObserver.supportedEntryTypes) {
        layoutObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutObserver);
      }

      if ('longtask' in PerformanceObserver.supportedEntryTypes) {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      }
    } catch (error) {
      console.warn('Failed to initialize performance observers:', error);
    }
  }

  /**
   * Track Core Web Vitals
   */
  private trackVitals() {
    // Track First Contentful Paint
    const fcpObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric({
            name: 'first_contentful_paint',
            value: entry.startTime,
            timestamp: Date.now(),
            category: 'loading'
          });
        }
      });
    });

    // Track Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      this.recordMetric({
        name: 'largest_contentful_paint',
        value: lastEntry.startTime,
        timestamp: Date.now(),
        category: 'loading',
        metadata: {
          element: 'element' in lastEntry ? (lastEntry as any).element?.tagName : null,
          url: 'url' in lastEntry ? (lastEntry as any).url : null
        }
      });
    });

    try {
      fcpObserver.observe({ entryTypes: ['paint'] });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(fcpObserver, lcpObserver);
    } catch (error) {
      console.warn('Failed to track vitals:', error);
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);

    // Log performance issues in development
    if (process.env.NODE_ENV === 'development') {
      if (metric.category === 'loading' && metric.value > 3000) {
        console.warn(`🐌 Slow loading: ${metric.name} took ${metric.value}ms`);
      }
      if (metric.category === 'rendering' && metric.value > 16) {
        console.warn(`🎨 Slow render: ${metric.name} took ${metric.value}ms`);
      }
      if (metric.name === 'long_task') {
        console.warn(`⏱️  Long task detected: ${metric.value}ms`);
      }
    }

    // Keep metrics array manageable
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }

  /**
   * Start timing a component or operation
   */
  startTiming(name: string) {
    this.startTimes.set(name, performance.now());
  }

  /**
   * End timing and record metric
   */
  endTiming(name: string, category: PerformanceMetric['category'] = 'rendering', metadata?: Record<string, any>) {
    const startTime = this.startTimes.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.recordMetric({
        name,
        value: duration,
        timestamp: Date.now(),
        category,
        metadata
      });
      this.startTimes.delete(name);
    }
  }

  /**
   * Track React component performance
   */
  trackComponent(name: string, phase: 'mount' | 'update' | 'unmount', actualDuration?: number) {
    if (!actualDuration) return;

    const existing = this.componentMetrics.get(name) || {
      name,
      mountTime: 0,
      renderTime: 0,
      propsChanges: 0,
      lastRender: 0
    };

    switch (phase) {
      case 'mount':
        existing.mountTime = actualDuration;
        existing.lastRender = Date.now();
        break;
      case 'update':
        existing.renderTime += actualDuration;
        existing.propsChanges += 1;
        existing.lastRender = Date.now();
        break;
    }

    this.componentMetrics.set(name, existing);

    // Record as metric for analysis
    this.recordMetric({
      name: `component_${phase}`,
      value: actualDuration,
      timestamp: Date.now(),
      category: 'rendering',
      metadata: { component: name, phase }
    });
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 60000); // Last minute

    const summary = {
      totalMetrics: this.metrics.length,
      recentMetrics: recentMetrics.length,
      categories: {} as Record<string, number>,
      slowComponents: [] as string[],
      avgLoadTime: 0,
      avgRenderTime: 0,
      longTasks: 0,
      layoutShifts: 0
    };

    // Calculate category distribution
    recentMetrics.forEach(metric => {
      summary.categories[metric.category] = (summary.categories[metric.category] || 0) + 1;
    });

    // Find slow components
    this.componentMetrics.forEach((metric, name) => {
      if (metric.mountTime > 100 || metric.renderTime / metric.propsChanges > 50) {
        summary.slowComponents.push(name);
      }
    });

    // Calculate averages
    const loadingMetrics = recentMetrics.filter(m => m.category === 'loading');
    const renderingMetrics = recentMetrics.filter(m => m.category === 'rendering');

    summary.avgLoadTime = loadingMetrics.length > 0
      ? loadingMetrics.reduce((sum, m) => sum + m.value, 0) / loadingMetrics.length
      : 0;

    summary.avgRenderTime = renderingMetrics.length > 0
      ? renderingMetrics.reduce((sum, m) => sum + m.value, 0) / renderingMetrics.length
      : 0;

    summary.longTasks = recentMetrics.filter(m => m.name === 'long_task').length;
    summary.layoutShifts = recentMetrics.filter(m => m.name === 'layout_shift').length;

    return summary;
  }

  /**
   * Get bundle loading statistics
   */
  getBundleStats() {
    const bundleMetrics = this.metrics.filter(m =>
      m.category === 'loading' && m.name.includes('resource_load')
    );

    const stats = {
      totalBundles: bundleMetrics.length,
      avgLoadTime: 0,
      slowBundles: [] as string[],
      cachedBundles: 0,
      totalSize: 0
    };

    if (bundleMetrics.length > 0) {
      stats.avgLoadTime = bundleMetrics.reduce((sum, m) => sum + m.value, 0) / bundleMetrics.length;
      stats.cachedBundles = bundleMetrics.filter(m => m.metadata?.cached).length;
      stats.totalSize = bundleMetrics.reduce((sum, m) => sum + (m.metadata?.size || 0), 0);
      stats.slowBundles = bundleMetrics
        .filter(m => m.value > 2000)
        .map(m => m.metadata?.url || 'unknown');
    }

    return stats;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      timestamp: Date.now(),
      metrics: this.metrics.slice(-100), // Last 100 metrics
      components: Object.fromEntries(this.componentMetrics),
      summary: this.getSummary(),
      bundleStats: this.getBundleStats()
    };
  }

  /**
   * Get resource type from URL
   */
  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'stylesheet';
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return 'image';
    if (url.includes('chunk')) return 'chunk';
    return 'other';
  }

  /**
   * Clean up observers
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
    this.componentMetrics.clear();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for component performance tracking
 */
export function usePerformanceTracking(componentName: string) {
  const startTime = React.useRef<number>();

  React.useLayoutEffect(() => {
    startTime.current = performance.now();
    return () => {
      if (startTime.current) {
        performanceMonitor.trackComponent(
          componentName,
          'mount',
          performance.now() - startTime.current
        );
      }
    };
  }, [componentName]);
}

/**
 * Higher-order component for automatic performance tracking
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  name?: string
) {
  const componentName = name || Component.displayName || Component.name || 'Unknown';

  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    usePerformanceTracking(componentName);
    return React.createElement(Component, { ...props, ref });
  });

  WrappedComponent.displayName = `withPerformanceTracking(${componentName})`;
  return WrappedComponent;
}

// Initialize global performance tracking
if (typeof window !== 'undefined') {
  // Track page load completion
  window.addEventListener('load', () => {
    performanceMonitor.recordMetric({
      name: 'page_load_complete',
      value: performance.now(),
      timestamp: Date.now(),
      category: 'loading'
    });
  });

  // Log performance summary periodically in development
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const summary = performanceMonitor.getSummary();
      if (summary.recentMetrics > 0) {
        console.group('📊 Performance Summary (Last 60s)');
        console.log('Metrics recorded:', summary.recentMetrics);
        console.log('Avg load time:', Math.round(summary.avgLoadTime), 'ms');
        console.log('Avg render time:', Math.round(summary.avgRenderTime), 'ms');
        if (summary.longTasks > 0) {
          console.warn('Long tasks detected:', summary.longTasks);
        }
        if (summary.slowComponents.length > 0) {
          console.warn('Slow components:', summary.slowComponents);
        }
        console.groupEnd();
      }
    }, 60000);
  }
}