/**
 * Category Mapping Service for Ingrid AI
 *
 * Intelligently maps Ingrid's suggested category names to existing
 * expense category IDs with fuzzy matching and semantic understanding.
 */

import { SuggestedCategoryService } from './SuggestedCategoryService';

export interface CategoryMatch {
  categoryId: string | null;
  categoryName: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'new';
  reason: string;
  needsApproval: boolean;
}

export interface ExistingCategory {
  id: string;
  name: string;
  description?: string | null;
}

export interface SuggestedCategory {
  id: string;
  suggested_name: string;
  suggested_description?: string;
  confidence: number;
  expense_count: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  created_by: string;
  company_id: string;
}

export class CategoryMappingService {
  private static readonly EXACT_MATCH_THRESHOLD = 0.95;
  private static readonly FUZZY_MATCH_THRESHOLD = 0.80;
  private static readonly SEMANTIC_MATCH_THRESHOLD = 0.75;

  /**
   * Common category synonyms and mappings
   */
  private static readonly CATEGORY_SYNONYMS: Record<string, string[]> = {
    'Technology': [
      'tech', 'software', 'hardware', 'computer', 'digital', 'it services',
      'information technology', 'software subscription', 'saas', 'cloud services'
    ],
    'Travel & Entertainment': [
      'travel', 'entertainment', 'meals', 'dining', 'restaurant', 'hotel',
      'transportation', 'flights', 'business meals', 'client entertainment'
    ],
    'Office Supplies': [
      'office', 'supplies', 'stationery', 'paper', 'pens', 'equipment',
      'office equipment', 'furniture', 'desk supplies'
    ],
    'Professional Services': [
      'consulting', 'legal', 'accounting', 'professional', 'advisory',
      'expert services', 'contractor', 'freelancer'
    ],
    'Marketing & Advertising': [
      'marketing', 'advertising', 'promotion', 'branding', 'social media',
      'digital marketing', 'print advertising', 'online ads'
    ],
    'Utilities': [
      'utilities', 'electricity', 'gas', 'water', 'internet', 'phone',
      'telecommunications', 'cellular', 'wifi'
    ],
    'Maintenance & Repairs': [
      'maintenance', 'repairs', 'facility', 'building', 'cleaning',
      'janitorial', 'upkeep', 'service'
    ],
    'Business Insurance': [
      'insurance', 'liability', 'coverage', 'premium', 'policy'
    ],
    'Training & Education': [
      'training', 'education', 'course', 'certification', 'workshop',
      'conference', 'seminar', 'learning'
    ]
  };

  /**
   * Map a suggested category name to an existing category ID
   */
  static async mapCategoryToId(
    suggestedCategory: string,
    existingCategories: ExistingCategory[],
    companyId: string,
    context?: {
      vendorName?: string;
      description?: string;
      amount?: number;
    }
  ): Promise<CategoryMatch> {
    console.log(`🎯 Mapping category: "${suggestedCategory}" against ${existingCategories.length} existing categories`);

    // 1. Try exact match first
    const exactMatch = this.findExactMatch(suggestedCategory, existingCategories);
    if (exactMatch) {
      return {
        categoryId: exactMatch.id,
        categoryName: exactMatch.name,
        confidence: this.EXACT_MATCH_THRESHOLD,
        matchType: 'exact',
        reason: `Exact match found: "${exactMatch.name}"`,
        needsApproval: false
      };
    }

    // 2. Try fuzzy/synonym matching
    const fuzzyMatch = this.findFuzzyMatch(suggestedCategory, existingCategories);
    if (fuzzyMatch && fuzzyMatch.confidence >= this.FUZZY_MATCH_THRESHOLD) {
      return {
        categoryId: fuzzyMatch.category.id,
        categoryName: fuzzyMatch.category.name,
        confidence: fuzzyMatch.confidence,
        matchType: 'fuzzy',
        reason: `Fuzzy match: "${suggestedCategory}" → "${fuzzyMatch.category.name}" (${Math.round(fuzzyMatch.confidence * 100)}% similarity)`,
        needsApproval: fuzzyMatch.confidence < 0.90
      };
    }

    // 3. Try semantic matching using synonyms
    const semanticMatch = this.findSemanticMatch(suggestedCategory, existingCategories);
    if (semanticMatch && semanticMatch.confidence >= this.SEMANTIC_MATCH_THRESHOLD) {
      return {
        categoryId: semanticMatch.category.id,
        categoryName: semanticMatch.category.name,
        confidence: semanticMatch.confidence,
        matchType: 'semantic',
        reason: `Semantic match: "${suggestedCategory}" maps to "${semanticMatch.category.name}"`,
        needsApproval: true
      };
    }

    // 4. No good match found - suggest new category
    const enhancedSuggestion = this.enhanceCategorySuggestion(suggestedCategory, context);
    return {
      categoryId: null,
      categoryName: enhancedSuggestion.name,
      confidence: 0.7,
      matchType: 'new',
      reason: `New category needed: "${enhancedSuggestion.name}"${enhancedSuggestion.description ? ` - ${enhancedSuggestion.description}` : ''}`,
      needsApproval: true
    };
  }

