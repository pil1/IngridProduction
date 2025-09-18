# INFOtrac Application - Complete Rewrite Specification

## Executive Summary

This document provides a comprehensive specification for rewriting the INFOtrac expense management and business automation platform from the ground up. The current application is a sophisticated multi-tenant B2B SaaS platform built on Supabase, and this rewrite will modernize the architecture while preserving all functionality.

## Table of Contents

1. [Business Requirements](#business-requirements)
2. [Technical Architecture](#technical-architecture)
3. [Core Features Specification](#core-features-specification)
4. [Database Design](#database-design)
5. [API Specification](#api-specification)
6. [Frontend Requirements](#frontend-requirements)
7. [Security Requirements](#security-requirements)
8. [Integration Requirements](#integration-requirements)
9. [Performance Requirements](#performance-requirements)
10. [Deployment & Infrastructure](#deployment--infrastructure)
11. [Migration Strategy](#migration-strategy)
12. [Timeline & Milestones](#timeline--milestones)
13. [Spire Integration](#spire-integration)

---

## 1. Business Requirements

### 1.1 Core Business Model
- **Multi-tenant B2B SaaS** expense management platform
- **Role-based access control** with hierarchical permissions
- **AI-powered** document processing and expense categorization
- **Modular feature system** for flexible company configurations
- **Cross-platform support** (web + mobile)

### 1.2 Target Users
- **Super Administrators**: System-wide management and configuration
- **Company Administrators**: Company setup, user management, configuration
- **Controllers**: Financial oversight, expense approval workflows
- **End Users**: Expense submission, basic reporting, profile management

### 1.3 Core Value Propositions
1. **Automated Expense Processing**: AI-powered receipt analysis and categorization
2. **Workflow Automation**: Configurable approval processes and notifications
3. **Financial Compliance**: GL account mapping, audit trails, reporting
4. **Multi-Company Management**: Scalable multi-tenant architecture
5. **Mobile-First Design**: Native mobile app with offline capabilities

---

## 2. Technical Architecture

### 2.1 Recommended Modern Tech Stack

#### Backend
- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5
- **Authentication**: NextAuth.js v5
- **API**: tRPC v11 (type-safe APIs)
- **File Storage**: Local filesystem + S3-compatible (Minio)
- **Cache**: Redis
- **Queue**: Bull MQ (Redis-based)

#### Frontend
- **Framework**: React 18 + TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (Radix UI)
- **State Management**: Zustand + TanStack Query v5
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Date Handling**: date-fns

#### Mobile Strategy
- **Primary Approach**: Capacitor web wrapper for cross-platform deployment
- **Native Option**: React Native + Expo for enhanced native performance
- **Responsive Web**: Fully responsive web application with mobile-first design
- **Navigation**: React Navigation v6 (for native) / Next.js routing (for web)
- **UI**: NativeBase or React Native Elements (native) / shadcn/ui (web)
- **State**: Shared store with web app via Zustand

#### AI & External Services
- **Document AI**: Google Document AI API
- **LLM**: OpenAI GPT-4 or Claude API
- **Email**: Resend or SendGrid
- **PDF Processing**: pdf-lib + pdf2pic

#### Development & Deployment
- **Package Manager**: pnpm
- **Build Tool**: Turbo (monorepo)
- **Testing**: Vitest + Testing Library
- **E2E Testing**: Playwright
- **CI/CD**: GitHub Actions
- **Deployment**: Docker + Kubernetes or Vercel
- **Monitoring**: Sentry + Axiom

### 2.2 Architecture Patterns

#### Monorepo Structure
```
infotrac/
├── apps/
│   ├── web/                 # Next.js web application
│   ├── mobile/              # React Native mobile app
│   └── api/                 # Standalone API (if needed)
├── packages/
│   ├── ui/                  # Shared UI components
│   ├── database/            # Prisma schema and migrations
│   ├── auth/                # Authentication utilities
│   ├── email/               # Email templates and utilities
│   ├── ai/                  # AI processing utilities
│   └── shared/              # Shared utilities and types
├── docs/                    # Documentation
└── tools/                   # Build tools and scripts
```

#### Backend Architecture
- **tRPC Routers**: Type-safe API endpoints
- **Middleware**: Authentication, authorization, logging
- **Services**: Business logic layer
- **Jobs**: Background processing with Bull MQ
- **Database**: Prisma with connection pooling

#### Frontend Architecture
- **App Router**: Next.js 15 file-based routing
- **Server Components**: Server-side rendering where beneficial
- **Client Components**: Interactive UI with React
- **Shared State**: Zustand for global state
- **Server State**: TanStack Query for API data

### 2.3 AI Integration Strategy

#### Core AI Principles
- **Deep Integration**: AI embedded in every user interaction and business process
- **Contextual Intelligence**: AI understands business context, user roles, and company-specific workflows
- **Adaptive Learning**: System continuously learns from user behavior and feedback
- **Explainable AI**: All AI decisions provide clear reasoning and confidence scores
- **Ethical AI**: Bias mitigation, privacy protection, and transparent data usage

#### AI Service Architecture
```typescript
interface AIService {
  // Natural Language Processing
  processText(text: string, context: AIContext): Promise<AIResponse>;

  // Computer Vision
  analyzeDocument(file: File, type: DocumentType): Promise<DocumentAnalysis>;

  // Predictive Analytics
  predictTrends(data: HistoricalData, timeframe: TimeRange): Promise<PredictionResult>;

  // Recommendation Engine
  generateSuggestions(user: User, context: BusinessContext): Promise<Suggestion[]>;

  // Document Generation
  createDocument(template: Template, data: DocumentData): Promise<GeneratedDocument>;
}
```

#### AI Data Pipeline
1. **Data Collection**: Capture user interactions, business transactions, and system events
2. **Data Processing**: Clean, normalize, and enrich data for AI consumption
3. **Model Training**: Continuous learning from historical and real-time data
4. **Inference**: Real-time AI predictions and recommendations
5. **Feedback Loop**: User feedback improves model accuracy over time

#### AI-Powered Features Matrix
| Feature Category | AI Capabilities | Business Impact |
|------------------|-----------------|-----------------|
| Document Processing | OCR, data extraction, categorization | 90% reduction in manual data entry |
| Expense Analysis | Anomaly detection, policy compliance | Proactive fraud prevention |
| Workflow Automation | Smart routing, deadline prediction | 70% faster approval processes |
| Business Insights | Predictive analytics, trend analysis | Data-driven decision making |
| Document Generation | Template-based creation, customization | Instant document production |

---


## 3. Core Features Specification

### 3.1 Authentication & User Management

#### Features
- **Email/Password Login**: Secure authentication with bcrypt
- **Multi-Factor Authentication**: TOTP support
- **Password Reset**: Email-based password recovery
- **User Impersonation**: Super-admin impersonation capability
- **Session Management**: JWT with refresh tokens
- **Role-Based Access**: Hierarchical permission system

#### User Roles & Permissions
```typescript
enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  CONTROLLER = "controller",
  USER = "user"
}

interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}
```

#### User Profile Features
- Personal information management
- Avatar upload and cropping
- Notification preferences
- Multi-language support (future)
- Theme preferences (light/dark)

### 3.2 Company Management

#### Multi-Tenant Architecture
- **Company Creation**: Super-admin company setup
- **Company Settings**: Branding, currencies, localization
- **Location Management**: Multiple company locations
- **Module Configuration**: Feature enablement per company

#### Company Features
- Company logo and branding
- Default currency and locale settings
- SMTP configuration for company emails
- Custom email templates
- Billing and subscription management

### 3.3 Module System

#### Core Modules
1. **Dashboard**: Analytics, charts, quick actions
2. **Expense Management**: Core expense submission and approval
3. **User Management**: User invitation and role management
4. **Company Settings**: Company configuration
5. **Reporting**: Financial reports and analytics
6. **Notifications**: System and email notifications

#### Module Configuration
- Enable/disable modules per company
- Configure module-specific settings
- User-level module access control
- Custom module permissions

### 3.4 Expense Management

#### Expense Submission
- **Manual Entry**: Form-based expense submission
- **Receipt Upload**: Drag-drop file upload
- **AI Processing**: Automatic data extraction
- **Multi-Currency**: Support for multiple currencies
- **Line Items**: Detailed expense breakdown
- **Categories**: Expense categorization

#### Receipt Processing Workflow
1. **File Upload**: PDF/image receipt upload
2. **OCR Processing**: Text extraction from documents
3. **AI Analysis**: Expense data extraction (amount, date, vendor)
4. **Data Validation**: User review and correction
5. **Categorization**: Auto-assignment to categories/GL accounts
6. **Duplicate Detection**: Hash-based duplicate prevention

#### Approval Workflow
- **Configurable Approval**: Multi-stage approval process
- **Role-Based Review**: Reviewer and controller roles
- **Comments System**: Review comments and feedback
- **Status Tracking**: Complete audit trail
- **Notifications**: Email alerts for workflow events

#### Expense Features
- Multi-currency support with exchange rates
- GL account mapping for accounting integration
- Project/cost center allocation
- Mileage tracking
- Recurring expenses
- Expense policies and limits

### 3.5 Vendor & Customer Management

#### Vendor Management
- Vendor contact information
- Payment terms configuration
- Vendor-specific expense policies
- Integration with expense categorization
- Vendor performance tracking

#### Customer Management
- Customer contact database
- Billing address management
- Customer-specific settings
- Revenue tracking (future)

### 3.6 Financial Management

#### Chart of Accounts
- GL account management
- Account code structure
- Category mapping
- Budget allocation (future)

#### Reporting & Analytics
- **Dashboard Analytics**: Key metrics and charts
- **Expense Reports**: Detailed expense analysis
- **Custom Reports**: User-configurable reports
- **Export Functionality**: PDF, Excel, CSV exports
- **Real-time Data**: Live dashboard updates

### 3.7 Automation System

#### Process Automation
- **Trigger Events**: Expense submission, approval, rejection, payment processing, vendor interactions
- **Actions**: Email notifications, data updates, integrations, document generation, task creation
- **Email Templates**: Dynamic template system with AI content generation
- **Workflow Builder**: Visual workflow configuration with AI suggestions
- **Smart Routing**: AI determines optimal approval paths based on expense type, amount, and historical patterns

#### AI-Powered Features
- **Intelligent Categorization**: ML models learn from user corrections and company-specific patterns
- **Vendor Recognition**: AI identifies vendors from receipts and suggests vendor profiles
- **Duplicate Detection**: Advanced algorithms detect duplicates across companies and time periods
- **Policy Compliance**: Real-time policy checking with natural language policy understanding
- **Predictive Analytics**: Forecast expenses, identify trends, and suggest budget adjustments
- **Automation Suggestions**: AI analyzes workflows and suggests automation opportunities
- **Smart Notifications**: Context-aware notifications with actionable insights
- **Task Automation**: Automatic creation of follow-up tasks based on expense patterns

#### Advanced Automation Capabilities
- **Conditional Workflows**: Complex business rules with AI-optimized conditions
- **Multi-step Automations**: Chain multiple actions with intelligent sequencing
- **Exception Handling**: AI detects anomalies and triggers appropriate responses
- **Performance Optimization**: Continuous learning improves automation efficiency
- **User Training**: AI suggests workflow improvements based on usage patterns

### 3.8 Communication System

#### Email System
- **System Emails**: Password reset, invitations, notifications
- **Company Emails**: Branded email templates
- **SMTP Configuration**: System and company-specific SMTP
- **Email Templates**: Rich HTML templates with variables
- **Email Tracking**: Delivery status and open rates

#### Notification System
- **In-App Notifications**: Real-time notification center
- **Email Notifications**: Configurable email alerts
- **Push Notifications**: Mobile push notifications
- **Notification Preferences**: User-configurable settings

### 3.9 Mobile Application Strategy

#### Deployment Options

##### Primary: Capacitor Web Wrapper
- **Single Codebase**: Web app wrapped for native deployment
- **Cross-Platform**: iOS, Android, and responsive web
- **Native Features**: Camera, GPS, file system, push notifications
- **Performance**: Near-native performance with web technologies
- **Development**: Faster development cycle, shared components

##### Alternative: React Native
- **Native Performance**: True native iOS/Android apps
- **Platform Optimization**: Platform-specific UI/UX optimizations
- **Advanced Features**: Complex native integrations, offline-first
- **Development**: Separate mobile codebase with shared business logic

##### Progressive Web App (PWA)
- **Zero-Install**: App-like experience without app stores
- **Offline Support**: Service worker caching and background sync
- **Cross-Device**: Works on any modern browser
- **Updates**: Automatic updates without user intervention

#### Core Mobile Features (All Options)
- **Expense Submission**: Camera integration for receipt capture
- **Photo Capture**: High-quality receipt photos with OCR
- **Approval Workflow**: Touch-optimized approval process
- **Dashboard**: Mobile-responsive analytics and KPIs
- **Offline Mode**: Core functionality without internet connection
- **Push Notifications**: Real-time alerts and reminders

#### Advanced Mobile Features
- **GPS Integration**: Location tracking for expense context
- **Biometric Auth**: Fingerprint/Face ID for secure access
- **Offline Sync**: Automatic synchronization when online
- **Background Processing**: Receipt upload and AI processing in background
- **Voice Commands**: Voice-to-text for expense descriptions
- **NFC Support**: Tap-to-pay integration for expenses
- **Haptic Feedback**: Native touch feedback for interactions

#### Mobile UI/UX Principles
- **Thumb-Friendly Design**: Important actions within thumb reach
- **Gesture Support**: Swipe, pinch, and long-press interactions
- **Material Design**: Consistent with platform design guidelines
- **Dark Mode**: System-aware dark/light theme switching
- **Accessibility**: Screen reader support, high contrast options
- **Performance**: 60fps animations, smooth scrolling

#### Mobile-Specific AI Features
- **Voice-to-Expense**: Voice commands for expense creation
- **Smart Camera**: AI-powered receipt capture and processing
- **Location Intelligence**: Context-aware expense categorization
- **Offline AI**: Cached AI models for offline processing
- **Predictive Input**: AI suggestions based on usage patterns

### 3.10 Business Insights & Analytics

#### AI-Powered Business Intelligence
- **Predictive Analytics**: Forecast future expenses, revenue, and cash flow
- **Anomaly Detection**: Identify unusual spending patterns and potential fraud
- **Trend Analysis**: Deep insights into spending trends by category, vendor, department
- **Benchmarking**: Compare performance against industry standards and historical data
- **Scenario Planning**: What-if analysis for budget planning and decision making

#### Advanced Analytics Features
- **Natural Language Queries**: Ask questions in plain English ("What were my travel expenses last quarter?")
- **Automated Insights**: AI-generated reports highlighting key findings and recommendations
- **Custom Dashboards**: Drag-and-drop dashboard builder with AI suggestions
- **Real-time Alerts**: Intelligent notifications for budget variances, policy violations
- **Executive Summaries**: AI-generated executive reports with key takeaways

#### Data Visualization & Reporting
- **Interactive Charts**: Dynamic visualizations with drill-down capabilities
- **Custom Report Builder**: No-code report creation with AI assistance
- **Automated Report Distribution**: Scheduled reports delivered via email or dashboard
- **Data Export**: Export to various formats with AI-optimized formatting
- **Collaborative Analytics**: Share insights with team members and stakeholders

#### Machine Learning Models
- **Expense Forecasting**: Predict future spending based on historical patterns
- **Vendor Performance**: Analyze vendor reliability, pricing trends, and payment terms
- **Budget Optimization**: AI recommendations for budget allocation and cost reduction
- **Risk Assessment**: Identify financial risks and compliance issues
- **Cash Flow Prediction**: Forecast cash flow based on expense patterns and payment cycles

#### Business Intelligence API
```typescript
interface BusinessInsightsAPI {
  // Predictive Analytics
  predictExpenses(params: PredictionParams): Promise<PredictionResult>;
  detectAnomalies(data: ExpenseData[]): Promise<AnomalyReport>;

  // Natural Language Processing
  queryData(query: string, context: QueryContext): Promise<QueryResult>;
  generateInsights(data: AnalyticsData): Promise<InsightReport>;

  // Automated Reporting
  createReport(config: ReportConfig): Promise<GeneratedReport>;
  scheduleReport(schedule: ScheduleConfig): Promise<ScheduledReport>;
}
```

### 3.11 AI-Powered Document Creation

#### Intelligent Document Generation
- **Contract Creation**: AI-drafted contracts with clause suggestions and risk analysis
- **Invoice Generation**: Automated invoice creation from expense data with smart formatting
- **Purchase Orders**: AI-generated POs with vendor optimization and approval routing
- **Legal Documents**: Template-based legal document creation with compliance checking
- **Business Proposals**: AI-assisted proposal writing with competitive analysis

#### Document AI Features
- **Template Intelligence**: AI learns from document usage patterns and suggests improvements
- **Content Optimization**: Natural language generation for professional document content
- **Compliance Checking**: Automated review against legal and regulatory requirements
- **Version Control**: AI-tracked document versions with change highlighting
- **Collaboration Tools**: Real-time collaborative editing with AI suggestions

#### Advanced Document Capabilities
- **Multi-format Support**: Generate documents in PDF, Word, Excel, and other formats
- **Dynamic Templates**: AI-customized templates based on document type and context
- **Data Integration**: Pull data from various sources to populate documents automatically
- **Signature Workflow**: Electronic signature integration with AI-verified authenticity
- **Document Analytics**: Track document usage, effectiveness, and user engagement

#### Document Generation API
```typescript
interface DocumentGenerationAPI {
  // Core Generation
  generateDocument(templateId: string, data: DocumentData): Promise<GeneratedDocument>;
  createContract(params: ContractParams): Promise<ContractDocument>;

  // AI Enhancement
  optimizeContent(content: string, context: DocumentContext): Promise<OptimizedContent>;
  suggestClauses(documentType: string, requirements: string[]): Promise<ClauseSuggestion[]>;

  // Compliance & Review
  checkCompliance(document: Document, standards: ComplianceStandard[]): Promise<ComplianceReport>;
  reviewDocument(document: Document): Promise<DocumentReview>;

  // Templates & Customization
  createTemplate(baseTemplate: Template, customizations: Customization[]): Promise<CustomTemplate>;
  analyzeTemplates(usageData: TemplateUsage[]): Promise<TemplateInsights>;
}
```

#### Document Types Supported
1. **Financial Documents**: Invoices, receipts, purchase orders, budgets
2. **Legal Documents**: Contracts, agreements, NDAs, terms of service
3. **Business Documents**: Proposals, reports, presentations, memos
4. **HR Documents**: Employment contracts, policies, handbooks
5. **Compliance Documents**: Audit reports, regulatory filings, certifications

---



## 4. Database Design

### 4.1 Core Tables

#### Users & Authentication
```sql
-- User authentication and profiles
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified_at TIMESTAMP,
  two_factor_secret VARCHAR(32),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  role user_role_enum NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar_url TEXT,
  bio TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  locale VARCHAR(10) DEFAULT 'en',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Companies & Multi-tenancy
```sql
companies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  domain VARCHAR(255),
  logo_url TEXT,
  default_currency CHAR(3) DEFAULT 'USD',
  timezone VARCHAR(50) DEFAULT 'UTC',
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

company_locations (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Module System
```sql
modules (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  category module_category_enum NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

company_modules (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, module_id)
);

user_modules (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);
```

#### Expense Management
```sql
expenses (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(15,4) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  base_currency_amount DECIMAL(15,4),
  exchange_rate DECIMAL(10,6),
  expense_date DATE NOT NULL,
  status expense_status_enum DEFAULT 'draft',
  category_id UUID REFERENCES expense_categories(id),
  gl_account_id UUID REFERENCES gl_accounts(id),
  vendor_id UUID REFERENCES vendors(id),
  merchant_name VARCHAR(255),
  project_code VARCHAR(100),
  cost_center VARCHAR(100),
  is_reimbursable BOOLEAN DEFAULT TRUE,

  -- Review workflow
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  controller_id UUID REFERENCES users(id),
  controller_approved_at TIMESTAMP,
  controller_notes TEXT,

  -- AI processing
  ai_confidence_score DECIMAL(3,2),
  ai_extracted_data JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

receipts (
  id UUID PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES users(id),

  -- AI processing results
  extracted_text TEXT,
  ai_analysis JSONB,
  document_hash CHAR(64) UNIQUE, -- SHA-256 for duplicate detection

  created_at TIMESTAMP DEFAULT NOW()
);

expense_line_items (
  id UUID PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(15,4) NOT NULL,
  total_amount DECIMAL(15,4) NOT NULL,
  category_id UUID REFERENCES expense_categories(id),
  gl_account_id UUID REFERENCES gl_accounts(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 Indexes and Performance

#### Key Indexes
```sql
-- Performance indexes
CREATE INDEX idx_expenses_company_date ON expenses(company_id, expense_date DESC);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_submitted_by ON expenses(submitted_by);
CREATE INDEX idx_receipts_hash ON receipts(document_hash);
CREATE INDEX idx_profiles_company ON profiles(company_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- Full-text search
CREATE INDEX idx_expenses_search ON expenses USING gin(to_tsvector('english', title || ' ' || description));
```

### 4.3 Data Relationships

#### Key Relationships
- **One Company → Many Users** (multi-tenant isolation)
- **One User → Many Expenses** (expense ownership)
- **One Expense → Many Receipts** (multiple receipt files)
- **One Expense → Many Line Items** (detailed breakdown)
- **Many Companies ↔ Many Modules** (feature enablement)
- **Many Users ↔ Many Modules** (access control)

---

## 5. API Specification

### 5.1 tRPC Router Structure

```typescript
// Main router structure
export const appRouter = router({
  auth: authRouter,
  users: userRouter,
  companies: companyRouter,
  expenses: expenseRouter,
  receipts: receiptRouter,
  vendors: vendorRouter,
  customers: customerRouter,
  modules: moduleRouter,
  notifications: notificationRouter,
  reports: reportRouter,
  automation: automationRouter,
  admin: adminRouter,
});
```

### 5.2 Core API Endpoints

#### Authentication Router
```typescript
export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => { /* ... */ }),

  register: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
    .mutation(async ({ input }) => { /* ... */ }),

  refresh: protectedProcedure
    .mutation(async ({ ctx }) => { /* ... */ }),

  impersonate: superAdminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => { /* ... */ }),
});
```

#### Expense Router
```typescript
export const expenseRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
      status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ input, ctx }) => { /* ... */ }),

  create: protectedProcedure
    .input(createExpenseSchema)
    .mutation(async ({ input, ctx }) => { /* ... */ }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateExpenseSchema }))
    .mutation(async ({ input, ctx }) => { /* ... */ }),

  submit: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => { /* ... */ }),

  approve: reviewerProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => { /* ... */ }),

  processReceipt: protectedProcedure
    .input(z.object({ receiptId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => { /* ... */ }),
});
```

### 5.3 Real-time Subscriptions

```typescript
// WebSocket subscriptions for real-time features
export const subscriptionRouter = router({
  expenseUpdates: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .subscription(async function* ({ input, ctx }) {
      // Real-time expense updates
    }),

  notifications: protectedProcedure
    .subscription(async function* ({ ctx }) {
      // Real-time notifications
    }),
});
```

---

## 6. Frontend Requirements

### 6.1 Component Architecture

#### Shared Components
- **Layout Components**: Header, sidebar, navigation
- **Form Components**: Input, select, textarea, file upload
- **Data Display**: Tables, cards, charts
- **Feedback**: Toast notifications, loading states, error boundaries
- **Navigation**: Breadcrumbs, pagination, tabs

#### Business Components
- **Expense Components**: ExpenseForm, ExpenseCard, ExpenseTable
- **Receipt Components**: ReceiptUpload, ReceiptViewer, ReceiptGallery
- **User Components**: UserProfile, UserInvitation, UserTable
- **Company Components**: CompanySettings, CompanyLogo, CompanyLocations

### 6.2 State Management

#### Global State (Zustand)
```typescript
interface AppState {
  user: User | null;
  company: Company | null;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  impersonating: User | null;
}
```

#### Server State (TanStack Query)
- Expense data with optimistic updates
- User profiles and company information
- Real-time notifications
- File upload progress

### 6.3 Forms and Validation

#### Form Patterns
- React Hook Form for form state management
- Zod schemas for validation
- Real-time validation feedback
- Auto-save for draft expenses
- File upload with progress indicators

### 6.4 Mobile Responsiveness & Cross-Platform Support

#### Responsive Breakpoints
- Mobile: 0-768px (optimized for phones)
- Tablet: 768-1024px (adaptive layouts)
- Desktop: 1024px+ (full feature set)
- Large Desktop: 1440px+ (enhanced dashboard layouts)

#### Mobile-First Design Principles
- **Progressive Enhancement**: Core functionality works on all devices
- **Touch-Optimized UI**: Large touch targets, gesture support
- **Adaptive Navigation**: Collapsible sidebar, bottom navigation for mobile
- **Responsive Typography**: Fluid typography scaling
- **Optimized Performance**: Lazy loading, image optimization for mobile networks

#### Cross-Platform Deployment Options

##### Option 1: Capacitor Web Wrapper (Recommended)
- **Framework**: Ionic Capacitor
- **Benefits**: Single codebase, web technologies, native performance
- **Features**: Native camera, file system, push notifications
- **Platforms**: iOS, Android, Web (responsive)
- **Development**: Build once, deploy everywhere

##### Option 2: React Native + Expo
- **Framework**: React Native with Expo
- **Benefits**: True native performance, platform-specific optimizations
- **Features**: Advanced native integrations, offline capabilities
- **Platforms**: iOS, Android
- **Development**: Separate mobile codebase with shared business logic

##### Option 3: Progressive Web App (PWA)
- **Framework**: Next.js with PWA capabilities
- **Benefits**: Zero-install experience, offline support
- **Features**: Service workers, app-like experience
- **Platforms**: All modern browsers
- **Development**: Web-first with mobile enhancements

#### Mobile-Specific Features
- **Camera Integration**: Native camera for receipt capture
- **GPS Location**: Location tracking for expense context
- **Biometric Authentication**: Fingerprint/Face ID support
- **Offline Mode**: Core functionality without internet
- **Push Notifications**: Real-time alerts and updates
- **Haptic Feedback**: Native touch feedback
- **Device Storage**: Local file storage and caching

#### Performance Optimization
- **Bundle Splitting**: Code splitting for faster mobile loads
- **Image Optimization**: Responsive images, WebP format
- **Caching Strategy**: Service worker caching for offline use
- **Network Optimization**: Efficient API calls, background sync
- **Battery Optimization**: Reduced background processing

---

## 7. Security Requirements

### 7.1 Authentication Security

#### Password Security
- Bcrypt hashing with salt rounds ≥ 12
- Password complexity requirements
- Password history prevention
- Account lockout after failed attempts

#### Session Management
- JWT tokens with short expiration (15 minutes)
- Refresh tokens with longer expiration (7 days)
- Secure HTTP-only cookies
- CSRF protection

#### Two-Factor Authentication
- TOTP-based 2FA
- Backup codes generation
- Recovery mechanisms

### 7.2 Authorization

#### Role-Based Access Control
- Hierarchical permission system
- Resource-level permissions
- Company-based data isolation
- User impersonation audit trail

#### Data Access Security
- Row-level security equivalent
- Company boundary enforcement
- User ownership validation
- Audit logging for sensitive operations

### 7.3 Data Protection

#### File Security
- Virus scanning for uploads
- File type validation
- Size limitations
- Secure file serving with signed URLs

#### Data Encryption
- Encryption at rest for sensitive data
- TLS 1.3 for data in transit
- Encrypted database connections
- Secure environment variable handling

### 7.4 API Security

#### Rate Limiting
- Per-user rate limits
- IP-based rate limiting
- Endpoint-specific limits
- DDoS protection

#### Input Validation
- Strict input validation with Zod
- SQL injection prevention
- XSS protection
- File upload validation

---

## 8. Integration Requirements

### 8.1 AI Services Integration

#### Document Processing
```typescript
interface DocumentProcessor {
  extractText(file: File): Promise<string>;
  analyzeExpense(text: string): Promise<ExpenseData>;
  detectDuplicates(hash: string): Promise<boolean>;
}
```

#### AI Analysis Pipeline
1. **OCR Processing**: Extract text from images/PDFs
2. **Data Extraction**: Use LLM to extract structured data
3. **Validation**: Confidence scoring and user review
4. **Learning**: Improve accuracy over time

### 8.2 Email Integration

#### Email Service
- Transactional emails (Resend/SendGrid)
- Template engine for dynamic content
- Delivery tracking and analytics
- Bounce and complaint handling

#### SMTP Configuration
- Company-specific SMTP settings
- Fallback to system SMTP
- Email authentication (SPF, DKIM)
- Email delivery monitoring

### 8.3 File Storage

#### Storage Strategy
- Local filesystem for development
- S3-compatible storage for production
- CDN integration for performance
- Backup and disaster recovery

#### File Processing
- Image optimization and resizing
- PDF generation for reports
- File virus scanning
- Automatic file cleanup

### 8.4 External APIs

#### Currency Exchange
- Real-time exchange rate API
- Historical rate data
- Multiple currency support
- Rate caching strategy

#### Location Services
- Address validation
- GPS coordinate handling
- Timezone detection
- Location-based features

---

## 9. Performance Requirements

### 9.1 Response Time Requirements

#### API Performance
- Authentication: < 200ms
- Data retrieval: < 500ms
- File upload: Streaming with progress
- AI processing: Background jobs with status updates

#### Frontend Performance
- Initial page load: < 2 seconds
- Route transitions: < 300ms
- Component renders: < 100ms
- Real-time updates: < 100ms latency

### 9.2 Scalability Requirements

#### Database Performance
- Connection pooling with PgBouncer
- Read replicas for reporting
- Query optimization and indexing
- Database partitioning for large datasets

#### Caching Strategy
- Redis for session storage
- Application-level caching
- CDN for static assets
- Browser caching optimization

### 9.3 Concurrency Requirements

#### User Load
- Support 1000+ concurrent users
- 10,000+ expenses per company
- Real-time updates for 100+ concurrent users
- Background job processing

#### File Processing
- Concurrent file uploads
- Background AI processing
- Queue management for heavy operations
- Progress tracking for long operations

---

## 10. Deployment & Infrastructure

### 10.1 Container Strategy

#### Docker Configuration
```dockerfile
# Multi-stage build for optimal image size
FROM node:20-alpine AS builder
# ... build steps

FROM node:20-alpine AS runner
# ... runtime configuration
```

#### Orchestration
- Kubernetes for production web deployment
- Docker Compose for development
- Health checks and readiness probes
- Auto-scaling based on metrics

#### Mobile Deployment
- **App Stores**: iOS App Store and Google Play Store
- **Enterprise Distribution**: In-house app distribution
- **Web Deployment**: Vercel/Netlify for responsive web app
- **Capacitor Build**: Automated build pipelines for mobile
- **Code Signing**: Automated code signing and security

### 10.2 Database Deployment

#### PostgreSQL Configuration
- Primary/replica setup
- Automated backups
- Point-in-time recovery
- Connection pooling

#### Migration Strategy
- Zero-downtime migrations
- Rollback procedures
- Data validation steps
- Performance impact monitoring

### 10.3 Monitoring & Observability

#### Application Monitoring
- Error tracking with Sentry
- Performance monitoring
- User session tracking
- Business metrics dashboard

#### Infrastructure Monitoring
- Database performance metrics
- Container resource usage
- Network latency monitoring
- Disk space and backup monitoring

---

## 11. Migration Strategy

### 11.1 Data Migration Plan

#### Phase 1: Core Data
1. Users and authentication data
2. Company information
3. Basic expense records
4. File attachments

#### Phase 2: Advanced Features
1. Module configurations
2. Email templates
3. Automation rules
4. User preferences

#### Phase 3: Historical Data
1. Audit trails
2. Notification history
3. Reporting data
4. Archive old records

### 11.2 Migration Tools

#### Data Extraction
```typescript
interface MigrationTool {
  extractUsers(): Promise<User[]>;
  extractCompanies(): Promise<Company[]>;
  extractExpenses(): Promise<Expense[]>;
  validateData(data: any[]): ValidationResult;
}
```

#### Migration Validation
- Data integrity checks
- Performance benchmarks
- Feature parity validation
- User acceptance testing

---

## 12. Timeline & Milestones

### 12.1 Development Phases

#### Week 1-2: Foundation
- [ ] Project setup and tooling
- [ ] Database design and migrations
- [ ] Authentication system
- [ ] Basic API structure
- [ ] UI component library

#### Week 3-4: Core Features
- [ ] User management
- [ ] Company management
- [ ] Basic expense CRUD
- [ ] File upload system
- [ ] Email integration

#### Week 5-6: Advanced Features
- [ ] AI document processing
- [ ] Approval workflows
- [ ] Reporting system
- [ ] Module system
- [ ] Real-time features

#### Week 7-8: Polish & Testing
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Security audit
- [ ] End-to-end testing
- [ ] Documentation

### 12.2 Success Criteria

#### Technical Metrics
- API response times < 500ms
- Zero security vulnerabilities
- 99.9% uptime
- Mobile responsiveness across devices

#### Business Metrics
- Feature parity with current system
- Improved user experience
- Reduced maintenance overhead
- Scalable architecture for growth

#### Quality Metrics
- Test coverage > 80%
- Performance benchmarks met
- Accessibility compliance (WCAG 2.1)
- Clean, maintainable codebase

---

## 13. Spire Integration

### 13.1 Integration Overview

#### Strategic Importance
The integration with Spire Systems represents a critical component of the INFOtrac ecosystem, enabling seamless data flow between expense management and enterprise resource planning (ERP) systems. This bidirectional integration ensures that every financial transaction, vendor relationship, and business process in INFOtrac can be automatically synchronized with Spire's comprehensive ERP platform.

#### Business Value Proposition
- **Unified Data Ecosystem**: Single source of truth across expense management and ERP
- **Automated Financial Workflows**: Eliminate manual data entry and reconciliation
- **Real-time Synchronization**: Instant updates between systems for accurate reporting
- **Enhanced Compliance**: Automated audit trails and financial controls
- **Operational Efficiency**: Reduced processing time and improved accuracy

### 13.2 Field Mapping Architecture

#### Core Mapping Principles
- **Comprehensive Coverage**: Every INFOtrac data field must have a corresponding Spire field mapping
- **Bidirectional Sync**: Changes in either system propagate automatically to the other
- **Data Transformation**: Intelligent mapping handles format differences and business logic
- **Validation Rules**: Automated validation ensures data integrity across systems
- **Audit Trail**: Complete tracking of all data synchronization activities

#### Critical Field Mappings

##### Expense Management Integration
```typescript
interface ExpenseToSpireMapping {
  // Expense Header Fields
  expenseId: string; // Maps to Spire Transaction ID
  companyId: string; // Maps to Spire Company Code
  amount: number; // Maps to Spire Transaction Amount
  currency: string; // Maps to Spire Currency Code
  expenseDate: Date; // Maps to Spire Transaction Date
  description: string; // Maps to Spire Description/Memo

  // Accounting Fields
  glAccount: string; // Maps to Spire GL Account Number
  costCenter: string; // Maps to Spire Cost Center Code
  projectCode: string; // Maps to Spire Project Code
  vendorId: string; // Maps to Spire Vendor ID

  // Approval Workflow
  approvalStatus: string; // Maps to Spire Approval Status
  approvedBy: string; // Maps to Spire Approver ID
  approvedDate: Date; // Maps to Spire Approval Date
}
```

##### Vendor Management Integration
```typescript
interface VendorMapping {
  vendorId: string; // INFOtrac → Spire Vendor ID
  vendorName: string; // Bidirectional
  taxId: string; // Maps to Spire Tax ID
  paymentTerms: string; // Maps to Spire Payment Terms
  address: Address; // Maps to Spire Vendor Address
  contactInfo: Contact; // Maps to Spire Contact Information
  vendorType: string; // Maps to Spire Vendor Classification
}
```

##### User & Employee Integration
```typescript
interface EmployeeMapping {
  employeeId: string; // INFOtrac User ID → Spire Employee ID
  employeeNumber: string; // Maps to Spire Employee Number
  department: string; // Maps to Spire Department Code
  managerId: string; // Maps to Spire Manager ID
  costCenter: string; // Maps to Spire Cost Center
  approvalLimit: number; // Maps to Spire Approval Authority
}
```

### 13.3 Integration Architecture

#### API Integration Layer
```typescript
interface SpireIntegrationAPI {
  // Authentication & Connection
  authenticate(credentials: SpireCredentials): Promise<AuthToken>;
  testConnection(): Promise<ConnectionStatus>;

  // Data Synchronization
  syncExpense(expense: Expense): Promise<SyncResult>;
  syncVendor(vendor: Vendor): Promise<SyncResult>;
  syncEmployee(employee: Employee): Promise<SyncResult>;

  // Bulk Operations
  bulkSyncExpenses(expenses: Expense[]): Promise<BulkSyncResult>;
  bulkSyncVendors(vendors: Vendor[]): Promise<BulkSyncResult>;

  // Query Operations
  getSpireData(entity: string, filters: QueryFilters): Promise<SpireData[]>;
  validateMapping(mapping: FieldMapping): Promise<ValidationResult>;
}
```

#### Synchronization Patterns
- **Real-time Sync**: Immediate synchronization for critical business processes
- **Batch Sync**: Scheduled bulk synchronization for large data sets
- **Event-Driven Sync**: Triggered by specific business events
- **Manual Sync**: User-initiated synchronization with conflict resolution

### 13.4 Data Transformation & Validation

#### Field Mapping Configuration
- **Mapping Tables**: Configurable field mapping tables per company
- **Transformation Rules**: Business logic for data format conversion
- **Default Values**: Intelligent defaults for missing required fields
- **Custom Mappings**: Company-specific field mapping configurations

#### Data Validation Rules
- **Required Field Validation**: Ensure all mandatory Spire fields are populated
- **Data Type Validation**: Validate data types match Spire requirements
- **Business Rule Validation**: Apply Spire-specific business rules
- **Cross-Reference Validation**: Validate relationships between entities

### 13.5 Error Handling & Monitoring

#### Synchronization Monitoring
- **Success/Failure Tracking**: Detailed logging of all sync operations
- **Error Categorization**: Classify errors for appropriate handling
- **Retry Mechanisms**: Automatic retry for transient failures
- **Alert System**: Notifications for sync failures and data discrepancies

#### Conflict Resolution
- **Conflict Detection**: Identify data conflicts between systems
- **Resolution Strategies**: Automated and manual conflict resolution
- **Audit Trail**: Complete history of conflict resolution decisions
- **Data Reconciliation**: Tools for reconciling discrepancies

### 13.6 Security & Compliance

#### Data Security
- **Encrypted Transmission**: All data transmitted over secure channels
- **Access Control**: Role-based access to integration features
- **Audit Logging**: Comprehensive audit trail of all integration activities
- **Data Masking**: Protect sensitive data during transmission

#### Compliance Requirements
- **SOX Compliance**: Financial data handling meets SOX requirements
- **GDPR Compliance**: Personal data protection and privacy
- **Industry Standards**: Compliance with relevant industry standards
- **Data Retention**: Appropriate retention policies for integration data

### 13.7 Implementation Roadmap

#### Phase 1: Foundation
- Establish secure API connections
- Implement basic field mappings
- Create synchronization framework
- Develop monitoring and logging

#### Phase 2: Core Integration
- Expense synchronization
- Vendor data integration
- Employee data mapping
- Real-time sync capabilities

#### Phase 3: Advanced Features
- Custom mapping configurations
- Advanced conflict resolution
- Bulk synchronization
- Performance optimization

#### Phase 4: Enterprise Features
- Multi-company support
- Advanced analytics integration
- Custom workflow triggers
- AI-powered mapping suggestions

---

## Conclusion

This specification provides a comprehensive plan for rewriting the INFOtrac application with modern technologies while preserving all existing functionality. The new architecture will be more maintainable, scalable, and performant while providing a better developer and user experience.

The modular approach allows for incremental development and testing, ensuring that critical business features are preserved throughout the migration process.