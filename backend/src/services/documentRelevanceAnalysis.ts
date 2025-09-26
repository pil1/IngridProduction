/**
 * Document Relevance Analysis Service
 *
 * Provides sophisticated relevance analysis for uploaded documents to detect
 * inappropriate or irrelevant uploads (e.g., personal photos instead of business documents).
 * Uses context-aware analysis based on upload destination and business rules.
 */

import { DocumentContentAnalysis } from './documentContentAnalysis';

export enum DocumentContext {
  EXPENSE_RECEIPT = 'expense_receipt',
  VENDOR_DOCUMENT = 'vendor_document',
  CUSTOMER_DOCUMENT = 'customer_document',
  BUSINESS_CARD = 'business_card',
  INVOICE = 'invoice',
  CONTRACT = 'contract',
  GENERIC_BUSINESS = 'generic_business'
}

export enum RelevanceWarningLevel {
  NONE = 'none',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

export interface RelevanceIndicator {
  type: 'positive' | 'negative' | 'neutral';
  factor: string;
  score: number; // -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
  description: string;
}

export interface RelevanceAnalysisResult {
  overallScore: number; // 0.0 to 1.0 (1.0 = highly relevant)
  warningLevel: RelevanceWarningLevel;
  message: string;
  indicators: RelevanceIndicator[];
  suggestions: string[];
  contextMatch: boolean;
  businessRelevance: number; // 0.0 to 1.0
  technicalQuality: number; // 0.0 to 1.0
}

export interface RelevanceAnalysisOptions {
  context: DocumentContext;
  companyId: string;
  userId: string;
  strictMode?: boolean; // More aggressive filtering
  customRules?: RelevanceRule[];
}

export interface RelevanceRule {
  name: string;
  context: DocumentContext[];
  condition: (analysis: DocumentContentAnalysis, fileInfo: FileInfo) => boolean;
  score: number;
  message: string;
  severity: RelevanceWarningLevel;
}

export interface FileInfo {
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
}

export class DocumentRelevanceAnalyzer {
  private readonly businessKeywords = new Set([
    'invoice', 'receipt', 'bill', 'statement', 'purchase', 'payment',
    'vendor', 'supplier', 'customer', 'client', 'company', 'business',
    'tax', 'vat', 'gst', 'total', 'amount', 'due', 'balance',
    'date', 'address', 'phone', 'email', 'website', 'www',
    'ltd', 'llc', 'inc', 'corp', 'corporation', 'limited',
    'contract', 'agreement', 'terms', 'conditions', 'service',
    'product', 'item', 'quantity', 'price', 'cost', 'expense'
  ]);

  private readonly personalKeywords = new Set([
    'selfie', 'vacation', 'holiday', 'family', 'personal',
    'pet', 'cat', 'dog', 'animal', 'friend', 'birthday',
    'party', 'wedding', 'celebration', 'photo', 'picture',
    'memories', 'fun', 'love', 'smile', 'happy', 'cute'
  ]);

