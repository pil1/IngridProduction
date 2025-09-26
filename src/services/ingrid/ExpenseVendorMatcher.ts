/**
 * Expense-Vendor Matching Service
 *
 * Handles intelligent matching of expense data to existing vendors with
 * permission-aware display logic for different user roles.
 */

import { VendorMappingService, VendorMatch, ExistingVendor } from './VendorMappingService';
import { supabase } from '@/integrations/supabase/client';

export interface ExpenseVendorContext {
  vendorName: string;
  extractedEmail?: string;
  extractedPhone?: string;
  extractedWebsite?: string;
  documentText?: string;
  companyId: string;
  userId: string;
  userRole: string;
  hasVendorPermissions: boolean;
}

export interface ExpenseVendorResult {
  match: VendorMatch | null;
  displayData: VendorDisplayData;
  suggestedActions: VendorAction[];
  needsVendorCreation: boolean;
}

export interface VendorDisplayData {
  displayName: string;
  showMatchStatus: boolean;
  showVendorDetails: boolean;
  matchStatusText?: string;
  matchStatusType?: 'exact' | 'fuzzy' | 'new' | 'suggestion';
  vendorId?: string;
  canEditVendor?: boolean;
  canCreateVendor?: boolean;
}

export interface VendorAction {
  type: 'create_vendor' | 'edit_vendor' | 'approve_match' | 'suggest_vendor';
  label: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  requiresPermission: boolean;
}

export class ExpenseVendorMatcher {
  private vendorMapping: VendorMappingService;

  constructor() {
    this.vendorMapping = new VendorMappingService();
  }

  /**
   * Match expense vendor data with existing vendors and return permission-aware results
   */
  async matchExpenseVendor(context: ExpenseVendorContext): Promise<ExpenseVendorResult> {
    const { vendorName, companyId, hasVendorPermissions, userRole } = context;

    // Get existing vendors for the company
    const existingVendors = await this.getCompanyVendors(companyId);

    // Perform vendor matching
    const match = await this.vendorMapping.mapVendorToExisting(
      vendorName,
      existingVendors,
      {
        includeWebEnrichment: true,
        confidenceThreshold: 0.7,
        maxSuggestions: 1
      }
    );

    // Generate permission-aware display data
    const displayData = this.generateDisplayData(match, context);

    // Generate suggested actions based on match and permissions
    const suggestedActions = this.generateSuggestedActions(match, context);

    // Determine if vendor creation is needed
    const needsVendorCreation = !match || match.confidence < 0.8;

    return {
      match,
      displayData,
      suggestedActions,
      needsVendorCreation
    };
  }

  /**
   * Generate permission-aware display data
   */
  private generateDisplayData(match: VendorMatch | null, context: ExpenseVendorContext): VendorDisplayData {
    const { hasVendorPermissions, userRole, vendorName } = context;

    if (!match || match.matchType === 'new') {
      // No match found - new vendor
      return {
        displayName: vendorName,
        showMatchStatus: hasVendorPermissions,
        showVendorDetails: false,
        matchStatusText: hasVendorPermissions ? 'New vendor detected' : undefined,
        matchStatusType: 'new',
        canEditVendor: false,
        canCreateVendor: hasVendorPermissions
      };
    }

    // Match found
    const baseData: VendorDisplayData = {
      displayName: match.vendorName,
      showMatchStatus: hasVendorPermissions,
      showVendorDetails: hasVendorPermissions,
      vendorId: match.vendorId || undefined,
      canEditVendor: hasVendorPermissions && !!match.vendorId,
      canCreateVendor: hasVendorPermissions
    };

    if (hasVendorPermissions) {
      // User can see vendor matching details
      switch (match.matchType) {
        case 'exact':
          baseData.matchStatusText = 'Exact match found';
          baseData.matchStatusType = 'exact';
          break;
        case 'fuzzy':
          baseData.matchStatusText = `Fuzzy match (${Math.round(match.confidence * 100)}% confidence)`;
          baseData.matchStatusType = 'fuzzy';
          break;
        case 'semantic':
          baseData.matchStatusText = `Semantic match (${Math.round(match.confidence * 100)}% confidence)`;
          baseData.matchStatusType = 'fuzzy';
          break;
        case 'web_enriched':
          baseData.matchStatusText = 'AI-enhanced match';
          baseData.matchStatusType = 'suggestion';
          break;
        default:
          baseData.matchStatusText = 'Vendor match found';
          baseData.matchStatusType = 'fuzzy';
      }
    }

    return baseData;
  }

