# INFOtrac Development Guide

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- Git

### Setup Development Environment

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd infotrac
   npm install
   ```

2. **Start the development environment:**
   ```bash
   # One-command setup (recommended)
   npm run dev:setup

   # Or manually
   ./dev-setup.sh
   ```

3. **Start frontend development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3001
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

## 🏗️ Architecture Overview

### Development Stack
```
Frontend (Vite + React) → Backend (Node.js/Express) → PostgreSQL + Redis
         ↓                        ↓                       ↓
   Hot Reload Enabled      Docker Container      Docker Containers
```

### Services
- **Frontend**: React + TypeScript + Vite (hot reload on port 8080)
- **Backend**: Node.js + Express + TypeScript (hot reload in container)
- **Database**: PostgreSQL 15 (Docker container, persistent volumes)
- **Cache**: Redis 7 (Docker container, session storage and caching)
- **Authentication**: JWT-based (no external auth service)

## 📋 Development Commands

### Environment Management
```bash
# Setup development environment
npm run dev:setup          # Complete setup with containers

# Container management
npm run dev:start          # Start all containers
npm run dev:stop           # Stop all containers
npm run dev:restart        # Restart all containers
npm run dev:reset          # Reset everything (removes data!)

# Logs and monitoring
npm run dev:logs           # View all container logs
npm run dev:shell:backend  # Access backend container shell
npm run dev:shell:db       # Access PostgreSQL shell
```

### Database Operations
```bash
# Database status and connection
npm run db:status          # Check PostgreSQL connectivity

# Database backup
npm run db:backup          # Create timestamped backup file

# Manual database access
npm run dev:shell:db       # Direct PostgreSQL shell access
```

### Frontend Development
```bash
# Development server with hot reload
npm run dev                # Start Vite dev server

# Building and testing
npm run build              # Production build
npm run build:dev          # Development build
npm run preview            # Preview production build
npm run test               # Run tests
npm run type-check         # TypeScript checking
```

### Code Quality
```bash
# Linting and formatting
npm run lint               # ESLint checking
npm run lint:fix           # Auto-fix ESLint issues
npm run format             # Format with Prettier
npm run format:check       # Check formatting
```

## 🔧 Configuration Files

### Environment Files
- `.env.development` - Development environment variables
- `.env.example` - Template for production environment
- `.env.production.example` - Production template

### Docker Configuration
- `docker-compose.dev.yml` - Development containers
- `docker-compose.yml` - Production containers
- `backend/Dockerfile.dev` - Backend development image

### Key Environment Variables
```bash
# Development Database (Docker)
DATABASE_URL=postgresql://infotrac_user:infotrac_password@localhost:5432/infotrac
REDIS_URL=redis://localhost:6379

# Authentication (Development)
JWT_SECRET=dev-jwt-secret-key-change-for-production
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=8

# Frontend API Connection
VITE_API_URL=http://localhost:3001/api

# Optional: AI and Email
OPENAI_API_KEY=your-openai-key-here
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
```

## 🔄 Development Workflow

### 1. Daily Development
```bash
# Start your day
npm run dev:start          # Start all containers
npm run dev                # Start frontend dev server

# During development
npm run dev:logs           # Monitor container logs
npm run dev:shell:backend  # Debug backend issues
npm run dev:shell:db       # Check database directly
```

### 2. Making Changes
- **Frontend changes**: Automatic hot reload
- **Backend changes**: Automatic restart via nodemon
- **Database changes**: Add SQL files to `database/init/`

### 3. Testing Changes
```bash
# Run tests
npm run test

# Check types
npm run type-check

# Lint code
npm run lint
```

### 4. Resetting Environment
```bash
# If you need a clean slate
npm run dev:reset          # Removes all data and rebuilds
```

## 🗄️ Database Development

### Schema Management
- Initial schema: `database/init/01-schema.sql`
- Seed data: `database/init/05-seed-data.sql`
- Migrations are auto-applied on container startup

### Database Access
```bash
# Via npm script (recommended)
npm run dev:shell:db

