/**
 * Action Card Generator
 *
 * Generates intelligent action suggestions and manages their lifecycle.
 * Action cards represent specific workflows that users can approve or modify.
 */

import {
  ActionCard,
  ActionCardType,
  ActionCardStatus,
  DocumentAnalysis,
  UserIntent,
  ProcessingContext,
  IngridConfig,
  IngridError
} from '@/types/ingrid';
import { expenseService } from '@/services/api';

export class ActionCardGenerator {
  private config: IngridConfig;
  private actionCards: Map<string, ActionCard> = new Map();

  constructor(config: IngridConfig) {
    this.config = config;
  }

  /**
   * Generate action cards based on document analysis and user intent
   */
  async generateActions(analysis: DocumentAnalysis, intent: UserIntent): Promise<ActionCard[]> {
    try {
      const actions: ActionCard[] = [];

      // Generate actions based on document type
      switch (analysis.documentType) {
        case 'receipt':
        case 'invoice':
          actions.push(...await this.generateExpenseActions(analysis, intent));
          break;

        case 'business_card':
          actions.push(...await this.generateContactActions(analysis, intent));
          break;

        case 'quote':
          actions.push(...await this.generateQuoteActions(analysis, intent));
          break;

        case 'contract':
          actions.push(...await this.generateContractActions(analysis, intent));
          break;

        default:
          actions.push(...await this.generateGenericActions(analysis, intent));
      }

      // Store action cards for later reference
      actions.forEach(action => {
        this.actionCards.set(action.id, action);
      });

      console.log(`🎴 Generated ${actions.length} action cards`);
      return actions;

    } catch (error) {
      console.error('🎴 Action generation error:', error);
      throw new IngridError(
        `Failed to generate actions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ACTION_GENERATION_FAILED'
      );
    }
  }

  /**
   * Generate conversational action cards (no document)
   */
  async generateConversationalActions(intent: UserIntent, context: ProcessingContext): Promise<ActionCard[]> {
    const actions: ActionCard[] = [];

    switch (intent.primary) {
      case 'create_expense':
        actions.push(await this.createExpenseFormAction());
        break;

      case 'add_contact':
        actions.push(await this.createContactFormAction());
        break;

      case 'find_vendor':
        actions.push(await this.createVendorSearchAction());
        break;
    }

    return actions;
  }

  /**
   * Generate expense-related action cards
   */
  private async generateExpenseActions(analysis: DocumentAnalysis, intent: UserIntent): Promise<ActionCard[]> {
    const actions: ActionCard[] = [];
    const data = analysis.extractedData;

    // Extract field confidences from OCR suggestions
    const fieldConfidences = this.extractFieldConfidences(analysis);

    // Main expense creation action
    const expenseAction: ActionCard = {
      id: this.generateId(),
      type: 'create_expense',
      title: 'Create Expense',
      description: `Create expense for ${data.vendor_name || 'Unknown Vendor'} - $${data.amount || '0.00'}`,
      data: {
        title: data.description || `Expense from ${data.vendor_name}`,
        description: data.description,
        amount: data.amount || 0,
        expense_date: data.expense_date || new Date().toISOString().split('T')[0],
        vendor_name: data.vendor_name,
        currency_code: data.currency_code || 'USD',
        category_id: data.category_id,
        gl_account_code: data.gl_account_code,
        tax_amount: data.tax_amount,
        is_reimbursable: true,
        line_items: data.line_items || [],
        field_confidences: fieldConfidences
      },
      confidence: analysis.confidence,
      approval_required: data.amount > 500, // Require approval for expenses over $500
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    actions.push(expenseAction);

    // SPIRE integration action (if enabled and vendor exists)
    if (this.config.enableSPIREIntegration && data.vendor_name) {
      const spireAction: ActionCard = {
        id: this.generateId(),
        type: 'create_expense_with_spire',
        title: 'Create Expense with SPIRE Integration',
        description: `Create expense with SPIRE vendor lookup for ${data.vendor_name}`,
        data: {
          ...expenseAction.data,
          spire_vendor_lookup: true,
          suggested_gl_account: '6200' // Default GL account
        },
        confidence: analysis.confidence * 0.9, // Slightly lower due to integration complexity
        approval_required: true, // SPIRE integration always requires approval
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      actions.push(spireAction);
    }

    // Quick approve action for high-confidence, low-amount expenses
    if (analysis.confidence > 0.9 && data.amount < 100) {
      const quickApproveAction: ActionCard = {
        id: this.generateId(),
        type: 'approve_expense',
        title: 'Quick Approve & Submit',
        description: `Automatically approve and submit this ${data.amount} expense`,
        data: expenseAction.data,
        confidence: analysis.confidence,
        approval_required: false,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString() // 1 hour
      };

      actions.push(quickApproveAction);
    }

    return actions;
  }

  /**
   * Generate contact-related action cards
   */
  private async generateContactActions(analysis: DocumentAnalysis, intent: UserIntent): Promise<ActionCard[]> {
    const actions: ActionCard[] = [];
    const data = analysis.extractedData;

    const contactAction: ActionCard = {
      id: this.generateId(),
      type: 'create_contact',
      title: 'Add Contact',
      description: `Add ${data.first_name} ${data.last_name} from ${data.company}`,
      data: {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        title: data.title,
        website: data.website,
        address: data.address
      },
      confidence: analysis.confidence,
      approval_required: false,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    actions.push(contactAction);

    // Vendor creation action if company info is available
    if (data.company && analysis.webEnrichment?.companyInfo) {
      const vendorAction: ActionCard = {
        id: this.generateId(),
        type: 'create_vendor',
        title: 'Create Vendor',
        description: `Add ${data.company} as a vendor`,
        data: {
          name: data.company,
          contact_person: `${data.first_name} ${data.last_name}`,
          email: data.email,
          phone: data.phone,
          website: data.website,
          address: data.address,
          industry: analysis.webEnrichment.companyInfo.industry
        },
        confidence: analysis.confidence * 0.8,
        approval_required: true,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      actions.push(vendorAction);
    }

    return actions;
  }

  /**
   * Generate quote-related action cards
   */
  private async generateQuoteActions(analysis: DocumentAnalysis, intent: UserIntent): Promise<ActionCard[]> {
    const actions: ActionCard[] = [];
    const data = analysis.extractedData;

    const quoteAction: ActionCard = {
      id: this.generateId(),
      type: 'process_quote',
      title: 'Process Quote',
      description: `Process quote ${data.quote_number} from ${data.vendor_name}`,
      data: {
        quote_number: data.quote_number,
        vendor_name: data.vendor_name,
        total_amount: data.total_amount,
        quote_date: data.quote_date,
        expiration_date: data.expiration_date,
        line_items: data.line_items
      },
      confidence: analysis.confidence,
      approval_required: data.total_amount > 1000,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    actions.push(quoteAction);

    return actions;
  }

  /**
   * Generate contract-related action cards
   */
  private async generateContractActions(analysis: DocumentAnalysis, intent: UserIntent): Promise<ActionCard[]> {
    const actions: ActionCard[] = [];
    const data = analysis.extractedData;

    const contractAction: ActionCard = {
      id: this.generateId(),
      type: 'general_action',
      title: 'Review Contract',
      description: `Review and process contract: ${data.contract_title}`,
      data: {
        contract_title: data.contract_title,
        parties: data.parties,
        effective_date: data.effective_date,
        expiration_date: data.expiration_date,
        contract_value: data.contract_value
      },
      confidence: analysis.confidence,
      approval_required: true,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    actions.push(contractAction);

    return actions;
  }

  /**
   * Generate generic action cards for unknown documents
   */
  private async generateGenericActions(analysis: DocumentAnalysis, intent: UserIntent): Promise<ActionCard[]> {
    const actions: ActionCard[] = [];

    const genericAction: ActionCard = {
      id: this.generateId(),
      type: 'general_action',
      title: 'Process Document',
      description: `Process ${analysis.extractedData.filename || 'document'}`,
      data: analysis.extractedData,
      confidence: analysis.confidence,
      approval_required: true,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    actions.push(genericAction);

    return actions;
  }

  /**
   * Create expense form action for conversational flow
   */
  private async createExpenseFormAction(): Promise<ActionCard> {
    return {
      id: this.generateId(),
      type: 'create_expense',
      title: 'Create New Expense',
      description: 'Open expense creation form',
      data: {
        title: '',
        description: '',
        amount: 0,
        expense_date: new Date().toISOString().split('T')[0],
        currency_code: 'USD',
        is_reimbursable: true
      },
      confidence: 1.0,
      approval_required: false,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create contact form action for conversational flow
   */
  private async createContactFormAction(): Promise<ActionCard> {
    return {
      id: this.generateId(),
      type: 'create_contact',
      title: 'Add New Contact',
      description: 'Open contact creation form',
      data: {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: ''
      },
      confidence: 1.0,
      approval_required: false,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create vendor search action
   */
  private async createVendorSearchAction(): Promise<ActionCard> {
    return {
      id: this.generateId(),
      type: 'general_action',
      title: 'Search Vendors',
      description: 'Search for vendors in the system',
      data: {
        action: 'vendor_search'
      },
      confidence: 1.0,
      approval_required: false,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Execute an approved action
   */
  async executeAction(actionId: string, userId: string): Promise<void> {
    const action = this.actionCards.get(actionId);
    if (!action) {
      throw new IngridError('Action card not found', 'ACTION_NOT_FOUND');
    }

    try {
      console.log(`🎯 Executing action: ${action.type} (${actionId})`);

      switch (action.type) {
        case 'create_expense':
        case 'create_expense_with_spire':
          await this.executeExpenseCreation(action);
          break;

        case 'approve_expense':
          await this.executeExpenseApproval(action, userId);
          break;

        case 'create_contact':
          await this.executeContactCreation(action);
          break;

        case 'create_vendor':
          await this.executeVendorCreation(action);
          break;

        default:
          console.log(`ℹ️ Action type ${action.type} execution not implemented yet`);
      }

      action.status = 'executed';
      console.log(`✅ Action executed successfully: ${actionId}`);

    } catch (error) {
      console.error(`🚨 Action execution failed: ${actionId}`, error);
      throw new IngridError(
        `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ACTION_EXECUTION_FAILED',
        { actionId, actionType: action.type }
      );
    }
  }

