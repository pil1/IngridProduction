import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Database,
  Play,
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

interface FixedDatabaseQueryInspectorProps {
  className?: string;
}

export function FixedDatabaseQueryInspector({ className }: FixedDatabaseQueryInspectorProps) {
  const [executions, setExecutions] = useState<QueryExecution[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<QueryExecution | null>(null);

  const executeQuery = async () => {
    if (!currentQuery.trim()) return;

    setIsExecuting(true);
    const startTime = Date.now();

    try {
      // Simple query execution - just try to run it against Supabase
      let result;
      const queryLower = currentQuery.toLowerCase().trim();

      if (queryLower.includes('profiles')) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .limit(10);

        if (error) throw error;
        result = data;
      } else if (queryLower.includes('companies')) {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .limit(10);

        if (error) throw error;
        result = data;
      } else if (queryLower.includes('expenses')) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .limit(10);

        if (error) throw error;
        result = data;
      } else {
        throw new Error('Simple queries only: try "profiles", "companies", or "expenses"');
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

      setExecutions(prev => [execution, ...prev.slice(0, 19)]); // Keep last 20
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

      setExecutions(prev => [execution, ...prev.slice(0, 19)]);
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

  const sampleQueries = [
    'profiles',
    'companies',
    'expenses'
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Query Executor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Inspector
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Simple table queries only. Try: {sampleQueries.map(q => `"${q}"`).join(', ')}
            </p>
            <Textarea
              placeholder="Enter table name (e.g., 'profiles')"
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              className="h-20 font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={executeQuery}
              disabled={isExecuting || !currentQuery.trim()}
              className="flex items-center gap-2"
            >
              <Play className="h-3 w-3" />
              {isExecuting ? 'Running...' : 'Query'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentQuery('')}
            >
              Clear
            </Button>
            <div className="flex gap-1 ml-auto">
              {sampleQueries.map(query => (
                <Button
                  key={query}
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQuery(query)}
                >
                  {query}
                </Button>
              ))}
            </div>
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
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {executions.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  <Database className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No queries executed yet</p>
                </div>
              ) : (
                executions.map((execution) => (
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
              <ScrollArea className="h-48">
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