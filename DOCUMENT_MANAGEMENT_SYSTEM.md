# Document Management System

## Overview

The INFOtrac Document Management System provides a comprehensive solution for document storage, organization, and intelligent naming across all modules. This system implements AI-powered smart naming, company-based isolation, permission controls, and robust audit trails.

## Key Features

### 🎯 Smart Document Naming
- **AI-Powered**: Automatically generates meaningful filenames based on document content
- **Template-Based**: Configurable naming patterns per document type and company
- **Confidence-Based**: Uses confidence scores to determine naming strategy
- **Fallback Support**: Graceful degradation for low-confidence scenarios

### 🏢 Company Isolation
- **Multi-Tenant**: Complete data isolation per company
- **Secure Access**: Document access restricted by company membership
- **Isolated Storage**: Physical/logical separation of document storage

### 🔐 Permission-Based Access Control
- **Granular Permissions**: Fine-grained access control per document action
- **Role Integration**: Seamless integration with existing permission system
- **Audit Trail**: Complete logging of all document access and modifications

### 📄 Multiple Storage Backends
- **Database Storage**: Small files stored directly in PostgreSQL
- **Filesystem Storage**: Larger files stored on local filesystem
- **S3 Ready**: Prepared for cloud storage integration

## Architecture

### Database Schema

#### Core Tables

