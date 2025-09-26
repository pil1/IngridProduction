/**
 * Document Duplicate Detection Service
 *
 * Provides sophisticated duplicate detection with date-aware intelligence
 * for recurring documents like monthly bills.
 */

import { Pool } from 'pg';
import { DocumentContentAnalysis } from './documentContentAnalysis';

export interface DuplicateDocument {
  id: string;
  originalFileName: string;
  smartFileName: string;
  uploadedBy: string;
  createdAt: string;
  documentCategory: string;
  similarity: DuplicateSimilarity;
  metadata: {
    fileSize: number;
    checksum: string;
    relevanceScore: number;
  };
}

export interface DuplicateSimilarity {
  overall: number; // 0-1 overall similarity score
  factors: {
    checksum: { match: boolean; score: number };
    perceptualHash: { match: boolean; score: number; distance: number };
    content: { similarity: number; vendorMatch: boolean; amountMatch: boolean };
    temporal: {
      dateVariance: number;
      isPotentialRecurring: boolean;
      timeDifference: string;
    };
    filename: { similarity: number; patterns: string[] };
  };
}

export interface DuplicateDetectionResult {
  hasDuplicates: boolean;
  exactDuplicates: DuplicateDocument[];
  potentialDuplicates: DuplicateDocument[];
  recommendation: 'proceed' | 'warn' | 'block';
  reasoning: string[];
  analysis: {
    totalChecked: number;
    checksumMatches: number;
    visualSimilarMatches: number;
    contentSimilarMatches: number;
    temporalAnalysis: {
      recurringPattern: boolean;
      monthlyBilling: boolean;
      dateVarianceAcceptable: boolean;
    };
  };
}

export interface DuplicateDetectionOptions {
  companyId: string;
  userId: string;
  documentCategory?: string;
  checkExactOnly?: boolean;
  temporalTolerance?: number; // Days
  contentSimilarityThreshold?: number; // 0-1
  visualSimilarityThreshold?: number; // 0-1
}

export class DocumentDuplicateDetectionService {
  constructor(private db: Pool) {}

