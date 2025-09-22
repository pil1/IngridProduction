import { useToast } from '@/hooks/use-toast';

/**
 * Enhanced error handling service for production edge cases
 * Handles network failures, authentication issues, database unavailability, etc.
 */

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  MAINTENANCE_ERROR = 'MAINTENANCE_ERROR'
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  code?: string;
  context?: Record<string, unknown>;
  timestamp: string;
  retryable: boolean;
  userFriendly: boolean;
}

export class ProductionErrorHandler {
  private static instance: ProductionErrorHandler;
  private errorLog: ErrorDetails[] = [];
  private maxLogSize = 100;

  static getInstance(): ProductionErrorHandler {
    if (!ProductionErrorHandler.instance) {
      ProductionErrorHandler.instance = new ProductionErrorHandler();
    }
    return ProductionErrorHandler.instance;
  }

  /**
   * Classify and handle different types of errors
   */
  classifyError(error: unknown): ErrorDetails {
    const timestamp = new Date().toISOString();
    const errorObj = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const errorMessage = typeof errorObj.message === 'string' ? errorObj.message : String(error);
    const errorCode = typeof errorObj.code === 'string' ? errorObj.code : undefined;

    // Network errors
    if (this.isNetworkError(error)) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network connection failed. Please check your internet connection.',
        code: errorCode || 'NETWORK_FAILURE',
        context: { originalError: errorMessage },
        timestamp,
        retryable: true,
        userFriendly: true
      };
    }

    // Authentication errors
    if (this.isAuthError(error)) {
      return {
        type: ErrorType.AUTH_ERROR,
        message: 'Authentication failed. Please log in again.',
        code: errorCode || 'AUTH_FAILURE',
        context: { originalError: errorMessage },
        timestamp,
        retryable: false,
        userFriendly: true
      };
    }

    // Database errors
    if (this.isDatabaseError(error)) {
      return {
        type: ErrorType.DATABASE_ERROR,
        message: 'Database temporarily unavailable. Please try again in a moment.',
        code: errorCode || 'DB_FAILURE',
        context: { originalError: errorMessage },
        timestamp,
        retryable: true,
        userFriendly: true
      };
    }

    // Validation errors
    if (this.isValidationError(error)) {
      return {
        type: ErrorType.VALIDATION_ERROR,
        message: errorMessage || 'Please check your input and try again.',
        code: errorCode || 'VALIDATION_FAILURE',
        context: { originalError: error },
        timestamp,
        retryable: false,
        userFriendly: true
      };
    }

    // Permission errors
    if (this.isPermissionError(error)) {
      return {
        type: ErrorType.PERMISSION_ERROR,
        message: 'You do not have permission to perform this action.',
        code: errorCode || 'PERMISSION_DENIED',
        context: { originalError: errorMessage },
        timestamp,
        retryable: false,
        userFriendly: true
      };
    }

    // Timeout errors
    if (this.isTimeoutError(error)) {
      return {
        type: ErrorType.TIMEOUT_ERROR,
        message: 'Request timed out. Please try again.',
        code: errorCode || 'TIMEOUT',
        context: { originalError: errorMessage },
        timestamp,
        retryable: true,
        userFriendly: true
      };
    }

    // Default to unknown error
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: 'An unexpected error occurred. Please try again or contact support.',
      code: errorCode || 'UNKNOWN',
      context: { originalError: errorMessage },
      timestamp,
      retryable: true,
      userFriendly: true
    };
  }

  /**
   * Handle error with appropriate user feedback and logging
   */
  handleError(error: unknown, context?: Record<string, unknown>): ErrorDetails {
    const errorDetails = this.classifyError(error);

    // Add context if provided
    if (context) {
      errorDetails.context = { ...errorDetails.context, ...context };
    }

    // Log error for debugging
    this.logError(errorDetails);

    // Report to external monitoring if configured
    this.reportError(errorDetails);

    return errorDetails;
  }

  /**
   * Handle error with automatic retry logic
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    retryDelay = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorDetails = this.classifyError(error);

        // Don't retry non-retryable errors
        if (!errorDetails.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        await this.delay(retryDelay * Math.pow(2, attempt - 1));
      }
    }

    throw lastError;
  }

  /**
   * Show user-friendly error toast
   */
  showErrorToast(errorDetails: ErrorDetails, toast: ReturnType<typeof useToast>['toast']) {
    if (!errorDetails.userFriendly) return;

    toast({
      title: this.getErrorTitle(errorDetails.type),
      description: errorDetails.message,
      variant: 'destructive'
    });
  }

  /**
   * Check if the application is in maintenance mode
   */
  async checkMaintenanceMode(): Promise<boolean> {
    try {
      // This could check an external status endpoint or configuration
      // For now, return false (not in maintenance)
      return false;
    } catch (error) {
      // If we can't check, assume not in maintenance
      return false;
    }
  }

  /**
   * Graceful degradation - provide fallback functionality
   */
  provideFallback<T>(primaryOperation: () => Promise<T>, fallback: T): Promise<T> {
    return this.handleWithRetry(primaryOperation, 2, 500)
      .catch(() => {
        console.warn('Primary operation failed, using fallback');
        return Promise.resolve(fallback);
      });
  }

  // Private helper methods
  private isNetworkError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const errorObj = error as Record<string, unknown>;
    return (
      errorObj.code === 'NETWORK_ERROR' ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('network')) ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('fetch')) ||
      errorObj.name === 'NetworkError' ||
      errorObj.code === 'FETCH_ERROR'
    );
  }

  private isAuthError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const errorObj = error as Record<string, unknown>;
    return (
      errorObj.status === 401 ||
      errorObj.code === 'UNAUTHORIZED' ||
      errorObj.code === 'AUTH_ERROR' ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('unauthorized')) ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('authentication'))
    );
  }

  private isDatabaseError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const errorObj = error as Record<string, unknown>;
    return (
      errorObj.code === 'DATABASE_ERROR' ||
      errorObj.code === 'CONNECTION_ERROR' ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('database')) ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('relation')) ||
      (typeof errorObj.code === 'string' && errorObj.code.startsWith('PGRST'))
    );
  }

  private isValidationError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const errorObj = error as Record<string, unknown>;
    return (
      errorObj.status === 400 ||
      errorObj.code === 'VALIDATION_ERROR' ||
      errorObj.name === 'ValidationError' ||
      'errors' in errorObj // Zod validation errors
    );
  }

  private isPermissionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const errorObj = error as Record<string, unknown>;
    return (
      errorObj.status === 403 ||
      errorObj.code === 'PERMISSION_DENIED' ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('permission')) ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('forbidden'))
    );
  }

  private isTimeoutError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const errorObj = error as Record<string, unknown>;
    return (
      errorObj.code === 'TIMEOUT' ||
      errorObj.name === 'TimeoutError' ||
      (typeof errorObj.message === 'string' && errorObj.message.includes('timeout'))
    );
  }

  private logError(errorDetails: ErrorDetails): void {
    // Add to in-memory log
    this.errorLog.unshift(errorDetails);

    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    // Console log for development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error handled:', errorDetails);
    }
  }

  private reportError(errorDetails: ErrorDetails): void {
    // This would integrate with external error reporting services
    // like Sentry, Rollbar, etc. in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to monitoring service
      // Sentry.captureException(errorDetails);
    }
  }

  private getErrorTitle(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK_ERROR:
        return 'Connection Error';
      case ErrorType.AUTH_ERROR:
        return 'Authentication Error';
      case ErrorType.DATABASE_ERROR:
        return 'Service Temporarily Unavailable';
      case ErrorType.VALIDATION_ERROR:
        return 'Validation Error';
      case ErrorType.PERMISSION_ERROR:
        return 'Access Denied';
      case ErrorType.TIMEOUT_ERROR:
        return 'Request Timeout';
      case ErrorType.MAINTENANCE_ERROR:
        return 'Maintenance Mode';
      default:
        return 'Error';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public utility methods
  getErrorLog(): ErrorDetails[] {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }

  getErrorStats(): Record<ErrorType, number> {
    const stats: Record<ErrorType, number> = {} as Record<ErrorType, number>;

    Object.values(ErrorType).forEach(type => {
      stats[type] = 0;
    });

    this.errorLog.forEach(error => {
      stats[error.type] = (stats[error.type] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
export const productionErrorHandler = ProductionErrorHandler.getInstance();

// Hook for easy use in React components
export const useProductionErrorHandler = () => {
  const { toast } = useToast();

  const handleError = (error: unknown, context?: Record<string, unknown>) => {
    const errorDetails = productionErrorHandler.handleError(error, context);
    productionErrorHandler.showErrorToast(errorDetails, toast);
    return errorDetails;
  };

  const handleWithRetry = <T>(
    operation: () => Promise<T>,
    maxRetries?: number,
    retryDelay?: number
  ) => {
    return productionErrorHandler.handleWithRetry(operation, maxRetries, retryDelay);
  };

  const provideFallback = <T>(
    primaryOperation: () => Promise<T>,
    fallback: T
  ) => {
    return productionErrorHandler.provideFallback(primaryOperation, fallback);
  };

  return {
    handleError,
    handleWithRetry,
    provideFallback,
    getErrorStats: () => productionErrorHandler.getErrorStats(),
    clearErrorLog: () => productionErrorHandler.clearErrorLog()
  };
};