/**
 * Document Management API Routes
 *
 * RESTful API for document upload, retrieval, and management with
 * smart naming, permission checks, and company isolation.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { body, query, param, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, requireCompany, hasPermission } from '@/middleware/auth';
import { asyncHandler, validationError, databaseError, notFoundError, forbiddenError } from '@/middleware/errorHandler';
import { DocumentStorageService } from '@/services/documentStorage';
import { documentIntelligenceOrchestrator, DocumentIntelligenceOptions } from '@/services/documentIntelligenceOrchestrator';
import { DocumentContext } from '@/services/documentRelevanceAnalysis';
import rateLimit from 'express-rate-limit';

const router = Router();
const documentStorage = new DocumentStorageService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow common document and image types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Rate limiting for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 uploads per windowMs
  message: { error: 'Too many uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// =====================================================
// Document Upload
// =====================================================

router.post('/upload',
  uploadLimiter,
  requireCompany,
  hasPermission('documents.upload'),
  upload.single('document'),
  [
    body('documentCategory').optional().isIn([
      'expense', 'invoice', 'receipt', 'contract', 'report',
      'business_card', 'email', 'statement', 'purchase_order', 'quote', 'other'
    ]),
    body('associatedEntityType').optional().isString().isLength({ max: 100 }),
    body('associatedEntityId').optional().isUUID(),
    body('associationType').optional().isString().isLength({ max: 100 }),
    body('aiExtractedData').optional().isJSON(),
    body('storageType').optional().isIn(['database', 'filesystem', 's3'])
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    if (!req.file) {
      throw validationError('No file uploaded');
    }

    const {
      documentCategory,
      associatedEntityType,
      associatedEntityId,
      associationType,
      aiExtractedData,
      storageType
    } = req.body;

    // Parse AI extracted data if provided
    let parsedAiData = {};
    if (aiExtractedData) {
      try {
        parsedAiData = JSON.parse(aiExtractedData);
      } catch (error) {
        throw validationError('Invalid aiExtractedData JSON');
      }
    }

    // Store document
    const storedDocument = await documentStorage.storeDocument(
      req.file.buffer,
      req.file.originalname,
      {
        companyId: req.user!.company_id!,
        uploadedBy: req.user!.id!,
        documentCategory,
        aiExtractedData: parsedAiData,
        storageType,
        associatedEntity: associatedEntityType && associatedEntityId ? {
          type: associatedEntityType,
          id: associatedEntityId,
          associationType
        } : undefined
      }
    );

    res.status(201).json({
      success: true,
      data: {
        document: storedDocument,
        message: `Document uploaded successfully as "${storedDocument.smartFileName}"`
      }
    });
  })
);

// =====================================================
// Get Document by ID
// =====================================================

router.get('/:id',
  requireCompany,
  [param('id').isUUID()],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check document access permission
    const hasAccess = await checkDocumentAccess(req.params.id, req.user!.id!, 'view');
    if (!hasAccess) {
      throw forbiddenError('Access denied to this document');
    }

    const document = await documentStorage.getDocumentById(req.params.id, {
      logAccess: true,
      userId: req.user!.id!,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: { document }
    });
  })
);

// =====================================================
// Download Document
// =====================================================

router.get('/:id/download',
  requireCompany,
  [param('id').isUUID()],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check document access permission
    const hasAccess = await checkDocumentAccess(req.params.id, req.user!.id!, 'download');
    if (!hasAccess) {
      throw forbiddenError('Access denied to this document');
    }

    const document = await documentStorage.getDocumentById(req.params.id);
    const fileData = await documentStorage.getDocumentFileData(req.params.id);

    // Log download access
    await db.query(`
      INSERT INTO document_access_logs (document_id, accessed_by, action, ip_address, user_agent)
      VALUES ($1, $2, 'download', $3, $4)
    `, [req.params.id, req.user!.id!, req.ip, req.get('User-Agent')]);

    // Set response headers for download
    res.setHeader('Content-Type', document.fileType);
    res.setHeader('Content-Length', document.fileSize);
    res.setHeader('Content-Disposition', `attachment; filename="${document.smartFileName}"`);

    res.send(fileData);
  })
);

// =====================================================
// List Documents
// =====================================================

router.get('/',
  requireCompany,
  hasPermission('documents.view_own'),
  [
    query('uploadedBy').optional().isUUID(),
    query('documentCategory').optional().isString(),
    query('associatedEntityType').optional().isString(),
    query('associatedEntityId').optional().isUUID(),
    query('search').optional().isString().isLength({ max: 255 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check if user can view all documents or just their own
    const canViewAll = await hasDocumentPermission(req.user!.id!, 'documents.view_all');

    const options = {
      companyId: req.user!.company_id!,
      uploadedBy: canViewAll ? req.query.uploadedBy as string : req.user!.id!,
      documentCategory: req.query.documentCategory as string,
      associatedEntityType: req.query.associatedEntityType as string,
      associatedEntityId: req.query.associatedEntityId as string,
      search: req.query.search as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };

    const result = await documentStorage.listDocuments(options);

    res.json({
      success: true,
      data: {
        documents: result.documents,
        pagination: {
          total: result.total,
          limit: options.limit,
          offset: options.offset,
          hasMore: (options.offset + options.limit) < result.total
        }
      }
    });
  })
);

// =====================================================
// Update Document Name
// =====================================================

router.put('/:id/rename',
  requireCompany,
  hasPermission('documents.rename'),
  [
    param('id').isUUID(),
    body('smartFileName').isString().isLength({ min: 1, max: 500 })
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check document access permission
    const hasAccess = await checkDocumentAccess(req.params.id, req.user!.id!, 'rename');
    if (!hasAccess) {
      throw forbiddenError('Access denied to rename this document');
    }

    await documentStorage.updateSmartName(
      req.params.id,
      req.body.smartFileName,
      req.user!.id!
    );

    const updatedDocument = await documentStorage.getDocumentById(req.params.id);

    res.json({
      success: true,
      data: {
        document: updatedDocument,
        message: 'Document renamed successfully'
      }
    });
  })
);

// =====================================================
// Regenerate Smart Name
// =====================================================

router.post('/:id/regenerate-name',
  requireCompany,
  hasPermission('documents.rename'),
  [
    param('id').isUUID(),
    body('aiExtractedData').optional().isJSON()
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check document access permission
    const hasAccess = await checkDocumentAccess(req.params.id, req.user!.id!, 'rename');
    if (!hasAccess) {
      throw forbiddenError('Access denied to rename this document');
    }

    const document = await documentStorage.getDocumentById(req.params.id);

    // Parse new AI data if provided
    let newAiData = document.aiExtractedData;
    if (req.body.aiExtractedData) {
      try {
        newAiData = JSON.parse(req.body.aiExtractedData);
      } catch (error) {
        throw validationError('Invalid aiExtractedData JSON');
      }
    }

    // TODO: Implement smart name regeneration
    // This would involve recreating the naming data and calling the naming service

    res.json({
      success: true,
      data: {
        message: 'Smart name regeneration feature coming soon'
      }
    });
  })
);

// =====================================================
// Delete Document
// =====================================================

router.delete('/:id',
  requireCompany,
  [param('id').isUUID()],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check document access permission
    const hasAccess = await checkDocumentAccess(req.params.id, req.user!.id!, 'delete');
    if (!hasAccess) {
      throw forbiddenError('Access denied to delete this document');
    }

    await documentStorage.deleteDocument(req.params.id, req.user!.id!);

    res.json({
      success: true,
      data: {
        message: 'Document deleted successfully'
      }
    });
  })
);

// =====================================================
// Get Document Associations
// =====================================================

router.get('/:id/associations',
  requireCompany,
  [param('id').isUUID()],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check document access permission
    const hasAccess = await checkDocumentAccess(req.params.id, req.user!.id!, 'view');
    if (!hasAccess) {
      throw forbiddenError('Access denied to this document');
    }

    const result = await db.query(`
      SELECT da.*, p.first_name, p.last_name
      FROM document_associations da
      LEFT JOIN profiles p ON da.created_by = p.user_id
      WHERE da.document_id = $1
      ORDER BY da.created_at DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        associations: result.rows.map(row => ({
          id: row.id,
          entityType: row.entity_type,
          entityId: row.entity_id,
          associationType: row.association_type,
          associationMetadata: row.association_metadata,
          createdAt: row.created_at,
          createdBy: {
            id: row.created_by,
            name: `${row.first_name} ${row.last_name}`.trim()
          }
        }))
      }
    });
  })
);

// =====================================================
// Get Document Access Logs (Audit Trail)
// =====================================================

router.get('/:id/access-logs',
  requireCompany,
  hasPermission('documents.view_all'),
  [
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await db.query(`
      SELECT dal.*, p.first_name, p.last_name
      FROM document_access_logs dal
      LEFT JOIN profiles p ON dal.accessed_by = p.user_id
      WHERE dal.document_id = $1
      ORDER BY dal.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [req.params.id, limit, offset]);

    res.json({
      success: true,
      data: {
        accessLogs: result.rows.map(row => ({
          id: row.id,
          action: row.action,
          actionDetails: row.action_details,
          timestamp: row.timestamp,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          success: row.success,
          errorMessage: row.error_message,
          user: {
            id: row.accessed_by,
            name: `${row.first_name} ${row.last_name}`.trim()
          }
        })),
        pagination: { limit, offset }
      }
    });
  })
);

// =====================================================
// Document Intelligence Analysis
// =====================================================

/**
 * Pre-upload Analysis - Quick analysis for real-time feedback
 */
