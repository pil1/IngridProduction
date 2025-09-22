# Ingrid AI Universal Assistant - Comprehensive Documentation

## Overview

Ingrid AI is a sophisticated, conversational AI assistant that replaces the legacy analyze-expense function with a universal document processing and business automation system. Built with real AI integration, comprehensive security controls, and permission-aware responses.

## 🎯 Core Features

### 1. Universal Document Processing
- **Multi-format Support**: PDFs, images (JPG, PNG, GIF), documents (DOC, DOCX)
- **Intelligent Document Classification**: Receipts, invoices, business cards, quotes, contracts
- **Real AI-Powered OCR**: Multiple provider support (OpenAI Vision, Google Cloud Vision, AWS Textract, Azure Document Intelligence)
- **Smart Data Extraction**: Automatic field detection and validation
- **Web Enrichment**: Company and vendor data enhancement from external sources

### 2. Conversational Interface
- **Natural Language Processing**: GPT-4 powered conversations
- **Context-Aware Responses**: Maintains conversation history and context
- **Action Cards**: Interactive suggestions for document processing
- **Multi-turn Conversations**: Supports complex, multi-step workflows
- **File Upload via Chat**: Drag-and-drop and button upload support

### 3. Security & Permission Framework
- **Role-Based Access Control**: Super-admin, admin, user roles
- **Permission-Aware Responses**: Filters sensitive data based on user permissions
- **Security Monitoring**: "Naughty list" system for unauthorized access attempts
- **Data Protection**: Automatic filtering of GL accounts, financial data, and sensitive information
- **Audit Trail**: Comprehensive logging of all user actions and access attempts

### 4. Admin Configuration
- **AI Provider Settings**: Configure OpenAI, Anthropic, or local AI providers
- **OCR Provider Selection**: Choose between multiple OCR services
- **Security Thresholds**: Configurable risk scoring and alert levels
- **Company-Level Settings**: Per-company AI configuration and limits

### 5. Intelligent Category Suggestion System
- **Smart Category Mapping**: AI-powered matching of expense categories with fuzzy and semantic algorithms
- **Controller Approval Workflow**: Complete approval system for new category suggestions
- **Usage Analytics**: Track suggestion accuracy and controller approval patterns
- **Automatic Integration**: Seamless integration with document processing pipeline

### 6. Intelligent Vendor Suggestion System
- **Smart Vendor Matching**: AI-powered vendor identification with fuzzy, semantic, and exact matching algorithms
- **Web Enrichment**: Automatic vendor data enhancement from external sources when details are missing
- **Controller Approval Workflow**: Complete approval system for new vendor suggestions with merge capabilities
- **Usage Analytics**: Track vendor suggestion accuracy, web enrichment success, and controller approval patterns
- **Automatic Integration**: Seamless integration with document processing pipeline and vendor management

## 🏗️ Architecture

### Core Services

#### IngridCore (`src/services/ingrid/IngridCore.ts`)
Main orchestration engine that coordinates all AI processing:
- Document analysis pipeline
- Permission filtering integration
- Conversation management
- Action card generation
- Legacy compatibility layer

```typescript
// Main document processing method
async processDocument(input: IngridDocumentInput): Promise<IngridResponse>

// Pure text conversation handling
async handleConversation(message: string, context: ProcessingContext): Promise<IngridResponse>

// Legacy compatibility for old analyze-expense API
async analyzeExpenseLegacy(fileBase64: string, mimeType: string): Promise<LegacyResponse>
```

#### OCRService (`src/services/ingrid/OCRService.ts`)
Handles optical character recognition with multiple provider support:
- **OpenAI Vision**: GPT-4 Vision for intelligent document analysis
- **Google Cloud Vision**: Google's OCR API
- **AWS Textract**: Amazon's document analysis service
- **Azure Document Intelligence**: Microsoft's document processing
- **Mock Provider**: For development and testing

```typescript
// Process document with automatic provider selection
async processDocument(file: File, options?: OCROptions): Promise<OCRResult>

// Provider-specific processing methods
private async processWithOpenAIVision(file: File): Promise<OCRResult>
private async processWithGoogleVision(file: File): Promise<OCRResult>
private async processWithAWSTextract(file: File): Promise<OCRResult>
```

#### ConversationalAI (`src/services/ingrid/ConversationalAI.ts`)
Powered by OpenAI GPT-4 for natural language understanding:
- Document-specific response generation
- General conversation handling
- Context-aware suggestions
- Intent-based response formatting

```typescript
// Generate intelligent responses for document processing
async generateDocumentResponse(
  analysis: DocumentAnalysis,
  intent: UserIntent,
  actions: ActionCard[]
): Promise<ConversationalResponse>

// Handle general conversation without documents
async handleGeneralConversation(
  message: string,
  intent: UserIntent,
  history: ConversationMessage[]
): Promise<ConversationalResponse>
```

#### WebEnrichmentService (`src/services/ingrid/WebEnrichmentService.ts`)
Enhances extracted data with external information:
- Company information lookup
- Vendor verification and categorization
- Industry classification
- Contact information validation