# Direct Docker access
docker-compose -f docker-compose.dev.yml exec postgres psql -U infotrac_user -d infotrac
```

### Common Database Tasks
```sql
-- List all tables
\dt

-- Describe a table
\d profiles

-- Check running connections
SELECT * FROM pg_stat_activity;

-- View logs
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
```

## 🤖 Ingrid AI Assistant Interface

### Overview
The Professional Ingrid AI Chat Interface provides a comprehensive AI-powered workflow automation experience with a modern two-column layout.

### Key Features
- **Professional Chat Interface**: Real-time messaging with file upload support
- **Action Cards System**: AI-generated suggestions for expenses, vendors, and more
- **Permission-Based Access**: Enterprise-grade security with role-based controls
- **Two-Column Layout**: Resizable panels for optimal workspace organization
- **Session Analytics**: Real-time tracking of interactions and approvals

### Architecture

#### Main Components
```
src/pages/IngridAIPage.tsx                    # Main AI assistant page
├── src/components/ingrid/
│   ├── ProfessionalIngridChat.tsx           # Chat interface component
│   ├── IngridActionCards.tsx                # Action cards management
│   └── IngridAvatar.tsx                     # AI avatar component
└── src/hooks/use-user-menu-preferences.tsx  # Menu integration
```

#### Key Implementation Details

**Permission System:**
```typescript
// Requires both module access AND permissions
const canAccessIngrid = useCanAccessIngrid();
// Uses AI_PERMISSIONS.INGRID_VIEW for access control
```

**Two-Column Layout:**
```typescript
// Resizable panels with PanelGroup
<PanelGroup direction="horizontal">
  <Panel defaultSize={50} minSize={30}>
    <ProfessionalIngridChat />
  </Panel>
  <Panel defaultSize={50} minSize={30}>
    <IngridActionCards />
  </Panel>
</PanelGroup>
```

**Action Card Workflow:**
1. User interacts with chat or uploads documents
2. AI generates action cards with confidence scores
3. User can edit, approve, or reject suggestions
4. Approved actions are processed and tracked

### Development Notes

**Menu Integration:**
- Added "Ingrid AI Assistant" menu item with Bot icon
- Uses `AI_PERMISSIONS.INGRID_VIEW` for access control
- Route: `/ingrid-ai`

**Message Flow:**
```typescript
User Message → AI Processing → Response + Action Cards
     ↓              ↓                ↓
File Upload → Document Analysis → Structured Data
```

**Testing Checklist:**
- [ ] Chat interface loads and responds
- [ ] File uploads trigger processing
- [ ] Action cards generate correctly
- [ ] Permission checks work properly
- [ ] Mobile layout is responsive
- [ ] Session stats update in real-time

### Accessing the Interface

1. **Via Menu**: Look for "Ingrid AI Assistant" in the main navigation
2. **Direct URL**: Navigate to `/ingrid-ai`
3. **Permission Required**: Users need Ingrid AI module access and `INGRID_VIEW` permission

**Super Admin Access:**
Super admins have automatic access to all modules and can always access the interface.

**Regular User Access:**
Requires:
- Company has "Ingrid AI" module enabled
- User has been granted Ingrid AI permissions
- User is logged in with valid session

## 🚨 Troubleshooting

### Common Issues

#### 1. Containers won't start
```bash
# Check Docker is running
docker info

# View container logs
npm run dev:logs

# Reset everything
npm run dev:reset
```

#### 2. Database connection issues
```bash
# Check PostgreSQL health
npm run db:status

# Restart database container
docker-compose -f docker-compose.dev.yml restart postgres
```

#### 3. Backend API not responding
```bash
# Check backend logs
docker-compose -f docker-compose.dev.yml logs backend

