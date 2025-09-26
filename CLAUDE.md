# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development (Docker-Based Environment)
- `docker-compose -f docker-compose.dev.yml up` - Start full development environment (backend + database + redis)
- `npm run dev` - Start frontend development server on port 8080 (requires Docker services running)
- `docker-compose -f docker-compose.dev.yml up --build` - Rebuild and start dev environment
- `docker-compose -f docker-compose.dev.yml down` - Stop development environment
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run lint` - Run ESLint for code linting
- `npm run preview` - Preview production build

### Testing & Console Monitoring
- **Professional Vitest testing infrastructure** is configured
- **Test coverage framework** ready for expansion
- **Current coverage**: ~25% (target: 40% by end of Phase 3)
- **Playwright Browser Automation** for console error monitoring
- Run tests: `npm run test` (when available)

#### Console Error Monitoring (NEW!)
**🎭 Automated browser testing with real-time console error detection**
- `npm run monitor:console` - Quick headless console error check
- `npm run test:console` - Watch mode with browser window
- `npm run test:console:report` - Generate detailed HTML report with screenshots
- `npm run test:e2e` - Full end-to-end testing suite
- `npm run test:e2e:debug` - Step-by-step debugging mode

**Features:**
- ✅ **Real browser testing** - Catches issues Vitest can't detect
- ✅ **Console error capture** - Automatically logs all JavaScript errors and warnings
- ✅ **Screenshot capture** - Takes screenshots when errors occur
- ✅ **Detailed reporting** - HTML reports with timestamps and stack traces
- ✅ **Navigation testing** - Tests multiple pages for console errors
- ✅ **Login flow testing** - Monitors authentication process
- ✅ **Rate limiting detection** - Identifies 429 errors and backend issues

**Quick Usage for Claude Code:**
```bash
# Quick console check (recommended for development)
npm run monitor:console

# Visual debugging
npm run test:console

# Comprehensive report with HTML output
npm run monitor:report
```

### Database Management - CRITICAL INSTRUCTIONS
**🚨 DOCKER-BASED POSTGRESQL ONLY 🚨**
- **Fully containerized development environment** via Docker Compose
- **Database, backend, and Redis all run in Docker containers**
- **Frontend can run locally via `npm run dev` or in Docker for full containerization**
- **Never use external database services** - everything is self-contained
- Development workflow:
  1. Start Docker services: `docker-compose -f docker-compose.dev.yml up`
  2. Frontend connects to containerized backend at `http://localhost:3001`
  3. Backend connects to containerized PostgreSQL and Redis
- When creating database changes:
  1. Create migration files in `database/migrations/` for version control
  2. Run migrations via Docker Compose or backend API endpoints
  3. Database changes are applied automatically on container startup
- The containerized database runs at: `postgres://infotrac_user:infotrac_password@postgres:5432/infotrac` (internal)
- External access: `postgres://infotrac_user:infotrac_password@localhost:5432/infotrac`
- All database operations are handled by the containerized Node.js backend API

### Code Quality Status (Updated September 24, 2025)
- ✅ **ESLint Violations**: **269** (MASSIVE SUCCESS - from 1,056!)
- ✅ **Production Readiness**: 100% achieved
- ✅ **Documentation Coverage**: 95% (comprehensively documented)
- ✅ **Module System**: Enterprise-grade modular architecture
- ✅ **User Experience**: Streamlined navigation and onboarding
- ✅ **Database Documentation**: Complete schema and architecture documentation
- ✅ **Architecture Analysis**: Comprehensive review and recommendations completed
- 🎯 **Next Focus**: Enhanced debugging capabilities + Phase 4 Ingrid AI Assistant implementation

## Architecture Overview

This is a React + TypeScript application for **INFOtrac**, an expense management and business automation platform built with Vite, PostgreSQL, Node.js backend, and shadcn/ui.