```typescript
// Enrich company data from external sources
async enrichCompanyData(companyName: string): Promise<WebEnrichmentData>

// Verify and categorize vendor information
async enrichVendorData(vendorName: string): Promise<VendorEnrichmentData>
```

#### CategoryMappingService (`src/services/ingrid/CategoryMappingService.ts`)
Intelligent category suggestion and matching system:
- **Fuzzy String Matching**: Levenshtein distance algorithm with 80% similarity threshold
- **Semantic Understanding**: Comprehensive synonym mapping for business categories
- **Exact Matching**: Case-insensitive direct category name matching (95% threshold)
- **Context-Aware Enhancement**: Vendor and description-based category enrichment
- **Confidence Scoring**: AI confidence levels with automatic approval recommendations

```typescript
// Core category mapping with intelligent fallbacks
static async mapCategoryToId(
  suggestedCategory: string,
  existingCategories: ExistingCategory[],
  companyId: string,
  context?: {
    vendorName?: string;
    description?: string;
    amount?: number;
  }
): Promise<CategoryMatch>

// Store new category suggestions for approval
static async storeSuggestedCategory(
  suggestion: {
    name: string;
    description?: string;
    confidence: number;
    context?: any;
  },
  companyId: string,
  userId: string
): Promise<string>

// Approve category suggestion and create expense category
static async approveSuggestion(
  suggestionId: string,
  reviewerId: string,
  approvedName?: string,
  description?: string,
  glAccountId?: string
): Promise<string>
```

#### SuggestedCategoryService (`src/services/ingrid/SuggestedCategoryService.ts`)
Complete category suggestion lifecycle management:
- **CRUD Operations**: Store, retrieve, update, and delete category suggestions
- **Approval Workflow**: Single approval, bulk operations, and merge functionality
- **Usage Tracking**: Automatic deduplication and suggestion frequency counting
- **Statistics Dashboard**: Analytics for approval rates, confidence scores, and usage patterns

```typescript
// Store category suggestion with deduplication
static async storeSuggestion(
  companyId: string,
  suggestedName: string,
  confidenceScore: number,
  context: SuggestedCategoryContext = {}
): Promise<string>

// Get all pending suggestions for controller review
static async getPendingSuggestions(companyId: string): Promise<SuggestedCategory[]>

// Approve suggestion and create expense category
static async approveSuggestion(
  suggestionId: string,
  reviewerId: string,
  finalName?: string,
  finalDescription?: string,
  glAccountId?: string,
  reviewNotes?: string
): Promise<ApprovalResult>

// Merge multiple similar suggestions into one category
static async mergeSuggestions(
  suggestionIds: string[],
  reviewerId: string,
  finalName: string,
  finalDescription?: string,
  glAccountId?: string,
  reviewNotes?: string
): Promise<ApprovalResult>

// Get comprehensive usage and approval statistics
static async getSuggestionStats(companyId: string): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  merged: number;
  avgConfidence: number;
  topSuggestions: Array<{ name: string; count: number; confidence: number }>;
}>
```

#### VendorMappingService (`src/services/ingrid/VendorMappingService.ts`)
Intelligent vendor suggestion and matching system:
- **Fuzzy String Matching**: Advanced Levenshtein distance algorithm with 80% similarity threshold
- **Semantic Understanding**: Comprehensive vendor alias mapping for common business vendors
- **Exact Matching**: Case-insensitive direct vendor name matching (95% threshold)
- **Web Enrichment**: Automatic vendor data enhancement when details are missing from documents
- **Confidence Scoring**: AI confidence levels with automatic approval recommendations
- **Mock Vendor Database**: Built-in database of 50+ common vendors (Amazon, Microsoft, Google, etc.)

```typescript
// Core vendor mapping with intelligent fallbacks and web enrichment
static async mapVendorToId(
  suggestedVendor: string,
  existingVendors: ExistingVendor[],
  companyId: string,
  context?: VendorContext
): Promise<VendorMatch>

// Store new vendor suggestions for approval
static async storeSuggestedVendor(
  suggestion: {
    name: string;
    email?: string;
    phone?: string;
    website?: string;
    confidence: number;
    context?: any;
    webEnrichmentData?: any;
  },
  companyId: string,
  userId: string
): Promise<string>

// Perform web enrichment to find vendor details
static async performWebEnrichment(
  vendorName: string,
  context?: VendorContext
): Promise<WebEnrichmentResult>
```

#### SuggestedVendorService (`src/services/ingrid/SuggestedVendorService.ts`)
Complete vendor suggestion lifecycle management:
- **CRUD Operations**: Store, retrieve, update, and delete vendor suggestions
- **Approval Workflow**: Single approval, bulk operations, and merge functionality
- **Usage Tracking**: Automatic deduplication and suggestion frequency counting
- **Statistics Dashboard**: Analytics for approval rates, confidence scores, web enrichment success
- **Merge Operations**: Intelligent merging of similar vendor suggestions

