/**
 * Document Intelligence Orchestrator Service
 *
 * Coordinates all document analysis services to provide comprehensive
 * document intelligence including content analysis, duplicate detection,
 * and relevance analysis. Acts as the main entry point for document
 * processing with intelligent workflows.
 */

import { DocumentContentAnalysisService, DocumentContentAnalysis } from './documentContentAnalysis';
import { DocumentDuplicateDetectionService, DuplicateDetectionResult, DuplicateDetectionOptions } from './documentDuplicateDetection';
import { DocumentRelevanceAnalyzer, RelevanceAnalysisResult, DocumentContext, RelevanceAnalysisOptions } from './documentRelevanceAnalysis';
import * as crypto from 'crypto';
import sharp from 'sharp';

export interface DocumentIntelligenceOptions {
  // Context information
  context: DocumentContext;
  companyId: string;
  userId: string;

  // Analysis preferences
  enableDuplicateDetection?: boolean;
  enableRelevanceAnalysis?: boolean;
  enableContentAnalysis?: boolean;

  // Duplicate detection options
  duplicateScope?: 'company' | 'user';
  temporalToleranceDays?: number;
  includeArchived?: boolean;

  // Relevance analysis options
  strictRelevance?: boolean;
  customRelevanceRules?: any[];

  // Content analysis options
  deepOCR?: boolean;
  extractBusinessEntities?: boolean;
  analyzeDocumentStructure?: boolean;
}

export interface DocumentIntelligenceResult {
  // File information
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  perceptualHash?: string;

  // Analysis results
  contentAnalysis: DocumentContentAnalysis;
  duplicateAnalysis: DuplicateDetectionResult;
  relevanceAnalysis: RelevanceAnalysisResult;

  // Overall assessment
  overallScore: number; // 0.0 to 1.0
  recommendedAction: 'accept' | 'warn' | 'reject';
  warnings: DocumentWarning[];
  suggestions: string[];

  // Performance metrics
  processingTimeMs: number;
  analysisTimestamp: Date;
}

export interface DocumentWarning {
  type: 'duplicate' | 'relevance' | 'quality' | 'security';
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
  actionable: boolean;
}

export interface FileInfo {
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
}

export class DocumentIntelligenceOrchestrator {
  private contentAnalyzer: DocumentContentAnalysisService;
  private duplicateDetector: DocumentDuplicateDetectionService;
  private relevanceAnalyzer: DocumentRelevanceAnalyzer;

  constructor() {
    this.contentAnalyzer = new DocumentContentAnalysisService();
    this.duplicateDetector = new DocumentDuplicateDetectionService();
    this.relevanceAnalyzer = new DocumentRelevanceAnalyzer();
  }

