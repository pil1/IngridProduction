/**
 * Smart Categorization Service
 *
 * Provides intelligent categorization of expenses and GL account suggestions
 * based on vendor patterns, amounts, descriptions, and historical data.
 */

import { IngridConfig } from '@/types/ingrid';
import { CategoryMappingService, type CategoryMatch, type ExistingCategory } from './CategoryMappingService';

export interface CategorySuggestion {
  category: string;
  confidence: number;
  reason: string;
  subcategory?: string;
}

export interface GLAccountSuggestion {
  accountCode: string;
  accountName: string;
  confidence: number;
  reason: string;
  department?: string;
}

export interface CategorizationResult {
  categories: CategorySuggestion[];
  glAccounts: GLAccountSuggestion[];
  tags: string[];
  recommendations: string[];
}

export class SmartCategorizationService {
  private config: IngridConfig;

  // Common expense categories with patterns
  private categoryPatterns = [
    {
      category: 'Office Supplies',
      subcategory: 'Stationery',
      patterns: ['staples', 'office depot', 'amazon', 'paper', 'pen', 'ink'],
      glAccount: '6010',
      glName: 'Office Supplies'
    },
    {
      category: 'Travel & Entertainment',
      subcategory: 'Meals',
      patterns: ['restaurant', 'food', 'starbucks', 'subway', 'mcdonald', 'cafe'],
      glAccount: '6020',
      glName: 'Meals & Entertainment'
    },
    {
      category: 'Travel & Entertainment',
      subcategory: 'Transportation',
      patterns: ['uber', 'lyft', 'taxi', 'airline', 'hotel', 'rental car', 'gas', 'shell', 'exxon'],
      glAccount: '6025',
      glName: 'Travel Expenses'
    },
    {
      category: 'Technology',
      subcategory: 'Software',
      patterns: ['microsoft', 'adobe', 'google', 'saas', 'software', 'subscription'],
      glAccount: '6030',
      glName: 'Software & Technology'
    },
    {
      category: 'Technology',
      subcategory: 'Hardware',
      patterns: ['computer', 'laptop', 'monitor', 'keyboard', 'mouse', 'electronics'],
      glAccount: '6035',
      glName: 'Computer Equipment'
    },
    {
      category: 'Professional Services',
      subcategory: 'Consulting',
      patterns: ['consulting', 'advisor', 'legal', 'accounting', 'professional'],
      glAccount: '6040',
      glName: 'Professional Services'
    },
    {
      category: 'Marketing & Advertising',
      subcategory: 'Digital Marketing',
      patterns: ['facebook', 'google ads', 'linkedin', 'marketing', 'advertising'],
      glAccount: '6050',
      glName: 'Marketing & Advertising'
    },
    {
      category: 'Utilities',
      subcategory: 'Communications',
      patterns: ['phone', 'internet', 'cellular', 'verizon', 'att', 'comcast'],
      glAccount: '6060',
      glName: 'Communications'
    },
    {
      category: 'Utilities',
      subcategory: 'Power',
      patterns: ['electric', 'power', 'utility', 'gas company', 'energy'],
      glAccount: '6065',
      glName: 'Utilities'
    },
    {
      category: 'Maintenance & Repairs',
      subcategory: 'Facility',
      patterns: ['repair', 'maintenance', 'cleaning', 'janitor', 'facility'],
      glAccount: '6070',
      glName: 'Repairs & Maintenance'
    }
  ];

  constructor(config: IngridConfig) {
    this.config = config;
  }

  /**
   * Analyze expense data and provide smart categorization suggestions
   */
  async categorizeExpense(expenseData: Record<string, any>): Promise<CategorizationResult> {
    try {
      console.log('🎯 Performing smart categorization');

      const vendorName = expenseData.vendor_name || '';
      const description = expenseData.description || '';
      const amount = expenseData.amount || 0;

      // Get category suggestions based on patterns
      const categories = this.suggestCategories(vendorName, description, amount);

      // Get GL account suggestions
      const glAccounts = this.suggestGLAccounts(vendorName, description, amount, categories);

      // Generate relevant tags
      const tags = this.generateTags(vendorName, description, categories);

      // Generate actionable recommendations
      const recommendations = this.generateRecommendations(expenseData, categories, glAccounts);

      console.log(`✅ Generated ${categories.length} category suggestions, ${glAccounts.length} GL suggestions`);

      return {
        categories,
        glAccounts,
        tags,
        recommendations
      };

    } catch (error) {
      console.error('🚨 Smart categorization failed:', error);
      return this.getFallbackCategorization(expenseData);
    }
  }