```typescript
// Store vendor suggestion with deduplication and usage tracking
static async storeSuggestion(
  companyId: string,
  suggestedName: string,
  confidenceScore: number,
  context: SuggestedVendorContext = {},
  webEnrichmentData?: Record<string, any>
): Promise<string>

// Get all pending suggestions for controller review
static async getPendingSuggestions(companyId: string): Promise<SuggestedVendor[]>

// Approve suggestion and create vendor
static async approveSuggestion(
  suggestionId: string,
  reviewerId: string,
  finalName?: string,
  finalEmail?: string,
  finalPhone?: string,
  finalAddressLine1?: string,
  finalAddressLine2?: string,
  finalCity?: string,
  finalState?: string,
  finalCountry?: string,
  finalPostalCode?: string,
  finalWebsite?: string,
  finalTaxId?: string,
  finalDescription?: string,
  reviewNotes?: string
): Promise<VendorApprovalResult>

// Merge multiple similar suggestions into one vendor
static async mergeSuggestions(
  suggestionIds: string[],
  reviewerId: string,
  finalName: string,
  finalEmail?: string,
  finalPhone?: string,
  finalWebsite?: string,
  finalDescription?: string,
  reviewNotes?: string
): Promise<VendorApprovalResult>

// Get comprehensive usage and approval statistics
static async getSuggestionStats(companyId: string): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  merged: number;
  avgConfidence: number;
  avgWebEnrichmentConfidence: number;
  topSuggestions: Array<{ name: string; count: number; confidence: number; hasWebData: boolean }>;
  webEnrichmentSuccess: number;
}>

// Find similar pending suggestions for merging
static async findSimilarSuggestions(
  suggestionId: string,
  similarityThreshold: number = 0.8
): Promise<SuggestedVendor[]>
```

### Security Services

#### PermissionService (`src/services/permissions/PermissionService.ts`)
Core security and permission management:
- Role-based access control
- Data filtering for sensitive information
- Action card permission filtering
- Security context management

```typescript
// Check if user has specific permission
static async hasPermission(
  context: SecurityContext,
  action: keyof UserPermissions,
  resource: string
): Promise<boolean>

// Filter sensitive data based on user permissions
static filterSensitiveData(
  data: Record<string, any>,
  context: SecurityContext,
  sensitiveFields: string[]
): Record<string, any>

// Filter action cards based on user permissions
static filterActionCards(
  actions: ActionCard[],
  context: SecurityContext
): ActionCard[]
```

#### SecurityMonitoringService (`src/services/permissions/SecurityMonitoringService.ts`)
"Naughty list" and security alerting system:
- Access attempt logging
- Risk scoring algorithm
- Automated security alerts
- Pattern detection for suspicious behavior

```typescript
// Monitor user actions and detect security issues
static async monitorUserAction(
  userId: string,
  userName: string,
  action: string,
  resource: string,
  permitted: boolean,
  context: Record<string, any>
): Promise<void>

// Generate security alerts for administrators
static async generateSecurityAlert(
  userId: string,
  userName: string,
  alertType: SecurityAlertType,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any>
): Promise<SecurityAlert>
```

### UI Components

#### IngridChatInterface (`src/components/ingrid/IngridChatInterface.tsx`)
Main conversational UI component:
- Chat message display
- File upload handling
- Action card interaction
- Real-time conversation updates

#### IngridSettingsTab (`src/components/IngridSettingsTab.tsx`)
Admin-only configuration interface:
- AI provider settings
- OCR configuration
- Security threshold management
- Company-specific settings

#### SecurityAlertsUI (`src/components/SecurityAlertsUI.tsx`)
Security monitoring dashboard:
- Real-time security alerts
- Naughty list management
- Risk scoring display
- Security metrics overview

#### SuggestedCategoriesTab (`src/components/SuggestedCategoriesTab.tsx`)
Complete controller interface for managing AI category suggestions:
- **Statistics Dashboard**: Real-time metrics for pending/approved/rejected suggestions
- **Bulk Operations**: Multi-select approval, rejection, and merging capabilities
- **Interactive Approval**: Inline editing with GL account assignment and reviewer notes
- **Smart Filtering**: Search, sort, and filter by confidence score, usage count, and status
- **Usage Analytics**: Visual indicators for suggestion frequency and confidence levels

```typescript
// Key features of the suggestion management interface
interface SuggestedCategoriesTabFeatures {
  statisticsOverview: {
    totalSuggestions: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    averageConfidence: number;
    topSuggestions: SuggestionSummary[];
  };

  bulkOperations: {
    multiSelect: boolean;
    bulkApprove: (suggestions: string[]) => Promise<void>;
    bulkReject: (suggestions: string[]) => Promise<void>;
    mergeSuggestions: (suggestions: string[], finalName: string) => Promise<void>;
  };

  realTimeUpdates: {
    reactQuery: boolean;
    optimisticUpdates: boolean;
    instantFeedback: boolean;
  };
}
```

