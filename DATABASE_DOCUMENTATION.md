# INFOtrac Database Documentation

## Overview

This document provides a comprehensive overview of the INFOtrac database structure, including all tables, relationships, business logic, and system architecture. The application uses **PostgreSQL** as the primary database, running locally within Docker containers for complete self-contained deployment.

**Database Connection**: `postgresql://infotrac_user:infotrac_password@postgres:5432/infotrac`

⚠️ **CRITICAL**: This application uses **LOCAL POSTGRESQL ONLY** - all database operations run within the Docker environment for complete isolation and portability.

## Table of Contents

1. [Foundation Tables](#foundation-tables)
2. [Authentication & User Management](#authentication--user-management)
3. [Permission System](#permission-system)
4. [Business Entities](#business-entities)
5. [AI Suggestion Systems](#ai-suggestion-systems)
6. [Document Management & Intelligence](#document-management--intelligence)
7. [Email & Automation](#email--automation)
8. [API Management](#api-management)
9. [Database Functions](#database-functions)
10. [Migration History](#migration-history)
11. [Row Level Security (RLS)](#row-level-security-rls)
12. [Indexes and Performance](#indexes-and-performance)

---

## Foundation Tables

### 1. `companies`
**Primary business entity table for multi-tenant architecture**

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  subscription_plan VARCHAR(50) DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'pro', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- Multi-tenant architecture foundation
- Subscription-based access control
- Address fields added in migration 014
- All other tables reference this for company isolation

**Indexes:**
- `idx_companies_name` - Fast name lookups
- `idx_companies_subscription` - Billing queries
- `idx_companies_active` - Active companies filtering

---

## Authentication & User Management

### 2. `auth_users`
**Primary authentication table replacing Supabase auth**

```sql
CREATE TABLE auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  reset_token VARCHAR(255),
  reset_token_expires_at TIMESTAMP WITH TIME ZONE,
  last_sign_in TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. `profiles`
**User profile information linked to authentication**

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE UNIQUE,
  email VARCHAR(255),
  full_name VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super-admin')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  avatar_url VARCHAR(500),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_sign_in TIMESTAMP WITH TIME ZONE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- JWT-based authentication system
- Three-tier role system: user, admin, super-admin
- Company-based isolation
- JSONB preferences for user customization
- Enhanced with separate name fields for better UX

**Relationships:**
- `user_id` → `auth_users(id)` (1:1 required)
- `company_id` → `companies(id)` (N:1 optional for super-admins)

**Indexes:**
- `idx_profiles_user_id` - Auth lookups
- `idx_profiles_company_id` - Company user queries
- `idx_profiles_role` - Role-based filtering
- `idx_profiles_email` - Email lookups

---

## Permission System

### 3. `modules`
**System modules for feature licensing and access control**

```sql
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  module_type VARCHAR(50) DEFAULT 'core' CHECK (module_type IN ('core', 'add-on', 'super')),
  category VARCHAR(50) DEFAULT 'general', -- Added in migration 008
  is_core_required BOOLEAN DEFAULT false, -- Added in migration 008
  is_active BOOLEAN DEFAULT true,
  default_monthly_price DECIMAL(10,2) DEFAULT 0,
  default_per_user_price DECIMAL(10,2) DEFAULT 0,
  requires_modules TEXT[] DEFAULT '{}', -- Added in migration 008
  feature_flags JSONB DEFAULT '{}', -- Added in migration 008
  api_endpoints TEXT[] DEFAULT '{}', -- Added in migration 008
  ui_components TEXT[] DEFAULT '{}', -- Added in migration 008
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Module Categories:**
- `core` - Essential functionality (Dashboard, User Management, Company Settings)
- `operations` - Business operations (Vendors, Customers, Expenses)
- `accounting` - Financial management (GL Accounts, Categories)
- `ai` - AI features (Ingrid AI Assistant)
- `automation` - Process automation
- `analytics` - Reporting and analytics

**Key Modules:**
- Dashboard (core, required)
- User Management (core, required)
- Company Settings (core, required)
- Ingrid AI Assistant (premium, $29.99/month + $4.99/user)
- Expense Management (add-on, $25/month + $3/user)
- Process Automation (add-on, $75/month + $8/user)

### 4. `company_modules`
**Module enablement per company**

```sql
CREATE TABLE company_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  enabled_by UUID REFERENCES auth.users(id), -- Added in migration 008
  enabled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Added in migration 008
  configuration JSONB DEFAULT '{}', -- Added in migration 008
  usage_limits JSONB DEFAULT '{}', -- Added in migration 008
  billing_tier VARCHAR(50) DEFAULT 'standard', -- Added in migration 008
  monthly_price DECIMAL(10,2),
  per_user_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, module_id)
);
```

### 5. `user_modules`
**Individual user access to modules within their company**

```sql
CREATE TABLE user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES auth_users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  restrictions JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module_id, company_id)
);
```

### 6. Enhanced Permissions Tables (Migration 008)

#### `permissions`
**Granular feature permissions**

```sql
CREATE TABLE permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_key VARCHAR(100) NOT NULL UNIQUE,
  permission_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  is_system_permission BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Permission Categories:**
- **Core**: dashboard.view, users.*, company.settings.*
- **Operations**: vendors.*, customers.*, expenses.*
- **AI**: ingrid.suggestions.*, ingrid.configure, ingrid.analytics.*
- **Accounting**: gl_accounts.*, expense_categories.*
- **Automation**: automation.*, process.*
- **Analytics**: analytics.*, reports.*

#### `user_permissions`
**Individual user permission grants**

```sql
CREATE TABLE user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_granted BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES auth_users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, permission_id, company_id)
);
```

#### `role_permissions`
**Default permissions for system roles**

```sql
CREATE TABLE role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_name, permission_id, module_id)
);
```

### 7. Custom Role System (Migration 021)

#### `custom_roles`
**Company-specific custom roles**

```sql
CREATE TABLE custom_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_name VARCHAR(100) NOT NULL,
  role_display_name VARCHAR(255) NOT NULL,
  description TEXT,
  based_on_role VARCHAR(50), -- 'user', 'admin', 'super-admin' for inheritance
  is_active BOOLEAN DEFAULT true,
  is_system_role BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, role_name)
);
```

#### `user_role_assignments`
**User assignments to custom or system roles**

```sql
CREATE TABLE user_role_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
  system_role VARCHAR(50), -- For backward compatibility
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth_users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);
```

#### `role_templates`
**Predefined role templates for quick setup**

```sql
CREATE TABLE role_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  target_use_cases TEXT[],
  base_permissions JSONB NOT NULL DEFAULT '[]',
  required_modules JSONB DEFAULT '[]',
  is_system_template BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Built-in Templates:**
- `expense_only` - Expense Submitter
- `view_only` - Read-only access
- `controller` - Financial Controller
- `accounting` - Accounting Specialist
- `manager` - Department Manager

---

## Business Entities

### 8. `vendors`
**Supplier and vendor management**

```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  website VARCHAR(255),
  contact_person VARCHAR(255),
  tax_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name)
);
```

### 9. `customers`
**Customer relationship management**

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  website VARCHAR(255),
  contact_person VARCHAR(255),
  tax_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name)
);
```

### 10. `expense_categories`
**Expense categorization for accounting**

```sql
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name)
);
```

---

## AI Suggestion Systems

### 11. `suggested_categories` (Migration 006)
**AI-powered category suggestions with approval workflow**

```sql
CREATE TABLE suggested_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  suggested_name VARCHAR(255) NOT NULL,
  suggested_description TEXT,
  suggested_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_reasoning TEXT,
  source_document_name VARCHAR(255),
  vendor_context VARCHAR(255),
  amount_context DECIMAL(15,2),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 1,
  first_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- **Deduplication**: Similar suggestions increment usage_count rather than creating duplicates
- **Confidence Scoring**: AI confidence from 0.0 to 1.0
- **Approval Workflow**: Controllers can approve, reject, or merge suggestions
- **Usage Analytics**: Tracks frequency and patterns
- **Context Preservation**: Maintains reasoning and source document info

### 12. `suggested_vendors` (Migration 007)
**AI-powered vendor suggestions with web enrichment**

```sql
CREATE TABLE suggested_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_reasoning TEXT,
  source_document_name VARCHAR(255),
  extraction_context JSONB DEFAULT '{}'::JSONB,
  web_enrichment_data JSONB DEFAULT '{}'::JSONB,
  web_enrichment_confidence DECIMAL(3,2) CHECK (web_enrichment_confidence >= 0 AND web_enrichment_confidence <= 1),
  vendor_match_type VARCHAR(20) CHECK (vendor_match_type IN ('exact', 'fuzzy', 'semantic', 'new', 'web_enriched')),
  existing_vendor_similarity DECIMAL(3,2),
  similar_vendor_ids UUID[] DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  reviewed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 1,
  first_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Advanced Features:**
- **Web Enrichment**: Automatic data enhancement from web sources
- **Fuzzy Matching**: Similarity detection with existing vendors
- **Full Address Support**: Complete vendor contact information
- **Match Type Classification**: exact, fuzzy, semantic, new, web_enriched
- **Merge Operations**: Intelligent consolidation of similar suggestions

---

## Document Management & Intelligence

### Enhanced `documents` Table (Migration 006)
**Enterprise-grade document management with AI-powered intelligence capabilities**

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Basic File Information
  original_filename TEXT NOT NULL,
  smart_filename TEXT, -- AI-generated intelligent filename
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  checksum TEXT NOT NULL, -- SHA-256 for deduplication

  -- Document Intelligence Fields (New in Phase 4.1)
  perceptual_hash TEXT, -- Visual similarity hash for images
  content_analysis JSONB, -- OCR + business entity extraction
  relevance_score FLOAT, -- Business document relevance (0.0-1.0)
  temporal_classification TEXT, -- recurring, one-time, periodic
  duplicate_analysis JSONB, -- Duplicate detection results

  -- Categorization & Context
  document_category TEXT NOT NULL, -- expense_receipt, business_card, invoice, etc.
  associated_entity_type TEXT, -- expense, vendor, customer
  associated_entity_id UUID, -- Related business entity

  -- Processing Status
  processing_status TEXT DEFAULT 'uploaded',
  ai_extracted_data JSONB, -- AI-extracted business data
  confidence_score FLOAT, -- AI extraction confidence (0.0-1.0)

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
  CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  CHECK (processing_status IN ('uploaded', 'processing', 'completed', 'failed'))
);

-- Performance Indexes
CREATE INDEX idx_documents_company_id ON documents(company_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_checksum ON documents(checksum);
CREATE INDEX idx_documents_perceptual_hash ON documents(perceptual_hash) WHERE perceptual_hash IS NOT NULL;
CREATE INDEX idx_documents_category ON documents(document_category);
CREATE INDEX idx_documents_entity ON documents(associated_entity_type, associated_entity_id) WHERE associated_entity_id IS NOT NULL;

-- JSONB Indexes for Intelligence Fields
CREATE INDEX idx_documents_content_analysis ON documents USING GIN (content_analysis) WHERE content_analysis IS NOT NULL;
CREATE INDEX idx_documents_duplicate_analysis ON documents USING GIN (duplicate_analysis) WHERE duplicate_analysis IS NOT NULL;
CREATE INDEX idx_documents_ai_data ON documents USING GIN (ai_extracted_data) WHERE ai_extracted_data IS NOT NULL;

-- Temporal Index for Duplicate Detection
CREATE INDEX idx_documents_temporal_class ON documents(temporal_classification, created_at) WHERE temporal_classification IS NOT NULL;
```

#### Document Intelligence Schema Details

**Content Analysis Structure (JSONB)**:
```json
{
  "extractedText": "Full OCR text content",
  "confidence": 0.95,
  "businessEntities": {
    "amounts": [{
      "value": 45.99,
      "currency": "USD",
      "confidence": 0.92,
      "position": {"x": 123, "y": 456}
    }],
    "dates": [{
      "value": "2025-09-25",
      "confidence": 0.88,
      "format": "YYYY-MM-DD",
      "position": {"x": 789, "y": 123}
    }],
    "vendors": [{
      "name": "ABC Company Inc",
      "confidence": 0.91,
      "position": {"x": 456, "y": 789}
    }],
    "addresses": [{
      "streetAddress": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "postalCode": "12345",
      "country": "USA",
      "confidence": 0.87
    }],
    "emails": [{
      "value": "contact@example.com",
      "confidence": 0.96
    }],
    "phones": [{
      "value": "+1-555-123-4567",
      "confidence": 0.89
    }]
  },
  "documentStructure": {
    "hasTable": true,
    "hasHeader": true,
    "hasFooter": false,
    "pageCount": 1
  }
}
```

**Duplicate Analysis Structure (JSONB)**:
```json
{
  "checkDate": "2025-09-25T10:30:00Z",
  "matches": [{
    "id": "uuid-of-similar-document",
    "similarity": 0.92,
    "matchType": "content_hash", // content_hash, perceptual_hash, content_similarity
    "confidence": 0.88,
    "metadata": {
      "filename": "similar-receipt.pdf",
      "uploadDate": "2025-09-20T15:45:00Z",
      "associatedEntity": "expense-uuid"
    }
  }],
  "temporalAnalysis": {
    "isRecurring": true,
    "pattern": "monthly",
    "lastOccurrence": "2025-08-25T10:00:00Z",
    "tolerance": 5 // days
  }
}
```

#### Key Intelligence Features

- **Multi-Factor Duplicate Detection**: SHA-256 hashing, perceptual hashing (images), and content similarity analysis
- **Business Entity Extraction**: Automated extraction of amounts, dates, vendors, addresses, emails, and phone numbers
- **Temporal Intelligence**: Recognition of recurring documents (monthly bills, statements) with configurable tolerance
- **Relevance Scoring**: Context-aware classification of business document relevance
- **Permission-Aware Analysis**: Company-scoped duplicate detection respecting user access permissions
- **Smart File Naming**: AI-powered intelligent filename generation based on content analysis
- **Performance Optimization**: Comprehensive indexing strategy for fast queries across intelligence fields

#### Row Level Security (RLS)

```sql
-- Enable RLS for documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access documents from their company
CREATE POLICY documents_company_isolation ON documents
  FOR ALL TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert documents for their company
CREATE POLICY documents_insert ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );
```

#### Intelligence Service Integration

The document intelligence system integrates with backend services:

- **`documentContentAnalysis.ts`**: OCR and entity extraction
- **`documentDuplicateDetection.ts`**: Multi-factor duplicate analysis
- **`documentRelevanceAnalysis.ts`**: Business relevance scoring
- **`documentIntelligenceOrchestrator.ts`**: Service coordination

These services populate the intelligence fields automatically during document upload and processing workflows.

---

## Email & Automation

### 13. Ingrid Email System (Migration 003)

#### `ingrid_email_accounts`
**Email account configuration per company**

```sql
CREATE TABLE ingrid_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email_address VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) DEFAULT 'Ingrid AI Assistant',
  email_credentials JSONB, -- Encrypted IMAP/SMTP configuration
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'setup')),
  last_checked_at TIMESTAMPTZ,
  last_email_received_at TIMESTAMPTZ,
  error_message TEXT,
  check_interval_minutes INTEGER DEFAULT 5 CHECK (check_interval_minutes >= 1 AND check_interval_minutes <= 60),
  max_emails_per_check INTEGER DEFAULT 50 CHECK (max_emails_per_check >= 1 AND max_emails_per_check <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(company_id, email_address)
);
```

#### `email_processing_queue`
**Email processing pipeline**

```sql
CREATE TABLE email_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ingrid_account_id UUID NOT NULL REFERENCES ingrid_email_accounts(id) ON DELETE CASCADE,
  sender_email VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255),
  user_id UUID REFERENCES profiles(id), -- Matched user if found
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id VARCHAR(255), -- Original email message ID
  in_reply_to VARCHAR(255), -- For threading
  attachments JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  ai_analysis_result JSONB, -- Results from AI content analysis
  actions_taken JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  response_sent_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `ingrid_actions`
**Available automation actions per company**

```sql
CREATE TABLE ingrid_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'submit_expense', 'create_quote', 'add_contact'
  action_name VARCHAR(255) NOT NULL,
  description TEXT,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger_keywords TEXT[],
  file_type_filters TEXT[], -- ['pdf', 'jpg', 'png']
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  allowed_user_roles TEXT[] DEFAULT '{"admin", "user"}'::text[],
  success_template TEXT,
  error_template TEXT,
  approval_template TEXT,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(company_id, action_type, action_name)
);
```

#### `ingrid_action_history`
**Action execution tracking**

```sql
CREATE TABLE ingrid_action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_queue_id UUID NOT NULL REFERENCES email_processing_queue(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action_id UUID REFERENCES ingrid_actions(id),
  action_type VARCHAR(50) NOT NULL,
  action_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'failed', 'cancelled')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  ai_confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  related_record_id UUID, -- ID of created expense, quote, contact, etc.
  related_record_type VARCHAR(50) -- 'expense', 'quote', 'contact'
);
```

---

## API Management

### 14. Company API Keys (Migrations 009, 022)

#### `company_api_keys`
**Secure API key storage per company**

```sql
CREATE TABLE company_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'openai', 'google_document_ai', etc.
  api_key_encrypted TEXT, -- Encrypted API key
  api_key_last_four VARCHAR(4), -- Last 4 characters for display
  is_active BOOLEAN DEFAULT true,
  provisioned_by UUID REFERENCES profiles(user_id), -- Super-admin who provisioned
  provisioned_at TIMESTAMP DEFAULT now(),
  last_used_at TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  monthly_usage_limit INTEGER, -- Optional usage limits
  notes TEXT, -- Admin notes about this key
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT unique_active_provider_per_company UNIQUE(company_id, provider) DEFERRABLE INITIALLY DEFERRED
);
```

**Supported Providers:**
- `openai` - OpenAI API for GPT models
- `google_document_ai` - Google Document AI for OCR
- `aws_textract` - AWS Textract for document processing
- `azure_document` - Azure Document Intelligence

#### `user_module_permissions` (Migration 023)
**Granular Ingrid AI permissions**

```sql
CREATE TABLE user_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  module_name VARCHAR(100) NOT NULL,
  permission_type VARCHAR(50) NOT NULL, -- 'chat', 'document_processing', 'automation', 'analytics'
  is_enabled BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES profiles(user_id),
  granted_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP, -- Optional expiration
  usage_limit INTEGER, -- Optional usage limits
  current_usage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT unique_user_module_permission UNIQUE(user_id, module_name, permission_type)
);
```

---

## Utility Tables

### 15. `notifications`
**User notification system**

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN DEFAULT false,
  action_url TEXT, -- Optional URL for notification action
  metadata JSONB DEFAULT '{}', -- Additional notification data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE -- Optional expiration
);
```

