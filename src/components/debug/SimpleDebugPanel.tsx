import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bug, Terminal, Database, Globe, X, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FixedConsoleViewer } from './FixedConsoleViewer';
import { FixedNetworkMonitor } from './FixedNetworkMonitor';
import { FixedDatabaseQueryInspector } from './FixedDatabaseQueryInspector';

export function SimpleDebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [activeTab, setActiveTab] = useState('console');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + D to toggle debug panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(!isVisible);
      }

      // ESC to close
      if (isVisible && e.key === 'Escape') {
        e.preventDefault();
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return 'w-80 h-96';
      case 'medium':
        return 'w-[600px] h-[500px]';
      case 'large':
        return 'w-[800px] h-[600px]';
      default:
        return 'w-[600px] h-[500px]';
    }
  };

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full w-12 h-12 shadow-lg bg-purple-600 hover:bg-purple-700 text-white"
        title="Open Debug Panel (Ctrl/Cmd + Shift + D)"
      >
        <Bug className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className={cn(
      'fixed top-4 right-4 z-50 bg-background border rounded-lg shadow-2xl flex flex-col',
      getSizeStyles()
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-purple-600" />
          <span className="font-semibold text-sm">Debug Panel</span>
          <Badge variant="outline" className="text-xs">⌘⇧D</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setSize(size === 'small' ? 'medium' : size === 'medium' ? 'large' : 'small')}
            title="Resize"
          >
            {size === 'small' ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b px-3 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="console" className="flex items-center gap-2 text-xs">
                <Terminal className="h-3 w-3" />
                Console
              </TabsTrigger>
              <TabsTrigger value="network" className="flex items-center gap-2 text-xs">
                <Globe className="h-3 w-3" />
                Network
              </TabsTrigger>
              <TabsTrigger value="database" className="flex items-center gap-2 text-xs">
                <Database className="h-3 w-3" />
                Database
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="console" className="h-full m-0">
              <div className="p-3 h-full">
                <FixedConsoleViewer />
              </div>
            </TabsContent>

            <TabsContent value="network" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <FixedNetworkMonitor />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="database" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <FixedDatabaseQueryInspector />
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Status bar */}
      <div className="border-t px-3 py-2 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span>Debug Panel Active</span>
          <span>Connected to Supabase</span>
        </div>
        <div className="flex items-center gap-2">
          <span>ESC to close</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}