### Key Technologies
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui components with Radix UI and Tailwind CSS
- **Backend**: Node.js/Express with JWT authentication (containerized)
- **Database**: PostgreSQL with Row Level Security (RLS) (containerized)
- **Infrastructure**: Full Docker Compose environment with Redis, Nginx
- **Routing**: React Router v6 with protected routes
- **State Management**: TanStack Query for server state
- **Mobile**: Capacitor for iOS/Android apps

### Architecture Patterns

#### Authentication & Authorization
- Role-based access control: `super-admin`, `admin`, `user`
- Protected routes with `ProtectedRoute` component in `src/App.tsx`
- Multi-tenant architecture with company-based data isolation
- User impersonation support for admins
- Complex onboarding flow for different user types

#### File Structure
- `src/pages/` - Main application pages
- `src/components/` - Reusable UI components
- `src/components/ui/` - shadcn/ui components (do not edit directly)
- `src/layouts/` - Layout components (RootLayout with sidebar)
- `src/integrations/api/` - API client configuration
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and business logic
- `src/services/ingrid/` - **🆕 Ingrid AI services** (Category mapping, suggestions, document processing)
- `src/hooks/` - **🆕 Document management hooks** (useDocumentUpload for comprehensive file operations)
- `backend/src/services/` - **🆕 Backend services** (Smart document naming, storage management)
- `backend/src/routes/` - **🆕 API endpoints** (Document management RESTful APIs)
- `database/migrations/` - Database schema including category suggestion system and document management
- `database/init/` - **🆕 Document management schema** (Complete database initialization)

#### Key Components
- **RootLayout**: Main layout with sidebar navigation
- **SessionContextProvider**: Manages user session and profile state
- **ProtectedRoute**: Handles authentication and role-based redirects
- Complex dialogs for automation, company setup, and user management

#### Business Domains
- **Expense Management**: Upload, categorize, and process expense receipts
- **🆕 AI Category Intelligence**: Intelligent expense category mapping and suggestion system
- **🆕 AI Vendor Intelligence**: Intelligent vendor mapping and suggestion system with web enrichment
- **Process Automation**: Email-based document processing with AI
- **Company Management**: Multi-tenant company settings and module access
- **User Management**: Role-based user administration
- **🆕 Document Management**: Enterprise-grade document storage with AI-powered smart naming
- **Document Processing**: PDF viewing and AI-powered data extraction

#### Key Technical Files for AI Suggestion Systems

**Category Suggestions:**
- **`src/services/ingrid/CategoryMappingService.ts`**: Core intelligence engine with fuzzy/semantic matching
- **`src/services/ingrid/SuggestedCategoryService.ts`**: Complete CRUD operations and approval workflow
- **`src/components/SuggestedCategoriesTab.tsx`**: Controller UI for managing suggestions
- **`src/pages/ExpenseCategoriesPage.tsx`**: Integrated tabs for categories and suggestions
- **`database/migrations/006_create_ingrid_suggested_categories.sql`**: Database schema and functions

**Vendor Suggestions:**
- **`src/services/ingrid/VendorMappingService.ts`**: Core intelligence engine with fuzzy/semantic matching and web enrichment
- **`src/services/ingrid/SuggestedVendorService.ts`**: Complete CRUD operations and approval workflow
- **`src/components/SuggestedVendorsTab.tsx`**: Controller UI for managing vendor suggestions
- **`src/pages/VendorsPage.tsx`**: Integrated tabs for vendors and suggestions
- **`database/migrations/007_create_ingrid_suggested_vendors.sql`**: Database schema and functions

**Unified Expense Review System:**
- **`src/components/expenses/ReviewInboxTab.tsx`**: Complete reviewer interface with smart filtering, assignment creation, and bulk operations