# Restart backend
docker-compose -f docker-compose.dev.yml restart backend
```

#### 4. Frontend build issues
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Reinstall dependencies
npm install

# Check TypeScript
npm run type-check
```

### Port Conflicts
If ports 5432, 6379, 3001, or 8080 are in use:

1. Stop conflicting services
2. Or modify ports in `docker-compose.dev.yml`
3. Update corresponding environment variables

### Performance Issues
```bash
# Clean up Docker resources
docker system prune -f

# Remove unused volumes
docker volume prune -f

# Check container resource usage
docker stats
```

## 📈 Development Best Practices

### Code Organization
- Use absolute imports with `@/` prefix
- Keep components small and focused
- Use TypeScript strictly
- Follow existing naming conventions

### Database Development
- Always use migrations for schema changes
- Test with realistic seed data
- Use proper indexes for queries
- Follow naming conventions (snake_case)

### API Development
- RESTful endpoints with proper HTTP methods
- Consistent error handling
- Request validation with Joi/Zod
- Proper authentication middleware

### Frontend Development
- Use React Query for server state
- Implement proper error boundaries
- Follow accessibility guidelines
- Optimize for performance

## 🔒 Security Considerations

### Development Security
- Never commit real API keys or secrets
- Use development-specific JWT secrets
- Local containers are isolated but not production-secure
- Regular dependency updates

### Database Security
- Development database uses default credentials
- Row Level Security (RLS) policies are active
- All queries go through authenticated API endpoints

## 📄 Document Management System

### Overview
The Comprehensive Document Management System provides enterprise-grade document storage with AI-powered smart naming that integrates seamlessly across all upload workflows in INFOtrac.

### Key Features
- **AI-Powered Smart Naming**: Automatically generates meaningful filenames based on document content
- **Multi-Tenant Storage**: Complete company isolation with permission-based access control
- **Seamless Integration**: Works with all existing upload workflows without disruption
- **Multiple Storage Backends**: Database, filesystem, and S3-ready storage options
- **Confidence-Based Strategies**: High/medium/low confidence approaches for optimal naming results

### Architecture

#### Core Components
```
backend/src/services/smartDocumentNaming.ts      # AI-powered naming engine
backend/src/services/documentStorage.ts         # Multi-backend storage service
backend/src/services/documentContentAnalysis.ts # OCR and business entity extraction (NEW)
backend/src/services/documentDuplicateDetection.ts # Multi-factor duplicate detection (NEW)
backend/src/services/documentRelevanceAnalysis.ts # Context-aware relevance analysis (NEW)
backend/src/services/documentIntelligenceOrchestrator.ts # Intelligence service coordinator (NEW)
backend/src/routes/documents.ts                 # RESTful API endpoints with intelligence
database/init/06-document-management.sql        # Complete database schema with intelligence fields
src/hooks/useDocumentUpload.ts                  # React hook with pre-upload analysis
src/components/SmartDocumentWarnings.tsx        # UI component for analysis results (NEW)
```

#### Database Schema
```sql
-- Core document storage
documents (
  id, company_id, original_filename, smart_filename,
  file_path, file_size, mime_type, checksum, created_at, created_by
)

-- Document associations (links to expenses, vendors, etc.)
document_associations (
  id, document_id, entity_type, entity_id, association_type, created_at
)

-- Access logging and audit trail
document_access_logs (
  id, document_id, user_id, action, ip_address, created_at
)

-- Customizable naming templates per company
document_naming_templates (
  id, company_id, document_type, template_pattern, created_at
)
```

#### Integration Points
The document management system integrates with all upload components:

**Receipt Upload (Expenses):**
```typescript
// Enhanced ReceiptUpload component
const { uploadExpenseReceipt, isUploading, uploadProgress, uploadedDocument } = useDocumentUpload();
const uploadedDoc = await uploadExpenseReceipt(file, aiResult, expenseId);
onFileSelected(aiResult, file, previewUrl, uploadedDoc.id);
```