### 16. `user_table_preferences` (Migration 002)
**Table customization settings per user**

```sql
CREATE TABLE user_table_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL, -- e.g., 'expenses', 'vendors', 'customers'
  preferences JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, table_name)
);
```

**Example Preferences Structure:**
```json
{
  "columnWidths": {
    "amount": 120,
    "description": 200,
    "category": 150
  },
  "sortBy": "created_at",
  "sortDirection": "desc",
  "filters": {
    "status": "pending",
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  },
  "hiddenColumns": ["id", "internal_notes"],
  "pageSize": 25
}
```

### 17. `company_settings` (Migration 004)
**Company-specific configuration**

```sql
CREATE TABLE company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  currency VARCHAR(3) DEFAULT 'USD',
  timezone VARCHAR(100) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'MM/dd/yyyy',
  expense_approval_required BOOLEAN DEFAULT false,
  max_expense_amount DECIMAL(12,2) DEFAULT 10000.00,
  receipt_required_above DECIMAL(12,2) DEFAULT 100.00,
  -- AI/Ingrid Configuration
  openai_api_key TEXT,
  ai_provider VARCHAR(20) DEFAULT 'mock',
  ai_model VARCHAR(50) DEFAULT 'gpt-4',
  ai_enabled BOOLEAN DEFAULT false,
  -- OCR Configuration
  ocr_provider VARCHAR(30) DEFAULT 'mock',
  google_vision_api_key TEXT,
  aws_access_key_id TEXT,
  aws_secret_access_key TEXT,
  aws_region VARCHAR(20) DEFAULT 'us-east-1',
  azure_api_key TEXT,
  azure_endpoint TEXT,
  -- Feature Toggles
  enable_web_enrichment BOOLEAN DEFAULT false,
  enable_spire_integration BOOLEAN DEFAULT false,
  auto_approval_threshold DECIMAL(3,2) DEFAULT 0.85,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id)
);
```

