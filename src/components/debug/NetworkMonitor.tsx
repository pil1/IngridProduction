import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Globe,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Trash2,
  Download,
  Pause,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NetworkRequest {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  duration?: number;
  requestSize?: number;
  responseSize?: number;
  headers?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  error?: string;
}

interface NetworkMonitorProps {
  className?: string;
}

const statusColors = {
  1: 'text-blue-600',   // 1xx Informational
  2: 'text-green-600',  // 2xx Success
  3: 'text-yellow-600', // 3xx Redirection
  4: 'text-red-600',    // 4xx Client Error
  5: 'text-red-600',    // 5xx Server Error
};

export function NetworkMonitor({ className }: NetworkMonitorProps) {
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequest | null>(null);
  const originalFetch = useRef<typeof window.fetch>();
  const originalXMLHttpRequest = useRef<typeof XMLHttpRequest>();

  useEffect(() => {
    if (!originalFetch.current) {
      originalFetch.current = window.fetch;
    }

    if (!originalXMLHttpRequest.current) {
      originalXMLHttpRequest.current = window.XMLHttpRequest;
    }

    // Intercept fetch requests
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      const method = (input instanceof Request ? input.method : init?.method) || 'GET';
      const startTime = Date.now();

      if (!isMonitoring) {
        return originalFetch.current!(input, init);
      }

      const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
      const requestBody = init?.body ? JSON.stringify(init.body) : undefined;
      const requestSize = requestBody ? new Blob([requestBody]).size : 0;

      // Create initial request record
      const request: NetworkRequest = {
        id: requestId,
        timestamp: new Date(),
        method: method.toUpperCase(),
        url,
        requestSize,
        requestBody: requestBody ? JSON.parse(requestBody) : undefined,
        headers: init?.headers as Record<string, string>
      };

      setRequests(prev => [...prev, request].slice(-200)); // Keep last 200 requests

      try {
        const response = await originalFetch.current!(input, init);
        const duration = Date.now() - startTime;

        // Clone response to read body without consuming it
        const responseClone = response.clone();
        let responseBody: any;
        let responseSize = 0;

        try {
          const text = await responseClone.text();
          responseSize = new Blob([text]).size;
          try {
            responseBody = JSON.parse(text);
          } catch {
            responseBody = text;
          }
        } catch {
          // Failed to read response body
        }

        // Update request with response data
        setRequests(prev =>
          prev.map(req =>
            req.id === requestId
              ? {
                  ...req,
                  status: response.status,
                  statusText: response.statusText,
                  duration,
                  responseSize,
                  responseBody
                }
              : req
          )
        );

        return response;
      } catch (error: any) {
        const duration = Date.now() - startTime;

        // Update request with error
        setRequests(prev =>
          prev.map(req =>
            req.id === requestId
              ? {
                  ...req,
                  duration,
                  error: error.message,
                  status: 0
                }
              : req
          )
        );

        throw error;
      }
    };

    // Intercept XMLHttpRequest
    window.XMLHttpRequest = class extends originalXMLHttpRequest.current! {
      private _method?: string;
      private _url?: string;
      private _startTime?: number;
      private _requestId?: string;

      constructor() {
        super();

        this.addEventListener('loadstart', () => {
          if (!isMonitoring) return;

          this._startTime = Date.now();
          this._requestId = Date.now() + Math.random().toString(36).substr(2, 9);

          const request: NetworkRequest = {
            id: this._requestId,
            timestamp: new Date(),
            method: this._method || 'GET',
            url: this._url || ''
          };

          setRequests(prev => [...prev, request].slice(-200));
        });

        this.addEventListener('loadend', () => {
          if (!this._requestId || !this._startTime) return;

          const duration = Date.now() - this._startTime;

          setRequests(prev =>
            prev.map(req =>
              req.id === this._requestId
                ? {
                    ...req,
                    status: this.status,
                    statusText: this.statusText,
                    duration,
                    responseSize: this.responseText ? new Blob([this.responseText]).size : 0,
                    responseBody: this.responseText
                  }
                : req
            )
          );
        });

        this.addEventListener('error', () => {
          if (!this._requestId || !this._startTime) return;

          const duration = Date.now() - this._startTime;

          setRequests(prev =>
            prev.map(req =>
              req.id === this._requestId
                ? {
                    ...req,
                    duration,
                    error: 'Network error',
                    status: 0
                  }
                : req
            )
          );
        });
      }

      open(method: string, url: string | URL, async?: boolean, user?: string, password?: string) {
        this._method = method;
        this._url = url.toString();
        return super.open(method, url, async, user, password);
      }
    };

    return () => {
      // Restore original methods
      if (originalFetch.current) {
        window.fetch = originalFetch.current;
      }
      if (originalXMLHttpRequest.current) {
        window.XMLHttpRequest = originalXMLHttpRequest.current;
      }
    };
  }, [isMonitoring]);

  const filteredRequests = requests.filter(req =>
    req.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.method.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearRequests = () => {
    setRequests([]);
    setSelectedRequest(null);
  };

  const exportRequests = () => {
    const data = filteredRequests.map(req => ({
      timestamp: req.timestamp.toISOString(),
      method: req.method,
      url: req.url,
      status: req.status,
      duration: req.duration,
      requestSize: req.requestSize,
      responseSize: req.responseSize,
      error: req.error
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-requests-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-600';
    const category = Math.floor(status / 100) as keyof typeof statusColors;
    return statusColors[category] || 'text-gray-600';
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Network Requests List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Network Monitor
              <Badge variant={isMonitoring ? 'default' : 'secondary'}>
                {isMonitoring ? 'Recording' : 'Paused'}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMonitoring(!isMonitoring)}
              >
                {isMonitoring ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportRequests}
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearRequests}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {filteredRequests.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No network requests to display</p>
                </div>
              ) : (
                filteredRequests.reverse().map((request) => (
                  <div
                    key={request.id}
                    className={cn(
                      'p-3 rounded border cursor-pointer transition-colors',
                      'hover:bg-muted/50',
                      selectedRequest?.id === request.id && 'bg-muted'
                    )}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {request.method}
                      </Badge>
                      <span className={cn('text-sm font-medium', getStatusColor(request.status))}>
                        {request.status || 'Pending'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {request.timestamp.toLocaleTimeString()}
                      </span>
                      {request.duration && (
                        <Badge variant="secondary" className="text-xs">
                          {request.duration}ms
                        </Badge>
                      )}
                      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        {request.requestSize && (
                          <span className="flex items-center gap-1">
                            <ArrowUp className="h-3 w-3" />
                            {formatBytes(request.requestSize)}
                          </span>
                        )}
                        {request.responseSize && (
                          <span className="flex items-center gap-1">
                            <ArrowDown className="h-3 w-3" />
                            {formatBytes(request.responseSize)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {request.url}
                    </div>
                    {request.error && (
                      <p className="text-xs text-red-600 mt-1">{request.error}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Request Details */}
      {selectedRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Request Details
              <Badge variant="outline">{selectedRequest.method}</Badge>
              <span className={cn('text-sm', getStatusColor(selectedRequest.status))}>
                {selectedRequest.status || 'Pending'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">URL</h4>
              <code className="text-xs bg-muted p-2 rounded block break-all">
                {selectedRequest.url}
              </code>
            </div>

            {selectedRequest.requestBody && (
              <div>
                <h4 className="text-sm font-medium mb-2">Request Body</h4>
                <ScrollArea className="h-32">
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded">
                    {JSON.stringify(selectedRequest.requestBody, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}

            {selectedRequest.responseBody && (
              <div>
                <h4 className="text-sm font-medium mb-2">Response Body</h4>
                <ScrollArea className="h-32">
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded">
                    {typeof selectedRequest.responseBody === 'string'
                      ? selectedRequest.responseBody
                      : JSON.stringify(selectedRequest.responseBody, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}

            {selectedRequest.error && (
              <div>
                <h4 className="text-sm font-medium mb-2">Error</h4>
                <div className="text-red-600 bg-red-50 p-2 rounded text-sm">
                  {selectedRequest.error}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}