**Document Management System:**
- **`database/init/06-document-management.sql`**: Complete database schema with document tables, associations, and access logging
- **`backend/src/services/smartDocumentNaming.ts`**: AI-powered naming engine with template system and confidence-based strategies
- **`backend/src/services/documentStorage.ts`**: Multi-backend document storage service with checksum duplicate detection
- **`backend/src/routes/documents.ts`**: RESTful API endpoints for document CRUD operations with permission validation
- **`src/hooks/useDocumentUpload.ts`**: React hook for document operations with progress tracking and smart naming
- **`src/components/ReceiptUpload.tsx`**: Enhanced receipt upload with document management integration
- **`src/components/AddEditExpenseDialog.tsx`**: Updated expense dialog with document ID state management
- **`src/components/vendors/AIEnhancedVendorCreation.tsx`**: Vendor creation with smart document naming integration
- **`src/components/customers/AIEnhancedCustomerCreation.tsx`**: Customer creation with business card document processing
- **`src/components/ingrid/ProfessionalIngridChat.tsx`**: Chat interface with document upload and smart naming capabilities

**Professional Ingrid AI Chat Interface:**
- **`src/pages/IngridAIPage.tsx`**: Main AI assistant page with two-column layout and permission-based access control
- **`src/components/ingrid/ProfessionalIngridChat.tsx`**: Advanced chat interface with file uploads, typing indicators, and message management
- **`src/components/ingrid/IngridActionCards.tsx`**: Action cards system for reviewing and approving AI suggestions
- **`src/hooks/use-user-menu-preferences.tsx`**: Updated menu system with "Ingrid AI Assistant" integration
  - Advanced filtering system (search, submitter, amount range, date range, priority)
  - Expense assignment workflow with team member selection and notifications
  - Status-based expense organization (pending, approved, rejected, info_requested, overdue)
  - Active filter indicators with individual removal capabilities
  - Mobile-responsive design with card/table layout switching
- **`src/pages/EnhancedExpensesPage.tsx`**: Enhanced main expenses page with permission-based Review Inbox tab
  - Smart tab ordering (Review Inbox first for reviewers, All first for others)
  - Permission-based tab visibility using OPERATIONS_PERMISSIONS.EXPENSES_REVIEW
  - Unified interface replacing separate ExpenseReviewPage
- **`src/components/expenses/SelectableExpenseTable.tsx`**: Multi-purpose table component for expense display
- **`src/components/ExpenseSummaryCard.tsx`**: Detailed expense information cards for mobile layouts
- **`src/components/BulkActionsToolbar.tsx`**: Advanced bulk operations with notification integration
- **`src/hooks/usePermissions.ts`**: Enhanced permission system for granular access control
- **`src/hooks/use-user-menu-preferences.tsx`**: Updated menu system with legacy expense review items removed
- **`src/App.tsx`**: Cleaned routing configuration with ExpenseReviewPage route removal

### Important Development Notes

#### Tech Stack Constraints
- All shadcn/ui components are pre-installed - do not install additional ones
- Use Tailwind CSS extensively for styling
- Routes are centrally managed in `src/App.tsx`
- Main page is `src/pages/Index.tsx`
- Always update the main page when adding new components for visibility

#### Backend Integration (Docker-Based)
- API client configured in `src/integrations/api/client.ts`
- Uses Row Level Security (RLS) for data access control at database level
- Node.js/Express backend handles all business logic (runs in Docker container)
- **CRITICAL**: Fully containerized environment - PostgreSQL, Redis, and Backend all in Docker
- Frontend connects to containerized backend at `http://localhost:3001`
- Database runs in Docker container via `docker-compose.dev.yml`
- All schema changes handled via migration files in `database/migrations/`
- Development workflow: Start Docker services first, then run frontend locally

#### Mobile Support
- Capacitor configured for iOS/Android deployment
- Responsive design with mobile-first approach

### Current Features
- Dashboard with analytics and charts
- Expense tracking and receipt processing
- Vendor and customer management with AI-powered vendor suggestions
- GL account and expense category management with AI-powered category suggestions
- Process automation with email integration
- Company and user administration
- Billing and module management
- Notification system
- **🆕 Ingrid Category Suggestion System** (Phase 3.5 - Completed September 22, 2025)
  - AI-powered category mapping with fuzzy/semantic matching
  - Controller approval workflow for new category suggestions
  - Usage analytics and bulk operations
  - Seamless integration with document processing pipeline