---

## Database Functions

### Core Permission Functions

#### `user_has_permission(user_id, permission_key, company_id)`
**Check if user has specific permission**
- Checks super-admin bypass
- Evaluates direct user permissions
- Falls back to role-based permissions
- Considers expiration dates

#### `company_has_module(company_id, module_name)`
**Check if company has module enabled**
- Validates company-module relationship
- Checks active status

#### `get_user_modules(user_id)`
**Get all modules accessible to user**
- Returns module details with access status
- Considers role, company modules, and individual grants
- Ordered by module type and name

### AI Suggestion Functions

#### `increment_suggestion_usage(company_id, suggested_name, confidence_score, context)`
**Store or update category suggestions**
- Deduplication logic
- Usage count increment
- Confidence score updates

#### `approve_category_suggestion(suggestion_id, reviewer_id, final_name, final_description, gl_account_id, review_notes)`
**Approve category suggestion and create expense category**
- Creates expense_categories record
- Updates suggestion status to 'approved'
- Links created category to suggestion

#### `increment_vendor_suggestion_usage(company_id, suggested_name, confidence_score, context, web_data)`
**Store or update vendor suggestions**
- Enhanced with web enrichment data
- Similar deduplication logic as categories

#### `approve_vendor_suggestion(suggestion_id, reviewer_id, ...vendor_fields)`
**Approve vendor suggestion and create vendor record**
- Creates vendors record with all fields
- Updates suggestion status
- Links created vendor to suggestion

