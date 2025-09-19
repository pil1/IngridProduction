import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface NotificationErrorBoundaryProps {
  children: React.ReactNode;
}

const NotificationErrorFallback = ({ error }: { error: Error }) => (
  <Alert variant="destructive" className="m-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Notification System Error</AlertTitle>
    <AlertDescription>
      The notification system encountered an error: {error.message}.
      Please refresh the page or contact support if the issue persists.
    </AlertDescription>
  </Alert>
);

export const NotificationErrorBoundary = ({ children }: NotificationErrorBoundaryProps) => {
  return (
    <ErrorBoundary
      fallback={NotificationErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Notification system error:', error, errorInfo);
        // In production, send to error reporting service
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default NotificationErrorBoundary;