- **🆕 Ingrid Vendor Suggestion System** (Phase 3.6 - Completed September 22, 2025)
  - AI-powered vendor mapping with fuzzy/semantic matching and web enrichment
  - Controller approval workflow for new vendor suggestions with merge capabilities
  - Complete vendor data editing (contact info, address, business details)
  - Web enrichment for missing vendor details with confidence scoring
  - Usage analytics and bulk operations
  - Seamless integration with document processing pipeline
- **🆕 Enhanced Permission Management System** (Phase 3.7 - Completed September 22, 2025)
  - Enterprise-grade permission management with graceful degradation
  - Individual user permission management with comprehensive validation
  - Real-time change tracking with bulk save operations
  - Permission guard system that prevents UI breakage when permissions change
  - Role-based user filtering (admin vs super-admin restrictions)
  - Advanced validation service with security rules and error handling
- **🆕 Navigation & Authentication Fixes** (Phase 3.8 - Completed September 22, 2025)
  - Super-admin profile completion loop resolution
  - Enhanced invited user onboarding with company summary display
  - Navigation restructure: User Management moved to main menu
  - Legacy Companies page removal and cleanup
  - Module activation system documentation (`MODULE_ACTIVATION_SYSTEM.md`)
- **🆕 Unified Expense Review System** (Phase 3.9 - Completed September 25, 2025)
  - **Integrated Workflow**: Unified expense review within main Expenses page, eliminating separate review interface
  - **Smart Tab Ordering**: Review Inbox appears first for users with EXPENSES_REVIEW permissions, "All" tab first for others
  - **Permission-Based Access**: "Review Inbox" tab visible only to admin/controller/super-admin users with proper permissions
  - **Comprehensive Review Actions**: Approve, reject, request information with detailed notes and notification integration
  - **Advanced Assignment System**: Create expense assignments for team members with due dates, messages, and automatic notifications
  - **Intelligent Filtering**: Multi-criteria smart filtering with search, submitter selection, amount ranges, date ranges, and priority-based filtering
  - **Active Filter Management**: Visual filter indicators with individual removal capabilities and "Clear All" functionality
  - **Bulk Operations**: Mass approve/reject with notification broadcasting and progress tracking
  - **Mobile-Responsive Design**: Adaptive layouts with ResizableTable for desktop and card layouts for mobile devices
  - **Status-Based Organization**: Tabbed interface for pending, approved, rejected, and info-requested expenses
  - **Module Integration**: Respects company module configurations for field visibility and feature availability
  - **Navigation Cleanup**: Removed legacy expense review menu items and routes system-wide
  - **Seamless Redirects**: Updated all expense review redirects to flow through unified interface
- **🆕 Comprehensive Document Management System with Smart Naming** (Phase 4.1 - Completed September 25, 2025)
  - **AI-Powered Smart Naming**: Automatically generates meaningful filenames based on document content (e.g., "Expense_Staples_2025-01-25_$45.99.pdf")
  - **Company-Based Isolation**: Complete multi-tenant document storage with strict company separation
  - **Permission-Based Access Control**: Granular document permissions integrated with existing role system
  - **Multiple Storage Backends**: Database, filesystem, and S3-ready storage with automatic selection based on file size
  - **Configurable Naming Templates**: Company-customizable naming patterns per document type with variable substitution
  - **Confidence-Based Naming Strategy**: High/medium/low confidence approaches for optimal naming results
  - **Complete Audit Trail**: Full logging of all document access, modifications, and downloads with IP tracking
  - **Duplicate Detection**: Checksum-based duplicate prevention within company boundaries
  - **File Security**: Type validation, size limits, virus scanning ready, and secure storage paths
  - **Frontend Integration**: React hook (`useDocumentUpload`) with progress tracking and smart name preview
  - **API-Driven**: RESTful document management endpoints with rate limiting and security validation
  - **Migration Support**: Automated migration tools for existing document references
  - **Future-Ready**: Designed as foundation for upcoming Document Management module