  private readonly contextRequirements: Record<DocumentContext, {
    requiredElements: string[];
    forbiddenElements: string[];
    minBusinessScore: number;
    preferredMimeTypes: string[];
  }> = {
    [DocumentContext.EXPENSE_RECEIPT]: {
      requiredElements: ['amount', 'date', 'vendor_or_merchant'],
      forbiddenElements: ['personal_photo', 'social_media'],
      minBusinessScore: 0.7,
      preferredMimeTypes: ['application/pdf', 'image/jpeg', 'image/png']
    },
    [DocumentContext.VENDOR_DOCUMENT]: {
      requiredElements: ['business_name', 'contact_info'],
      forbiddenElements: ['personal_photo', 'social_media'],
      minBusinessScore: 0.8,
      preferredMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
    },
    [DocumentContext.CUSTOMER_DOCUMENT]: {
      requiredElements: ['business_name', 'contact_info'],
      forbiddenElements: ['personal_photo', 'social_media'],
      minBusinessScore: 0.8,
      preferredMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
    },
    [DocumentContext.BUSINESS_CARD]: {
      requiredElements: ['name', 'contact_info'],
      forbiddenElements: ['personal_photo'],
      minBusinessScore: 0.6,
      preferredMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
    },
    [DocumentContext.INVOICE]: {
      requiredElements: ['amount', 'date', 'invoice_number', 'business_name'],
      forbiddenElements: ['personal_photo', 'social_media'],
      minBusinessScore: 0.9,
      preferredMimeTypes: ['application/pdf', 'image/jpeg', 'image/png']
    },
    [DocumentContext.CONTRACT]: {
      requiredElements: ['legal_terms', 'parties', 'date'],
      forbiddenElements: ['personal_photo', 'social_media'],
      minBusinessScore: 0.9,
      preferredMimeTypes: ['application/pdf', 'text/plain']
    },
    [DocumentContext.GENERIC_BUSINESS]: {
      requiredElements: ['business_content'],
      forbiddenElements: ['personal_photo'],
      minBusinessScore: 0.5,
      preferredMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
    }
  };

  /**
   * Analyze document relevance for a given context
   */
  async analyzeRelevance(
    contentAnalysis: DocumentContentAnalysis,
    fileInfo: FileInfo,
    options: RelevanceAnalysisOptions
  ): Promise<RelevanceAnalysisResult> {
    const indicators: RelevanceIndicator[] = [];
    let contextMatch = false;
    let businessRelevance = 0;
    let technicalQuality = 0;

    // 1. Analyze file type and technical quality
    const fileTypeAnalysis = this.analyzeFileType(fileInfo, options.context);
    indicators.push(...fileTypeAnalysis.indicators);
    technicalQuality = fileTypeAnalysis.score;

    // 2. Analyze business content relevance
    const businessAnalysis = this.analyzeBusinessContent(contentAnalysis, options.context);
    indicators.push(...businessAnalysis.indicators);
    businessRelevance = businessAnalysis.score;

    // 3. Check context-specific requirements
    const contextAnalysis = this.analyzeContextRequirements(contentAnalysis, fileInfo, options.context);
    indicators.push(...contextAnalysis.indicators);
    contextMatch = contextAnalysis.match;

    // 4. Apply custom rules if provided
    if (options.customRules) {
      const customAnalysis = this.applyCustomRules(contentAnalysis, fileInfo, options.customRules);
      indicators.push(...customAnalysis.indicators);
    }

    // 5. Calculate overall relevance score
    const overallScore = this.calculateOverallScore(
      businessRelevance,
      technicalQuality,
      contextMatch,
      indicators,
      options.strictMode || false
    );

    // 6. Determine warning level and message
    const { warningLevel, message, suggestions } = this.generateWarningAndSuggestions(
      overallScore,
      contextMatch,
      businessRelevance,
      options.context,
      indicators
    );

    return {
      overallScore,
      warningLevel,
      message,
      indicators,
      suggestions,
      contextMatch,
      businessRelevance,
      technicalQuality
    };
  }

