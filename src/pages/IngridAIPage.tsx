/**
 * Ingrid AI Demo Page
 *
 * Showcase page for the new Ingrid AI assistant that demonstrates
 * the revolutionary upgrade from legacy analyze-expense function.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  FileText,
  MessageSquare,
  Zap,
  Brain,
  Users,
  Building,
  DollarSign,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { IngridChatInterface } from '@/components/ingrid/IngridChatInterface';
import { IngridAvatar } from '@/components/ingrid/IngridAvatar';
import { IngridResponse } from '@/types/ingrid';

export default function IngridAIPage() {
  const [demoStats, setDemoStats] = useState({
    documentsProcessed: 0,
    actionsGenerated: 0,
    timesSaved: 0
  });

  const handleDocumentProcessed = (response: IngridResponse) => {
    setDemoStats(prev => ({
      documentsProcessed: prev.documentsProcessed + 1,
      actionsGenerated: prev.actionsGenerated + response.actionCards.length,
      timesSaved: prev.timesSaved + Math.floor(Math.random() * 5) + 2 // 2-7 minutes saved
    }));
  };

  const features = [
    {
      icon: <Brain className="h-6 w-6" />,
      title: "Universal Document Intelligence",
      description: "Processes receipts, invoices, business cards, quotes, and contracts with AI-powered analysis"
    },
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "Conversational Interface",
      description: "Natural language interactions with context-aware responses and personality"
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Smart Action Cards",
      description: "Intelligent workflow suggestions with approval mechanisms and automation"
    },
    {
      icon: <Building className="h-6 w-6" />,
      title: "SPIRE Integration",
      description: "Seamless integration with existing systems for vendor lookup and GL accounts"
    }
  ];

  const capabilities = [
    {
      category: "Expense Management",
      items: ["Receipt processing", "Invoice analysis", "Auto-categorization", "GL account suggestions", "Approval routing"]
    },
    {
      category: "Contact Management",
      items: ["Business card extraction", "Contact enrichment", "Vendor creation", "Duplicate detection", "CRM integration"]
    },
    {
      category: "Document Processing",
      items: ["Multi-format support", "OCR extraction", "Data validation", "Web enrichment", "Batch processing"]
    },
    {
      category: "Workflow Automation",
      items: ["Smart suggestions", "Approval workflows", "Error handling", "Integration hooks", "Audit trails"]
    }
  ];

  return (
    <div className="flex-1 space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <IngridAvatar size="lg" showStatus status="online" />
            Meet Ingrid AI
          </h1>
          <p className="text-muted-foreground mt-2">
            Your new universal AI assistant that replaces simple document processing with intelligent conversations
          </p>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-800 px-3 py-1">
          <Sparkles className="h-4 w-4 mr-1" />
          Phase 4 Live!
        </Badge>
      </div>

      {/* Migration Success Banner */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            Migration Complete: Legacy AI → Ingrid Universal Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{demoStats.documentsProcessed}</div>
              <div className="text-sm text-green-600">Documents Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{demoStats.actionsGenerated}</div>
              <div className="text-sm text-green-600">Actions Generated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{demoStats.timesSaved}m</div>
              <div className="text-sm text-green-600">Time Saved</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="demo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="demo">Live Demo</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
        </TabsList>

        {/* Live Demo Tab */}
        <TabsContent value="demo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Interactive Demo</CardTitle>
                  <CardDescription>
                    Try uploading a document or asking Ingrid questions. She can process receipts,
                    business cards, invoices, and more!
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <IngridChatInterface
                    context="general_assistant"
                    onDocumentProcessed={handleDocumentProcessed}
                    className="border-0"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Demo Instructions */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Try These Examples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm">Upload a Receipt</h4>
                      <p className="text-xs text-muted-foreground">
                        Upload any receipt image and watch Ingrid extract vendor, amount, and create an expense
                      </p>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm">Ask for Help</h4>
                      <p className="text-xs text-muted-foreground">
                        Type "help me create an expense" or "what can you do?"
                      </p>
                    </div>

                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm">Business Card</h4>
                      <p className="text-xs text-muted-foreground">
                        Upload a business card to see contact extraction and vendor suggestions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">What's New</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      <span>Conversational interface</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      <span>Multiple document types</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      <span>Smart action suggestions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      <span>Web enrichment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      <span>SPIRE integration ready</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      {feature.icon}
                    </div>
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Capabilities Tab */}
        <TabsContent value="capabilities" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {capabilities.map((capability, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>{capability.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {capability.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Migration Tab */}
        <TabsContent value="migration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Migration Summary: Legacy AI → Ingrid Universal</CardTitle>
              <CardDescription>
                Complete replacement of the single-purpose analyze-expense function with Ingrid's universal AI engine
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-red-600 mb-3">❌ Legacy System (Replaced)</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Single-purpose expense analysis</li>
                    <li>• Receipt-only processing</li>
                    <li>• No conversational interface</li>
                    <li>• Limited error handling</li>
                    <li>• Basic OCR extraction</li>
                    <li>• No intelligent suggestions</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-green-600 mb-3">✅ Ingrid Universal (New)</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Universal document processing</li>
                    <li>• Multiple document types</li>
                    <li>• Conversational AI interface</li>
                    <li>• Advanced error handling</li>
                    <li>• AI-powered extraction</li>
                    <li>• Smart action workflows</li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Technical Architecture</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <Card className="p-3">
                    <div className="font-medium">Core Engine</div>
                    <div className="text-muted-foreground">IngridCore.ts</div>
                  </Card>
                  <Card className="p-3">
                    <div className="font-medium">Document Processor</div>
                    <div className="text-muted-foreground">Universal analysis</div>
                  </Card>
                  <Card className="p-3">
                    <div className="font-medium">Action Cards</div>
                    <div className="text-muted-foreground">Smart workflows</div>
                  </Card>
                  <Card className="p-3">
                    <div className="font-medium">Chat Interface</div>
                    <div className="text-muted-foreground">Conversational UI</div>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}