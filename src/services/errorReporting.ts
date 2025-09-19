import { ErrorInfo } from 'react';

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

class ErrorReportingService {
  private isProduction = import.meta.env.PROD;
  private apiEndpoint = '/api/errors'; // Replace with your error reporting endpoint

  async reportError(error: Error, errorInfo?: ErrorInfo, userId?: string): Promise<void> {
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      userId,
      sessionId: this.getSessionId(),
    };

    // Log to console in development
    if (!this.isProduction) {
      console.group('🚨 Error Report');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Report:', errorReport);
      console.groupEnd();
      return;
    }

    // In production, send to error reporting service
    try {
      await this.sendToErrorService(errorReport);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  private async sendToErrorService(errorReport: ErrorReport): Promise<void> {
    // Option 1: Send to your own API
    try {
      await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorReport),
      });
    } catch {
      // Fallback: Store in localStorage for later retry
      this.storeErrorLocally(errorReport);
    }

    // Option 2: Integrate with Sentry (uncomment when ready)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       errorInfo: errorInfo,
    //       user: { id: userId }
    //     }
    //   });
    // }
  }

  private storeErrorLocally(errorReport: ErrorReport): void {
    try {
      const existingErrors = localStorage.getItem('pendingErrorReports');
      const errors = existingErrors ? JSON.parse(existingErrors) : [];
      errors.push(errorReport);

      // Keep only last 10 errors to prevent localStorage bloat
      if (errors.length > 10) {
        errors.splice(0, errors.length - 10);
      }

      localStorage.setItem('pendingErrorReports', JSON.stringify(errors));
    } catch (storageError) {
      console.error('Failed to store error locally:', storageError);
    }
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('error-session-id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('error-session-id', sessionId);
    }
    return sessionId;
  }

  async retryPendingErrors(): Promise<void> {
    if (!this.isProduction) return;

    try {
      const pendingErrors = localStorage.getItem('pendingErrorReports');
      if (!pendingErrors) return;

      const errors = JSON.parse(pendingErrors);
      for (const errorReport of errors) {
        await this.sendToErrorService(errorReport);
      }

      // Clear pending errors after successful retry
      localStorage.removeItem('pendingErrorReports');
    } catch (error) {
      console.error('Failed to retry pending errors:', error);
    }
  }
}

export const errorReportingService = new ErrorReportingService();

// Auto-retry pending errors on app load
if (typeof window !== 'undefined') {
  errorReportingService.retryPendingErrors();
}