  /**
   * Analyze file type appropriateness for context
   */
  private analyzeFileType(fileInfo: FileInfo, context: DocumentContext): {
    score: number;
    indicators: RelevanceIndicator[];
  } {
    const indicators: RelevanceIndicator[] = [];
    const requirements = this.contextRequirements[context];

    // Check MIME type appropriateness
    const isPreferredType = requirements.preferredMimeTypes.includes(fileInfo.mimeType);
    if (isPreferredType) {
      indicators.push({
        type: 'positive',
        factor: 'file_type',
        score: 0.3,
        confidence: 0.9,
        description: `File type ${fileInfo.mimeType} is appropriate for ${context}`
      });
    } else {
      indicators.push({
        type: 'negative',
        factor: 'file_type',
        score: -0.2,
        confidence: 0.7,
        description: `File type ${fileInfo.mimeType} is not preferred for ${context}`
      });
    }

    // Check file size reasonableness
    const sizeInMB = fileInfo.size / (1024 * 1024);
    if (sizeInMB < 0.01) { // Very small files
      indicators.push({
        type: 'negative',
        factor: 'file_size',
        score: -0.3,
        confidence: 0.8,
        description: 'File appears to be too small to contain meaningful business content'
      });
    } else if (sizeInMB > 50) { // Very large files
      indicators.push({
        type: 'negative',
        factor: 'file_size',
        score: -0.1,
        confidence: 0.6,
        description: 'File is unusually large for typical business documents'
      });
    }

    // Analyze filename for relevance
    const filename = fileInfo.originalName.toLowerCase();
    let filenameScore = 0;

    // Check for business-related keywords in filename
    for (const keyword of this.businessKeywords) {
      if (filename.includes(keyword)) {
        filenameScore += 0.1;
      }
    }

    // Check for personal-related keywords in filename
    for (const keyword of this.personalKeywords) {
      if (filename.includes(keyword)) {
        filenameScore -= 0.2;
      }
    }

    if (filenameScore > 0) {
      indicators.push({
        type: 'positive',
        factor: 'filename',
        score: Math.min(filenameScore, 0.3),
        confidence: 0.6,
        description: 'Filename suggests business-related content'
      });
    } else if (filenameScore < 0) {
      indicators.push({
        type: 'negative',
        factor: 'filename',
        score: Math.max(filenameScore, -0.3),
        confidence: 0.7,
        description: 'Filename suggests personal or non-business content'
      });
    }

    // Calculate overall file type score
    const totalScore = indicators.reduce((sum, indicator) => sum + indicator.score, 0);
    const score = Math.max(0, Math.min(1, 0.5 + totalScore));

    return { score, indicators };
  }

  /**
   * Analyze business content relevance
   */
  private analyzeBusinessContent(
    contentAnalysis: DocumentContentAnalysis,
    context: DocumentContext
  ): {
    score: number;
    indicators: RelevanceIndicator[];
  } {
    const indicators: RelevanceIndicator[] = [];
    let score = 0;

    // Check for business entities
    const { businessEntities } = contentAnalysis;

    // Amounts indicate financial documents
    if (businessEntities.amounts && businessEntities.amounts.length > 0) {
      const confidence = Math.min(businessEntities.amounts.reduce((sum, a) => sum + a.confidence, 0) / businessEntities.amounts.length, 1);
      indicators.push({
        type: 'positive',
        factor: 'financial_amounts',
        score: 0.3 * confidence,
        confidence,
        description: `Found ${businessEntities.amounts.length} monetary amount(s)`
      });
      score += 0.2;
    }

    // Dates are important for business documents
    if (businessEntities.dates && businessEntities.dates.length > 0) {
      const confidence = Math.min(businessEntities.dates.reduce((sum, d) => sum + d.confidence, 0) / businessEntities.dates.length, 1);
      indicators.push({
        type: 'positive',
        factor: 'dates',
        score: 0.2 * confidence,
        confidence,
        description: `Found ${businessEntities.dates.length} date(s)`
      });
      score += 0.1;
    }

    // Business entities (vendors, addresses, etc.)
    const businessEntityCount = [
      businessEntities.vendors?.length || 0,
      businessEntities.addresses?.length || 0,
      businessEntities.phoneNumbers?.length || 0,
      businessEntities.emails?.length || 0
    ].reduce((sum, count) => sum + count, 0);

    if (businessEntityCount > 0) {
      indicators.push({
        type: 'positive',
        factor: 'business_entities',
        score: Math.min(businessEntityCount * 0.1, 0.4),
        confidence: 0.8,
        description: `Found ${businessEntityCount} business-related entities`
      });
      score += Math.min(businessEntityCount * 0.05, 0.3);
    }

    // Check extracted text for business keywords
    const text = contentAnalysis.extractedText.toLowerCase();
    let businessKeywordCount = 0;
    let personalKeywordCount = 0;

    for (const keyword of this.businessKeywords) {
      if (text.includes(keyword)) {
        businessKeywordCount++;
      }
    }

    for (const keyword of this.personalKeywords) {
      if (text.includes(keyword)) {
        personalKeywordCount++;
      }
    }

    if (businessKeywordCount > 0) {
      indicators.push({
        type: 'positive',
        factor: 'business_keywords',
        score: Math.min(businessKeywordCount * 0.05, 0.3),
        confidence: 0.7,
        description: `Found ${businessKeywordCount} business-related keywords`
      });
      score += Math.min(businessKeywordCount * 0.02, 0.2);
    }

    if (personalKeywordCount > 0) {
      indicators.push({
        type: 'negative',
        factor: 'personal_keywords',
        score: -Math.min(personalKeywordCount * 0.1, 0.4),
        confidence: 0.8,
        description: `Found ${personalKeywordCount} personal/non-business keywords`
      });
      score -= Math.min(personalKeywordCount * 0.05, 0.3);
    }

    // Check document structure for business documents
    if (contentAnalysis.documentStructure) {
      const { hasTable, hasHeader, hasFooter } = contentAnalysis.documentStructure;

      if (hasTable) {
        indicators.push({
          type: 'positive',
          factor: 'document_structure',
          score: 0.2,
          confidence: 0.7,
          description: 'Document contains structured data (tables)'
        });
        score += 0.1;
      }

      if (hasHeader && hasFooter) {
        indicators.push({
          type: 'positive',
          factor: 'document_structure',
          score: 0.15,
          confidence: 0.6,
          description: 'Document has professional structure (header/footer)'
        });
        score += 0.05;
      }
    }

    // Normalize score to 0-1 range
    score = Math.max(0, Math.min(1, score));

    return { score, indicators };
  }

