import React, { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import PageLoader from './PageLoader';

interface AsyncErrorBoundaryProps {
  children: React.ReactNode;
  fallbackText?: string;
  componentName?: string;
}

const AsyncErrorFallback = ({ error, componentName }: { error: Error; componentName?: string }) => (
  <div className="flex items-center justify-center min-h-[200px] p-4">
    <Alert variant="destructive" className="max-w-md">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Component Loading Error</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          {componentName ? `The ${componentName} component` : 'A component'} failed to load.
        </p>
        <p className="text-sm">
          <strong>Error:</strong> {error.message}
        </p>
        <Button
          size="sm"
          onClick={() => window.location.reload()}
          className="mt-2"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload
        </Button>
      </AlertDescription>
    </Alert>
  </div>
);

const AsyncLoadingFallback = ({ text }: { text?: string }) => (
  <div className="flex items-center justify-center min-h-[200px]">
    <PageLoader text={text} />
  </div>
);

// Wrapper to handle startTransition for lazy loading
const LazyWrapper = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export const AsyncErrorBoundary = ({
  children,
  fallbackText = "Loading component...",
  componentName
}: AsyncErrorBoundaryProps) => {
  return (
    <ErrorBoundary
      fallback={<AsyncErrorFallback error={new Error('Unknown error')} componentName={componentName} />}
      onError={(error, errorInfo) => {
        console.error(`Async component error in ${componentName ?? 'unknown component'}:`, error, errorInfo);
        // In production, send to error reporting service with component context
      }}
    >
      <Suspense fallback={<AsyncLoadingFallback text={fallbackText} />}>
        <LazyWrapper>
          {children}
        </LazyWrapper>
      </Suspense>
    </ErrorBoundary>
  );
};

export default AsyncErrorBoundary;