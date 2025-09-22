/**
 * Ingrid AI Universal Assistant Types
 *
 * Core type definitions for the Ingrid AI system that replaces
 * the legacy analyze-expense function with a universal,
 * conversational AI assistant.
 */

// Core Ingrid Engine Types
export interface IngridResponse {
  message: string;
  actionCards: ActionCard[];
  confidence: number;
  needsApproval: boolean;
  conversationId?: string;
  context?: ProcessingContext;
}

export interface IngridDocumentInput {
  document: File;
  userMessage?: string;
  context: ProcessingContext;
  conversationId?: string;
  securityContext?: any; // SecurityContext from PermissionService
  companyId?: string; // Optional company ID for enhanced categorization
}

export interface ActionCard {
  id: string;
  type: ActionCardType;
  title: string;
  description: string;
  data: Record<string, any>;
  confidence: number;
  approval_required: boolean;
  status: ActionCardStatus;
  createdAt: string;
  expiresAt?: string;
}

export type ActionCardType =
  | 'create_expense'
  | 'create_contact'
  | 'create_vendor'
  | 'create_customer'
  | 'update_expense'
  | 'approve_expense'
  | 'create_expense_with_spire'
  | 'process_invoice'
  | 'extract_business_card'
  | 'process_quote'
  | 'general_action';

export type ActionCardStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'expired';

export type ProcessingContext =
  | 'expense_creation'
  | 'expense_workflow'
  | 'contact_management'
  | 'vendor_management'
  | 'invoice_processing'
  | 'document_analysis'
  | 'general_assistant';

// Document Analysis Types
export interface DocumentAnalysis {
  documentType: DocumentType;
  extractedData: Record<string, any>;
  confidence: number;
  suggestions: DocumentSuggestion[];
  webEnrichment?: WebEnrichmentData;
}

export type DocumentType =
  | 'receipt'
  | 'invoice'
  | 'business_card'
  | 'quote'
  | 'contract'
  | 'unknown';

export interface DocumentSuggestion {
  field: string;
  value: any;
  confidence: number;
  source: 'ocr' | 'web_enrichment' | 'historical_pattern' | 'ai_inference';
}

export interface WebEnrichmentData {
  companyInfo?: {
    name: string;
    website?: string;
    industry?: string;
    employeeCount?: number;
    description?: string;
  };
  vendorInfo?: {
    id?: string;
    name: string;
    category?: string;
    verified: boolean;
  };
}

// Conversation Management Types
export interface ConversationContext {
  id: string;
  userId: string;
  companyId: string;
  startedAt: string;
  lastActivity: string;
  status: ConversationStatus;
  messages: ConversationMessage[];
  metadata: Record<string, any>;
}

export type ConversationStatus =
  | 'active'
  | 'waiting_approval'
  | 'completed'
  | 'abandoned';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'ingrid';
  content: string;
  timestamp: string;
  attachments?: MessageAttachment[];
  actionCards?: string[]; // ActionCard IDs
}

export interface MessageAttachment {
  id: string;
  type: 'document' | 'image' | 'file';
  filename: string;
  size: number;
  url: string;
  mimeType: string;
}

// Intent Recognition Types
export interface UserIntent {
  primary: IntentType;
  confidence: number;
  entities: IntentEntity[];
  context: ProcessingContext;
}

export type IntentType =
  | 'process_document'
  | 'create_expense'
  | 'add_contact'
  | 'find_vendor'
  | 'get_help'
  | 'approve_action'
  | 'reject_action'
  | 'modify_data'
  | 'ask_question';

export interface IntentEntity {
  type: string;
  value: string;
  confidence: number;
  start?: number;
  end?: number;
}

// Legacy Compatibility Types
export interface LegacyResponse {
  data: {
    description?: string;
    amount?: number;
    vendor?: string;
    date?: string;
    category?: string;
    confidence?: number;
  };
  error: null | { message: string };
  success: boolean;
}

// Configuration Types
export interface IngridConfig {
  aiProvider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  enableWebEnrichment: boolean;
  enableSPIREIntegration: boolean;
  autoApprovalThreshold: number;
  conversationTimeout: number; // minutes
  ocrProvider: 'openai-vision' | 'google-document-ai';
  // OCR Provider API Keys
  googleProjectId?: string;
  googleProcessorId?: string;
}

// Error Types
export class IngridError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'IngridError';
  }
}