  /**
   * Analyze context-specific requirements
   */
  private analyzeContextRequirements(
    contentAnalysis: DocumentContentAnalysis,
    fileInfo: FileInfo,
    context: DocumentContext
  ): {
    match: boolean;
    indicators: RelevanceIndicator[];
  } {
    const indicators: RelevanceIndicator[] = [];
    const requirements = this.contextRequirements[context];

    let requiredElementsFound = 0;
    let forbiddenElementsFound = 0;

    // Check required elements
    for (const element of requirements.requiredElements) {
      const found = this.hasRequiredElement(contentAnalysis, element);
      if (found.present) {
        requiredElementsFound++;
        indicators.push({
          type: 'positive',
          factor: 'required_elements',
          score: 0.2,
          confidence: found.confidence,
          description: `Required element '${element}' found`
        });
      } else {
        indicators.push({
          type: 'negative',
          factor: 'missing_required',
          score: -0.3,
          confidence: 0.8,
          description: `Missing required element: ${element}`
        });
      }
    }

    // Check forbidden elements
    for (const element of requirements.forbiddenElements) {
      const found = this.hasForbiddenElement(contentAnalysis, fileInfo, element);
      if (found.present) {
        forbiddenElementsFound++;
        indicators.push({
          type: 'negative',
          factor: 'forbidden_elements',
          score: -0.5,
          confidence: found.confidence,
          description: `Forbidden element '${element}' detected`
        });
      }
    }

    // Determine context match
    const requiredRatio = requiredElementsFound / requirements.requiredElements.length;
    const match = requiredRatio >= 0.5 && forbiddenElementsFound === 0;

    return { match, indicators };
  }