**Vendor Creation:**
```typescript
// AIEnhancedVendorCreation with document management
const uploadedDoc = await uploadDocument({
  file,
  options: {
    documentCategory: 'business_card',
    aiExtractedData: mockAiData
  }
});
```

**Customer Creation:**
```typescript
// Business card processing with smart naming
const uploadedDoc = await uploadDocument(file, extractedData);
console.log(`Document saved as: ${uploadedDoc.smartFileName}`);
```

**Ingrid AI Chat:**
```typescript
// Chat interface file uploads with document management
const uploadedDoc = await uploadDocument({ file, options: { documentCategory: 'receipt' } });
// Smart naming integrated into AI responses
```

### Smart Naming System

#### Naming Strategies
1. **High Confidence (80%+)**: Full detailed naming with all extracted data
2. **Medium Confidence (50-79%)**: Basic naming with primary data points
3. **Low Confidence (<50%)**: Fallback to type-based naming with timestamp

#### Example Smart Names
```
High Confidence:    "Expense_Staples_2025-01-25_$45.99.pdf"
Medium Confidence:  "Receipt_OfficeSupplies_2025-01-25.pdf"
Low Confidence:     "Document_2025-01-25_143052.pdf"
```

#### Template System
Companies can customize naming patterns:
```javascript
// Template examples
"{type}_{vendor}_{date}_{amount}.{ext}"           // Expense documents
"{type}_{company}_{contact}.{ext}"                // Business cards
"Invoice_{vendor}_{invoice_number}_{date}.{ext}"  // Vendor invoices
```

### API Endpoints

#### Document Management
```bash
POST   /api/documents/upload              # Upload document with smart naming
GET    /api/documents/:id                 # Get document by ID
GET    /api/documents/:id/download        # Download document
PUT    /api/documents/:id/rename          # Update smart filename
DELETE /api/documents/:id                 # Delete document
GET    /api/documents/company/:companyId  # List company documents
```

#### Template Management
```bash
GET    /api/documents/templates/:companyId        # Get naming templates
POST   /api/documents/templates                   # Create naming template
PUT    /api/documents/templates/:id               # Update naming template
DELETE /api/documents/templates/:id               # Delete naming template
```

### Development Usage

#### Frontend Hook (Enhanced with Intelligence)
```typescript
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import SmartDocumentWarnings from '@/components/SmartDocumentWarnings';

function MyUploadComponent() {
  const {
    // Original functions
    uploadDocument,
    isUploading,
    uploadProgress,
    uploadedDocument,

    // NEW: Intelligence analysis functions
    analyzeDocument,
    analyzeDocumentFull,
    uploadWithAnalysis,
    uploadExpenseReceipt,
    uploadVendorDocument,
    uploadCustomerDocument,

    // NEW: Intelligence state
    isAnalyzing,
    analysisResult
  } = useDocumentUpload();

  const [showWarnings, setShowWarnings] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);

  // NEW: Pre-upload analysis with intelligence
  const handleUploadWithIntelligence = async (file: File) => {
    try {
      // First analyze the document
      const analysis = await analyzeDocumentFull(file, 'expense_receipt', {
        enableDuplicateDetection: true,
        enableRelevanceAnalysis: true,
        enableContentAnalysis: true,
        duplicateScope: 'company',
        temporalToleranceDays: 30
      });

      if (analysis?.recommendedAction === 'warn' || analysis?.recommendedAction === 'reject') {
        setAnalysisData(analysis);
        setShowWarnings(true);
        return;
      }

      // Analysis passed, proceed with upload
      await proceedWithUpload(file, analysis);
    } catch (error) {
      console.error('Analysis failed, proceeding with regular upload:', error);
      await proceedWithUpload(file, null);
    }
  };

  const proceedWithUpload = async (file: File, analysis: any) => {
    const result = await uploadExpenseReceipt(file, {
      // Include extracted data from analysis
      ...(analysis?.contentAnalysis?.businessEntities || {}),
      vendor: 'Acme Corp',
      amount: 123.45
    });
    console.log(`Smart filename: ${result.smartFileName}`);
  };

  return (
    <div>
      <input type="file" onChange={(e) => e.files?.[0] && handleUploadWithIntelligence(e.files[0])} />

      {isAnalyzing && <p>Analyzing document...</p>}
      {isUploading && <p>Uploading... {uploadProgress?.percentage}%</p>}

      {/* NEW: Smart Document Warnings */}
      {showWarnings && analysisData && (
        <SmartDocumentWarnings
          analysis={analysisData}
          isLoading={false}
          context="expense_receipt"
          onProceedAnyway={() => {
            setShowWarnings(false);
            proceedWithUpload(file, analysisData);
          }}
          onCancel={() => setShowWarnings(false)}
          onRetry={() => handleUploadWithIntelligence(file)}
        />
      )}
    </div>
  );
}
```