### Custom Role Functions

#### `get_user_effective_permissions(user_id, company_id)`
**Get combined permissions from all sources**
- Individual permissions (highest priority)
- Custom role permissions
- System role permissions (lowest priority)
- Returns table with permission_key, source, is_granted

#### `user_has_custom_permission(user_id, permission_key, company_id)`
**Check permission using custom role system**
- Uses get_user_effective_permissions
- Boolean result

### API Key Functions

#### `get_company_api_key(company_id, provider)`
**Securely retrieve API key for processing**
- Service role or super-admin only
- Updates usage tracking
- Returns encrypted key

#### `update_api_key_usage(company_id, provider, usage_count)`
**Track API key usage**
- Updates usage count and last_used_at
- For billing and monitoring

---

## Row Level Security (RLS)

**All tables have RLS enabled** with comprehensive policies:

### Company Isolation
- Users can only access data for their company
- Super-admins can access all companies
- Implemented via `company_id` filtering in all policies

### Role-Based Access
- **Super-admin**: Full access to all data
- **Admin**: Company-wide access with management permissions
- **User**: Limited access based on individual permissions

### Key Policy Patterns

#### Standard Company Access
```sql
-- Users can view data for their company
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE user_id = current_user_id()
  )
)
```

#### Admin Management
```sql
-- Admins can manage data in their company
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE user_id = current_user_id() AND role IN ('admin', 'super-admin')
  )
)
```

