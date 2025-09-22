/**
 * Intent Recognition
 *
 * Natural language understanding to detect user intent from messages.
 * Determines what the user wants to accomplish.
 */

import {
  UserIntent,
  IntentType,
  IntentEntity,
  ProcessingContext,
  IngridConfig
} from '@/types/ingrid';

export class IntentRecognition {
  private config: IngridConfig;

  constructor(config: IngridConfig) {
    this.config = config;
  }

  /**
   * Detect user intent from message and context
   */
  async detectIntent(message: string, context: ProcessingContext): Promise<UserIntent> {
    try {
      console.log(`🎯 Analyzing intent: "${message}" in context: ${context}`);

      const normalizedMessage = message.toLowerCase().trim();
      const entities = this.extractEntities(normalizedMessage);

      // Simple rule-based intent detection
      // In production, this would use NLP/ML models
      const primary = this.classifyIntent(normalizedMessage, context);
      const confidence = this.calculateIntentConfidence(normalizedMessage, primary);

      const intent: UserIntent = {
        primary,
        confidence,
        entities,
        context
      };

      console.log(`🎯 Intent detected: ${primary} (${confidence}% confidence)`);
      return intent;

    } catch (error) {
      console.error('🎯 Intent recognition error:', error);
      // Return default intent on error
      return {
        primary: 'get_help',
        confidence: 0.5,
        entities: [],
        context
      };
    }
  }

  /**
   * Classify intent based on message content and context
   */
  private classifyIntent(message: string, context: ProcessingContext): IntentType {
    // Document processing patterns
    if (this.containsAny(message, ['process', 'analyze', 'upload', 'scan'])) {
      return 'process_document';
    }

    // Expense creation patterns
    if (this.containsAny(message, ['expense', 'receipt', 'bill', 'payment', 'cost'])) {
      return 'create_expense';
    }

    // Contact management patterns
    if (this.containsAny(message, ['contact', 'person', 'business card', 'add person'])) {
      return 'add_contact';
    }

    // Vendor management patterns
    if (this.containsAny(message, ['vendor', 'supplier', 'company', 'business'])) {
      return 'find_vendor';
    }

    // Approval patterns
    if (this.containsAny(message, ['approve', 'yes', 'confirm', 'accept', 'ok'])) {
      return 'approve_action';
    }

    // Rejection patterns
    if (this.containsAny(message, ['reject', 'no', 'cancel', 'decline', 'deny'])) {
      return 'reject_action';
    }

    // Modification patterns
    if (this.containsAny(message, ['change', 'modify', 'update', 'edit', 'fix'])) {
      return 'modify_data';
    }

    // Help patterns
    if (this.containsAny(message, ['help', 'how', 'what', 'explain', 'guide'])) {
      return 'get_help';
    }

    // Question patterns
    if (this.containsAny(message, ['?', 'when', 'where', 'why', 'which', 'who'])) {
      return 'ask_question';
    }

    // Context-based fallbacks
    if (context === 'expense_creation' || context === 'expense_workflow') {
      return 'create_expense';
    }

    if (context === 'contact_management') {
      return 'add_contact';
    }

    // Default to help
    return 'get_help';
  }

  /**
   * Extract entities from the message
   */
  private extractEntities(message: string): IntentEntity[] {
    const entities: IntentEntity[] = [];

    // Extract amounts
    const amountRegex = /\$?(\d+\.?\d*)/g;
    let match;
    while ((match = amountRegex.exec(message)) !== null) {
      entities.push({
        type: 'amount',
        value: match[1],
        confidence: 0.9,
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // Extract dates
    const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2}|today|yesterday|tomorrow)/g;
    while ((match = dateRegex.exec(message)) !== null) {
      entities.push({
        type: 'date',
        value: match[1],
        confidence: 0.8,
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // Extract email addresses
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    while ((match = emailRegex.exec(message)) !== null) {
      entities.push({
        type: 'email',
        value: match[1],
        confidence: 0.95,
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // Extract phone numbers
    const phoneRegex = /(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g;
    while ((match = phoneRegex.exec(message)) !== null) {
      entities.push({
        type: 'phone',
        value: match[1],
        confidence: 0.85,
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return entities;
  }

  /**
   * Calculate confidence score for intent classification
   */
  private calculateIntentConfidence(message: string, intent: IntentType): number {
    const baseConfidence = 0.7;
    let confidence = baseConfidence;

    // Higher confidence for clear patterns
    const intentPatterns: Record<IntentType, string[]> = {
      'process_document': ['process this', 'analyze this', 'what is this'],
      'create_expense': ['create expense', 'add expense', 'new expense'],
      'add_contact': ['add contact', 'create contact', 'new contact'],
      'find_vendor': ['find vendor', 'search vendor', 'lookup vendor'],
      'get_help': ['help me', 'how do', 'what can'],
      'approve_action': ['approve', 'yes', 'confirm'],
      'reject_action': ['reject', 'no', 'cancel'],
      'modify_data': ['change', 'modify', 'update'],
      'ask_question': ['what is', 'how much', 'when did']
    };

    const patterns = intentPatterns[intent] || [];
    const hasStrongPattern = patterns.some(pattern =>
      message.includes(pattern.toLowerCase())
    );

    if (hasStrongPattern) {
      confidence = Math.min(confidence + 0.2, 0.95);
    }

    // Lower confidence for very short messages
    if (message.length < 5) {
      confidence = Math.max(confidence - 0.2, 0.3);
    }

    // Higher confidence for longer, descriptive messages
    if (message.length > 20) {
      confidence = Math.min(confidence + 0.1, 0.95);
    }

    return Math.round(confidence * 100);
  }

  /**
   * Check if message contains any of the given keywords
   */
  private containsAny(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword.toLowerCase()));
  }
}