  /**
   * Generate suggested actions based on match quality and user permissions
   */
  private generateSuggestedActions(match: VendorMatch | null, context: ExpenseVendorContext): VendorAction[] {
    const { hasVendorPermissions, userRole } = context;
    const actions: VendorAction[] = [];

    if (!hasVendorPermissions) {
      // Users without vendor permissions get no actions
      return actions;
    }

    if (!match || match.matchType === 'new') {
      // No match - suggest creating vendor
      actions.push({
        type: 'create_vendor',
        label: 'Create Vendor',
        description: 'Create a new vendor record with AI enhancement',
        priority: 'high',
        requiresPermission: true
      });
    } else {
      // Match found
      if (match.vendorId) {
        actions.push({
          type: 'edit_vendor',
          label: 'Edit Vendor',
          description: 'Update vendor details',
          priority: 'medium',
          requiresPermission: true
        });
      }

      if (match.needsApproval || match.confidence < 0.9) {
        actions.push({
          type: 'approve_match',
          label: match.confidence < 0.8 ? 'Verify Match' : 'Approve Match',
          description: `Confirm this vendor match (${Math.round(match.confidence * 100)}% confidence)`,
          priority: match.confidence < 0.8 ? 'high' : 'medium',
          requiresPermission: true
        });
      }

      // If confidence is low, also suggest creating a new vendor
      if (match.confidence < 0.6) {
        actions.push({
          type: 'create_vendor',
          label: 'Create New Instead',
          description: 'Create a new vendor instead of using the match',
          priority: 'medium',
          requiresPermission: true
        });
      }
    }

    return actions;
  }

  /**
   * Get vendors for a specific company
   */
  private async getCompanyVendors(companyId: string): Promise<ExistingVendor[]> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, email, phone, website')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (error) throw error;

      return data?.map(vendor => ({
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        website: vendor.website
      })) || [];
    } catch (error) {
      console.error('Error fetching company vendors:', error);
      return [];
    }
  }

  /**
   * Process expense vendor matching for display in expense forms
   */
  async processExpenseVendor(
    vendorName: string,
    companyId: string,
    userId: string,
    userRole: string,
    hasVendorPermissions: boolean,
    additionalContext?: {
      email?: string;
      phone?: string;
      website?: string;
      documentText?: string;
    }
  ): Promise<ExpenseVendorResult> {
    const context: ExpenseVendorContext = {
      vendorName,
      extractedEmail: additionalContext?.email,
      extractedPhone: additionalContext?.phone,
      extractedWebsite: additionalContext?.website,
      documentText: additionalContext?.documentText,
      companyId,
      userId,
      userRole,
      hasVendorPermissions
    };

    return this.matchExpenseVendor(context);
  }

  /**
   * Suggest creating a vendor from expense data
   */
  async suggestVendorCreation(
    vendorName: string,
    companyId: string,
    extractedData?: {
      email?: string;
      phone?: string;
      website?: string;
      address?: string;
    }
  ): Promise<{
    suggestedName: string;
    prefillData: Record<string, any>;
    confidence: number;
  }> {
    // Use web enrichment to enhance vendor data
    const webEnrichment = await this.vendorMapping.enrichVendorData(vendorName);

    const prefillData: Record<string, any> = {
      name: vendorName,
      email: extractedData?.email || webEnrichment?.email || '',
      phone: extractedData?.phone || webEnrichment?.phone || '',
      website: extractedData?.website || webEnrichment?.website || '',
    };

    // Add address data if available
    if (webEnrichment?.address) {
      prefillData.address_line_1 = webEnrichment.address.line1 || '';
      prefillData.city = webEnrichment.address.city || '';
      prefillData.state_province = webEnrichment.address.state || '';
      prefillData.postal_code = webEnrichment.address.postalCode || '';
      prefillData.country = webEnrichment.address.country || 'US';
    }

    return {
      suggestedName: vendorName,
      prefillData,
      confidence: webEnrichment?.confidence || 0.5
    };
  }
}

// Export singleton instance
export const expenseVendorMatcher = new ExpenseVendorMatcher();