  /**
   * Check if document has a required element
   */
  private hasRequiredElement(contentAnalysis: DocumentContentAnalysis, element: string): {
    present: boolean;
    confidence: number;
  } {
    const { businessEntities, extractedText } = contentAnalysis;
    const text = extractedText.toLowerCase();

    switch (element) {
      case 'amount':
        return {
          present: businessEntities.amounts?.length > 0,
          confidence: businessEntities.amounts?.length > 0 ?
            businessEntities.amounts.reduce((sum, a) => sum + a.confidence, 0) / businessEntities.amounts.length : 0
        };

      case 'date':
        return {
          present: businessEntities.dates?.length > 0,
          confidence: businessEntities.dates?.length > 0 ?
            businessEntities.dates.reduce((sum, d) => sum + d.confidence, 0) / businessEntities.dates.length : 0
        };

      case 'vendor_or_merchant':
      case 'business_name':
        return {
          present: businessEntities.vendors?.length > 0 || text.includes('llc') || text.includes('inc') || text.includes('ltd'),
          confidence: businessEntities.vendors?.length > 0 ?
            businessEntities.vendors.reduce((sum, v) => sum + v.confidence, 0) / businessEntities.vendors.length : 0.5
        };

      case 'contact_info':
        const hasEmail = businessEntities.emails?.length > 0;
        const hasPhone = businessEntities.phoneNumbers?.length > 0;
        const hasAddress = businessEntities.addresses?.length > 0;
        return {
          present: hasEmail || hasPhone || hasAddress,
          confidence: 0.8
        };

      case 'name':
        return {
          present: text.length > 10 && (text.includes(' ') || businessEntities.vendors?.length > 0),
          confidence: 0.6
        };

      case 'invoice_number':
        return {
          present: /(?:invoice|inv|#)\s*[:\-#]?\s*[a-z0-9]+/i.test(text),
          confidence: 0.7
        };

      case 'legal_terms':
        const legalTerms = ['agreement', 'contract', 'terms', 'conditions', 'parties', 'whereas', 'therefore'];
        const foundTerms = legalTerms.filter(term => text.includes(term));
        return {
          present: foundTerms.length >= 2,
          confidence: foundTerms.length / legalTerms.length
        };

      case 'parties':
        return {
          present: businessEntities.vendors?.length >= 2 || text.includes('party') || text.includes('parties'),
          confidence: 0.6
        };

      case 'business_content':
        return {
          present: text.length > 50,
          confidence: Math.min(text.length / 200, 1)
        };

      default:
        return { present: false, confidence: 0 };
    }
  }

  /**
   * Check if document has forbidden elements
   */
  private hasForbiddenElement(contentAnalysis: DocumentContentAnalysis, fileInfo: FileInfo, element: string): {
    present: boolean;
    confidence: number;
  } {
    const { extractedText } = contentAnalysis;
    const text = extractedText.toLowerCase();
    const filename = fileInfo.originalName.toLowerCase();

    switch (element) {
      case 'personal_photo':
        const personalPhotoKeywords = ['selfie', 'photo', 'pic', 'img_', 'dsc_', 'vacation', 'family', 'pet'];
        const hasPersonalKeywords = personalPhotoKeywords.some(keyword => filename.includes(keyword) || text.includes(keyword));
        const isImageWithLittleText = fileInfo.mimeType.startsWith('image/') && text.length < 20;
        return {
          present: hasPersonalKeywords || isImageWithLittleText,
          confidence: hasPersonalKeywords ? 0.8 : (isImageWithLittleText ? 0.6 : 0)
        };

      case 'social_media':
        const socialKeywords = ['facebook', 'twitter', 'instagram', 'snapchat', 'tiktok', 'social', 'post', 'like', 'share'];
        const hasSocialKeywords = socialKeywords.some(keyword => text.includes(keyword));
        return {
          present: hasSocialKeywords,
          confidence: 0.7
        };

      default:
        return { present: false, confidence: 0 };
    }
  }

  /**
   * Apply custom relevance rules
   */
  private applyCustomRules(
    contentAnalysis: DocumentContentAnalysis,
    fileInfo: FileInfo,
    rules: RelevanceRule[]
  ): {
    indicators: RelevanceIndicator[];
  } {
    const indicators: RelevanceIndicator[] = [];

    for (const rule of rules) {
      try {
        if (rule.condition(contentAnalysis, fileInfo)) {
          indicators.push({
            type: rule.score > 0 ? 'positive' : 'negative',
            factor: 'custom_rule',
            score: rule.score,
            confidence: 0.8,
            description: rule.message
          });
        }
      } catch (error) {
        console.warn('Custom rule evaluation error:', error);
      }
    }

    return { indicators };
  }

  /**
   * Calculate overall relevance score
   */
  private calculateOverallScore(
    businessRelevance: number,
    technicalQuality: number,
    contextMatch: boolean,
    indicators: RelevanceIndicator[],
    strictMode: boolean
  ): number {
    // Base score from business relevance and technical quality
    let score = (businessRelevance * 0.6) + (technicalQuality * 0.2);

    // Context match bonus/penalty
    if (contextMatch) {
      score += 0.2;
    } else {
      score -= strictMode ? 0.3 : 0.1;
    }

    // Apply indicator adjustments
    const indicatorAdjustment = indicators.reduce((sum, indicator) => sum + indicator.score, 0);
    score += indicatorAdjustment * 0.1;

    // Strict mode applies additional penalties
    if (strictMode) {
      const negativeIndicators = indicators.filter(i => i.type === 'negative').length;
      if (negativeIndicators > 2) {
        score -= 0.2;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate warning level, message, and suggestions
   */
  private generateWarningAndSuggestions(
    overallScore: number,
    contextMatch: boolean,
    businessRelevance: number,
    context: DocumentContext,
    indicators: RelevanceIndicator[]
  ): {
    warningLevel: RelevanceWarningLevel;
    message: string;
    suggestions: string[];
  } {
    const suggestions: string[] = [];

    // Determine warning level
    let warningLevel: RelevanceWarningLevel;
    let message: string;

    if (overallScore >= 0.8) {
      warningLevel = RelevanceWarningLevel.NONE;
      message = 'Document appears highly relevant for this context.';
    } else if (overallScore >= 0.6) {
      warningLevel = RelevanceWarningLevel.INFO;
      message = 'Document appears relevant, but could be improved.';
    } else if (overallScore >= 0.4) {
      warningLevel = RelevanceWarningLevel.WARNING;
      message = 'Document may not be appropriate for this context. Please review.';
    } else {
      warningLevel = RelevanceWarningLevel.ERROR;
      message = 'Document appears inappropriate for this context. Consider uploading a different file.';
    }

    // Generate specific suggestions
    const negativeIndicators = indicators.filter(i => i.type === 'negative');
    const missingRequiredIndicators = indicators.filter(i => i.factor === 'missing_required');

    if (!contextMatch) {
      suggestions.push(`Ensure the document is appropriate for ${context.replace('_', ' ')} uploads.`);
    }

    if (businessRelevance < 0.5) {
      suggestions.push('Consider uploading a business document rather than personal content.');
    }

    if (missingRequiredIndicators.length > 0) {
      suggestions.push('The document appears to be missing key information required for this context.');
    }

    if (negativeIndicators.some(i => i.factor === 'personal_keywords' || i.factor === 'personal_photo')) {
      suggestions.push('This appears to be personal content. Business documents are recommended.');
    }

    if (negativeIndicators.some(i => i.factor === 'file_size')) {
      suggestions.push('Check that the file size is appropriate and the document is complete.');
    }

    // Context-specific suggestions
    switch (context) {
      case DocumentContext.EXPENSE_RECEIPT:
        if (overallScore < 0.6) {
          suggestions.push('For expense receipts, ensure the document shows the amount, date, and merchant name.');
        }
        break;
      case DocumentContext.VENDOR_DOCUMENT:
        if (overallScore < 0.6) {
          suggestions.push('For vendor documents, include business cards, invoices, or documents with contact information.');
        }
        break;
      case DocumentContext.INVOICE:
        if (overallScore < 0.6) {
          suggestions.push('For invoices, ensure the document includes invoice number, amounts, dates, and business details.');
        }
        break;
    }

    return { warningLevel, message, suggestions };
  }
}

// Export default instance
export const documentRelevanceAnalyzer = new DocumentRelevanceAnalyzer();