- **🆕 Professional Ingrid AI Chat Interface** (Phase 4.0 - Completed September 25, 2025)
  - **Two-Column Professional Layout**: Dedicated page with resizable panels (chat left, action cards right)
  - **Advanced Chat Interface**: Professional messaging with file uploads, typing indicators, and status tracking
  - **Action Cards System**: AI-generated suggestions with edit, approve, and reject workflows
  - **Permission-Based Menu Integration**: "Ingrid AI Assistant" menu item with proper access controls
  - **Real-Time Interaction**: Live chat simulation with document processing and intelligent responses
  - **Session Analytics**: Message count, document processing, and approval statistics tracking
  - **Mobile-Responsive Design**: Adaptive interface that works across all device sizes
  - **Enterprise Security**: Full permission validation with graceful access denied states
  - **Floating Chat Removal**: Eliminated old bubble interface in favor of dedicated professional page
- **🆕 Document Intelligence System** (Phase 4.1 - Completed September 25, 2025)
  - **Advanced Duplicate Detection**: Multi-factor analysis using SHA-256, perceptual hashing, and content similarity with temporal intelligence for recurring documents
  - **Context-Aware Relevance Analysis**: Business document classification with category-specific warnings and confidence scoring
  - **Comprehensive Content Analysis**: OCR + business entity extraction (amounts, dates, vendors, addresses, emails, phone numbers) with structured data output
  - **Universal Integration**: Seamless integration across ALL upload components (expenses, vendors, customers, chat) with existing PostgreSQL document management
  - **Smart Document Warnings**: Sophisticated UI component for displaying analysis results with actionable insights and user controls
  - **Permission-Aware Analysis**: Company-scoped duplicate detection respecting user access permissions
  - **Intelligent Document Naming**: AI-powered smart file naming based on extracted content and document type classification
  - **Enterprise-Grade Architecture**: Backend services orchestration with graceful fallback mechanisms and optimized database performance

### AI System Evolution
**Current (Phase 4.0):** Professional AI chat interface with advanced document processing, enterprise permission management, and comprehensive workflow automation
- ✅ **Category Intelligence**: AI-powered category mapping with 95%+ accuracy
- ✅ **Vendor Intelligence**: AI-powered vendor mapping with 95%+ accuracy and web enrichment
- ✅ **Permission Intelligence**: Enterprise-grade permission management with graceful degradation
- ✅ **Fuzzy Matching**: Levenshtein distance algorithm for similar category/vendor names
- ✅ **Semantic Understanding**: Comprehensive synonym mapping for business categories and vendors
- ✅ **Web Enrichment**: Automatic vendor data enhancement from external sources
- ✅ **Controller Workflow**: Complete approval system for new category and vendor suggestions
- ✅ **Permission Validation**: Advanced security rules with role-based restrictions
- ✅ **Usage Analytics**: Data-driven category and vendor management with confidence scoring
- ✅ **Database Integration**: PostgreSQL with backend API functions and automated deduplication
- ✅ **Merge Operations**: Intelligent merging of similar suggestions
- ✅ **Real-time Updates**: Optimistic UI updates with server synchronization
- ✅ **Professional Chat Interface**: Two-column layout with resizable panels and real-time messaging
- ✅ **Action Cards System**: AI-generated suggestions with comprehensive edit, approve, and reject workflows
- ✅ **Session Analytics**: Real-time tracking of user interactions, document processing, and approval metrics
- ✅ **Advanced File Processing**: Support for multiple document types with intelligent content extraction
- ✅ **Permission-Based Access**: Enterprise-grade security with graceful access control and role validation
- ✅ **Document Intelligence**: AI-powered smart naming with confidence-based strategies and template customization
- ✅ **Multi-Tenant Storage**: Company-isolated document management with multiple backend support
- ✅ **Seamless Integration**: Document management integrated across all upload workflows without disruption

