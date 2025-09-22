/**
 * Vendor Mapping Service for Ingrid AI
 *
 * Intelligently maps Ingrid's suggested vendor names to existing
 * vendors with fuzzy matching, semantic understanding, and web enrichment.
 */

import { SuggestedVendorService } from './SuggestedVendorService';

export interface VendorMatch {
  vendorId: string | null;
  vendorName: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'new' | 'web_enriched';
  reason: string;
  needsApproval: boolean;
  webEnrichmentData?: WebEnrichmentResult;
}

export interface ExistingVendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
}

export interface SuggestedVendor {
  id: string;
  suggested_name: string;
  suggested_email?: string;
  suggested_phone?: string;
  suggested_website?: string;
  suggested_description?: string;
  confidence_score: number;
  usage_count: number;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  created_at: string;
  created_by: string;
  company_id: string;
}

export interface WebEnrichmentResult {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  taxId?: string;
  description?: string;
  confidence: number;
  sources: string[];
}

export interface VendorContext {
  documentType?: string;
  extractedEmail?: string;
  extractedPhone?: string;
  extractedAddress?: string;
  extractedWebsite?: string;
  amount?: number;
  description?: string;
}

export class VendorMappingService {
  private static readonly EXACT_MATCH_THRESHOLD = 0.95;
  private static readonly FUZZY_MATCH_THRESHOLD = 0.80;
  private static readonly SEMANTIC_MATCH_THRESHOLD = 0.75;
  private static readonly WEB_ENRICHMENT_CONFIDENCE_THRESHOLD = 0.70;

  /**
   * Common vendor name variations and aliases
   */
  private static readonly VENDOR_ALIASES: Record<string, string[]> = {
    'Microsoft': ['Microsoft Corporation', 'Microsoft Corp', 'MSFT', 'Microsoft Inc'],
    'Google': ['Google LLC', 'Google Inc', 'Alphabet Inc', 'Google Ireland Limited'],
    'Amazon': ['Amazon.com', 'Amazon Web Services', 'AWS', 'Amazon Inc'],
    'Apple': ['Apple Inc', 'Apple Computer', 'Apple Computer Inc'],
    'Adobe': ['Adobe Systems', 'Adobe Inc', 'Adobe Systems Incorporated'],
    'Salesforce': ['Salesforce.com', 'Salesforce Inc', 'SFDC'],
    'Oracle': ['Oracle Corporation', 'Oracle Corp', 'Oracle Systems'],
    'IBM': ['International Business Machines', 'IBM Corporation', 'IBM Corp'],
    'Cisco': ['Cisco Systems', 'Cisco Inc', 'Cisco Systems Inc'],
    'Intel': ['Intel Corporation', 'Intel Corp', 'Intel Inc']
  };

  /**
   * Map a suggested vendor name to an existing vendor ID with web enrichment
   */
  static async mapVendorToId(
    suggestedVendor: string,
    existingVendors: ExistingVendor[],
    companyId: string,
    context?: VendorContext
  ): Promise<VendorMatch> {
    console.log(`🏢 Mapping vendor: "${suggestedVendor}" against ${existingVendors.length} existing vendors`);

    // 1. Try exact match first
    const exactMatch = this.findExactMatch(suggestedVendor, existingVendors);
    if (exactMatch) {
      return {
        vendorId: exactMatch.id,
        vendorName: exactMatch.name,
        confidence: this.EXACT_MATCH_THRESHOLD,
        matchType: 'exact',
        reason: `Exact match found: "${exactMatch.name}"`,
        needsApproval: false
      };
    }

    // 2. Try fuzzy/alias matching
    const fuzzyMatch = this.findFuzzyMatch(suggestedVendor, existingVendors);
    if (fuzzyMatch && fuzzyMatch.confidence >= this.FUZZY_MATCH_THRESHOLD) {
      return {
        vendorId: fuzzyMatch.vendor.id,
        vendorName: fuzzyMatch.vendor.name,
        confidence: fuzzyMatch.confidence,
        matchType: 'fuzzy',
        reason: `Fuzzy match: "${suggestedVendor}" → "${fuzzyMatch.vendor.name}" (${Math.round(fuzzyMatch.confidence * 100)}% similarity)`,
        needsApproval: fuzzyMatch.confidence < 0.90
      };
    }

    // 3. Try semantic matching using aliases
    const semanticMatch = this.findSemanticMatch(suggestedVendor, existingVendors);
    if (semanticMatch && semanticMatch.confidence >= this.SEMANTIC_MATCH_THRESHOLD) {
      return {
        vendorId: semanticMatch.vendor.id,
        vendorName: semanticMatch.vendor.name,
        confidence: semanticMatch.confidence,
        matchType: 'semantic',
        reason: `Semantic match: "${suggestedVendor}" maps to "${semanticMatch.vendor.name}"`,
        needsApproval: true
      };
    }

    // 4. No good match found - try web enrichment and suggest new vendor
    const webEnrichment = await this.performWebEnrichment(suggestedVendor, context);
    const enhancedSuggestion = this.enhanceVendorSuggestion(suggestedVendor, context, webEnrichment);

    return {
      vendorId: null,
      vendorName: enhancedSuggestion.name,
      confidence: webEnrichment ?
        Math.max(0.7, webEnrichment.confidence) : 0.6,
      matchType: webEnrichment ? 'web_enriched' : 'new',
      reason: webEnrichment ?
        `Web-enriched vendor: "${enhancedSuggestion.name}" with ${webEnrichment.sources.length} data sources` :
        `New vendor needed: "${enhancedSuggestion.name}"`,
      needsApproval: true,
      webEnrichmentData: webEnrichment || undefined
    };
  }

