/**
 * Conversational AI Service
 *
 * Handles natural language conversations with users using OpenAI GPT-4.
 * Provides context-aware responses and maintains conversation flow.
 */

import { IngridConfig, UserIntent, DocumentAnalysis, ActionCard } from '@/types/ingrid';

export interface ConversationalAIResponse {
  message: string;
  confidence: number;
  suggestedActions?: string[];
  requiresFollowUp: boolean;
}

export class ConversationalAI {
  private config: IngridConfig;

  constructor(config: IngridConfig) {
    this.config = config;
  }

  /**
   * Generate contextual response based on document analysis and user intent
   */
  async generateDocumentResponse(
    analysis: DocumentAnalysis,
    intent: UserIntent,
    actions: ActionCard[]
  ): Promise<ConversationalAIResponse> {
    try {
      if (this.config.aiProvider === 'openai' && this.config.apiKey) {
        return this.generateOpenAIResponse(analysis, intent, actions);
      } else {
        // Fallback to rule-based responses
        return this.generateRuleBasedResponse(analysis, intent, actions);
      }
    } catch (error) {
      console.warn('⚠️ AI response generation failed, using fallback:', error);
      return this.generateRuleBasedResponse(analysis, intent, actions);
    }
  }

  /**
   * Generate conversational response using OpenAI GPT-4
   */
  private async generateOpenAIResponse(
    analysis: DocumentAnalysis,
    intent: UserIntent,
    actions: ActionCard[]
  ): Promise<ConversationalAIResponse> {
    const prompt = this.buildContextualPrompt(analysis, intent, actions);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are Ingrid, an AI assistant for expense management and document processing.
                     You are friendly, helpful, and professional. You help users process documents,
                     create expenses, manage contacts, and automate business workflows.

                     Always:
                     - Be conversational and helpful
                     - Explain what you found in the document
                     - Offer specific actions the user can take
                     - Ask for confirmation before taking actions
                     - Keep responses concise but informative`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message?.content || 'I processed your document!';

    return {
      message,
      confidence: 0.9,
      requiresFollowUp: actions.length > 0 && actions.some(a => a.approval_required),
      suggestedActions: actions.map(a => a.title)
    };
  }

  /**
   * Handle general conversation without document context
   */
  async handleGeneralConversation(
    userMessage: string,
    intent: UserIntent,
    conversationHistory: any[] = []
  ): Promise<ConversationalAIResponse> {
    try {
      if (this.config.aiProvider === 'openai' && this.config.apiKey) {
        return this.generateOpenAIConversationResponse(userMessage, intent, conversationHistory);
      } else {
        return this.generateRuleBasedConversationResponse(userMessage, intent);
      }
    } catch (error) {
      console.warn('⚠️ Conversation AI failed, using fallback:', error);
      return this.generateRuleBasedConversationResponse(userMessage, intent);
    }
  }

  /**
   * Generate conversation response using OpenAI
   */
  private async generateOpenAIConversationResponse(
    userMessage: string,
    intent: UserIntent,
    conversationHistory: any[]
  ): Promise<ConversationalAIResponse> {
    const messages = [
      {
        role: 'system',
        content: `You are Ingrid, an AI assistant for expense management and document processing.
                 You help users with business tasks like processing receipts, managing contacts,
                 creating expenses, and automating workflows.

                 Be friendly, helpful, and professional. Keep responses concise but informative.
                 If the user asks about capabilities, explain what you can do with documents and data.`
      }
    ];

    // Add conversation history (last 5 messages)
    const recentHistory = conversationHistory.slice(-5);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message?.content || 'How can I help you today?';

    return {
      message,
      confidence: 0.9,
      requiresFollowUp: false
    };
  }

  /**
   * Build contextual prompt for document processing
   */
  private buildContextualPrompt(
    analysis: DocumentAnalysis,
    intent: UserIntent,
    actions: ActionCard[]
  ): string {
    const { documentType, extractedData, confidence } = analysis;

    let prompt = `I analyzed a ${documentType} with ${confidence}% confidence. `;

    // Add key extracted data
    if (extractedData.vendor_name) {
      prompt += `The vendor is ${extractedData.vendor_name}. `;
    }
    if (extractedData.amount) {
      prompt += `The amount is $${extractedData.amount}. `;
    }
    if (extractedData.expense_date) {
      prompt += `The date is ${extractedData.expense_date}. `;
    }

    // Add available actions
    if (actions.length > 0) {
      prompt += `I can help with these actions: ${actions.map(a => a.title).join(', ')}. `;
    }

    // Add user intent context
    prompt += `The user wants to ${intent.primary.replace('_', ' ')}. `;

    prompt += `Generate a helpful, conversational response explaining what I found and asking for user approval to proceed with suggested actions. Keep it friendly and concise.`;

    return prompt;
  }

  /**
   * Fallback rule-based responses for document processing
   */
  private generateRuleBasedResponse(
    analysis: DocumentAnalysis,
    intent: UserIntent,
    actions: ActionCard[]
  ): ConversationalAIResponse {
    const { documentType, confidence, extractedData } = analysis;
    const actionCount = actions.length;

    let message = `I analyzed your ${documentType} with ${confidence}% confidence. `;

    // Add specific details based on document type
    if (documentType === 'receipt' || documentType === 'invoice') {
      if (extractedData.vendor_name && extractedData.amount) {
        message += `I found an expense from ${extractedData.vendor_name} for $${extractedData.amount}. `;
      }
      const hasExpenseAction = actions.some(a => a.type === 'create_expense');
      if (hasExpenseAction) {
        message += `I can create an expense entry for you. Would you like me to proceed?`;
      }
    } else if (documentType === 'business_card') {
      if (extractedData.company && extractedData.first_name) {
        message += `I found contact information for ${extractedData.first_name} from ${extractedData.company}. `;
      }
      const hasContactAction = actions.some(a => a.type === 'create_contact');
      if (hasContactAction) {
        message += `I can add this contact to your system. Should I create the contact entry?`;
      }
    } else {
      if (actionCount > 0) {
        message += `I have ${actionCount} suggestion${actionCount > 1 ? 's' : ''} for you. `;
      } else {
        message += `I'm not sure what you'd like me to do with this document. Could you tell me how I can help?`;
      }
    }

    return {
      message,
      confidence: 0.85,
      requiresFollowUp: actions.some(a => a.approval_required),
      suggestedActions: actions.map(a => a.title)
    };
  }

  /**
   * Fallback rule-based conversation responses
   */
  private generateRuleBasedConversationResponse(
    userMessage: string,
    intent: UserIntent
  ): ConversationalAIResponse {
    const message = userMessage.toLowerCase();

    // Handle common greetings and help requests
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return {
        message: "Hello! I'm Ingrid, your AI assistant. I can help you process documents, create expenses, manage contacts, and automate business workflows. What would you like to do today?",
        confidence: 0.9,
        requiresFollowUp: false
      };
    }

    if (message.includes('help') || message.includes('what can you do')) {
      return {
        message: "I can help you with many tasks! Upload receipts or invoices to create expenses automatically, scan business cards to add contacts, process quotes and contracts, and much more. Just upload a document or tell me what you need help with!",
        confidence: 0.9,
        requiresFollowUp: false
      };
    }

    // Handle intent-based responses
    switch (intent.primary) {
      case 'create_expense':
        return {
          message: "I'd be happy to help you create an expense! You can upload a receipt or invoice, or tell me the details and I'll create it for you.",
          confidence: 0.8,
          requiresFollowUp: false
        };

      case 'add_contact':
        return {
          message: "I can help you add contacts! Upload a business card or provide me with their details and I'll create the contact entry.",
          confidence: 0.8,
          requiresFollowUp: false
        };

      case 'get_help':
        return {
          message: "I'm here to help! I specialize in document processing and business automation. Upload a document, and I'll analyze it and suggest actions you can take.",
          confidence: 0.8,
          requiresFollowUp: false
        };

      default:
        return {
          message: "I understand you want to " + intent.primary.replace('_', ' ') + ". Could you provide more details or upload a relevant document so I can help you better?",
          confidence: 0.6,
          requiresFollowUp: true
        };
    }
  }
}