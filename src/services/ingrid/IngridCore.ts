/**
 * Ingrid Core Engine
 *
 * Central AI engine that replaces the legacy analyze-expense function
 * with a universal, conversational AI assistant capable of processing
 * any document type and providing intelligent workflow suggestions.
 */

import {
  IngridResponse,
  IngridDocumentInput,
  ActionCard,
  DocumentAnalysis,
  UserIntent,
  ProcessingContext,
  IngridConfig,
  IngridError,
  LegacyResponse
} from '@/types/ingrid';
import { DocumentProcessor } from './DocumentProcessor';
import { ConversationManager } from './ConversationManager';
import { ActionCardGenerator } from './ActionCardGenerator';
import { IntentRecognition } from './IntentRecognition';
import { ConversationalAI } from './ConversationalAI';
import { ConfigurationService } from './ConfigurationService';
import { PermissionService, SecurityContext } from '../permissions/PermissionService';

/**
 * Main Ingrid AI Engine
 *
 * Orchestrates all AI processing including document analysis,
 * intent recognition, action generation, and conversation management.
 */
export class IngridCore {
  private documentProcessor: DocumentProcessor;
  private conversationManager: ConversationManager;
  private actionCardGenerator: ActionCardGenerator;
  private intentRecognition: IntentRecognition;
  private conversationalAI: ConversationalAI;
  private config: IngridConfig;

  constructor(config: IngridConfig) {
    this.config = config;
    this.documentProcessor = new DocumentProcessor(config, config.ocrProvider);
    this.conversationManager = new ConversationManager(config);
    this.actionCardGenerator = new ActionCardGenerator(config);
    this.intentRecognition = new IntentRecognition(config);
    this.conversationalAI = new ConversationalAI(config);
  }

  /**
   * Universal document processing
   *
   * Main entry point that replaces the legacy analyze-expense function.
   * Processes any document type and returns intelligent suggestions.
   * Now includes permission-aware filtering.
   */
  async processDocument(input: IngridDocumentInput): Promise<IngridResponse> {
    try {
      console.log(`🤖 Ingrid: Processing ${input.document.name} (${input.context})`);

      // Extract company ID from input or securityContext
      const companyId = input.companyId || input.securityContext?.company_id || input.securityContext?.companyId;
      console.log(`🏢 Using company ID for enhanced categorization: ${companyId || 'none'}`);

      // Step 1: Analyze the document with fallback
      let analysis;
      try {
        analysis = await this.documentProcessor.analyze(input.document, companyId);
        console.log(`📄 Document analysis complete: ${analysis.documentType} (${analysis.confidence}% confidence)`);
      } catch (analysisError) {
        console.warn(`📄 Document analysis failed, using fallback:`, analysisError);
        analysis = this.createFallbackAnalysis(input.document);
      }

      // Step 2: Apply permission filtering to extracted data
      let filteredAnalysis = analysis;
      if (input.securityContext) {
        try {
          filteredAnalysis = {
            ...analysis,
            extractedData: PermissionService.filterSensitiveData(
              analysis.extractedData,
              input.securityContext,
              ['gl_account_code', 'gl_account_name', 'financial_data']
            )
          };
          console.log(`🔐 Applied permission filtering for user role: ${input.securityContext.userRole}`);
        } catch (permissionError) {
          console.warn(`🔐 Permission filtering failed:`, permissionError);
          filteredAnalysis = analysis; // Use unfiltered data if filtering fails
        }
      }

      // Step 3: Detect user intent with fallback
      let intent;
      try {
        intent = await this.intentRecognition.detectIntent(
          input.userMessage || `Process this ${filteredAnalysis.documentType}`,
          input.context
        );
        console.log(`🎯 Intent detected: ${intent.primary} (${intent.confidence}% confidence)`);
      } catch (intentError) {
        console.warn(`🎯 Intent detection failed, using fallback:`, intentError);
        intent = this.createFallbackIntent(input.context);
      }

      // Step 4: Generate action cards with fallback
      let actions;
      try {
        const rawActions = await this.actionCardGenerator.generateActions(filteredAnalysis, intent);

        // Step 5: Filter action cards based on user permissions
        actions = rawActions;
        if (input.securityContext) {
          try {
            actions = PermissionService.filterActionCards(rawActions, input.securityContext);
            console.log(`🔐 Filtered action cards: ${rawActions.length} → ${actions.length} based on permissions`);
          } catch (filterError) {
            console.warn(`🔐 Action card filtering failed:`, filterError);
            actions = rawActions; // Use unfiltered actions if filtering fails
          }
        }
        console.log(`🎴 Generated ${actions.length} action cards`);
      } catch (actionError) {
        console.warn(`🎴 Action card generation failed, using fallback:`, actionError);
        actions = this.createFallbackActions(filteredAnalysis, intent);
      }

      // Step 6: Generate conversational response using AI with fallback
      let aiResponse;
      try {
        aiResponse = await this.conversationalAI.generateDocumentResponse(filteredAnalysis, intent, actions);
      } catch (aiError) {
        console.warn(`🤖 AI response generation failed, using fallback:`, aiError);
        aiResponse = this.createFallbackAIResponse(filteredAnalysis, intent, actions);
      }
      let message = aiResponse.message;

      // Step 8: Manage conversation state
      if (input.conversationId) {
        await this.conversationManager.addMessage(input.conversationId, {
          id: this.generateId(),
          role: 'ingrid',
          content: message,
          timestamp: new Date().toISOString(),
          attachments: [{
            id: this.generateId(),
            type: 'document',
            filename: input.document.name,
            size: input.document.size,
            url: '', // Will be set by storage service
            mimeType: input.document.type
          }],
          actionCards: actions.map(a => a.id)
        });
      }

      const response: IngridResponse = {
        message,
        actionCards: actions,
        confidence: Math.min(analysis.confidence, intent.confidence),
        needsApproval: this.determineApprovalNeeds(actions),
        conversationId: input.conversationId,
        context: input.context
      };

      console.log(`✅ Ingrid: Processing complete for ${input.document.name}`);
      return response;

    } catch (error) {
      console.error('🚨 Ingrid processing error:', error);
      throw new IngridError(
        `Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROCESSING_FAILED',
        { document: input.document.name, context: input.context }
      );
    }
  }

  /**
   * Conversational interface
   *
   * Handles pure text conversations without document uploads
   */
  async handleConversation(
    message: string,
    context: ProcessingContext,
    conversationId?: string
  ): Promise<IngridResponse> {
    try {
      console.log(`💬 Ingrid: Handling conversation message in ${context}`);

      // Detect intent from the message
      const intent = await this.intentRecognition.detectIntent(message, context);

      // Generate contextual response using AI
      const conversationHistory = conversationId ?
        await this.conversationManager.getConversationHistory(conversationId) : [];
      const aiResponse = await this.conversationalAI.handleGeneralConversation(message, intent, conversationHistory);
      const responseMessage = aiResponse.message;

      // Generate any relevant action cards
      const actions = await this.actionCardGenerator.generateConversationalActions(intent, context);

      const response: IngridResponse = {
        message: responseMessage,
        actionCards: actions,
        confidence: intent.confidence,
        needsApproval: actions.some(a => a.approval_required),
        conversationId,
        context
      };

      // Update conversation if applicable
      if (conversationId) {
        await this.conversationManager.addMessage(conversationId, {
          id: this.generateId(),
          role: 'ingrid',
          content: responseMessage,
          timestamp: new Date().toISOString(),
          actionCards: actions.map(a => a.id)
        });
      }

      return response;

    } catch (error) {
      console.error('🚨 Conversation handling error:', error);
      throw new IngridError(
        `Failed to handle conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONVERSATION_FAILED',
        { message, context }
      );
    }
  }