  /**
   * Find exact match (case-insensitive)
   */
  private static findExactMatch(
    suggested: string,
    existing: ExistingVendor[]
  ): ExistingVendor | null {
    const normalizedSuggested = this.normalizeVendorName(suggested);

    return existing.find(vendor =>
      this.normalizeVendorName(vendor.name) === normalizedSuggested
    ) || null;
  }

  /**
   * Find fuzzy match using string similarity
   */
  private static findFuzzyMatch(
    suggested: string,
    existing: ExistingVendor[]
  ): { vendor: ExistingVendor; confidence: number } | null {
    let bestMatch: { vendor: ExistingVendor; confidence: number } | null = null;

    for (const vendor of existing) {
      const similarity = this.calculateStringSimilarity(suggested, vendor.name);

      if (similarity > (bestMatch?.confidence || 0)) {
        bestMatch = { vendor, confidence: similarity };
      }
    }

    return bestMatch && bestMatch.confidence >= this.FUZZY_MATCH_THRESHOLD
      ? bestMatch
      : null;
  }

  /**
   * Find semantic match using vendor aliases
   */
  private static findSemanticMatch(
    suggested: string,
    existing: ExistingVendor[]
  ): { vendor: ExistingVendor; confidence: number } | null {
    const normalizedSuggested = this.normalizeVendorName(suggested);

    for (const [canonicalName, aliases] of Object.entries(this.VENDOR_ALIASES)) {
      // Check if suggested matches any alias
      const matchingAlias = aliases.find(alias =>
        this.normalizeVendorName(alias) === normalizedSuggested ||
        this.calculateStringSimilarity(normalizedSuggested, alias) > 0.8
      );

      if (matchingAlias) {
        // Find if we have this vendor in existing vendors
        const existingVendor = existing.find(vendor =>
          this.normalizeVendorName(vendor.name) === this.normalizeVendorName(canonicalName) ||
          this.calculateStringSimilarity(vendor.name, canonicalName) > 0.8 ||
          aliases.some(alias => this.calculateStringSimilarity(vendor.name, alias) > 0.8)
        );

        if (existingVendor) {
          return {
            vendor: existingVendor,
            confidence: this.SEMANTIC_MATCH_THRESHOLD + 0.1
          };
        }
      }
    }

    return null;
  }

  /**
   * Perform web enrichment to find vendor details
   */
  private static async performWebEnrichment(
    vendorName: string,
    context?: VendorContext
  ): Promise<WebEnrichmentResult | null> {
    try {
      console.log(`🌐 Attempting web enrichment for vendor: "${vendorName}"`);

      // In a real implementation, this would call actual web APIs
      // For now, we'll return mock enriched data for common vendors
      const mockEnrichment = this.getMockWebEnrichment(vendorName);

      if (mockEnrichment) {
        console.log(`✅ Web enrichment successful for "${vendorName}"`);
        return mockEnrichment;
      }

      console.log(`ℹ️ No web enrichment data found for "${vendorName}"`);
      return null;
    } catch (error) {
      console.warn(`⚠️ Web enrichment failed for "${vendorName}":`, error);
      return null;
    }
  }

  /**
   * Mock web enrichment for demonstration
   * In production, this would call real APIs like Google Places, Clearbit, etc.
   */
  private static getMockWebEnrichment(vendorName: string): WebEnrichmentResult | null {
    const normalized = this.normalizeVendorName(vendorName);

    const mockData: Record<string, WebEnrichmentResult> = {
      'microsoft': {
        name: 'Microsoft Corporation',
        email: 'info@microsoft.com',
        phone: '+1-425-882-8080',
        website: 'https://www.microsoft.com',
        address: {
          line1: 'One Microsoft Way',
          city: 'Redmond',
          state: 'WA',
          country: 'United States',
          postalCode: '98052'
        },
        taxId: '91-1144442',
        description: 'Multinational technology corporation that produces computer software, consumer electronics, personal computers, and related services.',
        confidence: 0.95,
        sources: ['microsoft.com', 'sec.gov', 'linkedin.com']
      },
      'google': {
        name: 'Google LLC',
        email: 'support@google.com',
        website: 'https://www.google.com',
        address: {
          line1: '1600 Amphitheatre Parkway',
          city: 'Mountain View',
          state: 'CA',
          country: 'United States',
          postalCode: '94043'
        },
        description: 'American multinational technology company that specializes in Internet-related services and products.',
        confidence: 0.93,
        sources: ['google.com', 'alphabet.com', 'sec.gov']
      },
      'amazon': {
        name: 'Amazon.com, Inc.',
        website: 'https://www.amazon.com',
        address: {
          line1: '410 Terry Avenue North',
          city: 'Seattle',
          state: 'WA',
          country: 'United States',
          postalCode: '98109'
        },
        description: 'American multinational technology company which focuses on e-commerce, cloud computing, digital streaming, and artificial intelligence.',
        confidence: 0.91,
        sources: ['amazon.com', 'sec.gov', 'aboutamazon.com']
      }
    };

    return mockData[normalized] || null;
  }