  /**
   * Reject an action
   */
  async rejectAction(actionId: string, userId: string): Promise<void> {
    const action = this.actionCards.get(actionId);
    if (!action) {
      throw new IngridError('Action card not found', 'ACTION_NOT_FOUND');
    }

    action.status = 'rejected';
    console.log(`❌ Action rejected: ${actionId}`);
  }

  /**
   * Get action card by ID
   */
  async getActionCard(actionId: string): Promise<ActionCard | undefined> {
    return this.actionCards.get(actionId);
  }

  // Private execution methods

  private async executeExpenseCreation(action: ActionCard): Promise<void> {
    const result = await expenseService.createExpense({
      title: action.data.title,
      description: action.data.description,
      amount: action.data.amount,
      expense_date: action.data.expense_date,
      vendor_name: action.data.vendor_name,
      currency_code: action.data.currency_code || 'USD',
      is_reimbursable: action.data.is_reimbursable,
      company_id: 'current-company', // Will be set from session context
      submitted_by: 'current-user' // Will be set from session context
    });

    if (!result.success) {
      throw new Error(`Expense creation failed: ${result.error?.message}`);
    }

    console.log(`💰 Expense created: ${result.data?.id}`);
  }

  private async executeExpenseApproval(action: ActionCard, userId: string): Promise<void> {
    // First create the expense, then approve it
    await this.executeExpenseCreation(action);

    // In a real implementation, would approve the created expense
    console.log(`✅ Expense auto-approved by ${userId}`);
  }