router.post('/analyze/pre-upload',
  uploadLimiter,
  requireCompany,
  hasPermission('documents.upload'),
  upload.single('document'),
  [
    body('context').isIn(['expense_receipt', 'vendor_document', 'customer_document', 'business_card', 'invoice', 'contract', 'generic_business'])
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    if (!req.file) {
      throw validationError('No file uploaded for analysis');
    }

    const context = req.body.context as DocumentContext;

    // Quick pre-upload analysis
    const analysisResult = await documentIntelligenceOrchestrator.quickAnalysis(
      req.file.buffer,
      {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        extension: req.file.originalname.split('.').pop() || ''
      },
      context,
      req.user!.company_id!,
      req.user!.id!
    );

    res.json({
      success: true,
      data: {
        analysis: analysisResult,
        recommendations: {
          shouldUpload: analysisResult.canUpload,
          warnings: analysisResult.warnings,
          suggestions: analysisResult.suggestions
        }
      }
    });
  })
);

/**
 * Full Document Analysis - Comprehensive intelligence analysis
 */
router.post('/analyze/full',
  uploadLimiter,
  requireCompany,
  hasPermission('documents.upload'),
  upload.single('document'),
  [
    body('context').isIn(['expense_receipt', 'vendor_document', 'customer_document', 'business_card', 'invoice', 'contract', 'generic_business']),
    body('enableDuplicateDetection').optional().isBoolean(),
    body('enableRelevanceAnalysis').optional().isBoolean(),
    body('enableContentAnalysis').optional().isBoolean(),
    body('duplicateScope').optional().isIn(['company', 'user']),
    body('temporalToleranceDays').optional().isInt({ min: 1, max: 365 }),
    body('strictRelevance').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    if (!req.file) {
      throw validationError('No file uploaded for analysis');
    }

    const options: DocumentIntelligenceOptions = {
      context: req.body.context as DocumentContext,
      companyId: req.user!.company_id!,
      userId: req.user!.id!,
      enableDuplicateDetection: req.body.enableDuplicateDetection !== false,
      enableRelevanceAnalysis: req.body.enableRelevanceAnalysis !== false,
      enableContentAnalysis: req.body.enableContentAnalysis !== false,
      duplicateScope: req.body.duplicateScope || 'company',
      temporalToleranceDays: req.body.temporalToleranceDays || 30,
      strictRelevance: req.body.strictRelevance || false
    };

    // Comprehensive analysis
    const analysisResult = await documentIntelligenceOrchestrator.analyzeDocument(
      req.file.buffer,
      {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        extension: req.file.originalname.split('.').pop() || ''
      },
      options
    );

    res.json({
      success: true,
      data: {
        analysis: analysisResult,
        performance: {
          processingTime: analysisResult.processingTimeMs,
          analysisTimestamp: analysisResult.analysisTimestamp
        }
      }
    });
  })
);