#### SuggestedVendorsTab (`src/components/SuggestedVendorsTab.tsx`)
Complete controller interface for managing AI vendor suggestions:
- **Statistics Dashboard**: Real-time metrics for pending/approved/rejected/web-enriched vendors
- **Bulk Operations**: Multi-select approval, rejection, and merging capabilities
- **Interactive Approval**: Full vendor data editing with contact information, address, and business details
- **Smart Filtering**: Search, sort, and filter by confidence score, usage count, and web enrichment status
- **Web Enrichment Analytics**: Visual indicators for vendor data enhancement and confidence scoring
- **Usage Analytics**: Visual indicators for suggestion frequency and controller approval patterns

```typescript
// Key features of the vendor suggestion management interface
interface SuggestedVendorsTabFeatures {
  statisticsOverview: {
    totalSuggestions: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    webEnrichedCount: number;
    averageConfidence: number;
    averageWebEnrichmentConfidence: number;
    topSuggestions: VendorSuggestionSummary[];
    webEnrichmentSuccessRate: number;
  };

  vendorDataManagement: {
    fullContactInformation: boolean;
    addressManagement: boolean;
    businessDetailsEditing: boolean;
    webEnrichmentIntegration: boolean;
    confidenceScoring: boolean;
  };

  bulkOperations: {
    multiSelect: boolean;
    bulkApprove: (suggestions: string[]) => Promise<void>;
    bulkReject: (suggestions: string[]) => Promise<void>;
    mergeSuggestions: (suggestions: string[], finalVendorData: VendorData) => Promise<void>;
    findSimilarVendors: (suggestionId: string) => Promise<SuggestedVendor[]>;
  };

  webEnrichmentFeatures: {
    automaticDataEnhancement: boolean;
    confidenceScoring: boolean;
    vendorVerification: boolean;
    contactInformationValidation: boolean;
  };

  realTimeUpdates: {
    reactQuery: boolean;
    optimisticUpdates: boolean;
    instantFeedback: boolean;
    statisticsRefresh: boolean;
  };
}
```

### React Hooks

#### usePermissions (`src/hooks/usePermissions.ts`)
Permission checking throughout the application:
- Real-time permission checking
- Security context management
- Role-based UI rendering

```typescript
const {
  permissions,
  securityContext,
  hasPermission,
  canViewFinancialData,
  canManageGLAccounts,
  canConfigureIngrid,
  canViewSecurityAlerts
} = usePermissions();
```

## 🔧 Configuration

### Environment Variables
```env
# AI Provider Configuration
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_GOOGLE_CLOUD_API_KEY=your_google_cloud_key
VITE_AWS_ACCESS_KEY_ID=your_aws_access_key
VITE_AWS_SECRET_ACCESS_KEY=your_aws_secret_key
VITE_AZURE_ENDPOINT=your_azure_endpoint
VITE_AZURE_API_KEY=your_azure_api_key

# Default AI Configuration
VITE_DEFAULT_AI_PROVIDER=openai
VITE_DEFAULT_OCR_PROVIDER=openai-vision
VITE_ENABLE_WEB_ENRICHMENT=true
```

### ConfigurationService (`src/services/ingrid/ConfigurationService.ts`)
Dynamic configuration management with localStorage persistence:

```typescript
interface IngridConfig {
  aiProvider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  enableWebEnrichment: boolean;
  enableSPIREIntegration: boolean;
  autoApprovalThreshold: number;
  conversationTimeout: number;
  ocrProvider: 'mock' | 'openai-vision' | 'google-vision' | 'aws-textract' | 'azure-document';
}
```

## 🔒 Security Features

### Permission Levels

#### Super Admin
- Full system access
- Can configure Ingrid AI for all companies
- Access to all security monitoring features
- Can view and modify all data

#### Company Admin
- Can configure Ingrid AI for their company
- Access to company security alerts
- Can view GL accounts and financial data for their company
- Can manage users within their company

#### User
- Basic document processing
- Limited to non-sensitive data
- Cannot access financial information without explicit permission
- All actions are logged and monitored

### Data Protection

#### Sensitive Data Filtering
Automatically filters the following data types based on user permissions:
- GL account codes and names
- Financial data and amounts
- Bank account information
- Tax identification numbers
- Proprietary business information

#### Security Monitoring
- **Access Logging**: All user actions are logged with timestamps
- **Risk Scoring**: Automatic calculation of user risk scores based on behavior
- **Pattern Detection**: Identifies unusual access patterns
- **Automated Alerts**: Real-time notifications for security incidents
- **Naughty List**: Tracks users with repeated unauthorized access attempts

### Security Alerts

#### Alert Types
- `UNAUTHORIZED_ACCESS`: User attempted to access restricted data
- `SUSPICIOUS_PATTERN`: Unusual behavior detected
- `DATA_EXPORT_ATTEMPT`: Attempt to export sensitive data
- `PERMISSION_ESCALATION`: Attempt to access higher-level permissions
- `REPEATED_FAILURES`: Multiple failed access attempts

#### Severity Levels
- **Critical**: Immediate action required, potential security breach
- **High**: Significant security concern, requires prompt attention
- **Medium**: Moderate risk, should be investigated
- **Low**: Minor concern, for awareness and tracking