  /**
   * Detect duplicates for a document before upload
   */
  async detectDuplicates(
    fileBuffer: Buffer,
    checksum: string,
    perceptualHash: string,
    contentAnalysis: DocumentContentAnalysis,
    options: DuplicateDetectionOptions
  ): Promise<DuplicateDetectionResult> {
    const {
      companyId,
      userId,
      documentCategory,
      checkExactOnly = false,
      temporalTolerance = 35, // 35 days for monthly bills
      contentSimilarityThreshold = 0.8,
      visualSimilarityThreshold = 0.85
    } = options;

    try {
      // Step 1: Exact checksum match (identical files)
      const exactDuplicates = await this.findExactDuplicates(companyId, checksum, userId);

      // Step 2: If exact duplicates found and exact only requested, return early
      if (checkExactOnly && exactDuplicates.length > 0) {
        return this.buildResult(exactDuplicates, [], 'block',
          ['Exact duplicate found (identical file checksum)']);
      }

      // Step 3: Visual similarity check (perceptual hash)
      const visuallySimilar = await this.findVisuallySimilar(
        companyId, perceptualHash, visualSimilarityThreshold, userId
      );

      // Step 4: Content-based similarity check
      const contentSimilar = await this.findContentSimilar(
        companyId, contentAnalysis, contentSimilarityThreshold, documentCategory, userId
      );

      // Step 5: Combine and analyze results
      const allPotentialDuplicates = this.deduplicateResults(
        [...visuallySimilar, ...contentSimilar]
      );

      // Step 6: Temporal analysis for intelligent filtering
      const temporallyFiltered = await this.applyTemporalIntelligence(
        allPotentialDuplicates, contentAnalysis, temporalTolerance
      );

      // Step 7: Generate recommendation
      const recommendation = this.generateRecommendation(
        exactDuplicates, temporallyFiltered, contentAnalysis
      );

      return this.buildResult(exactDuplicates, temporallyFiltered, recommendation.action, recommendation.reasons);

    } catch (error) {
      console.error('Duplicate detection failed:', error);
      throw new Error(`Duplicate detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find exact duplicate documents by checksum
   */
  private async findExactDuplicates(
    companyId: string,
    checksum: string,
    userId: string
  ): Promise<DuplicateDocument[]> {
    const query = `
      SELECT
        d.id, d.original_file_name, d.smart_file_name, d.uploaded_by,
        d.created_at, d.document_category, d.file_size, d.checksum,
        d.relevance_score, d.perceptual_hash
      FROM documents d
      WHERE d.company_id = $1
        AND d.checksum = $2
        AND NOT d.is_deleted
        AND EXISTS (
          -- Ensure user has permission to see this document
          SELECT 1 FROM documents d2
          WHERE d2.id = d.id
          AND (
            d2.uploaded_by = $3
            OR d2.company_id = $1  -- Same company documents are visible
          )
        )
      ORDER BY d.created_at DESC
      LIMIT 10
    `;

    const result = await this.db.query(query, [companyId, checksum, userId]);

    return result.rows.map(row => ({
      id: row.id,
      originalFileName: row.original_file_name,
      smartFileName: row.smart_file_name,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      documentCategory: row.document_category,
      similarity: {
        overall: 1.0,
        factors: {
          checksum: { match: true, score: 1.0 },
          perceptualHash: { match: false, score: 0.0, distance: 0 },
          content: { similarity: 1.0, vendorMatch: true, amountMatch: true },
          temporal: { dateVariance: 0, isPotentialRecurring: false, timeDifference: '0 days' },
          filename: { similarity: 0.0, patterns: [] }
        }
      },
      metadata: {
        fileSize: row.file_size,
        checksum: row.checksum,
        relevanceScore: row.relevance_score || 0
      }
    }));
  }

  /**
   * Find visually similar documents by perceptual hash
   */
  private async findVisuallySimilar(
    companyId: string,
    perceptualHash: string,
    threshold: number,
    userId: string
  ): Promise<DuplicateDocument[]> {
    if (!perceptualHash) return [];

    const query = `
      SELECT
        d.id, d.original_file_name, d.smart_file_name, d.uploaded_by,
        d.created_at, d.document_category, d.file_size, d.checksum,
        d.relevance_score, d.perceptual_hash
      FROM documents d
      WHERE d.company_id = $1
        AND d.perceptual_hash IS NOT NULL
        AND d.perceptual_hash != $2
        AND NOT d.is_deleted
        AND EXISTS (
          SELECT 1 FROM documents d2
          WHERE d2.id = d.id
          AND (d2.uploaded_by = $3 OR d2.company_id = $1)
        )
      ORDER BY d.created_at DESC
      LIMIT 50
    `;

    const result = await this.db.query(query, [companyId, perceptualHash, userId]);
    const candidates: DuplicateDocument[] = [];

    for (const row of result.rows) {
      const distance = this.calculateHashDistance(perceptualHash, row.perceptual_hash);
      const similarity = 1 - (distance / 64); // Normalize to 0-1 scale

      if (similarity >= threshold) {
        candidates.push({
          id: row.id,
          originalFileName: row.original_file_name,
          smartFileName: row.smart_file_name,
          uploadedBy: row.uploaded_by,
          createdAt: row.created_at,
          documentCategory: row.document_category,
          similarity: {
            overall: similarity,
            factors: {
              checksum: { match: false, score: 0.0 },
              perceptualHash: { match: true, score: similarity, distance },
              content: { similarity: 0.0, vendorMatch: false, amountMatch: false },
              temporal: { dateVariance: 0, isPotentialRecurring: false, timeDifference: '' },
              filename: { similarity: 0.0, patterns: [] }
            }
          },
          metadata: {
            fileSize: row.file_size,
            checksum: row.checksum,
            relevanceScore: row.relevance_score || 0
          }
        });
      }
    }

    return candidates;
  }

  /**
   * Find content-similar documents using extracted business entities
   */
  private async findContentSimilar(
    companyId: string,
    contentAnalysis: DocumentContentAnalysis,
    threshold: number,
    documentCategory?: string,
    userId?: string
  ): Promise<DuplicateDocument[]> {
    // Extract key content for comparison
    const vendors = contentAnalysis.businessEntities.vendors.map(v => v.name.toLowerCase());
    const amounts = contentAnalysis.businessEntities.amounts.map(a => a.value);
    const emails = contentAnalysis.businessEntities.emails.map(e => e.email.toLowerCase());

    if (vendors.length === 0 && amounts.length === 0 && emails.length === 0) {
      return []; // Not enough content to compare
    }

    let query = `
      SELECT
        d.id, d.original_file_name, d.smart_file_name, d.uploaded_by,
        d.created_at, d.document_category, d.file_size, d.checksum,
        d.relevance_score, d.content_analysis
      FROM documents d
      WHERE d.company_id = $1
        AND d.content_analysis IS NOT NULL
        AND NOT d.is_deleted
    `;

    const queryParams = [companyId];
    let paramIndex = 2;

    if (documentCategory) {
      query += ` AND d.document_category = $${paramIndex}`;
      queryParams.push(documentCategory);
      paramIndex++;
    }

    if (userId) {
      query += ` AND (d.uploaded_by = $${paramIndex} OR d.company_id = $1)`;
      queryParams.push(userId);
    }

    query += ` ORDER BY d.created_at DESC LIMIT 100`;

    const result = await this.db.query(query, queryParams);
    const candidates: DuplicateDocument[] = [];

    for (const row of result.rows) {
      const similarity = this.calculateContentSimilarity(
        contentAnalysis,
        row.content_analysis
      );

      if (similarity.overall >= threshold) {
        candidates.push({
          id: row.id,
          originalFileName: row.original_file_name,
          smartFileName: row.smart_file_name,
          uploadedBy: row.uploaded_by,
          createdAt: row.created_at,
          documentCategory: row.document_category,
          similarity: {
            overall: similarity.overall,
            factors: {
              checksum: { match: false, score: 0.0 },
              perceptualHash: { match: false, score: 0.0, distance: 0 },
              content: similarity,
              temporal: { dateVariance: 0, isPotentialRecurring: false, timeDifference: '' },
              filename: { similarity: 0.0, patterns: [] }
            }
          },
          metadata: {
            fileSize: row.file_size,
            checksum: row.checksum,
            relevanceScore: row.relevance_score || 0
          }
        });
      }
    }

    return candidates;
  }

  /**
   * Apply temporal intelligence to filter out legitimate recurring documents
   */
  private async applyTemporalIntelligence(
    potentialDuplicates: DuplicateDocument[],
    contentAnalysis: DocumentContentAnalysis,
    toleranceDays: number
  ): Promise<DuplicateDocument[]> {
    const filtered: DuplicateDocument[] = [];

    for (const duplicate of potentialDuplicates) {
      const daysDifference = this.calculateDaysDifference(duplicate.createdAt);
      const isInRecurringRange = daysDifference >= (30 - toleranceDays/2) &&
                                daysDifference <= (30 + toleranceDays/2);

      // Check if this looks like a recurring document (monthly bill)
      const hasRecurringIndicators = this.detectRecurringIndicators(contentAnalysis);
      const isMonthlyBill = isInRecurringRange && hasRecurringIndicators;

      // Enhanced temporal analysis
      duplicate.similarity.factors.temporal = {
        dateVariance: daysDifference,
        isPotentialRecurring: isMonthlyBill,
        timeDifference: this.formatTimeDifference(daysDifference)
      };

      // Apply intelligent filtering
      if (isMonthlyBill && duplicate.similarity.factors.content.vendorMatch) {
        // This is likely a legitimate monthly bill - reduce severity
        duplicate.similarity.overall *= 0.7; // Reduce overall similarity score
      }

      // Only include if still above threshold after temporal adjustment
      if (duplicate.similarity.overall >= 0.6) {
        filtered.push(duplicate);
      }
    }

    return filtered.sort((a, b) => b.similarity.overall - a.similarity.overall);
  }

  /**
   * Generate recommendation based on duplicate analysis
   */
  private generateRecommendation(
    exactDuplicates: DuplicateDocument[],
    potentialDuplicates: DuplicateDocument[],
    contentAnalysis: DocumentContentAnalysis
  ): { action: 'proceed' | 'warn' | 'block'; reasons: string[] } {
    const reasons: string[] = [];

    // Block exact duplicates
    if (exactDuplicates.length > 0) {
      reasons.push(`Found ${exactDuplicates.length} identical document(s) with same checksum`);
      return { action: 'block', reasons };
    }

    // Warn for high-similarity non-recurring documents
    const highSimilarity = potentialDuplicates.filter(d =>
      d.similarity.overall >= 0.9 && !d.similarity.factors.temporal.isPotentialRecurring
    );

    if (highSimilarity.length > 0) {
      reasons.push(`Found ${highSimilarity.length} very similar document(s) - please verify this is not a duplicate`);
      return { action: 'warn', reasons };
    }

    // Warn for potential duplicates
    if (potentialDuplicates.length > 0) {
      const recurringCount = potentialDuplicates.filter(d =>
        d.similarity.factors.temporal.isPotentialRecurring
      ).length;

      if (recurringCount > 0) {
        reasons.push(`Found ${recurringCount} potentially similar recurring document(s) - this may be a monthly bill`);
      }

      const nonRecurringCount = potentialDuplicates.length - recurringCount;
      if (nonRecurringCount > 0) {
        reasons.push(`Found ${nonRecurringCount} similar document(s) that may be duplicates`);
      }

      return { action: 'warn', reasons };
    }

    return { action: 'proceed', reasons: ['No duplicates detected'] };
  }

  /**
   * Helper methods
   */
  private calculateHashDistance(hash1: string, hash2: string): number {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64; // Max distance

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
  }

  private calculateContentSimilarity(
    content1: DocumentContentAnalysis,
    content2: any
  ): { similarity: number; vendorMatch: boolean; amountMatch: boolean } {
    let score = 0;
    let factors = 0;
    let vendorMatch = false;
    let amountMatch = false;

    // Compare vendors
    if (content1.businessEntities.vendors.length > 0 && content2.businessEntities?.vendors?.length > 0) {
      factors++;
      for (const vendor1 of content1.businessEntities.vendors) {
        for (const vendor2 of content2.businessEntities.vendors) {
          if (this.stringSimilarity(vendor1.name, vendor2.name) > 0.8) {
            score += 0.4;
            vendorMatch = true;
            break;
          }
        }
      }
    }

    // Compare amounts
    if (content1.businessEntities.amounts.length > 0 && content2.businessEntities?.amounts?.length > 0) {
      factors++;
      for (const amount1 of content1.businessEntities.amounts) {
        for (const amount2 of content2.businessEntities.amounts) {
          const diff = Math.abs(amount1.value - amount2.value);
          if (diff < 0.01) {
            score += 0.3;
            amountMatch = true;
          } else if (diff / Math.max(amount1.value, amount2.value) < 0.05) {
            score += 0.2; // Close amounts
          }
        }
      }
    }

    // Compare emails
    if (content1.businessEntities.emails.length > 0 && content2.businessEntities?.emails?.length > 0) {
      factors++;
      for (const email1 of content1.businessEntities.emails) {
        for (const email2 of content2.businessEntities.emails) {
          if (email1.email.toLowerCase() === email2.email.toLowerCase()) {
            score += 0.3;
          }
        }
      }
    }

    const similarity = factors > 0 ? Math.min(1.0, score / factors) : 0;
    return { similarity, vendorMatch, amountMatch };
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateDaysDifference(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private detectRecurringIndicators(contentAnalysis: DocumentContentAnalysis): boolean {
    const text = contentAnalysis.extractedText.toLowerCase();
    const recurringKeywords = [
      'monthly', 'month', 'billing cycle', 'service period',
      'subscription', 'recurring', 'bill', 'statement'
    ];

    return recurringKeywords.some(keyword => text.includes(keyword));
  }

  private formatTimeDifference(days: number): string {
    if (days < 1) return 'Less than 1 day';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.round(days / 7)} weeks`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  }

  private deduplicateResults(duplicates: DuplicateDocument[]): DuplicateDocument[] {
    const seen = new Set<string>();
    return duplicates.filter(duplicate => {
      if (seen.has(duplicate.id)) return false;
      seen.add(duplicate.id);
      return true;
    });
  }

  private buildResult(
    exact: DuplicateDocument[],
    potential: DuplicateDocument[],
    recommendation: 'proceed' | 'warn' | 'block',
    reasoning: string[]
  ): DuplicateDetectionResult {
    return {
      hasDuplicates: exact.length > 0 || potential.length > 0,
      exactDuplicates: exact,
      potentialDuplicates: potential,
      recommendation,
      reasoning,
      analysis: {
        totalChecked: exact.length + potential.length,
        checksumMatches: exact.length,
        visualSimilarMatches: potential.filter(d => d.similarity.factors.perceptualHash.match).length,
        contentSimilarMatches: potential.filter(d => d.similarity.factors.content.similarity > 0.8).length,
        temporalAnalysis: {
          recurringPattern: potential.some(d => d.similarity.factors.temporal.isPotentialRecurring),
          monthlyBilling: potential.filter(d => d.similarity.factors.temporal.isPotentialRecurring).length > 0,
          dateVarianceAcceptable: potential.every(d => d.similarity.factors.temporal.dateVariance < 45)
        }
      }
    };
  }
}

export const createDocumentDuplicateDetectionService = (db: Pool) =>
  new DocumentDuplicateDetectionService(db);