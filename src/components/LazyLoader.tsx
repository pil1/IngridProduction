import React, { Suspense, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  minDelay?: number;
  componentName?: string;
}

const DefaultLoader = ({ componentName }: { componentName?: string }) => (
  <div className="flex items-center justify-center h-64 min-h-[200px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        {componentName ? `Loading ${componentName}...` : 'Loading...'}
      </p>
    </div>
  </div>
);

/**
 * Enhanced lazy loader with minimum loading time and graceful fallbacks
 * Prevents flash of loading state for fast components
 */
export const LazyLoader: React.FC<LazyLoaderProps> = ({
  children,
  fallback,
  minDelay = 200,
  componentName
}) => {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, minDelay);

    return () => clearTimeout(timer);
  }, [minDelay]);

  const fallbackComponent = showFallback ? (
    fallback || <DefaultLoader componentName={componentName} />
  ) : (
    <div className="min-h-[200px]" /> // Invisible placeholder to prevent layout shift
  );

  return (
    <Suspense fallback={fallbackComponent}>
      {children}
    </Suspense>
  );
};

/**
 * Higher-order component for creating optimized lazy components
 */
export function withLazyLoader<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: React.ReactNode;
    minDelay?: number;
    componentName?: string;
  }
) {
  return React.forwardRef<any, P>((props, ref) => (
    <LazyLoader {...options}>
      <Component {...props} ref={ref} />
    </LazyLoader>
  ));
}

/**
 * Preload a lazy component to improve perceived performance
 */
export async function preloadComponent(
  componentLoader: () => Promise<any>
): Promise<void> {
  try {
    await componentLoader();
  } catch (error) {
    console.warn('Failed to preload component:', error);
  }
}

/**
 * Hook to preload components on user interaction hints
 */
export function usePreloadOnHover(
  componentLoader: () => Promise<any>,
  enabled: boolean = true
) {
  const [hasPreloaded, setHasPreloaded] = useState(false);

  const preload = React.useCallback(() => {
    if (enabled && !hasPreloaded) {
      preloadComponent(componentLoader);
      setHasPreloaded(true);
    }
  }, [componentLoader, enabled, hasPreloaded]);

  return {
    onMouseEnter: preload,
    onFocus: preload,
    hasPreloaded
  };
}