  /**
   * Enhance vendor suggestion with better naming and context
   */
  private static enhanceVendorSuggestion(
    suggested: string,
    context?: VendorContext,
    webEnrichment?: WebEnrichmentResult | null
  ): { name: string; description?: string } {
    // Use web-enriched name if available, otherwise clean up suggested name
    let enhancedName = webEnrichment?.name || this.cleanVendorName(suggested);

    let description = webEnrichment?.description || '';

    // Add context-based enhancements if no web enrichment
    if (!webEnrichment && context) {
      if (context.extractedEmail) {
        description += `Contact: ${context.extractedEmail}`;
      }
      if (context.extractedWebsite) {
        description += description ? '. ' : '';
        description += `Website: ${context.extractedWebsite}`;
      }
      if (context.description) {
        description += description ? '. ' : '';
        description += `Context: ${context.description.substring(0, 100)}`;
      }
    }

    return {
      name: enhancedName,
      description: description || undefined
    };
  }

  /**
   * Clean and standardize vendor names
   */
  private static cleanVendorName(name: string): string {
    return name
      .replace(/\b(LLC|Inc|Corp|Corporation|Limited|Ltd|Co)\b\.?/gi, '')
      .replace(/[^\w\s&-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const a = this.normalizeVendorName(str1);
    const b = this.normalizeVendorName(str2);

    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Normalize vendor name for comparison
   */
  private static normalizeVendorName(name: string): string {
    return name.toLowerCase()
      .trim()
      .replace(/[&]/g, 'and')
      .replace(/\b(llc|inc|corp|corporation|limited|ltd|co)\b\.?/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Store suggested vendor for approval
   */
  static async storeSuggestedVendor(
    suggestion: {
      name: string;
      email?: string;
      phone?: string;
      website?: string;
      address?: any;
      description?: string;
      confidence: number;
      webEnrichmentData?: WebEnrichmentResult;
      context?: any;
    },
    companyId: string,
    userId: string
  ): Promise<string> {
    try {
      const suggestionId = await SuggestedVendorService.storeSuggestion(
        companyId,
        suggestion.name,
        suggestion.confidence,
        {
          email: suggestion.email,
          phone: suggestion.phone,
          website: suggestion.website,
          address_line1: suggestion.address?.line1,
          address_line2: suggestion.address?.line2,
          city: suggestion.address?.city,
          state: suggestion.address?.state,
          country: suggestion.address?.country,
          postal_code: suggestion.address?.postalCode,
          description: suggestion.description,
          reasoning: suggestion.context?.reasoning,
          document_name: suggestion.context?.document_name,
          match_type: suggestion.context?.match_type || 'new'
        },
        suggestion.webEnrichmentData ? {
          name: suggestion.webEnrichmentData.name,
          email: suggestion.webEnrichmentData.email,
          phone: suggestion.webEnrichmentData.phone,
          website: suggestion.webEnrichmentData.website,
          address: suggestion.webEnrichmentData.address,
          description: suggestion.webEnrichmentData.description,
          confidence: suggestion.webEnrichmentData.confidence,
          sources: suggestion.webEnrichmentData.sources
        } : undefined
      );

      console.log(`💼 Stored vendor suggestion: "${suggestion.name}" for approval (ID: ${suggestionId})`);
      return suggestionId;
    } catch (error) {
      console.error('❌ Failed to store vendor suggestion:', error);
      // Return a fallback ID so processing can continue
      return `fallback_${Date.now()}`;
    }
  }

  /**
   * Get all pending vendor suggestions for a company
   */
  static async getPendingSuggestions(companyId: string): Promise<SuggestedVendor[]> {
    return await SuggestedVendorService.getPendingSuggestions(companyId);
  }

  /**
   * Approve a suggested vendor and create it
   */
  static async approveSuggestion(
    suggestionId: string,
    reviewerId: string,
    approvedData?: {
      name?: string;
      email?: string;
      phone?: string;
      website?: string;
      address?: any;
      description?: string;
    },
    reviewNotes?: string
  ): Promise<string> {
    const result = await SuggestedVendorService.approveSuggestion(
      suggestionId,
      reviewerId,
      approvedData?.name,
      approvedData?.email,
      approvedData?.phone,
      approvedData?.address?.line1,
      approvedData?.address?.line2,
      approvedData?.address?.city,
      approvedData?.address?.state,
      approvedData?.address?.country,
      approvedData?.address?.postalCode,
      approvedData?.website,
      undefined, // tax_id
      approvedData?.description,
      reviewNotes
    );

    if (result.success) {
      return result.vendorId;
    } else {
      throw new Error(result.error || 'Failed to approve vendor suggestion');
    }
  }
}