  /**
   * Perform comprehensive document intelligence analysis
   */
  async analyzeDocument(
    fileBuffer: Buffer,
    fileInfo: FileInfo,
    options: DocumentIntelligenceOptions
  ): Promise<DocumentIntelligenceResult> {
    const startTime = Date.now();
    const warnings: DocumentWarning[] = [];
    const suggestions: string[] = [];

    try {
      // 1. Generate checksums and hashes
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      let perceptualHash: string | undefined;

      // Generate perceptual hash for images
      if (fileInfo.mimeType.startsWith('image/')) {
        try {
          perceptualHash = await this.generatePerceptualHash(fileBuffer);
        } catch (error) {
          console.warn('Failed to generate perceptual hash:', error);
        }
      }

      // 2. Content Analysis (if enabled)
      let contentAnalysis: DocumentContentAnalysis;
      if (options.enableContentAnalysis !== false) {
        contentAnalysis = await this.contentAnalyzer.analyzeDocument(fileBuffer, {
          mimeType: fileInfo.mimeType,
          fileName: fileInfo.originalName,
          deepOCR: options.deepOCR || true,
          extractBusinessEntities: options.extractBusinessEntities !== false,
          analyzeDocumentStructure: options.analyzeDocumentStructure !== false,
          context: options.context
        });

        // Add content quality warnings
        if (contentAnalysis.confidence < 0.3) {
          warnings.push({
            type: 'quality',
            severity: 'warning',
            message: 'Low OCR confidence - document may be unclear or damaged',
            details: { confidence: contentAnalysis.confidence },
            actionable: true
          });
          suggestions.push('Consider uploading a clearer image or higher quality scan');
        }

        if (contentAnalysis.extractedText.length < 10) {
          warnings.push({
            type: 'quality',
            severity: 'warning',
            message: 'Very little text found in document',
            details: { textLength: contentAnalysis.extractedText.length },
            actionable: true
          });
          suggestions.push('Ensure the document contains readable text content');
        }
      } else {
        // Minimal content analysis fallback
        contentAnalysis = {
          extractedText: '',
          confidence: 0.5,
          businessEntities: {
            amounts: [],
            dates: [],
            vendors: [],
            addresses: [],
            phoneNumbers: [],
            emails: []
          },
          documentStructure: {
            hasTable: false,
            hasHeader: false,
            hasFooter: false,
            hasSignature: false,
            hasLogo: false,
            hasStamps: false,
            pageCount: 1,
            layout: 'unknown'
          },
          technicalMetadata: {
            resolution: null,
            colorSpace: null,
            compression: null,
            creationDate: null,
            author: null,
            subject: null
          },
          temporalClassification: 'unknown',
          processingTimeMs: 0
        };
      }

      // 3. Duplicate Detection (if enabled)
      let duplicateAnalysis: DuplicateDetectionResult;
      if (options.enableDuplicateDetection !== false) {
        const duplicateOptions: DuplicateDetectionOptions = {
          companyId: options.companyId,
          userId: options.userId,
          scope: options.duplicateScope || 'company',
          temporalToleranceDays: options.temporalToleranceDays || 30,
          includeArchived: options.includeArchived || false,
          context: options.context
        };

        duplicateAnalysis = await this.duplicateDetector.detectDuplicates(
          fileBuffer,
          checksum,
          perceptualHash || '',
          contentAnalysis,
          duplicateOptions
        );

        // Add duplicate warnings
        if (duplicateAnalysis.hasDuplicates) {
          const severity = duplicateAnalysis.exactMatch ? 'error' :
                          duplicateAnalysis.highConfidence ? 'warning' : 'info';

          warnings.push({
            type: 'duplicate',
            severity,
            message: duplicateAnalysis.message,
            details: {
              matchCount: duplicateAnalysis.matches.length,
              exactMatch: duplicateAnalysis.exactMatch,
              confidence: duplicateAnalysis.confidence
            },
            actionable: true
          });

          if (duplicateAnalysis.exactMatch) {
            suggestions.push('This appears to be an exact duplicate of an existing document');
          } else {
            suggestions.push('Similar documents found - verify this is not a duplicate');
          }
        }
      } else {
        // Minimal duplicate analysis fallback
        duplicateAnalysis = {
          hasDuplicates: false,
          exactMatch: false,
          confidence: 0,
          message: 'Duplicate detection disabled',
          matches: [],
          temporalAnalysis: {
            isRecurring: false,
            expectedFrequency: null,
            lastOccurrence: null,
            withinExpectedWindow: false
          }
        };
      }

      // 4. Relevance Analysis (if enabled)
      let relevanceAnalysis: RelevanceAnalysisResult;
      if (options.enableRelevanceAnalysis !== false) {
        const relevanceOptions: RelevanceAnalysisOptions = {
          context: options.context,
          companyId: options.companyId,
          userId: options.userId,
          strictMode: options.strictRelevance || false,
          customRules: options.customRelevanceRules || []
        };

        relevanceAnalysis = await this.relevanceAnalyzer.analyzeRelevance(
          contentAnalysis,
          fileInfo,
          relevanceOptions
        );

        // Add relevance warnings
        if (relevanceAnalysis.warningLevel !== 'none') {
          warnings.push({
            type: 'relevance',
            severity: relevanceAnalysis.warningLevel,
            message: relevanceAnalysis.message,
            details: {
              score: relevanceAnalysis.overallScore,
              contextMatch: relevanceAnalysis.contextMatch,
              businessRelevance: relevanceAnalysis.businessRelevance
            },
            actionable: true
          });

          suggestions.push(...relevanceAnalysis.suggestions);
        }
      } else {
        // Minimal relevance analysis fallback
        relevanceAnalysis = {
          overallScore: 0.5,
          warningLevel: 'none',
          message: 'Relevance analysis disabled',
          indicators: [],
          suggestions: [],
          contextMatch: true,
          businessRelevance: 0.5,
          technicalQuality: 0.5
        };
      }

      // 5. Calculate overall assessment
      const overallScore = this.calculateOverallScore(
        contentAnalysis,
        duplicateAnalysis,
        relevanceAnalysis,
        options
      );

      const recommendedAction = this.determineRecommendedAction(
        overallScore,
        duplicateAnalysis,
        relevanceAnalysis,
        warnings
      );

      // 6. Add security warnings if needed
      await this.addSecurityWarnings(fileBuffer, fileInfo, warnings, suggestions);

      const processingTimeMs = Date.now() - startTime;

      return {
        fileName: fileInfo.originalName,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimeType,
        checksum,
        perceptualHash,
        contentAnalysis,
        duplicateAnalysis,
        relevanceAnalysis,
        overallScore,
        recommendedAction,
        warnings,
        suggestions: [...new Set(suggestions)], // Remove duplicates
        processingTimeMs,
        analysisTimestamp: new Date()
      };

    } catch (error) {
      console.error('Document intelligence analysis error:', error);

      // Return a safe fallback result
      return {
        fileName: fileInfo.originalName,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimeType,
        checksum: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
        contentAnalysis: {
          extractedText: '',
          confidence: 0,
          businessEntities: {
            amounts: [], dates: [], vendors: [], addresses: [], phoneNumbers: [], emails: []
          },
          documentStructure: {
            hasTable: false, hasHeader: false, hasFooter: false, hasSignature: false,
            hasLogo: false, hasStamps: false, pageCount: 1, layout: 'unknown'
          },
          technicalMetadata: {
            resolution: null, colorSpace: null, compression: null,
            creationDate: null, author: null, subject: null
          },
          temporalClassification: 'unknown',
          processingTimeMs: 0
        },
        duplicateAnalysis: {
          hasDuplicates: false, exactMatch: false, confidence: 0,
          message: 'Analysis failed', matches: [],
          temporalAnalysis: {
            isRecurring: false, expectedFrequency: null,
            lastOccurrence: null, withinExpectedWindow: false
          }
        },
        relevanceAnalysis: {
          overallScore: 0, warningLevel: 'error' as any,
          message: 'Analysis failed', indicators: [], suggestions: [],
          contextMatch: false, businessRelevance: 0, technicalQuality: 0
        },
        overallScore: 0,
        recommendedAction: 'reject',
        warnings: [{
          type: 'quality',
          severity: 'error',
          message: 'Document analysis failed - please try again',
          actionable: true
        }],
        suggestions: ['Try uploading the document again or contact support if the problem persists'],
        processingTimeMs: Date.now() - startTime,
        analysisTimestamp: new Date()
      };
    }
  }