/**
 * Analyze Existing Document - Re-analyze uploaded document
 */
router.post('/:id/analyze',
  requireCompany,
  hasPermission('documents.view_own'),
  [
    param('id').isUUID(),
    body('context').isIn(['expense_receipt', 'vendor_document', 'customer_document', 'business_card', 'invoice', 'contract', 'generic_business']),
    body('enableDuplicateDetection').optional().isBoolean(),
    body('enableRelevanceAnalysis').optional().isBoolean(),
    body('enableContentAnalysis').optional().isBoolean(),
    body('duplicateScope').optional().isIn(['company', 'user']),
    body('temporalToleranceDays').optional().isInt({ min: 1, max: 365 }),
    body('strictRelevance').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check document access permission
    const hasAccess = await checkDocumentAccess(req.params.id, req.user!.id!, 'view');
    if (!hasAccess) {
      throw forbiddenError('Access denied to analyze this document');
    }

    // Get document and file data
    const document = await documentStorage.getDocumentById(req.params.id);
    const fileData = await documentStorage.getDocumentFileData(req.params.id);

    const options: DocumentIntelligenceOptions = {
      context: req.body.context as DocumentContext,
      companyId: req.user!.company_id!,
      userId: req.user!.id!,
      enableDuplicateDetection: req.body.enableDuplicateDetection !== false,
      enableRelevanceAnalysis: req.body.enableRelevanceAnalysis !== false,
      enableContentAnalysis: req.body.enableContentAnalysis !== false,
      duplicateScope: req.body.duplicateScope || 'company',
      temporalToleranceDays: req.body.temporalToleranceDays || 30,
      strictRelevance: req.body.strictRelevance || false
    };

    // Comprehensive re-analysis
    const analysisResult = await documentIntelligenceOrchestrator.analyzeDocument(
      fileData,
      {
        originalName: document.originalFileName,
        mimeType: document.fileType,
        size: document.fileSize,
        extension: document.originalFileName.split('.').pop() || ''
      },
      options
    );

    // Update document with new analysis results
    await db.query(`
      UPDATE documents
      SET
        content_analysis = $2,
        relevance_score = $3,
        duplicate_analysis = $4,
        perceptual_hash = $5,
        updated_at = NOW()
      WHERE id = $1
    `, [
      req.params.id,
      JSON.stringify(analysisResult.contentAnalysis),
      analysisResult.relevanceAnalysis.overallScore,
      JSON.stringify(analysisResult.duplicateAnalysis),
      analysisResult.perceptualHash
    ]);

    res.json({
      success: true,
      data: {
        document: {
          id: document.id,
          smartFileName: document.smartFileName,
          originalFileName: document.originalFileName
        },
        analysis: analysisResult,
        message: 'Document re-analyzed and updated successfully'
      }
    });
  })
);

