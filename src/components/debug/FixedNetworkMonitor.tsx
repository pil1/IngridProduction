import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Globe,
  ArrowUp,
  ArrowDown,
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
  duration?: number;
  size?: string;
}

interface FixedNetworkMonitorProps {
  className?: string;
}

export function FixedNetworkMonitor({ className }: FixedNetworkMonitorProps) {
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequest | null>(null);

  // Simplified network monitoring - just track fetch calls
  useEffect(() => {
    if (!isMonitoring) return;

    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      const method = (input instanceof Request ? input.method : init?.method) || 'GET';
      const startTime = Date.now();

      const requestId = Date.now() + Math.random().toString(36).substr(2, 9);

      // Add initial request
      const request: NetworkRequest = {
        id: requestId,
        timestamp: new Date(),
        method: method.toUpperCase(),
        url,
        status: undefined,
        duration: undefined
      };

      setRequests(prev => [request, ...prev.slice(0, 49)]); // Keep last 50

      try {
        const response = await originalFetch(input, init);
        const duration = Date.now() - startTime;

        // Update with response
        setRequests(prev =>
          prev.map(req =>
            req.id === requestId
              ? {
                  ...req,
                  status: response.status,
                  duration,
                  size: response.headers.get('content-length')
                    ? `${Math.round(parseInt(response.headers.get('content-length')!) / 1024)}KB`
                    : 'Unknown'
                }
              : req
          )
        );

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        setRequests(prev =>
          prev.map(req =>
            req.id === requestId
              ? { ...req, status: 0, duration }
              : req
          )
        );

        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
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
      duration: req.duration
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
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-yellow-600';
    if (status >= 400) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className={cn('space-y-4', className)}>
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
              <Button variant="outline" size="sm" onClick={exportRequests}>
                <Download className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={clearRequests}>
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
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {filteredRequests.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Globe className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {requests.length === 0
                      ? 'No network requests captured yet'
                      : 'No requests match your search'
                    }
                  </p>
                </div>
              ) : (
                filteredRequests.map((request) => (
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
                      {request.size && (
                        <Badge variant="outline" className="text-xs">
                          {request.size}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {request.url}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

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
          <CardContent>
            <div>
              <h4 className="text-sm font-medium mb-2">URL</h4>
              <code className="text-xs bg-muted p-2 rounded block break-all">
                {selectedRequest.url}
              </code>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}