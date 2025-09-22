import { useCallback, useEffect, useRef, useState } from "react";

// Performance metrics interface
interface PerformanceMetrics {
  renderTime: number;
  totalRenderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
  mountTime: number;
}

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  SLOW_RENDER: 16, // 60fps threshold
  VERY_SLOW_RENDER: 100, // Renders slower than 100ms are very slow
  TOO_MANY_RENDERS: 50, // More than 50 renders might indicate performance issues
};

export const usePerformanceMonitor = (componentName: string, enabled: boolean = false) => {
  const renderStartTime = useRef<number>();
  const mountTime = useRef<number>(Date.now());
  const renderCountRef = useRef(0);
  const totalRenderTimeRef = useRef(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    totalRenderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    mountTime: 0,
  });

  // Track component lifecycle
  useEffect(() => {
    if (!enabled) return;

    mountTime.current = performance.now();

    return () => {
      if (mountTime.current) {
        const unmountTime = performance.now();
        const totalLifetime = unmountTime - mountTime.current;

        if (totalLifetime > 1000) {
          console.log(`🏁 [Performance] ${componentName} lifetime: ${totalLifetime.toFixed(2)}ms`);
        }
      }
    };
  }, [componentName, enabled]);

  // Track render performance with enhanced metrics
  useEffect(() => {
    if (!enabled) return;

    renderStartTime.current = performance.now();

    const timeoutId = setTimeout(() => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current;

        renderCountRef.current += 1;
        totalRenderTimeRef.current += renderTime;

        const newMetrics: PerformanceMetrics = {
          renderTime,
          totalRenderCount: renderCountRef.current,
          averageRenderTime: totalRenderTimeRef.current / renderCountRef.current,
          lastRenderTime: Date.now(),
          mountTime: mountTime.current,
        };

        setMetrics(newMetrics);

        // Enhanced logging with emojis and severity levels
        if (renderTime > PERFORMANCE_THRESHOLDS.VERY_SLOW_RENDER) {
          console.warn(`🐌 [Performance] Very slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
        } else if (renderTime > PERFORMANCE_THRESHOLDS.SLOW_RENDER) {
          console.warn(`⚠️ [Performance] Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
        }

        if (renderCountRef.current > PERFORMANCE_THRESHOLDS.TOO_MANY_RENDERS) {
          console.warn(`🔄 [Performance] High render count in ${componentName}: ${renderCountRef.current} renders`);
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  });

  const measureAsync = async <T>(operation: () => Promise<T>, operationName: string): Promise<T> => {
    if (!enabled) return operation();

    const start = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - start;

      if (duration > 100) {
        console.log(`⏱️ [Performance] ${componentName}.${operationName}: ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ [Performance] ${componentName}.${operationName} (failed): ${duration.toFixed(2)}ms`);
      throw error;
    }
  };

  const getPerformanceReport = useCallback(() => {
    const report = {
      componentName,
      ...metrics,
      componentAge: Date.now() - mountTime.current,
      isPerforming: metrics.averageRenderTime < PERFORMANCE_THRESHOLDS.SLOW_RENDER,
      hasSlowRenders: metrics.averageRenderTime > PERFORMANCE_THRESHOLDS.SLOW_RENDER,
      hasExcessiveRenders: metrics.totalRenderCount > PERFORMANCE_THRESHOLDS.TOO_MANY_RENDERS,
    };

    if (enabled) {
      console.group(`📊 Performance Report: ${componentName}`);
      console.log('Metrics:', report);
      console.groupEnd();
    }

    return report;
  }, [componentName, metrics, enabled]);

  const resetMetrics = useCallback(() => {
    renderCountRef.current = 0;
    totalRenderTimeRef.current = 0;
    mountTime.current = performance.now();
    setMetrics({
      renderTime: 0,
      totalRenderCount: 0,
      averageRenderTime: 0,
      lastRenderTime: 0,
      mountTime: performance.now(),
    });
  }, []);

  return {
    measureAsync,
    metrics,
    getPerformanceReport,
    resetMetrics,
    isMonitoring: enabled
  };
};

/**
 * Hook to monitor memory usage
 */
export const useMemoryMonitor = (interval = 5000, enabled = false) => {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);

  useEffect(() => {
    if (!enabled || !('memory' in performance)) {
      if (enabled) {
        console.warn('Performance memory API not available');
      }
      return;
    }

    const updateMemoryInfo = () => {
      const memory = (performance as Performance & { memory?: MemoryInfo }).memory;
      if (!memory) return;

      setMemoryInfo(memory);

      // Log memory warnings with emojis
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
      const usagePercent = (usedMB / limitMB) * 100;

      if (usagePercent > 90) {
        console.warn(`🚨 [Memory] High memory usage: ${usedMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`);
      } else if (usagePercent > 70) {
        console.warn(`⚠️ [Memory] Elevated memory usage: ${usedMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`);
      }
    };

    updateMemoryInfo();
    const intervalId = setInterval(updateMemoryInfo, interval);

    return () => clearInterval(intervalId);
  }, [interval, enabled]);

  return memoryInfo;
};

/**
 * Hook to measure and track custom performance metrics
 */
export const useCustomMetrics = () => {
  const metricsRef = useRef<Map<string, number[]>>(new Map());

  const recordMetric = useCallback((name: string, value: number) => {
    const existingValues = metricsRef.current.get(name) || [];
    existingValues.push(value);

    // Keep only the last 100 measurements to prevent memory bloat
    if (existingValues.length > 100) {
      existingValues.shift();
    }

    metricsRef.current.set(name, existingValues);
  }, []);

  const getMetricStats = useCallback((name: string) => {
    const values = metricsRef.current.get(name) || [];
    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

    return {
      count: values.length,
      average: avg,
      min,
      max,
      median,
      latest: values[values.length - 1],
    };
  }, []);

  const measureAsync = useCallback(async <T>(
    name: string,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    try {
      const result = await asyncFn();
      const endTime = performance.now();
      recordMetric(name, endTime - startTime);
      return result;
    } catch (error) {
      const endTime = performance.now();
      recordMetric(`${name}_error`, endTime - startTime);
      throw error;
    }
  }, [recordMetric]);

  const measureSync = useCallback(<T>(
    name: string,
    syncFn: () => T
  ): T => {
    const startTime = performance.now();
    try {
      const result = syncFn();
      const endTime = performance.now();
      recordMetric(name, endTime - startTime);
      return result;
    } catch (error) {
      const endTime = performance.now();
      recordMetric(`${name}_error`, endTime - startTime);
      throw error;
    }
  }, [recordMetric]);

  return {
    recordMetric,
    getMetricStats,
    measureAsync,
    measureSync,
  };
};

// Global performance monitoring utilities
export const logQueryPerformance = (queryKey: string, duration: number) => {
  if (duration > 500) {
    console.warn(`🐌 [Performance] Slow query ${queryKey}: ${duration.toFixed(2)}ms`);
  } else if (duration > 200) {
    console.log(`⏱️ [Performance] Query ${queryKey}: ${duration.toFixed(2)}ms`);
  }
};

export const logNavigationPerformance = (from: string, to: string, duration: number) => {
  if (duration > 500) {
    console.warn(`🐌 [Performance] Slow navigation ${from} → ${to}: ${duration.toFixed(2)}ms`);
  } else if (duration > 200) {
    console.log(`🧭 [Performance] Navigation ${from} → ${to}: ${duration.toFixed(2)}ms`);
  }
};

export const logBundleSize = (bundleName: string, sizeKB: number) => {
  if (sizeKB > 1000) {
    console.warn(`📦 [Performance] Large bundle ${bundleName}: ${sizeKB.toFixed(1)}KB`);
  } else if (sizeKB > 500) {
    console.log(`📦 [Performance] Bundle ${bundleName}: ${sizeKB.toFixed(1)}KB`);
  }
};