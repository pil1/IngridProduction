/**
 * Document Storage Service
 *
 * Handles secure document storage with multiple backend support:
 * - Database storage (default for smaller files)
 * - Filesystem storage (local files)
 * - S3 storage (future cloud storage)
 */

import { db } from '@/config/database';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { SmartDocumentNamingService, DocumentNamingData } from './smartDocumentNaming';

export interface StoredDocument {
  id: string;
  companyId: string;
  uploadedBy: string;
  originalFileName: string;
  smartFileName: string;
  displayName: string;
  fileType: string;
  fileSize: number;
  fileExtension: string;
  storageType: 'database' | 'filesystem' | 's3';
  storagePath: string;
  documentCategory: string;
  checksum: string;
  namingConfidence: number;
  aiExtractedData: Record<string, any>;
  namingMetadata: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface DocumentUploadOptions {
  companyId: string;
  uploadedBy: string;
  aiExtractedData?: Record<string, any>;
  documentCategory?: string;
  associatedEntity?: {
    type: string;
    id: string;
    associationType?: string;
  };
  storageType?: 'database' | 'filesystem' | 's3';
}

export interface DocumentRetrievalOptions {
  includeFileData?: boolean;
  logAccess?: boolean;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class DocumentStorageService {
  private namingService: SmartDocumentNamingService;
  private readonly STORAGE_BASE_PATH = process.env.DOCUMENT_STORAGE_PATH || './storage/documents';
  private readonly MAX_DATABASE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly CHECKSUM_ALGORITHM = 'sha256';

  constructor() {
    this.namingService = new SmartDocumentNamingService();
    this.ensureStorageDirectories();
  }

  /**
   * Store a document with smart naming and company isolation
   */
  async storeDocument(
    fileBuffer: Buffer,
    originalFileName: string,
    options: DocumentUploadOptions
  ): Promise<StoredDocument> {
    const fileExtension = path.extname(originalFileName).toLowerCase().substring(1);
    const fileType = this.getMimeTypeFromExtension(fileExtension);
    const checksum = this.calculateChecksum(fileBuffer);

    // Check for duplicate by checksum within company
    const existingDoc = await this.findDocumentByChecksum(checksum, options.companyId);
    if (existingDoc) {
      throw new Error('Document already exists with the same content');
    }

    // Prepare naming data
    const namingData: DocumentNamingData = {
      originalFileName,
      fileExtension,
      documentType: options.documentCategory || this.inferDocumentType(originalFileName, fileType),
      companyId: options.companyId,
      userId: options.uploadedBy,
      overallConfidence: options.aiExtractedData?.confidence || 0,
      dataConfidence: options.aiExtractedData?.confidences || {},
      ...this.extractNamingDataFromAI(options.aiExtractedData || {}),
    };

    if (options.associatedEntity) {
      namingData.associatedEntityType = options.associatedEntity.type;
      namingData.associatedEntityId = options.associatedEntity.id;
    }

    // Generate smart name
    const smartNaming = await this.namingService.generateSmartName(namingData);

    // Determine storage type
    const storageType = options.storageType || this.determineStorageType(fileBuffer.length);

    // Store file data
    const storagePath = await this.storeFileData(
      fileBuffer,
      smartNaming.smartFileName,
      options.companyId,
      storageType
    );

    // Insert document record
    const documentId = crypto.randomUUID();
    await db.query(`
      INSERT INTO documents (
        id, company_id, uploaded_by, original_file_name, smart_file_name,
        display_name, file_type, file_size, file_extension, storage_type,
        storage_path, document_category, ai_extracted_data, naming_metadata,
        metadata, naming_confidence, checksum, file_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      documentId,
      options.companyId,
      options.uploadedBy,
      originalFileName,
      smartNaming.smartFileName,
      smartNaming.displayName,
      fileType,
      fileBuffer.length,
      fileExtension,
      storageType,
      storagePath,
      options.documentCategory || 'other',
      JSON.stringify(options.aiExtractedData || {}),
      JSON.stringify(smartNaming.metadata),
      JSON.stringify(options),
      smartNaming.confidence,
      checksum,
      storageType === 'database' ? fileBuffer : null
    ]);

    // Create association if provided
    if (options.associatedEntity) {
      await this.createDocumentAssociation(
        documentId,
        options.associatedEntity.type,
        options.associatedEntity.id,
        options.associatedEntity.associationType || 'attachment',
        options.uploadedBy
      );
    }

    // Log upload action
    await this.logDocumentAccess(
      documentId,
      options.uploadedBy,
      'upload',
      { smartNaming, storageType, fileSize: fileBuffer.length }
    );

    // Return stored document info
    return this.getDocumentById(documentId);
  }

  /**
   * Retrieve document by ID
   */
  async getDocumentById(
    documentId: string,
    options: DocumentRetrievalOptions = {}
  ): Promise<StoredDocument> {
    const selectFields = options.includeFileData
      ? '*'
      : `id, company_id, uploaded_by, original_file_name, smart_file_name,
         display_name, file_type, file_size, file_extension, storage_type,
         storage_path, document_category, ai_extracted_data, naming_metadata,
         metadata, naming_confidence, checksum, created_at, updated_at`;

    const result = await db.query(`
      SELECT ${selectFields}
      FROM documents
      WHERE id = $1 AND NOT is_deleted
    `, [documentId]);

    if (result.rows.length === 0) {
      throw new Error('Document not found');
    }

    const doc = result.rows[0];

    // Log access if requested
    if (options.logAccess && options.userId) {
      await this.logDocumentAccess(
        documentId,
        options.userId,
        'view',
        {
          ipAddress: options.ipAddress,
          userAgent: options.userAgent
        }
      );
    }

    return this.mapDatabaseRowToDocument(doc);
  }

  /**
   * Retrieve document file data
   */
  async getDocumentFileData(documentId: string): Promise<Buffer> {
    const doc = await this.getDocumentById(documentId, { includeFileData: true });

    if (doc.storageType === 'database') {
      const result = await db.query('SELECT file_data FROM documents WHERE id = $1', [documentId]);
      if (result.rows[0]?.file_data) {
        return Buffer.from(result.rows[0].file_data);
      }
    } else if (doc.storageType === 'filesystem') {
      return await fs.readFile(doc.storagePath);
    }

    throw new Error('File data not available');
  }

  /**
   * List documents for a company with pagination and filtering
   */
  async listDocuments(options: {
    companyId: string;
    uploadedBy?: string;
    documentCategory?: string;
    associatedEntityType?: string;
    associatedEntityId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ documents: StoredDocument[]; total: number }> {
    let whereConditions = ['d.company_id = $1', 'NOT d.is_deleted'];
    let queryParams: any[] = [options.companyId];
    let paramIndex = 2;

    if (options.uploadedBy) {
      whereConditions.push(`d.uploaded_by = $${paramIndex++}`);
      queryParams.push(options.uploadedBy);
    }

    if (options.documentCategory) {
      whereConditions.push(`d.document_category = $${paramIndex++}`);
      queryParams.push(options.documentCategory);
    }

    if (options.search) {
      whereConditions.push(`(
        d.smart_file_name ILIKE $${paramIndex} OR
        d.original_file_name ILIKE $${paramIndex} OR
        d.display_name ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${options.search}%`);
      paramIndex++;
    }

    // Add association filter if specified
    let joinClause = '';
    if (options.associatedEntityType) {
      joinClause = 'INNER JOIN document_associations da ON d.id = da.document_id';
      whereConditions.push(`da.entity_type = $${paramIndex++}`);
      queryParams.push(options.associatedEntityType);

      if (options.associatedEntityId) {
        whereConditions.push(`da.entity_id = $${paramIndex++}`);
        queryParams.push(options.associatedEntityId);
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(DISTINCT d.id) as total
      FROM documents d
      ${joinClause}
      WHERE ${whereClause}
    `, queryParams);

    const total = parseInt(countResult.rows[0].total);

    // Get documents with pagination
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const documentsResult = await db.query(`
      SELECT DISTINCT d.id, d.company_id, d.uploaded_by, d.original_file_name,
             d.smart_file_name, d.display_name, d.file_type, d.file_size,
             d.file_extension, d.storage_type, d.storage_path, d.document_category,
             d.ai_extracted_data, d.naming_metadata, d.metadata, d.naming_confidence,
             d.checksum, d.created_at, d.updated_at
      FROM documents d
      ${joinClause}
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);

    const documents = documentsResult.rows.map(row => this.mapDatabaseRowToDocument(row));

    return { documents, total };
  }

  /**
   * Delete document (soft delete)
   */
  async deleteDocument(documentId: string, deletedBy: string): Promise<void> {
    await db.transaction(async (client) => {
      // Soft delete document
      await client.query(`
        UPDATE documents
        SET is_deleted = true, deleted_at = NOW(), deleted_by = $2
        WHERE id = $1 AND NOT is_deleted
      `, [documentId, deletedBy]);

      // Log deletion
      await this.logDocumentAccess(
        documentId,
        deletedBy,
        'delete',
        { action: 'soft_delete' }
      );
    });
  }

  /**
   * Update document smart name
   */
  async updateSmartName(
    documentId: string,
    newSmartName: string,
    updatedBy: string
  ): Promise<void> {
    const oldName = await db.query(
      'SELECT smart_file_name FROM documents WHERE id = $1',
      [documentId]
    );

    await db.query(`
      UPDATE documents
      SET smart_file_name = $2, display_name = $2, updated_at = NOW()
      WHERE id = $1
    `, [documentId, newSmartName]);

    await this.logDocumentAccess(
      documentId,
      updatedBy,
      'rename',
      { oldName: oldName.rows[0]?.smart_file_name, newName: newSmartName }
    );
  }

  /**
   * Create document association
   */
  private async createDocumentAssociation(
    documentId: string,
    entityType: string,
    entityId: string,
    associationType: string,
    createdBy: string
  ): Promise<void> {
    await db.query(`
      INSERT INTO document_associations (document_id, entity_type, entity_id, association_type, created_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (document_id, entity_type, entity_id) DO UPDATE
      SET association_type = $4, created_by = $5
    `, [documentId, entityType, entityId, associationType, createdBy]);
  }

  /**
   * Store file data based on storage type
   */
  private async storeFileData(
    fileBuffer: Buffer,
    fileName: string,
    companyId: string,
    storageType: 'database' | 'filesystem' | 's3'
  ): Promise<string> {
    switch (storageType) {
      case 'database':
        return 'database'; // File data stored in database blob

      case 'filesystem':
        const companyDir = path.join(this.STORAGE_BASE_PATH, companyId);
        await fs.mkdir(companyDir, { recursive: true });

        const filePath = path.join(companyDir, fileName);
        await fs.writeFile(filePath, fileBuffer);
        return filePath;

      case 's3':
        // TODO: Implement S3 storage
        throw new Error('S3 storage not yet implemented');

      default:
        throw new Error(`Unknown storage type: ${storageType}`);
    }
  }

  /**
   * Determine appropriate storage type based on file size and company settings
   */
  private determineStorageType(fileSize: number): 'database' | 'filesystem' | 's3' {
    if (fileSize <= this.MAX_DATABASE_FILE_SIZE) {
      return 'database';
    }
    return 'filesystem';
  }

  /**
   * Calculate file checksum for duplicate detection
   */
  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash(this.CHECKSUM_ALGORITHM).update(buffer).digest('hex');
  }

  /**
   * Find document by checksum within company
   */
  private async findDocumentByChecksum(checksum: string, companyId: string): Promise<StoredDocument | null> {
    const result = await db.query(`
      SELECT id, company_id, uploaded_by, original_file_name, smart_file_name,
             display_name, file_type, file_size, file_extension, storage_type,
             storage_path, document_category, ai_extracted_data, naming_metadata,
             metadata, naming_confidence, checksum, created_at, updated_at
      FROM documents
      WHERE checksum = $1 AND company_id = $2 AND NOT is_deleted
    `, [checksum, companyId]);

    return result.rows.length > 0 ? this.mapDatabaseRowToDocument(result.rows[0]) : null;
  }

  /**
   * Extract naming data from AI extracted data
   */
  private extractNamingDataFromAI(aiData: Record<string, any>): Partial<DocumentNamingData> {
    return {
      vendor: aiData.vendor_name || aiData.vendor,
      merchant: aiData.merchant_name || aiData.merchant,
      amount: aiData.amount || aiData.total,
      currency: aiData.currency || aiData.currency_code,
      date: aiData.expense_date || aiData.date ? new Date(aiData.expense_date || aiData.date) : undefined,
      invoiceNumber: aiData.invoice_number,
      receiptNumber: aiData.receipt_number,
      contactName: aiData.contact_name,
      companyName: aiData.company_name,
      reportType: aiData.report_type,
      period: aiData.period,
      contractType: aiData.contract_type
    };
  }

  /**
   * Infer document type from filename and MIME type
   */
  private inferDocumentType(fileName: string, mimeType: string): string {
    const lowerFileName = fileName.toLowerCase();

    if (lowerFileName.includes('invoice')) return 'invoice';
    if (lowerFileName.includes('receipt')) return 'receipt';
    if (lowerFileName.includes('contract')) return 'contract';
    if (lowerFileName.includes('report')) return 'report';
    if (lowerFileName.includes('statement')) return 'statement';
    if (lowerFileName.includes('expense')) return 'expense';

    if (mimeType.startsWith('image/')) return 'receipt'; // Images are often receipts
    if (mimeType === 'application/pdf') return 'other'; // PDFs could be anything

    return 'other';
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'tiff': 'image/tiff',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'csv': 'text/csv'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Log document access for audit trail
   */
  private async logDocumentAccess(
    documentId: string,
    userId: string,
    action: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await db.query(`
      INSERT INTO document_access_logs (document_id, accessed_by, action, action_details)
      VALUES ($1, $2, $3, $4)
    `, [documentId, userId, action, JSON.stringify(details)]);
  }

  /**
   * Ensure storage directories exist
   */
  private async ensureStorageDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.STORAGE_BASE_PATH, { recursive: true });
    } catch (error) {
      console.warn('Failed to create storage directories:', error);
    }
  }

  /**
   * Map database row to StoredDocument interface
   */
  private mapDatabaseRowToDocument(row: any): StoredDocument {
    return {
      id: row.id,
      companyId: row.company_id,
      uploadedBy: row.uploaded_by,
      originalFileName: row.original_file_name,
      smartFileName: row.smart_file_name,
      displayName: row.display_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      fileExtension: row.file_extension,
      storageType: row.storage_type,
      storagePath: row.storage_path,
      documentCategory: row.document_category,
      checksum: row.checksum,
      namingConfidence: parseFloat(row.naming_confidence || '0'),
      aiExtractedData: row.ai_extracted_data || {},
      namingMetadata: row.naming_metadata || {},
      metadata: row.metadata || {},
      createdAt: row.created_at
    };
  }
}