  /**
   * Generate perceptual hash for image similarity detection
   */
  private async generatePerceptualHash(imageBuffer: Buffer): Promise<string> {
    try {
      // Convert to grayscale and resize to 8x8 for perceptual hashing
      const { data } = await sharp(imageBuffer)
        .greyscale()
        .resize(8, 8, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Calculate average pixel value
      const average = data.reduce((sum, pixel) => sum + pixel, 0) / data.length;

      // Generate hash by comparing each pixel to average
      let hash = '';
      for (let i = 0; i < data.length; i++) {
        hash += data[i] > average ? '1' : '0';
      }

      // Convert binary string to hex
      return parseInt(hash, 2).toString(16).padStart(16, '0');
    } catch (error) {
      console.warn('Failed to generate perceptual hash:', error);
      return '';
    }
  }

  /**
   * Calculate overall document intelligence score
   */
  private calculateOverallScore(
    contentAnalysis: DocumentContentAnalysis,
    duplicateAnalysis: DuplicateDetectionResult,
    relevanceAnalysis: RelevanceAnalysisResult,
    options: DocumentIntelligenceOptions
  ): number {
    let score = 0.5; // Base score

    // Content quality contribution (0.3 weight)
    if (options.enableContentAnalysis !== false) {
      score += (contentAnalysis.confidence * 0.3);
    }

    // Relevance contribution (0.4 weight)
    if (options.enableRelevanceAnalysis !== false) {
      score += (relevanceAnalysis.overallScore * 0.4);
    }

    // Duplicate penalty (can reduce score significantly)
    if (options.enableDuplicateDetection !== false && duplicateAnalysis.hasDuplicates) {
      if (duplicateAnalysis.exactMatch) {
        score -= 0.6; // Major penalty for exact duplicates
      } else if (duplicateAnalysis.highConfidence) {
        score -= 0.3; // Moderate penalty for likely duplicates
      } else {
        score -= 0.1; // Minor penalty for possible duplicates
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Determine recommended action based on analysis results
   */
  private determineRecommendedAction(
    overallScore: number,
    duplicateAnalysis: DuplicateDetectionResult,
    relevanceAnalysis: RelevanceAnalysisResult,
    warnings: DocumentWarning[]
  ): 'accept' | 'warn' | 'reject' {
    // Check for critical issues first
    if (duplicateAnalysis.exactMatch) {
      return 'reject';
    }

    if (relevanceAnalysis.warningLevel === 'error') {
      return 'reject';
    }

    // Check for warnings that suggest rejection
    const errorWarnings = warnings.filter(w => w.severity === 'error');
    if (errorWarnings.length > 0) {
      return 'reject';
    }

    // Check for warnings that suggest caution
    const warningLevelWarnings = warnings.filter(w => w.severity === 'warning');
    if (warningLevelWarnings.length > 1 || overallScore < 0.4) {
      return 'warn';
    }

    if (duplicateAnalysis.hasDuplicates && duplicateAnalysis.highConfidence) {
      return 'warn';
    }

    if (relevanceAnalysis.warningLevel === 'warning') {
      return 'warn';
    }

    // Default to accept if no major issues
    return 'accept';
  }

  /**
   * Add security-related warnings
   */
  private async addSecurityWarnings(
    fileBuffer: Buffer,
    fileInfo: FileInfo,
    warnings: DocumentWarning[],
    suggestions: string[]
  ): Promise<void> {
    try {
      // Check file size limits
      const maxSizeBytes = 50 * 1024 * 1024; // 50MB
      if (fileInfo.size > maxSizeBytes) {
        warnings.push({
          type: 'security',
          severity: 'warning',
          message: 'File size exceeds recommended limits',
          details: { size: fileInfo.size, maxSize: maxSizeBytes },
          actionable: true
        });
        suggestions.push('Consider compressing the document or splitting large files');
      }

      // Check for suspicious file extensions
      const suspiciousExtensions = ['.exe', '.bat', '.scr', '.com', '.cmd', '.pif'];
      if (suspiciousExtensions.some(ext => fileInfo.originalName.toLowerCase().endsWith(ext))) {
        warnings.push({
          type: 'security',
          severity: 'error',
          message: 'Executable file types are not allowed',
          actionable: true
        });
      }

      // Check for embedded scripts in PDFs (basic check)
      if (fileInfo.mimeType === 'application/pdf') {
        const pdfString = fileBuffer.toString('latin1');
        if (pdfString.includes('/JS') || pdfString.includes('/JavaScript')) {
          warnings.push({
            type: 'security',
            severity: 'warning',
            message: 'PDF contains JavaScript - proceed with caution',
            actionable: true
          });
        }
      }

      // Check for very small files that might be suspicious
      if (fileInfo.size < 100) {
        warnings.push({
          type: 'security',
          severity: 'info',
          message: 'File is very small and may not contain meaningful content',
          details: { size: fileInfo.size },
          actionable: true
        });
      }

    } catch (error) {
      console.warn('Security analysis error:', error);
    }
  }

  /**
   * Quick pre-upload analysis for real-time feedback
   */
  async quickAnalysis(
    fileBuffer: Buffer,
    fileInfo: FileInfo,
    context: DocumentContext,
    companyId: string,
    userId: string
  ): Promise<{
    canUpload: boolean;
    warnings: string[];
    suggestions: string[];
  }> {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Quick file validation
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (fileInfo.size > maxSize) {
        warnings.push('File size exceeds maximum allowed (50MB)');
        return { canUpload: false, warnings, suggestions };
      }

      // Check file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'text/plain', 'text/csv'
      ];

      if (!allowedTypes.includes(fileInfo.mimeType)) {
        warnings.push(`File type ${fileInfo.mimeType} is not supported`);
        suggestions.push('Please upload PDF, image, or text files only');
        return { canUpload: false, warnings, suggestions };
      }

      // Quick duplicate check by checksum only
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const quickDuplicateCheck = await this.duplicateDetector.quickDuplicateCheck(
        checksum,
        companyId,
        userId
      );

      if (quickDuplicateCheck.hasDuplicates) {
        warnings.push('A file with identical content was already uploaded');
        suggestions.push('Verify this is not a duplicate before proceeding');
      }

      return {
        canUpload: true,
        warnings,
        suggestions
      };

    } catch (error) {
      console.error('Quick analysis error:', error);
      return {
        canUpload: false,
        warnings: ['Unable to analyze file - please try again'],
        suggestions: ['Contact support if the problem persists']
      };
    }
  }
}

// Export default instance
export const documentIntelligenceOrchestrator = new DocumentIntelligenceOrchestrator();