#### Backend Integration
```typescript
import { SmartDocumentNamingService } from '../services/smartDocumentNaming';
import { DocumentStorageService } from '../services/documentStorage';
import { DocumentIntelligenceOrchestrator } from '../services/documentIntelligenceOrchestrator';

// NEW: Analyze document with intelligence before processing
const intelligenceResult = await DocumentIntelligenceOrchestrator.analyzeDocument(fileBuffer, {
  filename: file.name,
  size: file.size,
  mimeType: file.type
}, {
  documentType: 'expense_receipt',
  enableDuplicateDetection: true,
  enableRelevanceAnalysis: true,
  enableContentAnalysis: true,
  duplicateScope: 'company',
  temporalToleranceDays: 30
});

// Check if we should proceed or warn user
if (intelligenceResult.recommendedAction === 'warn' || intelligenceResult.recommendedAction === 'reject') {
  // Show SmartDocumentWarnings component to user
  return { requiresUserDecision: true, analysis: intelligenceResult };
}

// Generate smart filename
const namingResult = await SmartDocumentNamingService.generateSmartName({
  originalFilename: file.name,
  documentType: 'expense',
  aiData: { vendor: 'Acme Corp', amount: 123.45 },
  companyId: user.companyId
});

// Store document
const storedDoc = await DocumentStorageService.storeDocument(
  fileBuffer,
  namingResult.smartFilename,
  { companyId: user.companyId, uploadedBy: user.id }
);
```

### Security Features
- **Company Isolation**: Documents are strictly isolated by company_id
- **Permission Validation**: All operations check user permissions and company access
- **Access Logging**: Complete audit trail of all document operations
- **Type Validation**: File type and size limits enforced
- **Virus Scanning Ready**: Architecture supports future virus scanning integration
- **Rate Limiting**: API endpoints include rate limiting protection

### Configuration
```typescript
// Environment variables for document management
DOCUMENT_STORAGE_BACKEND=database|filesystem|s3
DOCUMENT_MAX_SIZE=5MB
DOCUMENT_ALLOWED_TYPES=image/*,application/pdf,text/plain
DOCUMENT_NAMING_CONFIDENCE_THRESHOLD=0.5
DOCUMENT_STORAGE_PATH=/uploads
AWS_S3_BUCKET=infotrac-documents  // For S3 backend
```

## 📚 Additional Resources

### Documentation
- `DATABASE_DOCUMENTATION.md` - Complete database schema
- `DOCUMENT_MANAGEMENT_SYSTEM.md` - Comprehensive document management documentation
- `CLAUDE.md` - Development guidelines for Claude Code
- `README.md` - Project overview and production info

### API Documentation
- Backend health check: `GET http://localhost:3001/health`
- API endpoints follow REST conventions
- Authentication uses JWT tokens

---

**Happy coding! 🎉**

For questions or issues, refer to the troubleshooting section or check container logs for detailed error information.