## 🚀 Usage Examples

### Basic Document Processing
```typescript
// Upload a receipt and process it
const response = await ingridCore.processDocument({
  document: receiptFile,
  context: 'expense_creation',
  userMessage: 'Process this expense receipt',
  securityContext: userSecurityContext
});

// Response includes filtered data based on user permissions
console.log(response.message); // AI-generated explanation
console.log(response.actionCards); // Suggested actions (filtered)
```

### Conversational Interaction
```typescript
// Start a conversation
const response = await ingridCore.handleConversation(
  "I need help creating an expense report",
  'expense_workflow'
);

// Continue the conversation
const followUp = await ingridCore.handleConversation(
  "Can you categorize it as travel expense?",
  'expense_workflow',
  response.conversationId
);
```

### Permission Checking
```typescript
// Check specific permissions
const canView = await PermissionService.hasPermission(
  securityContext,
  'viewGLAccounts',
  'gl_account_123'
);

// Use React hook for UI components
const { canViewFinancialData, hasPermission } = usePermissions();

if (canViewFinancialData) {
  // Show financial information
}
```

### Security Monitoring
```typescript
// Monitor user action
await SecurityMonitoringService.monitorUserAction(
  userId,
  userName,
  'viewGLAccount',
  'gl_account_123',
  hasPermission,
  { userRole, companyId, sessionId }
);

// Get security alerts
const alerts = await SecurityMonitoringService.getSecurityAlerts(companyId);
```

### Category Suggestion Workflow
```typescript
// 1. Document processing triggers category suggestion
const existingCategories = await fetchExistingCategories(companyId);
const categoryMatch = await CategoryMappingService.mapCategoryToId(
  'Software License', // AI-extracted category
  existingCategories,
  companyId,
  {
    vendorName: 'Microsoft Corporation',
    description: 'Office 365 Business Premium',
    amount: 149.99
  }
);

// Result shows intelligent matching with reasoning
console.log(categoryMatch);
// {
//   categoryId: 'cat_123',
//   categoryName: 'Technology',
//   confidence: 0.89,
//   matchType: 'semantic',
//   reason: 'Semantic match: "Software License" maps to "Technology"',
//   needsApproval: false
// }

// 2. If no good match, store suggestion for controller approval
if (categoryMatch.matchType === 'new' && categoryMatch.needsApproval) {
  const suggestionId = await CategoryMappingService.storeSuggestedCategory({
    name: categoryMatch.categoryName,
    confidence: categoryMatch.confidence,
    context: {
      reasoning: categoryMatch.reason,
      document_name: 'microsoft_invoice.pdf',
      vendor_name: 'Microsoft Corporation',
      amount: 149.99
    }
  }, companyId, userId);
}

// 3. Controller reviews and approves suggestions
const pendingSuggestions = await SuggestedCategoryService.getPendingSuggestions(companyId);
const approvalResult = await SuggestedCategoryService.approveSuggestion(
  suggestionId,
  controllerId,
  'Software Licenses', // Controller-modified name
  'Microsoft Office and productivity software licenses',
  'gl_account_6200', // GL account assignment
  'Approved with GL mapping to software expense account'
);

// 4. Get usage analytics for optimization
const stats = await SuggestedCategoryService.getSuggestionStats(companyId);
console.log(stats);
// {
//   total: 45,
//   pending: 12,
//   approved: 28,
//   rejected: 3,
//   merged: 2,
//   avgConfidence: 0.82,
//   topSuggestions: [
//     { name: 'Software Licenses', count: 8, confidence: 0.91 },
//     { name: 'Office Supplies', count: 5, confidence: 0.87 }
//   ]
// }
```

### Bulk Category Management
```typescript
// Controller bulk operations for similar suggestions
const similarSuggestions = pendingSuggestions
  .filter(s => s.suggested_name.toLowerCase().includes('software'))
  .map(s => s.id);

// Merge multiple similar suggestions into one category
const mergeResult = await SuggestedCategoryService.mergeSuggestions(
  similarSuggestions,
  controllerId,
  'Software & Technology',
  'All software licenses, subscriptions, and technology expenses',
  'gl_account_6200',
  'Merged all software-related suggestions into unified category'
);

// Bulk reject inappropriate suggestions
const inappropriateSuggestions = pendingSuggestions
  .filter(s => s.confidence_score < 0.5)
  .map(s => s.id);

for (const suggestionId of inappropriateSuggestions) {
  await SuggestedCategoryService.rejectSuggestion(
    suggestionId,
    controllerId,
    'Low confidence score - requires manual review'
  );
}
```

