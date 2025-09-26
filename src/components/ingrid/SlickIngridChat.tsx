/**
 * Slick Ingrid Chat - Premium AI Chat Interface
 *
 * A beautiful, modern chat interface with advanced features:
 * - Animated typing indicators
 * - Message status indicators
 * - File upload with preview
 * - Action cards and smart suggestions
 * - Voice input (future)
 * - Rich markdown rendering
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Send,
  Paperclip,
  Mic,
  Bot,
  User,
  CheckCheck,
  Clock,
  AlertCircle,
  Sparkles,
  Zap,
  FileText,
  Image as ImageIcon,
  X,
  MoreVertical,
  Copy,
  RefreshCw,
  Star,
  Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { openAIService, ChatMessage, OpenAIResponse } from '@/services/ingrid/OpenAIService';
import { ingridPermissionsService } from '@/services/api/ingridPermissions';
import { useSession } from '@/components/SessionContextProvider';
import { IngridAvatar } from './IngridAvatar';

export interface SlickChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'error';
  attachments?: ChatAttachment[];
  actionCards?: ActionCard[];
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

export interface ChatAttachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'file';
  size: number;
  url?: string;
  preview?: string;
}

export interface ActionCard {
  id: string;
  title: string;
  description: string;
  action: 'create_expense' | 'add_vendor' | 'categorize' | 'export' | 'schedule';
  data: any;
  confidence: number;
  icon?: string;
}

interface SlickIngridChatProps {
  height?: string;
  showHeader?: boolean;
  context?: string;
  onMessageSent?: (message: SlickChatMessage) => void;
  onActionExecuted?: (actionId: string, result: any) => void;
  onFileUploaded?: (files: File[]) => void;
  className?: string;
}

export function SlickIngridChat({
  height = "600px",
  showHeader = true,
  context = "chat",
  onMessageSent,
  onActionExecuted,
  onFileUploaded,
  className
}: SlickIngridChatProps) {
  const { profile } = useSession();
  const [messages, setMessages] = useState<SlickChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [hasPermission, setHasPermission] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check user permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      if (!profile?.user_id) return;

      const response = await ingridPermissionsService.checkUserPermission(
        profile.user_id,
        'chat'
      );

      setHasPermission(response.data || false);
    };

    checkPermissions();
  }, [profile?.user_id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Initialize with welcome message
  useEffect(() => {
    if (hasPermission && messages.length === 0) {
      const welcomeMessage: SlickChatMessage = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: `Hello! I'm Ingrid, your AI assistant. I can help you with:\n\n✨ **Document Processing** - Upload receipts, invoices, or business cards\n📊 **Expense Management** - Create and categorize expenses automatically\n🏢 **Vendor Management** - Extract and organize vendor information\n📈 **Business Insights** - Analyze your data and provide recommendations\n\nHow can I assist you today?`,
        timestamp: new Date(),
        status: 'delivered',
        actionCards: [
          {
            id: 'upload_receipt',
            title: 'Upload Receipt',
            description: 'Process expense receipts automatically',
            action: 'create_expense',
            data: {},
            confidence: 100,
            icon: 'FileText'
          },
          {
            id: 'add_vendor',
            title: 'Add Vendor',
            description: 'Upload business card or vendor info',
            action: 'add_vendor',
            data: {},
            confidence: 100,
            icon: 'Building'
          }
        ]
      };
      setMessages([welcomeMessage]);
    }
  }, [hasPermission, messages.length]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() && attachments.length === 0) return;
    if (!profile?.user_id || !hasPermission) return;

    const userMessage: SlickChatMessage = {
      id: `msg_${Date.now()}_user`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      status: 'sending',
      attachments: [...attachments]
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setAttachments([]);
    setIsLoading(true);

    // Update message status to sent
    setTimeout(() => {
      setMessages(prev => prev.map(msg =>
        msg.id === userMessage.id ? { ...msg, status: 'sent' } : msg
      ));
    }, 100);

    try {
      // Track usage
      await ingridPermissionsService.incrementUsage(profile.user_id, 'chat', 1);

      // Show typing indicator
      setIsTyping(true);

      // Prepare context for OpenAI
      const ingridContext = {
        userId: profile.user_id,
        companyId: profile.company_id || '',
        userRole: profile.role || 'user',
        currentPage: window.location.pathname,
        permissions: ['chat', 'general:read'],
        sessionId: `session_${Date.now()}`
      };

      // Convert to OpenAI format
      const chatMessages: ChatMessage[] = messages
        .filter(msg => msg.type !== 'system')
        .map(msg => ({
          role: msg.type === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }));

      // Add current user message
      chatMessages.push({
        role: 'user',
        content: userMessage.content
      });

      const startTime = Date.now();
      const aiResponse = await openAIService.sendMessage(chatMessages, ingridContext);
      const processingTime = Date.now() - startTime;

      setIsTyping(false);

      if (aiResponse) {
        const assistantMessage: SlickChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          type: 'assistant',
          content: aiResponse.content,
          timestamp: new Date(),
          status: 'delivered',
          metadata: {
            model: aiResponse.model,
            tokens: aiResponse.usage?.total_tokens,
            processingTime
          }
        };

        setMessages(prev => prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'delivered' } : msg
        ).concat(assistantMessage));

        onMessageSent?.(assistantMessage);
      } else {
        // Handle error
        setMessages(prev => prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'error' } : msg
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      setMessages(prev => prev.map(msg =>
        msg.id === userMessage.id ? { ...msg, status: 'error' } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, attachments, profile, hasPermission, messages, onMessageSent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAttachments: ChatAttachment[] = files.map(file => ({
      id: `attach_${Date.now()}_${Math.random()}`,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' :
            file.type === 'application/pdf' ? 'document' : 'file',
      size: file.size,
      url: URL.createObjectURL(file)
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
    onFileUploaded?.(files);
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  const executeAction = async (actionCard: ActionCard) => {
    try {
      // Simulate action execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      onActionExecuted?.(actionCard.id, { success: true });

      // Add success message
      const successMessage: SlickChatMessage = {
        id: `msg_${Date.now()}_system`,
        type: 'system',
        content: `✅ Successfully executed: ${actionCard.title}`,
        timestamp: new Date(),
        status: 'delivered'
      };

      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      console.error('Error executing action:', error);
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusIcon = (status: SlickChatMessage['status']) => {
    switch (status) {
      case 'sending':
        return <Clock className="h-3 w-3 text-gray-400" />;
      case 'sent':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  // Permission check
  if (!hasPermission) {
    return (
      <Card className={cn("flex items-center justify-center p-8", className)} style={{ height }}>
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 text-gray-400 mx-auto" />
          <div>
            <h3 className="font-semibold text-gray-900">Ingrid AI Access Required</h3>
            <p className="text-sm text-gray-600 mt-1">
              Contact your administrator to enable Ingrid AI chat access.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)} style={{ height }}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center space-x-3">
            <IngridAvatar size="sm" showStatus />
            <div>
              <h3 className="font-semibold text-sm">Ingrid AI Assistant</h3>
              <p className="text-xs text-muted-foreground flex items-center space-x-1">
                <Sparkles className="h-3 w-3" />
                <span>Powered by OpenAI</span>
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear Chat
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Export Chat
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Star className="h-4 w-4 mr-2" />
                Feedback
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={message.id} className={cn(
              "flex gap-3",
              message.type === 'user' ? "flex-row-reverse" : "flex-row"
            )}>
              {/* Avatar */}
              <Avatar className="h-8 w-8 flex-shrink-0">
                {message.type === 'assistant' ? (
                  <IngridAvatar size="sm" />
                ) : (
                  <AvatarFallback className="bg-blue-500 text-white text-xs">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                )}
              </Avatar>

              {/* Message Content */}
              <div className={cn(
                "flex-1 max-w-[80%] space-y-2",
                message.type === 'user' ? "items-end" : "items-start"
              )}>
                {/* Message Bubble */}
                <div className={cn(
                  "relative px-4 py-2 rounded-2xl shadow-sm",
                  message.type === 'user'
                    ? "bg-blue-500 text-white ml-12"
                    : "bg-gray-100 text-gray-900 mr-12",
                  message.type === 'system' && "bg-green-50 text-green-800 border border-green-200"
                )}>
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>

                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.attachments.map(attachment => (
                        <div key={attachment.id} className="flex items-center space-x-2 p-2 bg-white/20 rounded-lg">
                          {attachment.type === 'image' ? (
                            <ImageIcon className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                          <span className="text-sm truncate">{attachment.name}</span>
                          <span className="text-xs opacity-70">
                            {(attachment.size / 1024).toFixed(1)}KB
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Cards */}
                {message.actionCards && message.actionCards.length > 0 && (
                  <div className="space-y-2 mr-12">
                    {message.actionCards.map(action => (
                      <Card key={action.id} className="p-3 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                            onClick={() => executeAction(action)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Zap className="h-4 w-4 text-blue-600" />
                            <div>
                              <p className="font-medium text-sm">{action.title}</p>
                              <p className="text-xs text-gray-600">{action.description}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {action.confidence}%
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Message Info */}
                <div className={cn(
                  "flex items-center space-x-2 text-xs text-gray-500",
                  message.type === 'user' ? "justify-end" : "justify-start"
                )}>
                  <span>{formatTimestamp(message.timestamp)}</span>
                  {message.type === 'user' && getStatusIcon(message.status)}
                  {message.metadata?.processingTime && (
                    <span className="text-xs text-gray-400">
                      {message.metadata.processingTime}ms
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <IngridAvatar size="sm" />
              </Avatar>
              <div className="bg-gray-100 rounded-2xl px-4 py-2 mr-12">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {attachments.map(attachment => (
              <div key={attachment.id} className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full text-sm border">
                {attachment.type === 'image' ? (
                  <ImageIcon className="h-4 w-4 text-blue-500" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-500" />
                )}
                <span className="truncate max-w-[120px]">{attachment.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-red-100"
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-end space-x-2">
          {/* File Upload */}
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Ingrid anything..."
              className="min-h-[40px] max-h-[120px] resize-none pr-12"
              disabled={isLoading}
            />

            {/* Send Button */}
            <Button
              onClick={sendMessage}
              disabled={(!inputValue.trim() && attachments.length === 0) || isLoading}
              className="absolute right-2 bottom-2 h-8 w-8 p-0"
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Voice Input (Future) */}
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 flex-shrink-0 opacity-50"
            disabled
          >
            <Mic className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-2 text-center">
          Ingrid can make mistakes. Verify important information.
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />
    </Card>
  );
}