  /**
   * Find exact match (case-insensitive)
   */
  private static findExactMatch(
    suggested: string,
    existing: ExistingCategory[]
  ): ExistingCategory | null {
    const normalizedSuggested = this.normalizeString(suggested);

    return existing.find(cat =>
      this.normalizeString(cat.name) === normalizedSuggested
    ) || null;
  }

  /**
   * Find fuzzy match using string similarity
   */
  private static findFuzzyMatch(
    suggested: string,
    existing: ExistingCategory[]
  ): { category: ExistingCategory; confidence: number } | null {
    let bestMatch: { category: ExistingCategory; confidence: number } | null = null;

    for (const category of existing) {
      const similarity = this.calculateStringSimilarity(suggested, category.name);

      if (similarity > (bestMatch?.confidence || 0)) {
        bestMatch = { category, confidence: similarity };
      }
    }

    return bestMatch && bestMatch.confidence >= this.FUZZY_MATCH_THRESHOLD
      ? bestMatch
      : null;
  }

  /**
   * Find semantic match using synonym mappings
   */
  private static findSemanticMatch(
    suggested: string,
    existing: ExistingCategory[]
  ): { category: ExistingCategory; confidence: number } | null {
    const normalizedSuggested = this.normalizeString(suggested);

    for (const [categoryName, synonyms] of Object.entries(this.CATEGORY_SYNONYMS)) {
      // Check if suggested matches any synonym
      const matchingSynonym = synonyms.find(synonym =>
        this.normalizeString(synonym) === normalizedSuggested ||
        this.calculateStringSimilarity(normalizedSuggested, synonym) > 0.8
      );

      if (matchingSynonym) {
        // Find if we have this category in existing categories
        const existingCategory = existing.find(cat =>
          this.normalizeString(cat.name) === this.normalizeString(categoryName) ||
          this.calculateStringSimilarity(cat.name, categoryName) > 0.8
        );

        if (existingCategory) {
          return {
            category: existingCategory,
            confidence: this.SEMANTIC_MATCH_THRESHOLD + 0.1
          };
        }
      }
    }

    return null;
  }

  /**
   * Enhance category suggestion with better naming and description
   */
  private static enhanceCategorySuggestion(
    suggested: string,
    context?: {
      vendorName?: string;
      description?: string;
      amount?: number;
    }
  ): { name: string; description?: string } {
    // Capitalize properly
    let enhancedName = suggested
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Add context-based enhancements
    let description = '';

    if (context?.vendorName) {
      description += `Suggested based on vendor: ${context.vendorName}`;
    }

    if (context?.description) {
      description += description ? '. ' : '';
      description += `Context: ${context.description.substring(0, 100)}`;
    }

    return {
      name: enhancedName,
      description: description || undefined
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const a = this.normalizeString(str1);
    const b = this.normalizeString(str2);

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
   * Normalize string for comparison
   */
  private static normalizeString(str: string): string {
    return str.toLowerCase()
      .trim()
      .replace(/[&]/g, 'and')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Store suggested category for approval
   */
  static async storeSuggestedCategory(
    suggestion: {
      name: string;
      description?: string;
      confidence: number;
      context?: any;
    },
    companyId: string,
    userId: string
  ): Promise<string> {
    try {
      const suggestionId = await SuggestedCategoryService.storeSuggestion(
        companyId,
        suggestion.name,
        suggestion.confidence,
        {
          description: suggestion.description,
          reasoning: suggestion.context?.reasoning,
          document_name: suggestion.context?.document_name,
          vendor_name: suggestion.context?.vendor_name,
          amount: suggestion.context?.amount
        }
      );

      console.log(`💡 Stored category suggestion: "${suggestion.name}" for approval (ID: ${suggestionId})`);
      return suggestionId;
    } catch (error) {
      console.error('❌ Failed to store category suggestion:', error);
      // Return a fallback ID so processing can continue
      return `fallback_${Date.now()}`;
    }
  }

  /**
   * Get all pending category suggestions for a company
   */
  static async getPendingSuggestions(companyId: string): Promise<SuggestedCategory[]> {
    return await SuggestedCategoryService.getPendingSuggestions(companyId);
  }

  /**
   * Approve a suggested category and create it
   */
  static async approveSuggestion(
    suggestionId: string,
    reviewerId: string,
    approvedName?: string,
    description?: string,
    glAccountId?: string
  ): Promise<string> {
    const result = await SuggestedCategoryService.approveSuggestion(
      suggestionId,
      reviewerId,
      approvedName,
      description,
      glAccountId
    );

    if (result.success) {
      return result.categoryId;
    } else {
      throw new Error(result.error || 'Failed to approve suggestion');
    }
  }
}