### Vendor Suggestion Workflow
```typescript
// 1. Document processing triggers vendor suggestion
const existingVendors = await fetchExistingVendors(companyId);
const vendorMatch = await VendorMappingService.mapVendorToId(
  'Amazon Web Services', // AI-extracted vendor
  existingVendors,
  companyId,
  {
    documentType: 'receipt',
    extractedEmail: 'aws-billing@amazon.com',
    amount: 299.99
  }
);

// Result shows intelligent matching with web enrichment
console.log(vendorMatch);
// {
//   vendorId: 'vendor_123',
//   vendorName: 'Amazon Web Services',
//   confidence: 0.95,
//   matchType: 'exact',
//   reason: 'Exact match found in existing vendor database',
//   needsApproval: false,
//   webEnrichmentData: {
//     website: 'https://aws.amazon.com',
//     phone: '1-206-266-4064',
//     address: '410 Terry Ave N, Seattle, WA 98109',
//     confidence: 0.98
//   }
// }

// 2. If no good match, store suggestion with web enrichment for controller approval
if (vendorMatch.matchType === 'new' && vendorMatch.needsApproval) {
  const suggestionId = await VendorMappingService.storeSuggestedVendor({
    name: vendorMatch.vendorName,
    confidence: vendorMatch.confidence,
    context: {
      reasoning: vendorMatch.reason,
      document_name: 'aws_invoice.pdf',
      extractedEmail: 'aws-billing@amazon.com',
      amount: 299.99
    },
    webEnrichmentData: vendorMatch.webEnrichmentData
  }, companyId, userId);
}

// 3. Controller reviews and approves suggestions
const pendingSuggestions = await SuggestedVendorService.getPendingSuggestions(companyId);
const approvalResult = await SuggestedVendorService.approveSuggestion(
  suggestionId,
  controllerId,
  'Amazon Web Services', // Controller-confirmed name
  'aws-billing@amazon.com', // Email
  '1-206-266-4064', // Phone
  '410 Terry Ave N', // Address line 1
  undefined, // Address line 2
  'Seattle', // City
  'WA', // State
  'United States', // Country
  '98109', // Postal code
  'https://aws.amazon.com', // Website
  undefined, // Tax ID
  'Cloud computing and web services provider', // Description
  'Approved with web-enriched contact information'
);

// 4. Get usage analytics for optimization
const stats = await SuggestedVendorService.getSuggestionStats(companyId);
console.log(stats);
// {
//   total: 67,
//   pending: 15,
//   approved: 42,
//   rejected: 7,
//   merged: 3,
//   avgConfidence: 0.84,
//   avgWebEnrichmentConfidence: 0.91,
//   topSuggestions: [
//     { name: 'Amazon Web Services', count: 12, confidence: 0.95, hasWebData: true },
//     { name: 'Microsoft Corporation', count: 8, confidence: 0.92, hasWebData: true }
//   ],
//   webEnrichmentSuccess: 38
// }
```

### Bulk Vendor Management
```typescript
// Controller bulk operations for similar vendor suggestions
const similarSuggestions = pendingSuggestions
  .filter(s => s.suggested_name.toLowerCase().includes('amazon'))
  .map(s => s.id);

// Merge multiple similar suggestions into one vendor
const mergeResult = await SuggestedVendorService.mergeSuggestions(
  similarSuggestions,
  controllerId,
  'Amazon Web Services',
  'aws-billing@amazon.com',
  '1-206-266-4064',
  'https://aws.amazon.com',
  'Amazon Web Services - Cloud computing and web services provider',
  'Merged all Amazon-related suggestions into unified vendor record'
);

// Find similar vendors for intelligent merging
const similarVendors = await SuggestedVendorService.findSimilarSuggestions(
  suggestionId,
  0.8 // 80% similarity threshold
);

// Bulk reject low-confidence suggestions
const lowConfidenceSuggestions = pendingSuggestions
  .filter(s => s.confidence_score < 0.6 && !s.web_enrichment_data)
  .map(s => s.id);

for (const suggestionId of lowConfidenceSuggestions) {
  await SuggestedVendorService.rejectSuggestion(
    suggestionId,
    controllerId,
    'Low confidence score and no web enrichment data available'
  );
}
```

## 📊 Integration Points

### Legacy Compatibility
Maintains compatibility with the old analyze-expense API:
```typescript
// Old API still works
const legacyResult = await ingridCore.analyzeExpenseLegacy(fileBase64, mimeType);

// Returns data in the expected legacy format
interface LegacyResponse {
  data: {
    description?: string;
    amount?: number;
    vendor?: string;
    date?: string;
    category?: string;
    confidence?: number;
  };
  error: null | { message: string };
  success: boolean;
}
```

### Category Suggestion Integration
The category suggestion system integrates seamlessly with document processing:

