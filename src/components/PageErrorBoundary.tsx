import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  pageName?: string;
}

const PageErrorFallback = ({ error, pageName }: { error: Error; pageName?: string }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Page Error</AlertTitle>
          <AlertDescription>
            {pageName ? `The ${pageName} page` : 'This page'} encountered an error and couldn't load properly.
            <br /><br />
            <strong>Error:</strong> {error.message}
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Page
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export const PageErrorBoundary = ({ children, pageName }: PageErrorBoundaryProps) => {
  return (
    <ErrorBoundary
      fallback={<PageErrorFallback error={new Error('Unknown error')} pageName={pageName} />}
      onError={(error, errorInfo) => {
        console.error(`Page error in ${pageName ?? 'unknown page'}:`, error, errorInfo);
        // In production, send to error reporting service with page context
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default PageErrorBoundary;