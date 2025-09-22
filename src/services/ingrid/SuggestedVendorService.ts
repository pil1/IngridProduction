/**
 * Suggested Vendor Service for Ingrid AI
 *
 * Handles storage, retrieval, and approval workflow for AI-suggested vendors.
 * Integrates with Supabase for persistent storage and provides controller approval workflow.
 */

import { supabase } from '@/integrations/supabase/client';

export interface SuggestedVendor {
  id: string;
  company_id: string;
  suggested_name: string;
  suggested_email?: string;
  suggested_phone?: string;
  suggested_address_line1?: string;
  suggested_address_line2?: string;
  suggested_city?: string;
  suggested_state?: string;
  suggested_country?: string;
  suggested_postal_code?: string;
  suggested_website?: string;
  suggested_tax_id?: string;
  suggested_description?: string;
  suggested_by_user_id?: string;
  confidence_score: number;
  ai_reasoning?: string;
  source_document_name?: string;
  extraction_context?: Record<string, any>;
  web_enrichment_data?: Record<string, any>;
  web_enrichment_confidence?: number;
  vendor_match_type?: string;
  existing_vendor_similarity?: number;
  similar_vendor_ids?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  reviewed_by_user_id?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_vendor_id?: string;
  usage_count: number;
  first_suggested_at: string;
  last_suggested_at: string;
  created_at: string;
  updated_at: string;
}

export interface SuggestedVendorContext {
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  tax_id?: string;
  description?: string;
  reasoning?: string;
  document_name?: string;
  match_type?: string;
}

export interface VendorApprovalResult {
  vendorId: string;
  suggestionId: string;
  success: boolean;
  error?: string;
}

export class SuggestedVendorService {

