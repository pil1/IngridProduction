/**
 * Ingrid AI Assistant Page
 *
 * Professional two-column layout featuring:
 * - Left: Professional chat interface with Ingrid
 * - Right: Action cards for reviewing and approving AI suggestions
 *
 * Only accessible to users with proper Ingrid AI permissions and module access.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import {
  Bot,
  Sparkles,
  Shield,
  AlertTriangle,
  Zap,
  MessageSquare,
  FileText,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { ProfessionalIngridChat } from '@/components/ingrid/ProfessionalIngridChat';
import { IngridActionCards } from '@/components/ingrid/IngridActionCards';
import { IngridAvatar } from '@/components/ingrid/IngridAvatar';
import { useSession } from '@/components/SessionContextProvider';
import { useCanAccessIngrid } from '@/hooks/useEnhancedPermissions';
import { cn } from '@/lib/utils';

// Action Card interface (shared with components)
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

export default function IngridAIPage() {
  const { profile } = useSession();
  const canAccessIngrid = useCanAccessIngrid();

  const [actionCards, setActionCards] = useState<ActionCard[]>([]);
  const [sessionStats, setSessionStats] = useState({
    messagesExchanged: 0,
    documentsProcessed: 0,
    actionCardsGenerated: 0,
    actionCardsApproved: 0
  });

  // Handle permission checks
  if (!profile) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to access Ingrid AI Assistant</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canAccessIngrid) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Access Restricted:</strong> You don't have permission to access Ingrid AI Assistant.
            Please contact your administrator to request access to the Ingrid AI module and appropriate permissions.
          </AlertDescription>
        </Alert>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              About Ingrid AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Ingrid AI Assistant is your comprehensive business process automation tool that can:
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Document Processing
                </div>
                <ul className="text-sm text-muted-foreground ml-6 space-y-1">
                  <li>• Receipt & invoice analysis</li>
                  <li>• Business card extraction</li>
                  <li>• Contract processing</li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-green-500" />
                  Smart Automation
                </div>
                <ul className="text-sm text-muted-foreground ml-6 space-y-1">
                  <li>• Expense categorization</li>
                  <li>• Vendor enrichment</li>
                  <li>• Approval workflows</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle new action card generation
  const handleActionCardGenerated = (actionCard: ActionCard) => {
    setActionCards(prev => [actionCard, ...prev]);
    setSessionStats(prev => ({
      ...prev,
      actionCardsGenerated: prev.actionCardsGenerated + 1
    }));
  };

  // Handle action card approval
  const handleActionCardApprove = (cardId: string, editedData?: any) => {
    setActionCards(prev => prev.map(card =>
      card.id === cardId
        ? {
            ...card,
            status: 'approved' as const,
            data: editedData || card.data
          }
        : card
    ));
    setSessionStats(prev => ({
      ...prev,
      actionCardsApproved: prev.actionCardsApproved + 1
    }));
  };

  // Handle action card rejection
  const handleActionCardReject = (cardId: string, reason?: string) => {
    setActionCards(prev => prev.map(card =>
      card.id === cardId
        ? { ...card, status: 'rejected' as const }
        : card
    ));
  };

  // Handle action card editing
  const handleActionCardEdit = (cardId: string, newData: any) => {
    setActionCards(prev => prev.map(card =>
      card.id === cardId
        ? { ...card, data: newData }
        : card
    ));
  };

  // Handle message sent
  const handleMessageSent = (message: string) => {
    setSessionStats(prev => ({
      ...prev,
      messagesExchanged: prev.messagesExchanged + 1
    }));
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <IngridAvatar size="lg" showStatus status="online" />
            <div>
              <h1 className="text-3xl font-semibold">Ingrid AI Assistant</h1>
              <p className="text-muted-foreground mt-1">
                Your intelligent business process automation assistant
              </p>
            </div>
          </div>

          {/* Session Stats */}
          <div className="hidden lg:flex items-center gap-6 bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{sessionStats.messagesExchanged}</span>
              <span className="text-muted-foreground">messages</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-green-500" />
              <span className="font-medium">{sessionStats.documentsProcessed}</span>
              <span className="text-muted-foreground">docs</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-purple-500" />
              <span className="font-medium">{sessionStats.actionCardsGenerated}</span>
              <span className="text-muted-foreground">suggestions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Chat Interface */}
          <Panel
            defaultSize={50}
            minSize={30}
            className="flex flex-col"
          >
            <div className="h-full">
              <ProfessionalIngridChat
                onActionCardGenerated={handleActionCardGenerated}
                onMessageSent={handleMessageSent}
                className="h-full"
              />
            </div>
          </Panel>

          {/* Resizable Handle */}
          <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20 transition-colors" />

          {/* Right Panel - Action Cards */}
          <Panel
            defaultSize={50}
            minSize={30}
            className="flex flex-col"
          >
            <IngridActionCards
              actionCards={actionCards}
              onApprove={handleActionCardApprove}
              onReject={handleActionCardReject}
              onEdit={handleActionCardEdit}
              className="h-full border rounded-lg bg-card"
            />
          </Panel>
        </PanelGroup>
      </div>

      {/* Footer Status */}
      <div className="flex-shrink-0 mt-8 pt-4 border-t">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-muted-foreground">AI Assistant Active</span>
            </div>
            {actionCards.filter(card => card.status === 'suggested').length > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">
                  {actionCards.filter(card => card.status === 'suggested').length} pending review
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            <span>Session {new Date().toLocaleTimeString()}</span>
            {sessionStats.actionCardsApproved > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{sessionStats.actionCardsApproved} approved</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}