/**
 * Get Document Analysis Results - Retrieve stored analysis
 */
router.get('/:id/analysis',
  requireCompany,
  [param('id').isUUID()],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    // Check document access permission
    const hasAccess = await checkDocumentAccess(req.params.id, req.user!.id!, 'view');
    if (!hasAccess) {
      throw forbiddenError('Access denied to this document analysis');
    }

    const result = await db.query(`
      SELECT
        id,
        smart_file_name,
        original_file_name,
        file_type,
        file_size,
        checksum,
        perceptual_hash,
        content_analysis,
        relevance_score,
        duplicate_analysis,
        temporal_classification,
        created_at,
        updated_at
      FROM documents
      WHERE id = $1 AND company_id = $2
    `, [req.params.id, req.user!.company_id!]);

    if (result.rows.length === 0) {
      throw notFoundError('Document not found');
    }

    const document = result.rows[0];

    res.json({
      success: true,
      data: {
        document: {
          id: document.id,
          smartFileName: document.smart_file_name,
          originalFileName: document.original_file_name,
          fileType: document.file_type,
          fileSize: document.file_size,
          checksum: document.checksum,
          perceptualHash: document.perceptual_hash,
          relevanceScore: document.relevance_score,
          temporalClassification: document.temporal_classification,
          createdAt: document.created_at,
          updatedAt: document.updated_at
        },
        analysis: {
          contentAnalysis: document.content_analysis,
          duplicateAnalysis: document.duplicate_analysis,
          hasAnalysis: !!(document.content_analysis || document.duplicate_analysis)
        }
      }
    });
  })
);