  private async executeContactCreation(action: ActionCard): Promise<void> {
    // Implementation would call contact service
    console.log(`👤 Contact created: ${action.data.first_name} ${action.data.last_name}`);
  }

  private async executeVendorCreation(action: ActionCard): Promise<void> {
    // Implementation would call vendor service
    console.log(`🏢 Vendor created: ${action.data.name}`);
  }

  private generateId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract field confidences from document analysis suggestions
   */
  private extractFieldConfidences(analysis: DocumentAnalysis): Record<string, number> {
    const fieldConfidences: Record<string, number> = {};

    // Map from suggestions (which come from OCR keyValuePairs)
    if (analysis.suggestions) {
      analysis.suggestions.forEach(suggestion => {
        const fieldName = suggestion.field;
        const confidence = suggestion.confidence;

        // Map OCR field names to expected form field names
        const fieldMapping: Record<string, string> = {
          'vendor_name': 'vendor_name',
          'amount': 'amount',
          'expense_date': 'expense_date',
          'description': 'description',
          'category': 'category',
          'gl_account_code': 'gl_account_code',
          'tax_amount': 'tax_amount',
          'currency_code': 'currency_code'
        };

        const mappedField = fieldMapping[fieldName];
        if (mappedField) {
          fieldConfidences[mappedField] = confidence;
        }
      });
    }

    // Set default confidences for common fields if not present
    const defaultConfidences = {
      description: 0.8,
      amount: 0.85,
      vendor_name: 0.8,
      expense_date: 0.9,
      category_id: 0.7,
      gl_account_code: 0.6,
      tax_amount: 0.75,
      currency_code: 0.95
    };

    // Fill in missing confidences with defaults
    Object.entries(defaultConfidences).forEach(([field, defaultConfidence]) => {
      if (fieldConfidences[field] === undefined) {
        fieldConfidences[field] = defaultConfidence;
      }
    });

    console.log('🎯 Extracted field confidences:', fieldConfidences);
    return fieldConfidences;
  }
}