import { useEffect, useRef } from "react";

export const usePerformanceMonitor = (componentName: string, enabled: boolean = false) => {
  const renderStartTime = useRef<number>();
  const mountTime = useRef<number>();

  useEffect(() => {
    if (!enabled) return;

    mountTime.current = performance.now();
    
    return () => {
      if (mountTime.current) {
        const unmountTime = performance.now();
        const totalLifetime = unmountTime - mountTime.current;
        
        if (totalLifetime > 1000) { // Log if component lived longer than 1 second
          console.log(`[Performance] ${componentName} lifetime: ${totalLifetime.toFixed(2)}ms`);
        }
      }
    };
  }, [componentName, enabled]);

  useEffect(() => {
    if (!enabled) return;

    renderStartTime.current = performance.now();
    
    // Use setTimeout to measure render completion
    const timeoutId = setTimeout(() => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current;
        
        if (renderTime > 16) { // Log if render takes longer than 16ms (60fps threshold)
          console.log(`[Performance] ${componentName} render: ${renderTime.toFixed(2)}ms`);
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
      
      if (duration > 100) { // Log if async operation takes longer than 100ms
        console.log(`[Performance] ${componentName}.${operationName}: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.log(`[Performance] ${componentName}.${operationName} (failed): ${duration.toFixed(2)}ms`);
      throw error;
    }
  };

  return { measureAsync };
};

// Global performance monitoring utilities
export const logQueryPerformance = (queryKey: string, duration: number) => {
  if (duration > 500) { // Log slow queries
    console.log(`[Performance] Query ${queryKey}: ${duration.toFixed(2)}ms`);
  }
};

export const logNavigationPerformance = (from: string, to: string, duration: number) => {
  if (duration > 200) { // Log slow navigations
    console.log(`[Performance] Navigation ${from} → ${to}: ${duration.toFixed(2)}ms`);
  };
}