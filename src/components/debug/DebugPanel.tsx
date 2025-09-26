import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bug,
  Terminal,
  Database,
  Globe,
  Settings,
  X,
  Minimize2,
  Maximize2,
  Move
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConsoleViewer } from './ConsoleViewer';
import { DatabaseQueryInspector } from './DatabaseQueryInspector';
import { NetworkMonitor } from './NetworkMonitor';

interface DebugPanelProps {
  className?: string;
}

type PanelSize = 'small' | 'medium' | 'large' | 'fullscreen';

export function DebugPanel({ className }: DebugPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [size, setSize] = useState<PanelSize>('medium');
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState('console');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + D to toggle debug panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(!isVisible);
      }

      // Ctrl/Cmd + Shift + C for console tab
      if (isVisible && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setActiveTab('console');
      }

      // Ctrl/Cmd + Shift + N for network tab
      if (isVisible && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        setActiveTab('network');
      }

      // Ctrl/Cmd + Shift + Q for database tab
      if (isVisible && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        setActiveTab('database');
      }

      // Escape to close
      if (isVisible && e.key === 'Escape') {
        e.preventDefault();
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Keep panel within viewport bounds
    const maxX = window.innerWidth - 400; // Minimum panel width
    const maxY = window.innerHeight - 300; // Minimum panel height

    setPosition({
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return 'w-80 h-96';
      case 'medium':
        return 'w-[600px] h-[500px]';
      case 'large':
        return 'w-[800px] h-[600px]';
      case 'fullscreen':
        return 'w-screen h-screen';
      default:
        return 'w-[600px] h-[500px]';
    }
  };

  const getPositionStyles = () => {
    if (size === 'fullscreen') {
      return { top: 0, left: 0 };
    }
    return { top: position.y, left: position.x };
  };

  // Debug toggle button (always visible)
  const DebugToggleButton = () => (
    <Button
      onClick={() => setIsVisible(true)}
      className={cn(
        'fixed bottom-4 right-4 z-50 rounded-full w-12 h-12 shadow-lg',
        'bg-purple-600 hover:bg-purple-700 text-white',
        isVisible && 'hidden'
      )}
      title="Open Debug Panel (Ctrl/Cmd + Shift + D)"
    >
      <Bug className="h-5 w-5" />
    </Button>
  );

  if (!isVisible) {
    return <DebugToggleButton />;
  }

  return (
    <>
      <DebugToggleButton />
      <div
        className={cn(
          'fixed z-50 bg-background border rounded-lg shadow-2xl',
          'resize-none overflow-hidden',
          getSizeStyles(),
          isMinimized && 'h-auto',
          className
        )}
        style={getPositionStyles()}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between p-3 border-b bg-muted/30',
            'cursor-move select-none'
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-purple-600" />
            <span className="font-semibold text-sm">Debug Panel</span>
            <div className="flex items-center gap-1 ml-2">
              <Badge variant="outline" className="text-xs">
                ⌘⇧D
              </Badge>
              <Badge variant="outline" className="text-xs">
                ESC to close
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Size controls */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSize(size === 'small' ? 'medium' : 'small')}
              title="Toggle size"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSize(size === 'fullscreen' ? 'medium' : 'fullscreen')}
              title="Fullscreen"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>

            {/* Minimize/Restore */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <Move className="h-3 w-3" />
            </Button>

            {/* Close */}
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
        {!isMinimized && (
          <div className="flex flex-col h-full overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="border-b px-3 flex-shrink-0">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="console" className="flex items-center gap-2 text-xs">
                    <Terminal className="h-3 w-3" />
                    Console
                    <Badge variant="outline" className="text-xs">⌘⇧C</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="network" className="flex items-center gap-2 text-xs">
                    <Globe className="h-3 w-3" />
                    Network
                    <Badge variant="outline" className="text-xs">⌘⇧N</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="database" className="flex items-center gap-2 text-xs">
                    <Database className="h-3 w-3" />
                    Database
                    <Badge variant="outline" className="text-xs">⌘⇧Q</Badge>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="console" className="h-full m-0">
                  <div className="p-3 h-full overflow-hidden">
                    <ConsoleViewer className="h-full" />
                  </div>
                </TabsContent>

                <TabsContent value="network" className="h-full m-0">
                  <ScrollArea className="h-full">
                    <div className="p-3">
                      <NetworkMonitor />
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="database" className="h-full m-0">
                  <ScrollArea className="h-full">
                    <div className="p-3">
                      <DatabaseQueryInspector />
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>

            {/* Status bar */}
            <div className="border-t px-3 py-2 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span>Ready</span>
                <span>Connected to Supabase</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Debug Mode: Active</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}