/**
 * Ingrid Chat Interface
 *
 * Main conversational UI component that replaces simple upload dialogs
 * with an intelligent, interactive chat experience.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Upload, Send, Paperclip, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { ingridCore } from '@/services/ingrid/IngridCore';
import { ActionCard } from './ActionCard';
import { IngridAvatar } from './IngridAvatar';
import {
  IngridResponse,
  ConversationMessage,
  ProcessingContext
} from '@/types/ingrid';

interface IngridChatInterfaceProps {
  context?: ProcessingContext;
  onActionExecuted?: (actionId: string, result: any) => void;
  onDocumentProcessed?: (response: IngridResponse) => void;
  className?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ingrid';
  content: string;
  timestamp: string;
  attachment?: {
    name: string;
    size: number;
    type: string;
  };
  actionCards?: string[];
}

export const IngridChatInterface: React.FC<IngridChatInterfaceProps> = ({
  context = 'general_assistant',
  onActionExecuted,
  onDocumentProcessed,
  className
}) => {
  const { profile } = useSession();
  const { toast } = useToast();
  const { securityContext } = usePermissions();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'ingrid',
      content: "Hi! I'm Ingrid, your AI assistant. I can help you process documents, create expenses, manage contacts, and much more. What can I help you with today?",
      timestamp: new Date().toISOString(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeActions, setActiveActions] = useState<Map<string, any>>(new Map());
  const [conversationId, setConversationId] = useState<string>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);

    try {
      // Send message to Ingrid
      const response = await ingridCore.handleConversation(
        inputMessage,
        context,
        conversationId
      );

      // Create Ingrid response message
      const ingridMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'ingrid',
        content: response.message,
        timestamp: new Date().toISOString(),
        actionCards: response.actionCards.map(a => a.id)
      };

      setMessages(prev => [...prev, ingridMessage]);

      // Store action cards for interaction
      response.actionCards.forEach(action => {
        setActiveActions(prev => new Map(prev.set(action.id, action)));
      });

      // Set conversation ID if not set
      if (response.conversationId && !conversationId) {
        setConversationId(response.conversationId);
      }

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process your message. Please try again.',
        variant: 'destructive'
      });

      const errorMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'ingrid',
        content: "I'm sorry, I encountered an error processing your message. Please try again or contact support if the issue persists.",
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (isProcessing) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: `I've uploaded a file: ${file.name}`,
      timestamp: new Date().toISOString(),
      attachment: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Process document with Ingrid (with security context)
      const response = await ingridCore.processDocument({
        document: file,
        context,
        conversationId,
        userMessage: `Process this ${file.name}`,
        securityContext
      });

      // Create Ingrid response message
      const ingridMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'ingrid',
        content: response.message,
        timestamp: new Date().toISOString(),
        actionCards: response.actionCards.map(a => a.id)
      };

      setMessages(prev => [...prev, ingridMessage]);

      // Store action cards
      response.actionCards.forEach(action => {
        setActiveActions(prev => new Map(prev.set(action.id, action)));
      });

      // Set conversation ID if not set
      if (response.conversationId && !conversationId) {
        setConversationId(response.conversationId);
      }

      // Notify parent of document processing
      onDocumentProcessed?.(response);

      toast({
        title: 'Document Processed',
        description: `Successfully analyzed ${file.name}`,
      });

    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: 'Processing Failed',
        description: 'Failed to process the uploaded file. Please try again.',
        variant: 'destructive'
      });

      const errorMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'ingrid',
        content: `I'm sorry, I couldn't process "${file.name}". The file might be corrupted or in an unsupported format. Please try uploading a different file.`,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActionResponse = async (actionId: string, approved: boolean) => {
    try {
      const response = await ingridCore.handleActionResponse(
        actionId,
        approved,
        profile?.user_id || 'unknown'
      );

      // Add Ingrid's response to chat
      const ingridMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'ingrid',
        content: response.message,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, ingridMessage]);

      // Remove the action from active actions
      setActiveActions(prev => {
        const newMap = new Map(prev);
        newMap.delete(actionId);
        return newMap;
      });

      // Notify parent of action execution
      if (approved) {
        onActionExecuted?.(actionId, response);
      }

      toast({
        title: approved ? 'Action Executed' : 'Action Cancelled',
        description: approved ? 'The action has been completed successfully.' : 'The action has been cancelled.',
      });

    } catch (error) {
      console.error('Action response error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process action response.',
        variant: 'destructive'
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className={`flex flex-col h-[600px] ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          Ingrid AI Assistant
          {isProcessing && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full" />
              Processing...
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <Separator />

      {/* Messages Area */}
      <CardContent className="flex-1 p-0">
        <ScrollArea
          className="h-full px-4 py-4"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {message.role === 'ingrid' && <IngridAvatar size="sm" />}

                  <div className={`flex flex-col space-y-1 max-w-[80%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    <div className={`rounded-lg px-3 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm">{message.content}</p>

                      {message.attachment && (
                        <div className="mt-2 p-2 bg-black/10 rounded text-xs">
                          <div className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {message.attachment.name}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Action Cards */}
                {message.actionCards && message.actionCards.length > 0 && (
                  <div className="ml-12 space-y-2">
                    {message.actionCards.map(actionId => {
                      const action = activeActions.get(actionId);
                      return action ? (
                        <ActionCard
                          key={actionId}
                          action={action}
                          onApprove={() => handleActionResponse(actionId, true)}
                          onReject={() => handleActionResponse(actionId, false)}
                        />
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <Separator />

      {/* Input Area */}
      <div className="p-4">
        <div className="flex gap-2">
          <div className="flex-1 flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask Ingrid anything or upload a document..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isProcessing}
            />

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
            />

            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isProcessing}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Drop files here to upload, or use the upload button. Supports PDFs, images, and documents.
        </p>
      </div>
    </Card>
  );
};