/**
 * Ingrid AI Services Export
 *
 * Central export file for all Ingrid AI functionality.
 * Provides clean imports for the rest of the application.
 */

// Core engine and services
export { IngridCore, ingridCore } from './IngridCore';
export { DocumentProcessor } from './DocumentProcessor';
export { ActionCardGenerator } from './ActionCardGenerator';
export { ConversationManager } from './ConversationManager';
export { IntentRecognition } from './IntentRecognition';
export { ConversationalAI } from './ConversationalAI';
export { OCRService } from './OCRService';
export { ConfigurationService } from './ConfigurationService';
export { WebEnrichmentService } from './WebEnrichmentService';
export { SmartCategorizationService } from './SmartCategorizationService';

// Legacy compatibility
export { analyzeExpense, analyzeDocumentWithIngrid, migrateFromSupabaseFunction } from './LegacyCompatibility';

// Types
export * from '@/types/ingrid';

// Default export provides the main API
import { ingridCore } from './IngridCore';
import { analyzeExpense, analyzeDocumentWithIngrid } from './LegacyCompatibility';

export default {
  // Main Ingrid instance
  ingrid: ingridCore,

  // Document processing
  processDocument: ingridCore.processDocument.bind(ingridCore),
  handleConversation: ingridCore.handleConversation.bind(ingridCore),

  // Legacy compatibility
  analyzeExpense,
  analyzeDocumentWithIngrid,

  // Direct access to core for advanced usage
  core: ingridCore
};