#### Super-Admin Override
```sql
-- Super-admins can access everything
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE user_id = current_user_id() AND role = 'super-admin'
  )
)
```

---

## Indexes and Performance

### Primary Indexes
- All tables have primary key indexes (UUID)
- Foreign key indexes for join performance
- Unique constraints where needed

### Company-Based Queries
- `company_id` indexed on all multi-tenant tables
- Combined indexes for common query patterns

### User Lookups
- `user_id` indexed for authentication queries
- `email` indexed for user searches

### AI System Optimization
- `status` indexes on suggestion tables
- `confidence_score` indexes for ranking
- `usage_count` indexes for popularity sorting
- `created_at` indexes for chronological ordering

### Permission System
- Composite indexes on permission checks
- Role-based filtering optimization
- Module access pattern optimization

---

## Migration History

| Migration | Description | Key Changes |
|-----------|-------------|-------------|
| 000 | Foundation Tables | companies, profiles, modules, business entities |
| 001 | Notifications | User notification system |
| 002 | User Preferences | Table customization settings |
| 003 | Ingrid Email | Email automation infrastructure |
| 004 | Company Settings | Configuration and AI settings |
| 006 | Suggested Categories | AI category suggestion system |
| 007 | Suggested Vendors | AI vendor suggestion with web enrichment |
| 008 | Enhanced Permissions | Granular permission system |
| 009 | API Key Manager | Company-specific API key storage |
| 010-013 | RLS Fixes | Production-safe RLS policies |
| 014 | Address Fields | Company address enhancement |
| 015 | Module Cleanup | Unused module removal |
| 016 | INFOtrac Company | Default company setup |
| 017 | Name Fields | First/last name separation |
| 018 | Super Admin | Super admin account creation |
| 019 | RLS Fixes | Profile policies refinement |
| 020 | User Modules | Individual module access |
| 021 | Custom Roles | Company-specific role system |
| 022 | Company API Keys | Duplicate table cleanup |
| 023 | Ingrid AI Module | Enhanced Ingrid permissions |