  /**
   * Suggest expense categories based on vendor and description patterns
   */
  private suggestCategories(vendorName: string, description: string, amount: number): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];
    const searchText = `${vendorName} ${description}`.toLowerCase();

    // Pattern-based matching
    for (const pattern of this.categoryPatterns) {
      for (const keyword of pattern.patterns) {
        if (searchText.includes(keyword)) {
          const confidence = this.calculatePatternConfidence(keyword, searchText, amount);

          suggestions.push({
            category: pattern.category,
            subcategory: pattern.subcategory,
            confidence,
            reason: `Matched keyword "${keyword}" in vendor/description`
          });
          break; // Only match once per pattern
        }
      }
    }

    // Amount-based heuristics
    suggestions.push(...this.getAmountBasedSuggestions(amount));

    // Remove duplicates and sort by confidence
    const uniqueSuggestions = this.deduplicateCategories(suggestions);
    return uniqueSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Top 3 suggestions
  }

  /**
   * Suggest GL accounts based on categorization
   */
  private suggestGLAccounts(
    vendorName: string,
    description: string,
    amount: number,
    categories: CategorySuggestion[]
  ): GLAccountSuggestion[] {
    const suggestions: GLAccountSuggestion[] = [];
    const searchText = `${vendorName} ${description}`.toLowerCase();

    // Direct pattern matching for GL accounts
    for (const pattern of this.categoryPatterns) {
      for (const keyword of pattern.patterns) {
        if (searchText.includes(keyword)) {
          suggestions.push({
            accountCode: pattern.glAccount,
            accountName: pattern.glName,
            confidence: this.calculatePatternConfidence(keyword, searchText, amount),
            reason: `Based on vendor pattern match for "${keyword}"`
          });
          break;
        }
      }
    }

    // Category-based GL suggestions
    for (const category of categories) {
      const glSuggestion = this.getGLAccountForCategory(category);
      if (glSuggestion) {
        suggestions.push(glSuggestion);
      }
    }

    // Default suggestions based on amount
    if (suggestions.length === 0) {
      suggestions.push(...this.getDefaultGLSuggestions(amount));
    }

    // Remove duplicates and sort
    const uniqueSuggestions = this.deduplicateGLAccounts(suggestions);
    return uniqueSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Generate relevant tags for the expense
   */
  private generateTags(vendorName: string, description: string, categories: CategorySuggestion[]): string[] {
    const tags: string[] = [];

    // Add primary category as tag
    if (categories.length > 0) {
      tags.push(categories[0].category.toLowerCase().replace(/\s+/g, '-'));
    }

    // Add vendor-based tags
    if (vendorName) {
      const vendorTag = vendorName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (vendorTag.length > 2) {
        tags.push(vendorTag);
      }
    }

    // Add contextual tags
    const searchText = `${vendorName} ${description}`.toLowerCase();

    if (searchText.includes('recurring') || searchText.includes('monthly')) {
      tags.push('recurring');
    }

    if (searchText.includes('urgent') || searchText.includes('emergency')) {
      tags.push('urgent');
    }

    if (searchText.includes('project') || searchText.includes('client')) {
      tags.push('project-related');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    expenseData: Record<string, any>,
    categories: CategorySuggestion[],
    glAccounts: GLAccountSuggestion[]
  ): string[] {
    const recommendations: string[] = [];

    // High confidence categorization
    if (categories.length > 0 && categories[0].confidence > 0.8) {
      recommendations.push(`High confidence categorization: ${categories[0].category}`);
    }

    // Amount-based recommendations
    const amount = expenseData.amount || 0;
    if (amount > 1000) {
      recommendations.push('Large expense - consider requiring additional approval');
    }

    if (amount < 25) {
      recommendations.push('Small expense - consider petty cash category');
    }

    // Missing information recommendations
    if (!expenseData.receipt_image) {
      recommendations.push('Consider requesting receipt image for documentation');
    }

    if (!expenseData.business_purpose) {
      recommendations.push('Add business purpose for better expense tracking');
    }

    // Vendor-based recommendations
    if (expenseData.vendor_name) {
      const vendorLower = expenseData.vendor_name.toLowerCase();
      if (vendorLower.includes('amazon') || vendorLower.includes('online')) {
        recommendations.push('Online purchase - verify business purpose and itemize if possible');
      }
    }

    return recommendations;
  }

  /**
   * Calculate confidence for pattern matches
   */
  private calculatePatternConfidence(keyword: string, searchText: string, amount: number): number {
    let confidence = 0.7; // Base confidence

    // Exact match gets higher confidence
    if (searchText.includes(keyword)) {
      confidence += 0.2;
    }

    // Keyword at beginning of vendor name gets bonus
    if (searchText.startsWith(keyword)) {
      confidence += 0.1;
    }

    // Amount-based adjustments
    if (amount > 0 && amount < 1000) {
      confidence += 0.05; // Typical business expense range
    }

    return Math.min(confidence, 0.99); // Cap at 99%
  }

  /**
   * Get amount-based category suggestions
   */
  private getAmountBasedSuggestions(amount: number): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];

    if (amount < 25) {
      suggestions.push({
        category: 'Petty Cash',
        confidence: 0.6,
        reason: 'Small amount suggests petty cash expense'
      });
    }

    if (amount > 500 && amount < 2000) {
      suggestions.push({
        category: 'Equipment',
        confidence: 0.5,
        reason: 'Amount range typical for equipment purchases'
      });
    }

    if (amount > 100 && amount < 500) {
      suggestions.push({
        category: 'Professional Services',
        confidence: 0.4,
        reason: 'Amount range typical for professional services'
      });
    }

    return suggestions;
  }

  /**
   * Get GL account suggestion for a category
   */
  private getGLAccountForCategory(category: CategorySuggestion): GLAccountSuggestion | null {
    const pattern = this.categoryPatterns.find(p => p.category === category.category);

    if (pattern) {
      return {
        accountCode: pattern.glAccount,
        accountName: pattern.glName,
        confidence: category.confidence * 0.9, // Slightly lower than category confidence
        reason: `Based on category match: ${category.category}`
      };
    }

    return null;
  }

  /**
   * Get default GL account suggestions when no patterns match
   */
  private getDefaultGLSuggestions(amount: number): GLAccountSuggestion[] {
    const suggestions: GLAccountSuggestion[] = [];

    // Default business expense
    suggestions.push({
      accountCode: '6000',
      accountName: 'General Business Expenses',
      confidence: 0.5,
      reason: 'Default category for unclassified business expenses'
    });

    // Amount-based defaults
    if (amount < 100) {
      suggestions.push({
        accountCode: '6005',
        accountName: 'Miscellaneous Expenses',
        confidence: 0.4,
        reason: 'Small amount suggests miscellaneous expense'
      });
    }

    return suggestions;
  }

  /**
   * Remove duplicate category suggestions
   */
  private deduplicateCategories(suggestions: CategorySuggestion[]): CategorySuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.category}-${suggestion.subcategory || ''}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Remove duplicate GL account suggestions
   */
  private deduplicateGLAccounts(suggestions: GLAccountSuggestion[]): GLAccountSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      if (seen.has(suggestion.accountCode)) {
        return false;
      }
      seen.add(suggestion.accountCode);
      return true;
    });
  }

  /**
   * Fallback categorization when main logic fails
   */
  private getFallbackCategorization(expenseData: Record<string, any>): CategorizationResult {
    return {
      categories: [{
        category: 'Business Expense',
        confidence: 0.5,
        reason: 'Default categorization'
      }],
      glAccounts: [{
        accountCode: '6000',
        accountName: 'General Business Expenses',
        confidence: 0.5,
        reason: 'Default GL account'
      }],
      tags: ['business-expense'],
      recommendations: ['Manual review recommended for proper categorization']
    };
  }

  /**
   * Enhanced categorization with intelligent category mapping
   */
  async categorizeExpenseWithMapping(
    expenseData: Record<string, any>,
    existingCategories: ExistingCategory[],
    companyId: string
  ): Promise<CategorizationResult & { categoryMatch: CategoryMatch }> {
    // Get initial categorization
    const baseResult = await this.categorizeExpense(expenseData);

    if (baseResult.categories.length === 0) {
      // Fallback if no categories suggested
      const fallbackMatch: CategoryMatch = {
        categoryId: null,
        categoryName: 'Business Expense',
        confidence: 0.5,
        matchType: 'new',
        reason: 'No specific category patterns matched',
        needsApproval: true
      };

      return {
        ...baseResult,
        categoryMatch: fallbackMatch
      };
    }

    // Map the top suggested category to existing categories
    const topSuggestion = baseResult.categories[0];
    const categoryMatch = await CategoryMappingService.mapCategoryToId(
      topSuggestion.category,
      existingCategories,
      companyId,
      {
        vendorName: expenseData.vendor_name,
        description: expenseData.description,
        amount: expenseData.amount
      }
    );

    // Update recommendations based on mapping
    const enhancedRecommendations = [...baseResult.recommendations];

    if (categoryMatch.matchType === 'exact') {
      enhancedRecommendations.push(`Perfect category match found: "${categoryMatch.categoryName}"`);
    } else if (categoryMatch.matchType === 'fuzzy') {
      enhancedRecommendations.push(`Similar category found: "${categoryMatch.categoryName}" (${Math.round(categoryMatch.confidence * 100)}% match)`);
    } else if (categoryMatch.matchType === 'semantic') {
      enhancedRecommendations.push(`Related category found: "${categoryMatch.categoryName}"`);
    } else if (categoryMatch.matchType === 'new') {
      enhancedRecommendations.push(`New category suggested: "${categoryMatch.categoryName}" - requires approval`);
    }

    return {
      ...baseResult,
      recommendations: enhancedRecommendations,
      categoryMatch
    };
  }
}