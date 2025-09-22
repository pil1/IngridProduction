/**
 * Suggested Category Service for Ingrid AI
 *
 * Handles storage, retrieval, and approval workflow for AI-suggested expense categories.
 * Integrates with Supabase for persistent storage and provides controller approval workflow.
 */

import { supabase } from '@/integrations/supabase/client';

export interface SuggestedCategory {
  id: string;
  company_id: string;
  suggested_name: string;
  suggested_description?: string;
  suggested_by_user_id?: string;
  confidence_score: number;
  ai_reasoning?: string;
  source_document_name?: string;
  vendor_context?: string;
  amount_context?: number;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  reviewed_by_user_id?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_category_id?: string;
  usage_count: number;
  first_suggested_at: string;
  last_suggested_at: string;
  created_at: string;
  updated_at: string;
}

export interface SuggestedCategoryContext {
  description?: string;
  reasoning?: string;
  document_name?: string;
  vendor_name?: string;
  amount?: number;
}

export interface ApprovalResult {
  categoryId: string;
  suggestionId: string;
  success: boolean;
  error?: string;
}

export class SuggestedCategoryService {

  /**
   * Store a new category suggestion or increment usage count for existing one
   */
  static async storeSuggestion(
    companyId: string,
    suggestedName: string,
    confidenceScore: number,
    context: SuggestedCategoryContext = {}
  ): Promise<string> {
    try {
      console.log(`💡 Storing category suggestion: "${suggestedName}" for company ${companyId}`);

      // Use the database function to handle deduplication and usage counting
      const { data, error } = await supabase.rpc('increment_suggestion_usage', {
        p_company_id: companyId,
        p_suggested_name: suggestedName,
        p_confidence_score: confidenceScore,
        p_context: context
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Category suggestion stored with ID: ${data}`);
      return data;
    } catch (error) {
      console.error('❌ Failed to store category suggestion:', error);
      throw new Error(`Failed to store category suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all pending suggestions for a company
   */
  static async getPendingSuggestions(companyId: string): Promise<SuggestedCategory[]> {
    try {
      console.log(`📋 Fetching pending suggestions for company: ${companyId}`);

      const { data, error } = await supabase
        .from('suggested_categories')
        .select(`
          *,
          suggested_by_user:profiles!suggested_by_user_id(id, first_name, last_name, email),
          reviewed_by_user:profiles!reviewed_by_user_id(id, first_name, last_name, email)
        `)
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('usage_count', { ascending: false })
        .order('last_suggested_at', { ascending: false });

      if (error) {
        throw error;
      }

      console.log(`📊 Found ${data?.length || 0} pending suggestions`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch pending suggestions:', error);
      return [];
    }
  }

  /**
   * Get all suggestions (including approved/rejected) for a company
   */
  static async getAllSuggestions(companyId: string): Promise<SuggestedCategory[]> {
    try {
      const { data, error } = await supabase
        .from('suggested_categories')
        .select(`
          *,
          suggested_by_user:profiles!suggested_by_user_id(id, first_name, last_name, email),
          reviewed_by_user:profiles!reviewed_by_user_id(id, first_name, last_name, email),
          created_category:expense_categories!created_category_id(id, name, description)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch all suggestions:', error);
      return [];
    }
  }

  /**
   * Approve a suggestion and create the corresponding expense category
   */
  static async approveSuggestion(
    suggestionId: string,
    reviewerId: string,
    finalName?: string,
    finalDescription?: string,
    glAccountId?: string,
    reviewNotes?: string
  ): Promise<ApprovalResult> {
    try {
      console.log(`✅ Approving suggestion: ${suggestionId}`);

      const { data, error } = await supabase.rpc('approve_category_suggestion', {
        p_suggestion_id: suggestionId,
        p_reviewer_id: reviewerId,
        p_final_name: finalName || null,
        p_final_description: finalDescription || null,
        p_gl_account_id: glAccountId || null,
        p_review_notes: reviewNotes || null
      });

      if (error) {
        throw error;
      }

      console.log(`🎉 Suggestion approved and category created with ID: ${data}`);
      return {
        categoryId: data,
        suggestionId,
        success: true
      };
    } catch (error) {
      console.error('❌ Failed to approve suggestion:', error);
      return {
        categoryId: '',
        suggestionId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reject a suggestion
   */
  static async rejectSuggestion(
    suggestionId: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      console.log(`❌ Rejecting suggestion: ${suggestionId}`);

      const { error } = await supabase
        .from('suggested_categories')
        .update({
          status: 'rejected',
          reviewed_by_user_id: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || 'Rejected by controller',
          updated_at: new Date().toISOString()
        })
        .eq('id', suggestionId);

      if (error) {
        throw error;
      }

      console.log(`✅ Suggestion rejected successfully`);
      return true;
    } catch (error) {
      console.error('❌ Failed to reject suggestion:', error);
      return false;
    }
  }

  /**
   * Merge multiple similar suggestions into one approved category
   */
  static async mergeSuggestions(
    suggestionIds: string[],
    reviewerId: string,
    finalName: string,
    finalDescription?: string,
    glAccountId?: string,
    reviewNotes?: string
  ): Promise<ApprovalResult> {
    try {
      console.log(`🔄 Merging ${suggestionIds.length} suggestions into one category`);

      if (suggestionIds.length === 0) {
        throw new Error('No suggestions provided for merging');
      }

      // Approve the first suggestion (creates the category)
      const approvalResult = await this.approveSuggestion(
        suggestionIds[0],
        reviewerId,
        finalName,
        finalDescription,
        glAccountId,
        reviewNotes
      );

      if (!approvalResult.success) {
        throw new Error(approvalResult.error);
      }

      // Mark the rest as merged
      const remainingSuggestionIds = suggestionIds.slice(1);
      if (remainingSuggestionIds.length > 0) {
        const { error } = await supabase
          .from('suggested_categories')
          .update({
            status: 'merged',
            reviewed_by_user_id: reviewerId,
            reviewed_at: new Date().toISOString(),
            review_notes: `Merged into category: ${finalName}`,
            created_category_id: approvalResult.categoryId,
            updated_at: new Date().toISOString()
          })
          .in('id', remainingSuggestionIds);

        if (error) {
          throw error;
        }
      }

      console.log(`🎉 Successfully merged ${suggestionIds.length} suggestions`);
      return approvalResult;
    } catch (error) {
      console.error('❌ Failed to merge suggestions:', error);
      return {
        categoryId: '',
        suggestionId: suggestionIds[0],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get suggestion statistics for a company
   */
  static async getSuggestionStats(companyId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    merged: number;
    avgConfidence: number;
    topSuggestions: Array<{ name: string; count: number; confidence: number }>;
  }> {
    try {
      const suggestions = await this.getAllSuggestions(companyId);

      const stats = {
        total: suggestions.length,
        pending: suggestions.filter(s => s.status === 'pending').length,
        approved: suggestions.filter(s => s.status === 'approved').length,
        rejected: suggestions.filter(s => s.status === 'rejected').length,
        merged: suggestions.filter(s => s.status === 'merged').length,
        avgConfidence: suggestions.length > 0
          ? suggestions.reduce((sum, s) => sum + s.confidence_score, 0) / suggestions.length
          : 0,
        topSuggestions: suggestions
          .filter(s => s.status === 'pending')
          .sort((a, b) => b.usage_count - a.usage_count)
          .slice(0, 5)
          .map(s => ({
            name: s.suggested_name,
            count: s.usage_count,
            confidence: s.confidence_score
          }))
      };

      return stats;
    } catch (error) {
      console.error('❌ Failed to get suggestion stats:', error);
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        merged: 0,
        avgConfidence: 0,
        topSuggestions: []
      };
    }
  }
}