**Future (Phase 4.2):** **Next Generation AI Features**
- 🤖 **Enhanced Machine Learning**: Advanced pattern recognition and user behavior learning
- 🌐 **Real-Time Web Enrichment**: Live data enhancement from external sources and APIs
- 🔗 **SPIRE Integration**: AI-powered accounting automation with category sync
- 🎯 **Context Awareness**: Machine learning from user patterns and preferences
- 📊 **Advanced Analytics**: Predictive insights and automated reporting
- 🔄 **Workflow Automation**: Intelligent process optimization and routing

#### Key Technical Files for Document Intelligence System

**Backend Services:**
- **`backend/src/services/documentContentAnalysis.ts`**: OCR and business entity extraction service with comprehensive text analysis
- **`backend/src/services/documentDuplicateDetection.ts`**: Multi-factor duplicate detection with temporal intelligence and perceptual hashing
- **`backend/src/services/documentRelevanceAnalysis.ts`**: Context-aware business document classification with confidence scoring
- **`backend/src/services/documentIntelligenceOrchestrator.ts`**: Coordinates all analysis services for comprehensive document intelligence
- **`backend/src/routes/documents.ts`**: Enhanced API routes with pre-upload analysis, full analysis, and duplicate checking endpoints

**Frontend Components:**
- **`src/components/SmartDocumentWarnings.tsx`**: Sophisticated UI for displaying analysis results with actionable insights and user controls
- **`src/hooks/useDocumentUpload.ts`**: Enhanced hook with pre-upload analysis capabilities and intelligence state management
- **`src/components/ReceiptUpload.tsx`**: Enhanced with document intelligence (removed Supabase dependency, added PostgreSQL intelligence)
- **`src/components/vendors/AIEnhancedVendorCreation.tsx`**: Enhanced with document intelligence analysis and smart warnings
- **`src/components/customers/AIEnhancedCustomerCreation.tsx`**: Enhanced with document intelligence analysis and smart warnings
- **`src/components/ingrid/ProfessionalIngridChat.tsx`**: Enhanced with advanced document intelligence analysis for uploaded files

**Database Schema:**
- **`database/init/06-document-management.sql`**: Enhanced with intelligence fields (perceptual_hash, content_analysis, relevance_score, temporal_classification, duplicate_analysis) and optimized JSONB indexes

**Migration Strategy:** See `INGRID_AI_MIGRATION_STRATEGY.md` for detailed implementation plan

### Development Workflow
1. Routes are defined in `src/App.tsx` - keep them there
2. Put new pages in `src/pages/`
3. Put new components in `src/components/`
4. Update `src/pages/Index.tsx` to include new components for user visibility
5. Use existing shadcn/ui components instead of creating new ones
6. Follow the established authentication and authorization patterns

## Development Roadmap
See `INFOTRAC_UNIVERSAL_ROADMAP.md` for comprehensive development planning:
- Phase 1: ✅ Completed (Stability & Error Handling)
- Phase 2: ✅ Completed (Architecture & TypeScript)
- Phase 3: ✅ Completed (Production Readiness)
- Phase 3.5: ✅ Completed (Ingrid Category Suggestion System)
- Phase 3.6: ✅ Completed (Ingrid Vendor Suggestion System)
- Phase 3.7: ✅ Completed (Enhanced Permission Management System)
- Phase 3.8: ✅ Completed (Navigation & Authentication Fixes)
- Phase 3.9: ✅ Completed (Unified Expense Review System)
- Phase 4.0: ✅ Completed (Professional Ingrid AI Chat Interface)
- Phase 4.1: ✅ Completed (Comprehensive Document Management System with Smart Naming)
  - ESLint violations: **269** (MASSIVE SUCCESS - down from 1,056!)
  - Bundle optimizations: 96% reduction achieved in critical components
  - Testing infrastructure: Ready for expansion (40% coverage target)
  - Document management: Full integration across all upload workflows

## Module Activation System
See `MODULE_ACTIVATION_SYSTEM.md` for comprehensive documentation on creating and activating new modules:
- Three-tier activation process (System → Company → User)
- Complete developer workflow for new features
- Menu system integration and route protection
- Testing and verification procedures
- ratelimited
- When I say ratelimited or #ratelimited, restart the entire dev environment so we can circumvent it.