```typescript
// Enhanced DocumentProcessor with automatic category and vendor suggestions
class DocumentProcessor {
  static async processDocument(document: File, companyId: string): Promise<ProcessingResult> {
    // 1. OCR and data extraction
    const ocrResult = await OCRService.processDocument(document);

    // 2. Extract category from document content
    const extractedCategory = await this.extractCategoryFromContent(ocrResult.text);

    // 3. Intelligent category mapping
    const existingCategories = await this.fetchExistingCategories(companyId);
    const categoryMatch = await CategoryMappingService.mapCategoryToId(
      extractedCategory,
      existingCategories,
      companyId,
      {
        vendorName: ocrResult.vendor,
        description: ocrResult.description,
        amount: ocrResult.amount
      }
    );

    // 4. Store category suggestion if new category needed
    if (categoryMatch.matchType === 'new' && categoryMatch.needsApproval) {
      await CategoryMappingService.storeSuggestedCategory({
        name: categoryMatch.categoryName,
        confidence: categoryMatch.confidence,
        context: {
          reasoning: categoryMatch.reason,
          document_name: document.name,
          vendor_name: ocrResult.vendor,
          amount: ocrResult.amount
        }
      }, companyId, 'system');
    }

    // 5. Intelligent vendor mapping and suggestion storage
    const existingVendors = await this.fetchExistingVendors(companyId);
    let vendorMatch;
    let vendorSuggestionId: string | undefined;

    if (ocrResult.vendor && existingVendors.length > 0) {
      vendorMatch = await VendorMappingService.mapVendorToId(
        ocrResult.vendor,
        existingVendors,
        companyId,
        {
          documentType: 'receipt',
          extractedEmail: ocrResult.email,
          amount: ocrResult.amount
        }
      );

      // Store vendor suggestion if needed
      if (vendorMatch.matchType === 'new' || vendorMatch.matchType === 'web_enriched') {
        if (vendorMatch.needsApproval) {
          vendorSuggestionId = await VendorMappingService.storeSuggestedVendor({
            name: vendorMatch.vendorName,
            email: ocrResult.email,
            confidence: vendorMatch.confidence,
            context: {
              reasoning: vendorMatch.reason,
              document_name: document.name,
              match_type: vendorMatch.matchType
            },
            webEnrichmentData: vendorMatch.webEnrichmentData
          }, companyId, 'system');
        }
      }
    }

    return {
      ...ocrResult,
      categoryMatch,
      vendorMatch,
      categorySuggestionStored: categoryMatch.matchType === 'new',
      vendorSuggestionStored: !!vendorSuggestionId,
      vendorSuggestionId
    };
  }
}
```

### Database Schema Integration
The category and vendor suggestion systems use dedicated tables with complete audit trails:

```sql
-- Suggested categories table with approval workflow
CREATE TABLE suggested_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Suggestion details
  suggested_name VARCHAR(255) NOT NULL,
  suggested_description TEXT,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_reasoning TEXT,
  source_document_name VARCHAR(255),
  vendor_context VARCHAR(255),
  amount_context DECIMAL(15,2),

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  reviewed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,

  -- Usage tracking
  usage_count INTEGER DEFAULT 1,
  first_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intelligent deduplication function
CREATE OR REPLACE FUNCTION increment_suggestion_usage(
  p_company_id UUID,
  p_suggested_name VARCHAR(255),
  p_confidence_score DECIMAL(3,2),
  p_context JSONB DEFAULT '{}'::JSONB
) RETURNS UUID;

-- Category creation and approval function
CREATE OR REPLACE FUNCTION approve_category_suggestion(
  p_suggestion_id UUID,
  p_reviewer_id UUID,
  p_final_name VARCHAR(255) DEFAULT NULL,
  p_final_description TEXT DEFAULT NULL,
  p_gl_account_id UUID DEFAULT NULL,
  p_review_notes TEXT DEFAULT NULL
) RETURNS UUID;

-- Suggested vendors table with approval workflow and web enrichment
CREATE TABLE suggested_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Vendor suggestion details
  suggested_name VARCHAR(255) NOT NULL,
  suggested_email VARCHAR(255),
  suggested_phone VARCHAR(50),
  suggested_address_line1 VARCHAR(255),
  suggested_address_line2 VARCHAR(255),
  suggested_city VARCHAR(100),
  suggested_state VARCHAR(100),
  suggested_country VARCHAR(100),
  suggested_postal_code VARCHAR(20),
  suggested_website VARCHAR(255),
  suggested_tax_id VARCHAR(50),
  suggested_description TEXT,
  suggested_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- AI context and confidence
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_reasoning TEXT,
  source_document_name VARCHAR(255),
  extraction_context JSONB DEFAULT '{}'::JSONB,
  web_enrichment_data JSONB DEFAULT '{}'::JSONB,
  web_enrichment_confidence DECIMAL(3,2) CHECK (web_enrichment_confidence >= 0 AND web_enrichment_confidence <= 1),

  -- Matching context
  vendor_match_type VARCHAR(20) CHECK (vendor_match_type IN ('exact', 'fuzzy', 'semantic', 'new', 'web_enriched')),
  existing_vendor_similarity DECIMAL(3,2),
  similar_vendor_ids UUID[] DEFAULT '{}',

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  reviewed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,

  -- Usage tracking
  usage_count INTEGER DEFAULT 1,
  first_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor deduplication and usage tracking function
CREATE OR REPLACE FUNCTION increment_vendor_suggestion_usage(
  p_company_id UUID,
  p_suggested_name VARCHAR(255),
  p_confidence_score DECIMAL(3,2),
  p_context JSONB DEFAULT '{}'::JSONB,
  p_web_data JSONB DEFAULT '{}'::JSONB
) RETURNS UUID;

-- Vendor creation and approval function
CREATE OR REPLACE FUNCTION approve_vendor_suggestion(
  p_suggestion_id UUID,
  p_reviewer_id UUID,
  p_final_name VARCHAR(255) DEFAULT NULL,
  p_final_email VARCHAR(255) DEFAULT NULL,
  p_final_phone VARCHAR(50) DEFAULT NULL,
  p_final_address_line1 VARCHAR(255) DEFAULT NULL,
  p_final_address_line2 VARCHAR(255) DEFAULT NULL,
  p_final_city VARCHAR(100) DEFAULT NULL,
  p_final_state VARCHAR(100) DEFAULT NULL,
  p_final_country VARCHAR(100) DEFAULT NULL,
  p_final_postal_code VARCHAR(20) DEFAULT NULL,
  p_final_website VARCHAR(255) DEFAULT NULL,
  p_final_tax_id VARCHAR(50) DEFAULT NULL,
  p_final_description TEXT DEFAULT NULL,
  p_review_notes TEXT DEFAULT NULL
) RETURNS UUID;
```

