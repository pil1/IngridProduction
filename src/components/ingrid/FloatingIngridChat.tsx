/**
 * Floating Ingrid Chat Widget
 *
 * A beautiful floating chat widget that provides access to Ingrid AI
 * from anywhere in the application. Toggleable, responsive, and persistent.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  MessageSquare,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  Zap
} from 'lucide-react';
import { SlickIngridChat } from './SlickIngridChat';
import { IngridAvatar } from './IngridAvatar';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';
import { useHasModuleAccess } from '@/hooks/useEnhancedPermissions';

export interface FloatingChatState {
  isOpen: boolean;
  isMinimized: boolean;
  hasUnreadMessages: boolean;
  lastInteraction: Date | null;
}

interface FloatingIngridChatProps {
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showWelcomePulse?: boolean;
  contextualHelp?: boolean;
  onStateChange?: (state: FloatingChatState) => void;
}

export function FloatingIngridChat({
  className,
  position = 'bottom-right',
  showWelcomePulse = true,
  contextualHelp = true,
  onStateChange
}: FloatingIngridChatProps) {
  const { profile } = useSession();
  const hasIngridAccess = useHasModuleAccess('Ingrid AI');

  const [chatState, setChatState] = useState<FloatingChatState>({
    isOpen: false,
    isMinimized: false,
    hasUnreadMessages: false,
    lastInteraction: null
  });

  const [showInitialPulse, setShowInitialPulse] = useState(showWelcomePulse);
  const [contextualMessage, setContextualMessage] = useState<string | null>(null);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  // Update parent component when state changes
  useEffect(() => {
    onStateChange?.(chatState);
  }, [chatState, onStateChange]);

  // Hide initial pulse after first interaction
  useEffect(() => {
    if (chatState.isOpen && showInitialPulse) {
      setShowInitialPulse(false);
    }
  }, [chatState.isOpen, showInitialPulse]);

  // Contextual help based on current route
  useEffect(() => {
    if (!contextualHelp) return;

    const currentPath = window.location.pathname;
    let message = null;

    if (currentPath.includes('/expenses')) {
      message = "📄 I can process receipt images, extract expense data, suggest categories, and create complete expense records instantly!";
    } else if (currentPath.includes('/vendors')) {
      message = "🏢 Upload business cards or invoices and I'll create vendor profiles with enriched company data from the web!";
    } else if (currentPath.includes('/customers')) {
      message = "👥 I can analyze customer documents, extract contact info, and help manage business relationships efficiently!";
    } else if (currentPath.includes('/dashboard')) {
      message = "📊 I can explain your dashboard metrics, help create new records, or answer questions about your business data!";
    } else if (currentPath.includes('/analytics')) {
      message = "📈 Let me analyze your data trends, create custom reports, or provide AI-powered business insights!";
    } else if (currentPath.includes('/company')) {
      message = "⚙️ I can help configure company settings, manage user permissions, or optimize your business processes!";
    } else if (currentPath.includes('/users')) {
      message = "👤 I can assist with user management, role assignments, or help onboard new team members!";
    } else if (currentPath.includes('/ingrid')) {
      message = "🤖 Welcome to my demo page! Try uploading any document or ask me about my AI capabilities!";
    } else if (currentPath === '/' || currentPath.includes('/index')) {
      message = "🚀 Welcome to INFOtrac! I'm your AI assistant - upload documents, ask questions, or let me help automate your workflows!";
    } else {
      message = "💬 Hi! I'm Ingrid, your AI assistant. Upload any business document or ask me how I can help you today!";
    }

    setContextualMessage(message);
  }, [contextualHelp]);

  const toggleChat = () => {
    setChatState(prev => ({
      ...prev,
      isOpen: !prev.isOpen,
      isMinimized: false,
      hasUnreadMessages: false,
      lastInteraction: new Date()
    }));
  };

  const minimizeChat = () => {
    setChatState(prev => ({
      ...prev,
      isMinimized: !prev.isMinimized
    }));
  };

  const closeChat = () => {
    setChatState(prev => ({
      ...prev,
      isOpen: false,
      isMinimized: false
    }));
  };

  const handleDocumentProcessed = (files: any[], result: any) => {
    // Mark as having new messages if chat is minimized
    if (chatState.isMinimized) {
      setChatState(prev => ({
        ...prev,
        hasUnreadMessages: true
      }));
    }
  };

  const handleActionExecuted = (actionId: string, result: any) => {
    // Track interactions
    setChatState(prev => ({
      ...prev,
      lastInteraction: new Date()
    }));
  };

  // Don't show if not logged in or user doesn't have Ingrid module access
  if (!profile || !hasIngridAccess) return null;

  return (
    <div className={cn(
      "fixed z-50 flex flex-col items-end",
      positionClasses[position],
      className
    )}>
      {/* Chat Window */}
      {chatState.isOpen && (
        <Card className={cn(
          "mb-4 shadow-2xl border-2 transition-all duration-300 ease-in-out",
          chatState.isMinimized ? "h-16" : "h-[600px]",
          "w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)]"
        )}>
          {/* Chat Header - always visible when open */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center space-x-3">
              <IngridAvatar size="sm" showStatus />
              <div>
                <h3 className="font-semibold text-sm">Ingrid AI Assistant</h3>
                <p className="text-xs text-muted-foreground">
                  {chatState.isMinimized ? 'Chat minimized' : 'Ready to help'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={minimizeChat}
                className="h-8 w-8 p-0"
              >
                {chatState.isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeChat}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat Content */}
          {!chatState.isMinimized && (
            <div className="h-[calc(600px-80px)]">
              <SlickIngridChat
                height="100%"
                showHeader={false}
                context="floating_widget"
                onMessageSent={(message) => handleDocumentProcessed([], message)}
                onActionExecuted={handleActionExecuted}
                className="border-0"
              />
            </div>
          )}

          {/* Minimized state content */}
          {chatState.isMinimized && chatState.hasUnreadMessages && (
            <div className="p-2">
              <Badge variant="secondary" className="text-xs">
                New messages from Ingrid
              </Badge>
            </div>
          )}
        </Card>
      )}

      {/* Floating Action Button */}
      <Button
        onClick={toggleChat}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300",
          "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700",
          "relative overflow-hidden group"
        )}
        size="lg"
      >
        {/* Background Animation */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Icon */}
        <div className="relative z-10 flex items-center justify-center">
          {chatState.isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <div className="relative">
              <MessageSquare className="h-6 w-6 text-white" />

              {/* Notification badges */}
              {chatState.hasUnreadMessages && (
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
              )}

              {showInitialPulse && !chatState.lastInteraction && (
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="h-3 w-3 text-yellow-400" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Static ring for new users */}
        {showInitialPulse && !chatState.lastInteraction && (
          <div className="absolute inset-0 rounded-full border-2 border-white/30" />
        )}
      </Button>

      {/* Welcome tooltip for new users - positioned above button */}
      {showInitialPulse && !chatState.isOpen && !chatState.lastInteraction && (
        <div className={cn(
          "absolute bottom-20 max-w-72 p-3 bg-white rounded-lg shadow-lg border",
          position.includes('right') ? "right-0" : "left-0"
        )}>
          <div className="flex items-start space-x-2">
            <div className="flex-shrink-0">
              <Zap className="h-4 w-4 text-blue-500 mt-0.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Meet Ingrid, your AI assistant!
              </p>
              <p className="text-xs text-gray-600 mt-1">
                I can help you process documents, create expenses, manage vendors, and much more. Click to chat!
              </p>
            </div>
          </div>

          {/* Arrow pointer - pointing down to button */}
          <div className={cn(
            "absolute top-full w-0 h-0",
            "border-l-6 border-r-6 border-t-6",
            "border-l-transparent border-r-transparent border-t-white",
            position.includes('right') ? "right-6" : "left-6"
          )} />
        </div>
      )}

      {/* Contextual help tooltip - positioned above button */}
      {contextualMessage && !chatState.isOpen && !showInitialPulse && (
        <div className={cn(
          "absolute bottom-20 max-w-64 p-2 bg-blue-50 rounded-lg shadow-md border border-blue-200",
          position.includes('right') ? "right-0" : "left-0"
        )}>
          <p className="text-xs text-blue-800">
            {contextualMessage}
          </p>

          {/* Arrow pointer - pointing down to button */}
          <div className={cn(
            "absolute top-full w-0 h-0",
            "border-l-6 border-r-6 border-t-6",
            "border-l-transparent border-r-transparent border-t-blue-200",
            position.includes('right') ? "right-6" : "left-6"
          )} />
        </div>
      )}
    </div>
  );
}

// Hook for managing floating chat state across the app
export function useFloatingIngridChat() {
  const [chatState, setChatState] = useState<FloatingChatState>({
    isOpen: false,
    isMinimized: false,
    hasUnreadMessages: false,
    lastInteraction: null
  });

  const openChat = () => {
    setChatState(prev => ({ ...prev, isOpen: true, isMinimized: false }));
  };

  const closeChat = () => {
    setChatState(prev => ({ ...prev, isOpen: false }));
  };

  const minimizeChat = () => {
    setChatState(prev => ({ ...prev, isMinimized: true }));
  };

  const markAsRead = () => {
    setChatState(prev => ({ ...prev, hasUnreadMessages: false }));
  };

  return {
    chatState,
    openChat,
    closeChat,
    minimizeChat,
    markAsRead,
    setChatState
  };
}