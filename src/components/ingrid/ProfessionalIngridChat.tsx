/**
 * Professional Ingrid Chat Interface
 *
 * A clean, professional chat interface designed for the main Ingrid AI page.
 * Features a clean layout with message history, typing indicators, and file upload.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { IngridAvatar } from './IngridAvatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { useSession } from '@/components/SessionContextProvider';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
  }>;
}

interface ActionCard {
  id: string;
  type: 'expense' | 'vendor' | 'customer' | 'category';
  title: string;
  description: string;
  data: any;
  confidence?: number;
  status: 'suggested' | 'approved' | 'rejected';
  createdAt: Date;
}

interface ProfessionalIngridChatProps {
  className?: string;
  onActionCardGenerated?: (actionCard: ActionCard) => void;
  onMessageSent?: (message: string) => void;
}

export function ProfessionalIngridChat({
  className,
  onActionCardGenerated,
  onMessageSent
}: ProfessionalIngridChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hello! I'm Ingrid, your AI assistant. I can help you process documents, create expenses, manage vendors, and much more. Upload a document or ask me a question to get started!",
      timestamp: new Date(),
      status: 'sent'
    }
  ]);

  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session and document upload
  const { profile } = useSession();
  const {
    uploadDocument,
    isUploading,
    isAnalyzing,
    analysisResult: currentAnalysis
  } = useDocumentUpload();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim() && !isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);
    setIsProcessing(true);

    // Notify parent component
    onMessageSent?.(currentMessage);

    // Simulate AI processing
    setTimeout(() => {
      setMessages(prev => prev.map(msg =>
        msg.id === userMessage.id ? { ...msg, status: 'sent' } : msg
      ));

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: generateAIResponse(currentMessage),
          timestamp: new Date(),
          status: 'sent'
        };

        setMessages(prev => [...prev, aiResponse]);
        setIsTyping(false);
        setIsProcessing(false);

        // Simulate action card generation
        if (currentMessage.toLowerCase().includes('expense') ||
            currentMessage.toLowerCase().includes('receipt') ||
            currentMessage.toLowerCase().includes('invoice')) {
          setTimeout(() => {
            const actionCard: ActionCard = {
              id: Date.now().toString(),
              type: 'expense',
              title: 'Create Expense Record',
              description: 'Based on our conversation, I can help create an expense record',
              data: {
                amount: 45.99,
                vendor: 'Office Supplies Inc',
                category: 'Office Expenses',
                date: new Date()
              },
              confidence: 92,
              status: 'suggested',
              createdAt: new Date()
            };
            onActionCardGenerated?.(actionCard);
          }, 1000);
        }
      }, 1500);
    }, 500);
  };

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();

    if (input.includes('expense') || input.includes('receipt')) {
      return "I'd be happy to help you with expense processing! I can analyze receipt images, extract key information like amounts and vendor details, suggest appropriate expense categories, and create complete expense records. Would you like to upload a receipt image or tell me more about the expense you'd like to process?";
    }

    if (input.includes('vendor') || input.includes('supplier')) {
      return "I can assist with vendor management! I can process business cards, enrich vendor information from the web, detect duplicates, and help create complete vendor profiles. Do you have a business card or invoice you'd like me to analyze?";
    }

    if (input.includes('help') || input.includes('what can you do')) {
      return "I'm your comprehensive AI assistant for business process automation! Here's what I can help you with:\n\n• **Document Processing**: Receipts, invoices, business cards, quotes\n• **Expense Management**: Automatic categorization, GL account suggestions\n• **Vendor Management**: Contact enrichment, duplicate detection\n• **Data Analysis**: Extract and validate information from any business document\n• **Workflow Automation**: Smart suggestions and approval workflows\n\nJust upload a document or ask me about any business process you'd like to streamline!";
    }

    return "I understand you'd like assistance with that. Could you provide more details or upload any relevant documents? I'm here to help streamline your business processes with AI-powered automation.";
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: `Uploaded: ${file.name}`,
      timestamp: new Date(),
      status: 'sending',
      attachments: [{
        name: file.name,
        type: file.type,
        size: file.size
      }]
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    setIsTyping(true);

    // Step 1: Upload to document management system with AI data for smart naming
    let uploadedDoc = null;
    try {
      const mockAiData = {
        extracted_amount: file.name.toLowerCase().includes('business') ? null : 89.99,
        vendor_name: file.name.toLowerCase().includes('business') ? 'ABC Company' : 'Restaurant XYZ',
        expense_date: new Date().toISOString(),
        document_type: file.name.toLowerCase().includes('business') ? 'business_card' : 'receipt'
      };

      uploadedDoc = await uploadDocument({
        file,
        options: {
          documentCategory: file.name.toLowerCase().includes('business') ? 'business_card' : 'receipt',
          aiExtractedData: mockAiData
        }
      });

      if (uploadedDoc) {
        setDocumentId(uploadedDoc.id);
        console.log(`Chat document uploaded with smart name: ${uploadedDoc.smartFileName}`);
      }
    } catch (error) {
      console.error('Document upload failed in chat:', error);
    }

    // Step 2: Simulate file processing
    setTimeout(() => {
      setMessages(prev => prev.map(msg =>
        msg.id === userMessage.id ? { ...msg, status: 'sent' } : msg
      ));

      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `I've successfully processed ${file.name}! ${uploadedDoc ? `The document has been saved as "${uploadedDoc.smartFileName}".` : ''} I can see this appears to be a ${file.type.includes('image') ? 'receipt or document image' : 'document file'}. I've extracted the relevant information and I'm preparing action cards for you to review. Check the Action Cards panel on the right to see my suggestions!`,
          timestamp: new Date(),
          status: 'sent'
        };

        setMessages(prev => [...prev, aiResponse]);
        setIsTyping(false);
        setIsProcessing(false);

        // Generate action card for file upload
        const actionCard: ActionCard = {
          id: Date.now().toString(),
          type: file.name.toLowerCase().includes('business') ? 'vendor' : 'expense',
          title: `Process ${file.name}`,
          description: `AI-extracted data from uploaded ${file.type.includes('image') ? 'image' : 'document'}`,
          data: {
            filename: file.name,
            documentId: uploadedDoc?.id || null,
            extractedAmount: file.name.toLowerCase().includes('business') ? null : 89.99,
            extractedVendor: file.name.toLowerCase().includes('business') ? 'ABC Company' : 'Restaurant XYZ',
            extractedDate: new Date()
          },
          confidence: 89,
          status: 'suggested',
          createdAt: new Date()
        };
        onActionCardGenerated?.(actionCard);
      }, 2000);
    }, 1000);

    // Reset file input
    event.target.value = '';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Document analysis handlers
  const handleRetryAnalysis = () => {
    setShowWarnings(false);
    // Retry analysis logic would go here
  };

  const handleViewDuplicate = () => {
    // View duplicate logic would go here
  };

  const handleProceedAnyway = () => {
    setShowWarnings(false);
    // Proceed with upload despite warnings
  };

  const handleCancelUpload = () => {
    setShowWarnings(false);
    setCurrentFile(null);
  };

  const getMessageIcon = (message: Message) => {
    if (message.type === 'user') {
      return <User className="h-4 w-4" />;
    }
    return <IngridAvatar size="sm" className="h-6 w-6" />;
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case 'sent':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex flex-col h-full border rounded-lg bg-card", className)}>
      {/* Minimal Status Bar */}
      {isTyping && (
        <div className="flex-shrink-0 px-4 py-2 bg-muted/30 border-b">
          <div className="flex items-center gap-2">
            <IngridAvatar size="sm" className="h-5 w-5" />
            <div className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ingrid is thinking...</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.type === 'assistant' && (
                  <div className="flex-shrink-0">
                    {getMessageIcon(message)}
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2",
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {message.attachments && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((attachment, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs opacity-80">
                          {attachment.type.startsWith('image/') ? (
                            <ImageIcon className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span>{attachment.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs opacity-60">
                      {format(message.timestamp, 'HH:mm')}
                    </span>
                    {message.type === 'user' && (
                      <div className="flex-shrink-0">
                        {getStatusIcon(message.status)}
                      </div>
                    )}
                  </div>
                </div>

                {message.type === 'user' && (
                  <div className="flex-shrink-0">
                    {getMessageIcon(message)}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <IngridAvatar size="sm" className="h-6 w-6" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Ingrid is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Input Area */}
        <div className="flex-shrink-0 p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Ingrid anything or upload a document..."
                disabled={isProcessing || isAnalyzing}
                className="min-h-[40px] resize-none"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isAnalyzing}
              className="flex-shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Button
              onClick={handleSendMessage}
              disabled={(!currentMessage.trim() && !isProcessing) || isProcessing || isAnalyzing}
              className="flex-shrink-0"
            >
              {isProcessing || isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Smart Document Warnings */}
          {showWarnings && currentAnalysis && (
            <div className="mt-4">
              <SmartDocumentWarnings
                analysis={currentAnalysis}
                isLoading={false}
                context="chat_upload"
                fileName={currentFile?.name}
                onRetry={handleRetryAnalysis}
                onViewDuplicate={handleViewDuplicate}
                onProceedAnyway={handleProceedAnyway}
                onCancel={handleCancelUpload}
                showDetailedAnalysis={true}
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
        </div>
      </div>
    </div>
  );
}