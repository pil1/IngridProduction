/**
 * Diagnostic Tools Component
 *
 * Helps identify component loading and runtime issues
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Component Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div>
                  <strong>Error:</strong> {this.state.error?.message}
                </div>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">
                      Error Details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Component to test if all UI components are loading correctly
export const ComponentHealthCheck: React.FC = () => {
  const [results, setResults] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const testComponents = async () => {
      const tests: Record<string, () => Promise<boolean>> = {
        'Card': async () => {
          try {
            const { Card } = await import('@/components/ui/card');
            return !!Card;
          } catch { return false; }
        },
        'Button': async () => {
          try {
            const { Button } = await import('@/components/ui/button');
            return !!Button;
          } catch { return false; }
        },
        'Badge': async () => {
          try {
            const { Badge } = await import('@/components/ui/badge');
            return !!Badge;
          } catch { return false; }
        },
        'Progress': async () => {
          try {
            const { Progress } = await import('@/components/ui/progress');
            return !!Progress;
          } catch { return false; }
        },
        'EnhancedExpenseTableV2': async () => {
          try {
            const { EnhancedExpenseTableV2 } = await import('@/components/expenses/enhanced/EnhancedExpenseTableV2');
            return !!EnhancedExpenseTableV2;
          } catch { return false; }
        },
        'AIAnalyticsDashboard': async () => {
          try {
            const { AIAnalyticsDashboard } = await import('@/components/analytics/AIAnalyticsDashboard');
            return !!AIAnalyticsDashboard;
          } catch { return false; }
        }
      };

      const newResults: Record<string, boolean> = {};
      for (const [name, test] of Object.entries(tests)) {
        try {
          newResults[name] = await test();
        } catch (error) {
          console.error(`Failed to test ${name}:`, error);
          newResults[name] = false;
        }
      }
      setResults(newResults);
    };

    testComponents();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Component Health Check
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(results).map(([name, success]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-sm">{name}</span>
              <div className={`w-3 h-3 rounded-full ${success ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          ))}
          {Object.keys(results).length === 0 && (
            <div className="text-sm text-gray-500">Testing components...</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};