/**
 * Bulk Duplicate Detection - Find duplicates across multiple files
 */
router.post('/analyze/duplicates',
  requireCompany,
  hasPermission('documents.view_own'),
  [
    body('documentIds').isArray().custom((value) => {
      if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
        throw new Error('documentIds must be an array with 1-20 document IDs');
      }
      return value.every((id: any) => typeof id === 'string');
    }),
    body('includeArchived').optional().isBoolean(),
    body('temporalToleranceDays').optional().isInt({ min: 1, max: 365 })
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const documentIds: string[] = req.body.documentIds;
    const includeArchived = req.body.includeArchived || false;
    const temporalToleranceDays = req.body.temporalToleranceDays || 30;

    // Verify user has access to all requested documents
    const accessChecks = await Promise.all(
      documentIds.map(id => checkDocumentAccess(id, req.user!.id!, 'view'))
    );

    if (accessChecks.some(hasAccess => !hasAccess)) {
      throw forbiddenError('Access denied to one or more documents');
    }

    // Get documents data
    const documentsResult = await db.query(`
      SELECT
        id,
        checksum,
        perceptual_hash,
        content_analysis,
        smart_file_name,
        file_size,
        created_at
      FROM documents
      WHERE id = ANY($1)
        AND company_id = $2
        ${!includeArchived ? 'AND NOT is_deleted' : ''}
    `, [documentIds, req.user!.company_id!]);

    const duplicateResults = [];

    // Check each document for duplicates
    for (const doc of documentsResult.rows) {
      // Find potential duplicates based on checksum and perceptual hash
      const duplicatesQuery = await db.query(`
        SELECT
          id,
          smart_file_name,
          checksum,
          perceptual_hash,
          file_size,
          created_at,
          CASE
            WHEN checksum = $1 THEN 'exact'
            WHEN perceptual_hash IS NOT NULL AND perceptual_hash = $2 THEN 'visual'
            ELSE 'content'
          END as match_type
        FROM documents
        WHERE company_id = $3
          AND id != $4
          AND (
            checksum = $1
            OR (perceptual_hash IS NOT NULL AND perceptual_hash = $2)
          )
          ${!includeArchived ? 'AND NOT is_deleted' : ''}
        ORDER BY created_at DESC
      `, [doc.checksum, doc.perceptual_hash, req.user!.company_id!, doc.id]);

      if (duplicatesQuery.rows.length > 0) {
        duplicateResults.push({
          document: {
            id: doc.id,
            smartFileName: doc.smart_file_name,
            fileSize: doc.file_size,
            createdAt: doc.created_at
          },
          duplicates: duplicatesQuery.rows.map(dup => ({
            id: dup.id,
            smartFileName: dup.smart_file_name,
            fileSize: dup.file_size,
            createdAt: dup.created_at,
            matchType: dup.match_type,
            confidence: dup.match_type === 'exact' ? 1.0 : 0.8
          }))
        });
      }
    }

    res.json({
      success: true,
      data: {
        duplicateResults,
        summary: {
          documentsAnalyzed: documentIds.length,
          documentsWithDuplicates: duplicateResults.length,
          totalDuplicatesFound: duplicateResults.reduce((sum, result) => sum + result.duplicates.length, 0)
        }
      }
    });
  })
);

// =====================================================
// Helper Functions
// =====================================================

/**
 * Check if user has access to document
 */
async function checkDocumentAccess(
  documentId: string,
  userId: string,
  action: string = 'view'
): Promise<boolean> {
  const result = await db.query(
    'SELECT check_document_access($1, $2, $3) as has_access',
    [documentId, userId, action]
  );

  return result.rows[0]?.has_access || false;
}

/**
 * Check if user has specific document permission
 */
async function hasDocumentPermission(userId: string, permission: string): Promise<boolean> {
  const result = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN profiles p ON up.user_id = p.user_id
      WHERE up.user_id = $1
        AND up.permission_name = $2
        AND up.is_granted = true
        AND (p.role = 'super-admin' OR up.permission_name = $2)
    ) as has_permission
  `, [userId, permission]);

  return result.rows[0]?.has_permission || false;
}

export default router;