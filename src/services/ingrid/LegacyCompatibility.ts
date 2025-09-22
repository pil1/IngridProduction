/**
 * Legacy Compatibility Layer
 *
 * Maintains backward compatibility with the old analyze-expense API
 * while routing all processing through the new Ingrid engine.
 * This allows for seamless migration without breaking existing code.
 */

import { ingridCore } from './IngridCore';
import { LegacyResponse } from '@/types/ingrid';

/**
 * Legacy analyze-expense function replacement
 *
 * Provides a drop-in replacement for the old Supabase Edge Function
 * that maintains the same API but uses Ingrid's universal processing.
 */
export async function analyzeExpense(
  fileBase64: string,
  mimeType: string
): Promise<LegacyResponse> {
  try {
    console.log('🔄 Legacy API called - routing through Ingrid AI');

    // Use Ingrid's legacy compatibility layer
    const result = await ingridCore.analyzeExpenseLegacy(fileBase64, mimeType);

    console.log('✅ Legacy API processed through Ingrid successfully');
    return result;

  } catch (error) {
    console.error('🚨 Legacy API error:', error);
    return {
      data: {},
      error: { message: error instanceof Error ? error.message : 'Analysis failed' },
      success: false
    };
  }
}

/**
 * Enhanced analyze function that returns full Ingrid capabilities
 *
 * For new code that wants to take advantage of Ingrid's full feature set
 * while still using a simple function-based API.
 */
export async function analyzeDocumentWithIngrid(
  file: File,
  context: 'expense_creation' | 'contact_management' | 'document_analysis' = 'expense_creation'
) {
  try {
    console.log(`🤖 Enhanced analyze called: ${file.name} (${context})`);

    const response = await ingridCore.processDocument({
      document: file,
      context,
      userMessage: `Analyze this ${file.name}`
    });

    console.log('✅ Enhanced analysis complete');
    return {
      success: true,
      data: response,
      error: null
    };

  } catch (error) {
    console.error('🚨 Enhanced analysis error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

/**
 * Migration helper to gradually update existing code
 *
 * This function can be used to replace calls to the old analyze-expense
 * Supabase function with minimal code changes.
 */
export async function migrateFromSupabaseFunction(
  functionName: 'analyze-expense',
  payload: { file_base64: string; mime_type: string }
): Promise<LegacyResponse> {
  console.log(`🔄 Migrating Supabase function call: ${functionName}`);

  switch (functionName) {
    case 'analyze-expense':
      return analyzeExpense(payload.file_base64, payload.mime_type);

    default:
      return {
        data: {},
        error: { message: `Function ${functionName} not supported` },
        success: false
      };
  }
}

// Export the main functions for easy import
export { ingridCore };
export default {
  analyzeExpense,
  analyzeDocumentWithIngrid,
  migrateFromSupabaseFunction,
  ingridCore
};