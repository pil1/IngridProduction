import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Terminal,
  Trash2,
  Search,
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
}

interface FixedConsoleViewerProps {
  className?: string;
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

export function FixedConsoleViewer({ className }: FixedConsoleViewerProps) {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [isCapturing, setIsCapturing] = useState(true);

  // Simplified console interception - only capture new messages
  useEffect(() => {
    if (!isCapturing) return;

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addMessage = (level: ConsoleMessage['level'], args: any[]) => {
      const message: ConsoleMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        level,
        message: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
        source: 'Application'
      };

      setMessages(prev => [...prev.slice(-99), message]); // Keep last 100
    };

    // Override console methods
    console.log = (...args) => {
      originalLog.apply(console, args);
      addMessage('log', args);
    };

    console.error = (...args) => {
      originalError.apply(console, args);
      addMessage('error', args);
    };

    console.warn = (...args) => {
      originalWarn.apply(console, args);
      addMessage('warn', args);
    };

    console.info = (...args) => {
      originalInfo.apply(console, args);
      addMessage('info', args);
    };

    // Cleanup
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, [isCapturing]);

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = msg.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === 'all' || msg.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const clearMessages = () => setMessages([]);

  const exportLogs = () => {
    const data = filteredMessages.map(msg => ({
      timestamp: msg.timestamp.toISOString(),
      level: msg.level,
      message: msg.message,
      source: msg.source
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

  // Add a test message on mount
  useEffect(() => {
    console.log('Console viewer initialized and working!');
  }, []);

  return (
    <Card className={cn('h-80', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Console Viewer
            <Badge variant={isCapturing ? 'default' : 'secondary'}>
              {isCapturing ? 'Active' : 'Paused'}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCapturing(!isCapturing)}
            >
              {isCapturing ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="outline" size="sm" onClick={clearMessages}>
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
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
        <ScrollArea className="h-48">
          <div className="p-4 space-y-2">
            {filteredMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                <Terminal className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {messages.length === 0
                    ? 'No console messages yet. Try console.log("Hello Debug!")'
                    : 'No messages match your search.'
                  }
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const IconComponent = levelIcons[msg.level];
                return (
                  <div
                    key={msg.id}
                    className="flex gap-2 p-2 rounded text-xs hover:bg-muted/50 transition-colors border-l-2 border-l-transparent hover:border-l-primary/20"
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
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
                        {msg.message}
                      </pre>
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