**`documents`** - Central document repository
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    uploaded_by UUID NOT NULL,
    original_file_name VARCHAR(500) NOT NULL,
    smart_file_name VARCHAR(500),
    display_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_type storage_type DEFAULT 'database',
    document_category document_category DEFAULT 'other',
    ai_extracted_data JSONB DEFAULT '{}',
    naming_metadata JSONB DEFAULT '{}',
    naming_confidence DECIMAL(3,2) DEFAULT 0.00,
    checksum VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Additional fields for security, versioning, etc.
);
```

**`document_associations`** - Links documents to entities
```sql
CREATE TABLE document_associations (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    association_type VARCHAR(100) DEFAULT 'attachment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`document_naming_templates`** - Smart naming configuration
```sql
CREATE TABLE document_naming_templates (
    id UUID PRIMARY KEY,
    company_id UUID,
    document_type VARCHAR(100) NOT NULL,
    template_pattern VARCHAR(500) NOT NULL,
    date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true
);
```

### Backend Services

#### SmartDocumentNamingService
Handles intelligent document naming based on content analysis and templates.

**Key Methods:**
- `generateSmartName(data: DocumentNamingData): Promise<SmartNamingResult>`
- `applyTemplate(pattern: string, variables: Record<string, string>): string`
- `validateTemplate(pattern: string): Promise<{isValid: boolean; errors: string[]}>`

**Naming Examples:**
```typescript
// High confidence expense receipt
"Expense_Staples_2025-01-25_$45.99.pdf"

// Vendor invoice
"Invoice_INV2025-001_Microsoft_2025-01-25.pdf"

// Business card
"BusinessCard_JohnDoe_AcmeCorp_2025-01-25.jpg"

// Fallback (low confidence)
"Document_2025-01-25_HHmmss_abc123.pdf"
```

#### DocumentStorageService
Manages secure document storage with multiple backend support.

**Key Methods:**
- `storeDocument(fileBuffer: Buffer, fileName: string, options: DocumentUploadOptions): Promise<StoredDocument>`
- `getDocumentById(documentId: string, options?: DocumentRetrievalOptions): Promise<StoredDocument>`
- `getDocumentFileData(documentId: string): Promise<Buffer>`
- `listDocuments(options: ListOptions): Promise<{documents: StoredDocument[], total: number}>`

### API Endpoints

#### Document Upload
```http
POST /api/documents/upload
Content-Type: multipart/form-data

Form Data:
- document: File (required)
- documentCategory: string (optional)
- associatedEntityType: string (optional)
- associatedEntityId: UUID (optional)
- aiExtractedData: JSON (optional)
```

#### Document Download
```http
GET /api/documents/{id}/download
Authorization: Bearer {token}

Response: File with smart filename
```

#### Document Management
```http
# Get document info
GET /api/documents/{id}

# List documents
GET /api/documents?search=term&category=expense&limit=50&offset=0

# Rename document
PUT /api/documents/{id}/rename
Content-Type: application/json
{"smartFileName": "New_Name.pdf"}

# Delete document
DELETE /api/documents/{id}
```

### Frontend Integration

#### React Hook Usage
```typescript
import { useDocumentUpload } from '@/hooks/useDocumentUpload';

function ExpenseForm() {
  const {
    uploadDocument,
    uploadExpenseReceipt,
    isUploading,
    uploadProgress,
    uploadedDocument
  } = useDocumentUpload();

  const handleFileUpload = async (file: File, aiData: any) => {
    const document = await uploadExpenseReceipt(file, aiData, expenseId);
    if (document) {
      console.log(`Uploaded as: ${document.smartFileName}`);
    }
  };

  return (
    <div>
      {isUploading && (
        <div>Upload Progress: {uploadProgress?.percentage}%</div>
      )}
      {/* Upload UI */}
    </div>
  );
}
```

## Smart Naming System

### Template Variables

The smart naming system supports the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{type}` | Document type | "Expense", "Invoice" |
| `{vendor}` | Vendor/supplier name | "Amazon", "Microsoft" |
| `{date}` | Document date (YYYY-MM-DD) | "2025-01-25" |
| `{amount}` | Formatted amount | "$156.78", "€45.99" |
| `{number}` | Document number | "INV-2025-001" |
| `{contact}` | Contact person | "John_Doe" |
| `{company}` | Company name | "Acme_Corp" |

### Template Examples

```javascript
// Expense receipts
"{type}_{vendor}_{date}_{amount}"
// Output: "Expense_Staples_2025-01-25_$45.99.pdf"

// Invoices
"Invoice_{number}_{vendor}_{date}"
// Output: "Invoice_INV2025-001_Microsoft_2025-01-25.pdf"

// Contracts
"Contract_{contract_type}_{company}_{date}"
// Output: "Contract_ServiceAgreement_AcmeCorp_2025-01-25.pdf"
```

### Confidence Levels

- **High Confidence (≥80%)**: Use full template with all variables
- **Medium Confidence (30-79%)**: Use simplified template + timestamp
- **Low Confidence (<30%)**: Use fallback naming with hash

## Permission System

### Document Permissions

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `documents.view_own` | View own documents | user, admin, super-admin |
| `documents.view_all` | View all company documents | admin, super-admin |
| `documents.upload` | Upload new documents | user, admin, super-admin |
| `documents.download_own` | Download own documents | user, admin, super-admin |
| `documents.download_all` | Download all documents | admin, super-admin |
| `documents.delete_own` | Delete own documents | user, admin, super-admin |
| `documents.delete_all` | Delete any document | admin, super-admin |
| `documents.rename` | Rename documents | admin, super-admin |

### Access Control Logic

```typescript
// Document access is granted if:
// 1. User is super-admin (global access)
// 2. User is in same company as document
// 3. User owns the document OR has appropriate permission
// 4. User has access through entity associations (e.g., expense reviewer)

function checkDocumentAccess(documentId: string, userId: string, action: string) {
  // Implemented in database function check_document_access()
}
```

## Integration Points

### Expense Management
- Receipt uploads automatically use smart naming
- AI-extracted data informs filename generation
- Documents linked to expense records

### Vendor Management
- Invoice and contract uploads
- Business card processing
- Vendor information extraction for naming

### Customer Management
- Customer document uploads
- Contact information extraction
- Project document organization

### Future: Process Automation
- Email attachment processing
- Automated document classification
- Workflow-based document routing

## Configuration

### Environment Variables

```bash
# Document storage
DOCUMENT_STORAGE_PATH=./storage/documents
DOCUMENT_MAX_SIZE=50MB

# Database storage threshold
DOCUMENT_DB_MAX_SIZE=10MB

# File type restrictions
DOCUMENT_ALLOWED_TYPES=pdf,jpg,jpeg,png,gif,webp,doc,docx,xls,xlsx
```

### Company-Level Settings

Companies can customize:
- Naming templates per document type
- Date format preferences (MM-DD-YYYY vs DD-MM-YYYY)
- Currency format preferences
- Maximum filename length
- File type restrictions

## Security Features

### File Security
- **Type Validation**: Whitelist of allowed MIME types
- **Size Limits**: Configurable per role/module
- **Virus Scanning**: Ready for integration
- **Checksum Verification**: Duplicate detection and integrity checks

### Access Security
- **Company Isolation**: Strict tenant separation
- **Permission Validation**: Every access checked
- **Audit Logging**: Complete access trail
- **Token-Based**: Secure API access

### Storage Security
- **Encrypted Storage**: Option for file encryption
- **Secure Paths**: Prevention of path traversal attacks
- **Access Logs**: All file access logged
- **Rate Limiting**: Upload rate restrictions

## Monitoring & Analytics

### Audit Trail
All document operations are logged:
- Upload, view, download, rename, delete
- User identification and timestamps
- IP addresses and user agents
- Success/failure status

### Usage Analytics
- Storage usage per company
- Document type distribution
- Naming confidence trends
- Access pattern analysis

## Migration Strategy

### Existing Documents
For systems with existing document references:

1. **Inventory Phase**: Identify all current document storage
2. **Migration Script**: Batch import existing documents
3. **Smart Naming**: Generate intelligent names retroactively
4. **Reference Updates**: Update foreign keys to new system
5. **Validation**: Ensure no data loss

### Example Migration
```sql
-- Migrate expense receipts
INSERT INTO documents (company_id, uploaded_by, original_file_name, ...)
SELECT company_id, submitted_by, receipt_file_name, ...
FROM expenses
WHERE receipt_file_name IS NOT NULL;

-- Create associations
INSERT INTO document_associations (document_id, entity_type, entity_id)
SELECT d.id, 'expense', e.id
FROM documents d
JOIN expenses e ON d.original_file_name = e.receipt_file_name;
```

## Development Guidelines

### Adding New Document Types

1. **Update Enum**: Add to `document_category` enum
2. **Create Template**: Add default naming template
3. **Update Service**: Add extraction logic for document type
4. **Test Integration**: Verify naming and storage

### Custom Templates

```sql
INSERT INTO document_naming_templates (
  company_id, document_type, template_pattern, description
) VALUES (
  'company-uuid', 'custom_report',
  'Report_{report_type}_{period}_{date}',
  'Custom report naming pattern'
);
```

### Frontend Components

When creating document upload components:

1. Use `useDocumentUpload` hook
2. Implement progress tracking
3. Show smart name preview
4. Handle error states gracefully
5. Provide manual rename option

## Troubleshooting

### Common Issues

**Upload Failures:**
- Check file type allowlist
- Verify file size limits
- Ensure user has upload permission
- Check storage space

**Naming Issues:**
- Review AI extraction confidence
- Check template variable availability
- Verify template syntax
- Examine fallback logic

**Permission Denied:**
- Verify user company membership
- Check specific document permissions
- Review entity association permissions
- Validate token/session

### Debug Tools

```sql
-- Check document permissions
SELECT check_document_access('doc-uuid', 'user-uuid', 'view');

-- Review naming metadata
SELECT naming_metadata, naming_confidence
FROM documents WHERE id = 'doc-uuid';

-- Audit access logs
SELECT * FROM document_access_logs
WHERE document_id = 'doc-uuid'
ORDER BY timestamp DESC;
```

## Future Enhancements

### Planned Features
- **Version Control**: Document versioning and history
- **Collaboration**: Comment and review systems
- **Advanced Search**: Full-text content search
- **Automated Workflows**: Rule-based document routing
- **Integration APIs**: Third-party system connectors

### Performance Optimizations
- **CDN Integration**: Global document delivery
- **Compression**: Automatic file compression
- **Caching**: Intelligent document caching
- **Parallel Processing**: Batch operations

## Support

### Documentation
- API Reference: `/api/documents` endpoints
- Database Schema: `database/init/06-document-management.sql`
- Frontend Hooks: `src/hooks/useDocumentUpload.ts`

### Monitoring
- Health Check: `/health/documents`
- Metrics: Storage usage, upload rates, error rates
- Alerts: Failed uploads, storage limits, security events

This document management system provides a solid foundation for current needs while being extensible for future requirements. The smart naming feature ensures documents are always professionally organized, while the robust permission system maintains security and compliance.