  /**
   * Store a new vendor suggestion or increment usage count for existing one
   */
  static async storeSuggestion(
    companyId: string,
    suggestedName: string,
    confidenceScore: number,
    context: SuggestedVendorContext = {},
    webEnrichmentData?: Record<string, any>
  ): Promise<string> {
    try {
      console.log(`💼 Storing vendor suggestion: "${suggestedName}" for company ${companyId}`);

      // Use the database function to handle deduplication and usage counting
      const { data, error } = await supabase.rpc('increment_vendor_suggestion_usage', {
        p_company_id: companyId,
        p_suggested_name: suggestedName,
        p_confidence_score: confidenceScore,
        p_context: context,
        p_web_data: webEnrichmentData || {}
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Vendor suggestion stored with ID: ${data}`);
      return data;
    } catch (error) {
      console.error('❌ Failed to store vendor suggestion:', error);
      throw new Error(`Failed to store vendor suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all pending suggestions for a company
   */
  static async getPendingSuggestions(companyId: string): Promise<SuggestedVendor[]> {
    try {
      console.log(`📋 Fetching pending vendor suggestions for company: ${companyId}`);

      const { data, error } = await supabase
        .from('suggested_vendors')
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

      console.log(`📊 Found ${data?.length || 0} pending vendor suggestions`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch pending vendor suggestions:', error);
      return [];
    }
  }

  /**
   * Get all suggestions (including approved/rejected) for a company
   */
  static async getAllSuggestions(companyId: string): Promise<SuggestedVendor[]> {
    try {
      const { data, error } = await supabase
        .from('suggested_vendors')
        .select(`
          *,
          suggested_by_user:profiles!suggested_by_user_id(id, first_name, last_name, email),
          reviewed_by_user:profiles!reviewed_by_user_id(id, first_name, last_name, email),
          created_vendor:vendors!created_vendor_id(id, name, email, phone, website)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch all vendor suggestions:', error);
      return [];
    }
  }

  /**
   * Approve a suggestion and create the corresponding vendor
   */
  static async approveSuggestion(
    suggestionId: string,
    reviewerId: string,
    finalName?: string,
    finalEmail?: string,
    finalPhone?: string,
    finalAddressLine1?: string,
    finalAddressLine2?: string,
    finalCity?: string,
    finalState?: string,
    finalCountry?: string,
    finalPostalCode?: string,
    finalWebsite?: string,
    finalTaxId?: string,
    finalDescription?: string,
    reviewNotes?: string
  ): Promise<VendorApprovalResult> {
    try {
      console.log(`✅ Approving vendor suggestion: ${suggestionId}`);

      const { data, error } = await supabase.rpc('approve_vendor_suggestion', {
        p_suggestion_id: suggestionId,
        p_reviewer_id: reviewerId,
        p_final_name: finalName || null,
        p_final_email: finalEmail || null,
        p_final_phone: finalPhone || null,
        p_final_address_line1: finalAddressLine1 || null,
        p_final_address_line2: finalAddressLine2 || null,
        p_final_city: finalCity || null,
        p_final_state: finalState || null,
        p_final_country: finalCountry || null,
        p_final_postal_code: finalPostalCode || null,
        p_final_website: finalWebsite || null,
        p_final_tax_id: finalTaxId || null,
        p_final_description: finalDescription || null,
        p_review_notes: reviewNotes || null
      });

      if (error) {
        throw error;
      }

      console.log(`🎉 Vendor suggestion approved and vendor created with ID: ${data}`);
      return {
        vendorId: data,
        suggestionId,
        success: true
      };
    } catch (error) {
      console.error('❌ Failed to approve vendor suggestion:', error);
      return {
        vendorId: '',
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
      console.log(`❌ Rejecting vendor suggestion: ${suggestionId}`);

      const { error } = await supabase
        .from('suggested_vendors')
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

      console.log(`✅ Vendor suggestion rejected successfully`);
      return true;
    } catch (error) {
      console.error('❌ Failed to reject vendor suggestion:', error);
      return false;
    }
  }

  /**
   * Merge multiple similar suggestions into one approved vendor
   */
  static async mergeSuggestions(
    suggestionIds: string[],
    reviewerId: string,
    finalName: string,
    finalEmail?: string,
    finalPhone?: string,
    finalWebsite?: string,
    finalDescription?: string,
    reviewNotes?: string
  ): Promise<VendorApprovalResult> {
    try {
      console.log(`🔄 Merging ${suggestionIds.length} vendor suggestions into one vendor`);

      if (suggestionIds.length === 0) {
        throw new Error('No suggestions provided for merging');
      }

      // Approve the first suggestion (creates the vendor)
      const approvalResult = await this.approveSuggestion(
        suggestionIds[0],
        reviewerId,
        finalName,
        finalEmail,
        finalPhone,
        undefined, // address fields
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        finalWebsite,
        undefined, // tax_id
        finalDescription,
        reviewNotes
      );

      if (!approvalResult.success) {
        throw new Error(approvalResult.error);
      }

      // Mark the rest as merged
      const remainingSuggestionIds = suggestionIds.slice(1);
      if (remainingSuggestionIds.length > 0) {
        const { error } = await supabase
          .from('suggested_vendors')
          .update({
            status: 'merged',
            reviewed_by_user_id: reviewerId,
            reviewed_at: new Date().toISOString(),
            review_notes: `Merged into vendor: ${finalName}`,
            created_vendor_id: approvalResult.vendorId,
            updated_at: new Date().toISOString()
          })
          .in('id', remainingSuggestionIds);

        if (error) {
          throw error;
        }
      }

      console.log(`🎉 Successfully merged ${suggestionIds.length} vendor suggestions`);
      return approvalResult;
    } catch (error) {
      console.error('❌ Failed to merge vendor suggestions:', error);
      return {
        vendorId: '',
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
    avgWebEnrichmentConfidence: number;
    topSuggestions: Array<{ name: string; count: number; confidence: number; hasWebData: boolean }>;
    webEnrichmentSuccess: number;
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
        avgWebEnrichmentConfidence: suggestions.filter(s => s.web_enrichment_confidence).length > 0
          ? suggestions
              .filter(s => s.web_enrichment_confidence)
              .reduce((sum, s) => sum + (s.web_enrichment_confidence || 0), 0) /
            suggestions.filter(s => s.web_enrichment_confidence).length
          : 0,
        topSuggestions: suggestions
          .filter(s => s.status === 'pending')
          .sort((a, b) => b.usage_count - a.usage_count)
          .slice(0, 5)
          .map(s => ({
            name: s.suggested_name,
            count: s.usage_count,
            confidence: s.confidence_score,
            hasWebData: !!(s.web_enrichment_data && Object.keys(s.web_enrichment_data).length > 0)
          })),
        webEnrichmentSuccess: suggestions.filter(s => s.web_enrichment_data && Object.keys(s.web_enrichment_data).length > 0).length
      };

      return stats;
    } catch (error) {
      console.error('❌ Failed to get vendor suggestion stats:', error);
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        merged: 0,
        avgConfidence: 0,
        avgWebEnrichmentConfidence: 0,
        topSuggestions: [],
        webEnrichmentSuccess: 0
      };
    }
  }

  /**
   * Find similar pending suggestions for merging
   */
  static async findSimilarSuggestions(
    suggestionId: string,
    similarityThreshold: number = 0.8
  ): Promise<SuggestedVendor[]> {
    try {
      // Get the base suggestion
      const { data: baseSuggestion, error: baseError } = await supabase
        .from('suggested_vendors')
        .select('*')
        .eq('id', suggestionId)
        .single();

      if (baseError || !baseSuggestion) {
        throw new Error('Base suggestion not found');
      }

      // Get all pending suggestions for the same company
      const { data: allSuggestions, error: allError } = await supabase
        .from('suggested_vendors')
        .select('*')
        .eq('company_id', baseSuggestion.company_id)
        .eq('status', 'pending')
        .neq('id', suggestionId);

      if (allError) {
        throw allError;
      }

      // Filter by similarity (this would use the same string similarity algorithm as VendorMappingService)
      const similarSuggestions = (allSuggestions || []).filter(suggestion => {
        // Simple similarity check - in production this would use the proper algorithm
        const similarity = this.calculateSimpleSimilarity(
          baseSuggestion.suggested_name,
          suggestion.suggested_name
        );
        return similarity >= similarityThreshold;
      });

      return similarSuggestions;
    } catch (error) {
      console.error('❌ Failed to find similar vendor suggestions:', error);
      return [];
    }
  }

  /**
   * Simple similarity calculation (placeholder for proper algorithm)
   */
  private static calculateSimpleSimilarity(str1: string, str2: string): number {
    const normalize = (str: string) => str.toLowerCase().trim();
    const a = normalize(str1);
    const b = normalize(str2);

    if (a === b) return 1.0;
    if (a.includes(b) || b.includes(a)) return 0.8;

    // Simple character overlap check
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }
}