### SPIRE Integration (Planned)
Future integration with SPIRE ERP system:
- Direct GL account synchronization
- Real-time financial data validation
- Automated posting workflows
- Advanced approval chains

### Webhook Support (Planned)
Real-time notifications for external systems:
- Document processing completion
- Security alert notifications
- Action card status updates
- Conversation state changes

## 🔧 Development & Testing

### Mock Services
For development and testing, Ingrid includes sophisticated mock services:
- **MockOCRProvider**: Simulates document analysis with realistic data
- **MockConversationalAI**: Provides intelligent mock responses
- **MockWebEnrichment**: Returns sample company and vendor data

### Testing Strategy
```typescript
// Unit tests for core services
describe('IngridCore', () => {
  test('processes document with permissions', async () => {
    const result = await ingridCore.processDocument({
      document: mockFile,
      context: 'expense_creation',
      securityContext: mockUserContext
    });

    expect(result.actionCards).toBeDefined();
    expect(result.message).toContain('expense');
  });
});

// Integration tests for security
describe('SecurityMonitoring', () => {
  test('logs unauthorized access attempts', async () => {
    await SecurityMonitoringService.monitorUserAction(
      'user123',
      'john.doe',
      'viewGLAccount',
      'restricted_account',
      false, // Permission denied
      { userRole: 'user' }
    );

    const alerts = await SecurityMonitoringService.getSecurityAlerts('company123');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('UNAUTHORIZED_ACCESS');
  });
});
```

### Performance Monitoring
Built-in performance tracking:
- Document processing times
- AI response latency
- Security check overhead
- User interaction patterns

## 📈 Analytics & Metrics

### Usage Analytics
- Document processing volume
- AI accuracy metrics
- User engagement patterns
- Feature adoption rates

### Security Metrics
- Failed access attempts
- Risk score distributions
- Alert frequency and types
- Response times to security incidents

### Business Intelligence
- Expense categorization accuracy
- Vendor recognition rates
- Processing time improvements
- Cost savings through automation

## 🛠️ Troubleshooting

### Common Issues

#### "Permission Denied" Errors
- Check user role and company assignment
- Verify security context is properly set
- Review permission service configuration

#### OCR Processing Failures
- Verify API keys are correctly configured
- Check file format and size limits
- Review OCR provider status and quotas

#### Conversation Timeouts
- Check conversation timeout settings
- Verify conversation ID persistence
- Review session management configuration

### Debug Mode
Enable debug logging for detailed troubleshooting:
```typescript
// Enable debug mode in configuration
const config = ConfigurationService.getConfig();
config.debug = true;
ConfigurationService.saveConfig(config);
```

### Logs and Monitoring
- All AI interactions are logged with timestamps
- Security events are tracked in detail
- Performance metrics are collected automatically
- Error rates and patterns are monitored

## 🔮 Future Enhancements

### Planned Features
1. **Advanced ML Models**: Custom-trained models for specific document types
2. **Multi-language Support**: OCR and conversation support for multiple languages
3. **Voice Interface**: Voice-to-text integration for hands-free operation
4. **Mobile Optimization**: Enhanced mobile app integration
5. **Advanced Analytics**: ML-powered insights and predictions
6. **Workflow Automation**: Complex multi-step business process automation

### API Roadmap
1. **REST API**: Full REST API for external integrations
2. **GraphQL**: Real-time subscriptions and flexible queries
3. **Webhooks**: Event-driven integrations
4. **SDK**: JavaScript/TypeScript SDK for third-party developers

## 📞 Support & Contact

### Documentation Updates
This documentation is maintained alongside the codebase. For updates or corrections:
1. Update the relevant code documentation
2. Regenerate this comprehensive guide
3. Test all examples and code snippets
4. Review with the development team

### Technical Support
For technical issues or questions:
1. Check the troubleshooting section
2. Review the debug logs
3. Contact the development team
4. Create detailed issue reports with reproduction steps

---

*Last Updated: September 22, 2025*
*Version: Phase 6 - Intelligent Vendor Suggestion System with Web Enrichment*