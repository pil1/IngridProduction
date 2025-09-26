import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Terminal,
  Trash2,
  Search,
  Filter,
  Download,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsoleMessage {
  id: string;
  timestamp: Date;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
  stack?: string;
  args?: any[];
}

interface ConsoleViewerProps {
  className?: string;
  maxMessages?: number;
}

const levelIcons = {
  log: Terminal,
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
  debug: Bug
};

const levelColors = {
  log: 'text-gray-600',
  info: 'text-blue-600',
  warn: 'text-yellow-600',
  error: 'text-red-600',
  debug: 'text-purple-600'
};

export function ConsoleViewer({ className, maxMessages = 500 }: ConsoleViewerProps) {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [isCapturing, setIsCapturing] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const originalConsole = useRef<typeof console>();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (!originalConsole.current) {
      originalConsole.current = { ...console };
    }

    const interceptConsole = (level: keyof typeof levelIcons) => {
      const original = originalConsole.current![level];
      console[level] = (...args: any[]) => {
        // Call original console method
        original.apply(console, args);

        if (isCapturing) {
          const message: ConsoleMessage = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            level,
            message: args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '),
            source: getCallStack(),
            args
          };

          if (level === 'error' && args[0] instanceof Error) {
            message.stack = args[0].stack;
          }

          setMessages(prev => {
            const updated = [...prev, message];
            if (updated.length > maxMessages) {
              return updated.slice(-maxMessages);
            }
            return updated;
          });
        }
      };
    };

    // Intercept all console methods
    ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
      interceptConsole(level as keyof typeof levelIcons);
    });

    // Scroll to bottom when messages update
    setTimeout(scrollToBottom, 100);

    return () => {
      // Restore original console methods
      if (originalConsole.current) {
        Object.assign(console, originalConsole.current);
      }
    };
  }, [isCapturing, maxMessages]);

  const getCallStack = (): string => {
    try {
      throw new Error();
    } catch (e: any) {
      const stack = e.stack?.split('\n');
      // Find the first line that's not from this component
      const relevantLine = stack?.find((line: string) =>
        line.includes('.tsx') || line.includes('.ts') || line.includes('.js')
      );
      return relevantLine?.trim().replace(/^\s*at\s+/, '') || 'Unknown';
    }
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = msg.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         msg.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === 'all' || msg.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const clearMessages = () => {
    setMessages([]);
  };

  const exportLogs = () => {
    const data = filteredMessages.map(msg => ({
      timestamp: msg.timestamp.toISOString(),
      level: msg.level,
      message: msg.message,
      source: msg.source,
      stack: msg.stack
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleCapture = () => {
    setIsCapturing(!isCapturing);
  };

  return (
    <Card className={cn('h-96', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Console Viewer
            <Badge variant={isCapturing ? 'default' : 'secondary'}>
              {isCapturing ? 'Capturing' : 'Paused'}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCapture}
            >
              {isCapturing ? 'Pause' : 'Resume'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="h-8 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Levels</option>
            <option value="log">Log</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-72" ref={scrollAreaRef}>
          <div className="p-4 space-y-2">
            {filteredMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No console messages to display</p>
                {searchTerm && <p className="text-xs">Try adjusting your search or filter</p>}
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const IconComponent = levelIcons[msg.level];
                return (
                  <div
                    key={msg.id}
                    className="flex gap-2 p-2 rounded text-xs hover:bg-muted/50 transition-colors"
                  >
                    <IconComponent className={cn('h-3 w-3 mt-0.5 flex-shrink-0', levelColors[msg.level])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                        <Badge variant="secondary" className="text-xs h-4">
                          {msg.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {msg.source}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-xs">
                        {msg.message}
                      </pre>
                      {msg.stack && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Stack trace
                          </summary>
                          <pre className="text-xs text-muted-foreground mt-1 pl-4 border-l border-muted">
                            {msg.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}