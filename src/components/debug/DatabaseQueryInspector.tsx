import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Database,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface QueryExecution {
  id: string;
  timestamp: Date;
  query: string;
  duration: number;
  status: 'success' | 'error';
  result?: any;
  error?: string;
  rowCount?: number;
}

interface DatabaseQueryInspectorProps {
  className?: string;
}

export function DatabaseQueryInspector({ className }: DatabaseQueryInspectorProps) {
  const [executions, setExecutions] = useState<QueryExecution[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<QueryExecution | null>(null);

  useEffect(() => {
    // Intercept Supabase queries by monkey-patching the client
    const originalFrom = supabase.from.bind(supabase);

    supabase.from = (table: string) => {
      const builder = originalFrom(table);
      const originalSelect = builder.select.bind(builder);
      const originalInsert = builder.insert.bind(builder);
      const originalUpdate = builder.update.bind(builder);
      const originalDelete = builder.delete.bind(builder);

      const trackQuery = (operation: string, params?: any) => {
        const queryString = `${operation} FROM ${table}${params ? ` WITH ${JSON.stringify(params)}` : ''}`;
        const startTime = Date.now();

        return {
          then: (callback: Function) => {
            const execution: QueryExecution = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              timestamp: new Date(),
              query: queryString,
              duration: Date.now() - startTime,
              status: 'success'
            };

            // Track the execution
            setExecutions(prev => [...prev, execution].slice(-100)); // Keep last 100

            return callback && callback();
          },
          catch: (errorCallback: Function) => {
            const execution: QueryExecution = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              timestamp: new Date(),
              query: queryString,
              duration: Date.now() - startTime,
              status: 'error',
              error: 'Query execution failed'
            };

            setExecutions(prev => [...prev, execution].slice(-100));

            return errorCallback && errorCallback();
          }
        };
      };

      builder.select = (columns?: string) => {
        const result = originalSelect(columns);

        // Intercept the actual execution
        const originalThen = result.then.bind(result);
        result.then = (callback: Function) => {
          const startTime = Date.now();
          return originalThen((response: any) => {
            const execution: QueryExecution = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              timestamp: new Date(),
              query: `SELECT ${columns || '*'} FROM ${table}`,
              duration: Date.now() - startTime,
              status: response.error ? 'error' : 'success',
              result: response.data,
              error: response.error?.message,
              rowCount: response.data?.length
            };

            setExecutions(prev => [...prev, execution].slice(-100));

            return callback ? callback(response) : response;
          });
        };

        return result;
      };

      return builder;
    };

    return () => {
      // Cleanup if needed
    };
  }, []);

  const executeQuery = async () => {
    if (!currentQuery.trim()) return;

    setIsExecuting(true);
    const startTime = Date.now();

    try {
      // Parse the query to determine the operation
      const queryLower = currentQuery.toLowerCase().trim();
      let result;

      if (queryLower.startsWith('select')) {
        // Extract table name (simplified parser)
        const match = queryLower.match(/from\s+(\w+)/);
        const table = match?.[1];

        if (table) {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(100);

          if (error) throw error;
          result = data;
        } else {
          throw new Error('Could not parse table name from query');
        }
      } else {
        throw new Error('Only SELECT queries are supported in this interface');
      }

      const execution: QueryExecution = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        query: currentQuery,
        duration: Date.now() - startTime,
        status: 'success',
        result,
        rowCount: result?.length
      };

      setExecutions(prev => [...prev, execution].slice(-100));
      setSelectedExecution(execution);

    } catch (error: any) {
      const execution: QueryExecution = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        query: currentQuery,
        duration: Date.now() - startTime,
        status: 'error',
        error: error.message
      };

      setExecutions(prev => [...prev, execution].slice(-100));
      setSelectedExecution(execution);
    }

    setIsExecuting(false);
  };

  const clearHistory = () => {
    setExecutions([]);
    setSelectedExecution(null);
  };

  const exportHistory = () => {
    const data = executions.map(exec => ({
      timestamp: exec.timestamp.toISOString(),
      query: exec.query,
      duration: exec.duration,
      status: exec.status,
      rowCount: exec.rowCount,
      error: exec.error
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-history-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyQuery = (query: string) => {
    navigator.clipboard.writeText(query);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Query Executor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Query Executor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter your SQL query (SELECT statements only)..."
            value={currentQuery}
            onChange={(e) => setCurrentQuery(e.target.value)}
            className="min-h-[100px] font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={executeQuery}
              disabled={isExecuting || !currentQuery.trim()}
              className="flex items-center gap-2"
            >
              <Play className="h-3 w-3" />
              {isExecuting ? 'Executing...' : 'Execute'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentQuery('')}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Query History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Query History ({executions.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportHistory}>
                <Download className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={clearHistory}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {executions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No queries executed yet</p>
                </div>
              ) : (
                executions.reverse().map((execution) => (
                  <div
                    key={execution.id}
                    className={cn(
                      'p-3 rounded border cursor-pointer transition-colors',
                      'hover:bg-muted/50',
                      selectedExecution?.id === execution.id && 'bg-muted'
                    )}
                    onClick={() => setSelectedExecution(execution)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {execution.status === 'success' ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-red-600" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {execution.timestamp.toLocaleTimeString()}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {execution.duration}ms
                      </Badge>
                      {execution.rowCount !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          {execution.rowCount} rows
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyQuery(execution.query);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <code className="text-xs block truncate bg-muted p-1 rounded">
                      {execution.query}
                    </code>
                    {execution.error && (
                      <p className="text-xs text-red-600 mt-1">{execution.error}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Query Results */}
      {selectedExecution && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Query Results
              {selectedExecution.status === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedExecution.status === 'error' ? (
              <div className="text-red-600 bg-red-50 p-4 rounded">
                <p className="font-medium">Error:</p>
                <p className="text-sm mt-1">{selectedExecution.error}</p>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(selectedExecution.result, null, 2)}
                </pre>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}