---

## Key Relationships

### Core Entity Relationships
```
auth_users (1) ←→ (1) profiles
profiles (N) ←→ (1) companies
companies (1) ←→ (N) company_modules (N) ←→ (1) modules
profiles (N) ←→ (N) user_modules (N) ←→ (1) modules
companies (1) ←→ (N) vendors/customers/expense_categories
```

### Permission Relationships
```
profiles (N) ←→ (N) user_permissions (N) ←→ (1) permissions
roles (N) ←→ (N) role_permissions (N) ←→ (1) permissions
custom_roles (1) ←→ (N) custom_role_permissions (N) ←→ (1) permissions
profiles (N) ←→ (1) user_role_assignments (N) ←→ (1) custom_roles
```

### AI Suggestion Flow
```
AI System → suggested_categories/suggested_vendors
Controller Review → Approval/Rejection
Approved → expense_categories/vendors
Usage Tracking → analytics and optimization
```

---

## Business Logic Patterns

### Multi-Tenant Architecture
- Every business table includes `company_id`
- RLS enforces company isolation
- Super-admins bypass company restrictions

### Three-Tier Permission Model
1. **System Level**: Module availability and pricing
2. **Company Level**: Module enablement and configuration
3. **User Level**: Individual access and restrictions

### AI Suggestion Workflow
1. **Detection**: AI identifies potential categories/vendors
2. **Deduplication**: Similar suggestions increment usage count
3. **Storage**: Context and confidence preserved
4. **Review**: Controllers approve/reject/merge
5. **Creation**: Approved suggestions create business entities
6. **Analytics**: Usage patterns drive future suggestions

### Graceful Degradation
- Permission system provides fallbacks
- Missing tables don't break core functionality
- Mock providers for development/testing

---

## Performance Considerations

### Query Optimization
- Company-scoped queries for multi-tenant performance
- Indexed foreign keys for fast joins
- Composite indexes for common filter patterns

### Caching Strategy
- Permission checks cached client-side (5 minutes)
- Module access cached per session
- Static data (role templates) cached longer

### Scalability
- UUID primary keys for distributed systems
- JSONB for flexible metadata storage
- Async processing for AI workflows

---

This documentation reflects the current state of the INFOtrac database as of September 2025, with comprehensive coverage of all 23 migrations and the complete system architecture.