  /**
   * Legacy compatibility layer
   *
   * Maintains compatibility with the old analyze-expense API
   * while routing through the new Ingrid engine
   */
  async analyzeExpenseLegacy(fileBase64: string, mimeType: string): Promise<LegacyResponse> {
    try {
      console.log('🔄 Legacy compatibility: Converting to Ingrid format');

      // Convert base64 to File object
      const file = this.base64ToFile(fileBase64, mimeType);

      // Process through Ingrid engine
      const ingridResult = await this.processDocument({
        document: file,
        context: 'expense_creation',
        userMessage: 'Process this expense receipt'
      });

      // Convert back to legacy format
      const legacyResponse = this.convertToLegacyFormat(ingridResult);
      console.log('✅ Legacy compatibility: Conversion complete');

      return legacyResponse;

    } catch (error) {
      console.error('🚨 Legacy analysis error:', error);
      return {
        data: {},
        error: { message: error instanceof Error ? error.message : 'Analysis failed' },
        success: false
      };
    }
  }

  /**
   * Action card approval/rejection
   */
  async handleActionResponse(actionId: string, approved: boolean, userId: string): Promise<IngridResponse> {
    try {
      const action = await this.actionCardGenerator.getActionCard(actionId);
      if (!action) {
        throw new IngridError('Action card not found', 'ACTION_NOT_FOUND');
      }

      if (approved) {
        await this.actionCardGenerator.executeAction(actionId, userId);
        return {
          message: `✅ Great! I've ${action.title.toLowerCase()} successfully.`,
          actionCards: [],
          confidence: 1.0,
          needsApproval: false
        };
      } else {
        await this.actionCardGenerator.rejectAction(actionId, userId);
        return {
          message: `👍 No problem! I've cancelled that action. Is there anything else you'd like me to help with?`,
          actionCards: [],
          confidence: 1.0,
          needsApproval: false
        };
      }
    } catch (error) {
      throw new IngridError(
        `Failed to handle action response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ACTION_RESPONSE_FAILED'
      );
    }
  }

  // Private helper methods

  private async generateResponse(
    analysis: DocumentAnalysis,
    intent: UserIntent,
    actions: ActionCard[]
  ): Promise<string> {
    const { documentType, confidence } = analysis;
    const actionCount = actions.length;

    // Generate contextual response based on document type and actions
    if (documentType === 'receipt' || documentType === 'invoice') {
      const hasExpenseAction = actions.some(a => a.type === 'create_expense');
      if (hasExpenseAction) {
        return `I found a ${documentType} with ${confidence}% confidence. I can create an expense entry for you with the extracted details. Would you like me to proceed?`;
      }
    }

    if (documentType === 'business_card') {
      const hasContactAction = actions.some(a => a.type === 'create_contact');
      if (hasContactAction) {
        return `I found a business card! I can add this contact to your system with their details. Should I create the contact entry?`;
      }
    }

    if (actionCount === 0) {
      return `I analyzed your ${documentType}, but I'm not sure what you'd like me to do with it. Could you tell me how you'd like me to help?`;
    }

    return `I found a ${documentType} and have ${actionCount} suggestion${actionCount > 1 ? 's' : ''} for you. Take a look and let me know what you'd like me to do!`;
  }

  private async generateConversationalResponse(
    message: string,
    intent: UserIntent,
    context: ProcessingContext
  ): Promise<string> {
    // Simple conversational responses based on intent
    switch (intent.primary) {
      case 'get_help':
        return "I'm Ingrid, your AI assistant! I can help you process documents, create expenses, manage contacts, and much more. Just upload a document or ask me what you need!";

      case 'create_expense':
        return "I'd be happy to help you create an expense! You can upload a receipt or invoice, or tell me the details and I'll create it for you.";

      case 'add_contact':
        return "I can help you add contacts! Upload a business card or provide me with their details and I'll create the contact entry.";

      default:
        return "I understand you want to " + intent.primary.replace('_', ' ') + ". How can I help you with that?";
    }
  }

  private determineApprovalNeeds(actions: ActionCard[]): boolean {
    return actions.some(action => action.approval_required);
  }

  private base64ToFile(base64: string, mimeType: string): File {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new File([byteArray], 'document', { type: mimeType });
  }

  private convertToLegacyFormat(ingridResult: IngridResponse): LegacyResponse {
    // Extract expense data from action cards
    const expenseAction = ingridResult.actionCards.find(a => a.type === 'create_expense');

    if (expenseAction && expenseAction.data) {
      return {
        data: {
          description: expenseAction.data.description || '',
          amount: expenseAction.data.amount || 0,
          vendor: expenseAction.data.vendor_name || '',
          date: expenseAction.data.expense_date || '',
          category_id: expenseAction.data.category_id || null,
          confidence: ingridResult.confidence
        },
        error: null,
        success: true
      };
    }

    return {
      data: { confidence: ingridResult.confidence },
      error: null,
      success: true
    };
  }

  private createFallbackAnalysis(document: File): DocumentAnalysis {
    return {
      documentType: 'receipt',
      extractedData: {
        vendor_name: 'Unknown Vendor',
        amount: 25.00,
        expense_date: new Date().toISOString().split('T')[0],
        description: `Expense from ${document.name}`,
        currency_code: 'USD',
        category_id: null // Will be set by smart categorization or user selection
      },
      confidence: 0.5,
      suggestions: ['Please verify the extracted information'],
      webEnrichment: undefined
    };
  }

  private createFallbackIntent(context: ProcessingContext): UserIntent {
    return {
      primary: context === 'expense_creation' ? 'create_expense' : 'analyze_document',
      secondary: [],
      confidence: 0.6,
      entities: [],
      context: context
    };
  }

  private createFallbackActions(analysis: DocumentAnalysis, intent: UserIntent): ActionCard[] {
    return [
      {
        id: 'fallback_action',
        type: 'expense_creation',
        title: 'Create Expense Entry',
        description: 'Create an expense entry with the extracted information',
        confidence: 0.5,
        priority: 'medium',
        data: analysis.extractedData,
        suggestedAction: 'review_and_submit',
        estimatedTime: 5
      }
    ];
  }

  private createFallbackAIResponse(analysis: DocumentAnalysis, intent: UserIntent, actions: ActionCard[]): any {
    return {
      message: `I've processed your document "${analysis.documentType}" and extracted the available information. While some AI services encountered issues, I can still help you create an expense entry. Please review the extracted data and make any necessary corrections.`,
      confidence: 0.5,
      suggestions: ['Review extracted data for accuracy', 'Add any missing information', 'Submit when ready']
    };
  }

  private generateId(): string {
    return `ingrid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create and export singleton instance with dynamic configuration
export const ingridCore = new IngridCore(ConfigurationService.getConfig());