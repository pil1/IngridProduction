-- =====================================================
-- Document Management System with Smart Naming
-- =====================================================
-- This migration creates a comprehensive document management system
-- with AI-powered smart naming, company isolation, and permission-based access

-- Create ENUM types for document storage and categories
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'storage_type') THEN
        CREATE TYPE storage_type AS ENUM ('database', 'filesystem', 's3');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_category') THEN
        CREATE TYPE document_category AS ENUM (
            'expense', 'invoice', 'receipt', 'contract',
            'report', 'business_card', 'email', 'statement',
            'purchase_order', 'quote', 'other'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_action') THEN
        CREATE TYPE document_action AS ENUM (
            'upload', 'view', 'download', 'update', 'rename', 'delete', 'share'
        );
    END IF;
END $$;

-- =====================================================
-- Core Documents Table
-- =====================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth_users(id),

    -- File naming
    original_file_name VARCHAR(500) NOT NULL,
    smart_file_name VARCHAR(500),
    display_name VARCHAR(500) NOT NULL,

    -- File properties
    file_type VARCHAR(255) NOT NULL, -- MIME type
    file_size BIGINT NOT NULL,
    file_extension VARCHAR(50),

    -- Storage information
    storage_path VARCHAR(1000) NOT NULL,
    storage_type storage_type DEFAULT 'database',
    file_data BYTEA, -- For database storage option

    -- Document classification
    document_category document_category DEFAULT 'other',

    -- AI and metadata
    ai_extracted_data JSONB DEFAULT '{}',
    naming_metadata JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Smart naming confidence
    naming_confidence DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00

    -- Security
    checksum VARCHAR(128), -- SHA-256 hash
    perceptual_hash VARCHAR(64), -- Visual similarity hash for images
    is_encrypted BOOLEAN DEFAULT false,

    -- Intelligence and Analysis
    content_analysis JSONB DEFAULT '{}', -- OCR results, extracted text, entities
    relevance_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00 relevance to context
    temporal_classification VARCHAR(50) DEFAULT 'one_time', -- one_time, monthly, quarterly, annual, unknown
    duplicate_analysis JSONB DEFAULT '{}', -- Duplicate detection metadata and reasoning

    -- Virus scanning
    virus_scan_status VARCHAR(50) DEFAULT 'pending', -- pending, clean, infected, error
    virus_scan_date TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Soft delete
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES auth_users(id),

    -- Constraints
    CONSTRAINT valid_file_size CHECK (file_size > 0),
    CONSTRAINT valid_naming_confidence CHECK (naming_confidence >= 0 AND naming_confidence <= 1)
);

-- =====================================================
-- Document Associations Table
-- =====================================================
CREATE TABLE IF NOT EXISTS document_associations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL, -- 'expense', 'vendor', 'customer', 'invoice', etc.
    entity_id UUID NOT NULL,
    association_type VARCHAR(100) DEFAULT 'attachment', -- 'attachment', 'receipt', 'invoice', 'supporting_doc'
    association_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth_users(id),

    -- Ensure unique association per document-entity pair
    CONSTRAINT unique_document_entity UNIQUE (document_id, entity_type, entity_id)
);

-- =====================================================
-- Document Access Logs Table (Audit Trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_access_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    accessed_by UUID NOT NULL REFERENCES auth_users(id),
    action document_action NOT NULL,
    action_details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Document Naming Templates Table
-- =====================================================
CREATE TABLE IF NOT EXISTS document_naming_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL for global templates
    document_type VARCHAR(100) NOT NULL,
    template_pattern VARCHAR(500) NOT NULL, -- e.g., "{category}_{vendor}_{date}_{amount}"
    description TEXT,

    -- Template variables configuration
    date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
    currency_format VARCHAR(50) DEFAULT 'symbol_amount', -- 'symbol_amount', 'amount_code'
    max_length INTEGER DEFAULT 255,

    -- Priority and status
    priority INTEGER DEFAULT 100, -- Lower number = higher priority
    is_active BOOLEAN DEFAULT true,
    is_system_default BOOLEAN DEFAULT false, -- System templates cannot be deleted

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth_users(id),

    -- Ensure unique active template per document type per company
    CONSTRAINT unique_active_template UNIQUE (company_id, document_type, is_active)
);

-- =====================================================
-- Document Shares Table (For Future Sharing Features)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth_users(id),
    shared_with_user_id UUID REFERENCES auth_users(id),
    shared_with_email VARCHAR(255),
    share_token VARCHAR(255) UNIQUE,
    permissions JSONB DEFAULT '{"view": true, "download": false}',
    expires_at TIMESTAMP WITH TIME ZONE,
    accessed_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Documents table indexes
CREATE INDEX idx_documents_company_id ON documents(company_id) WHERE NOT is_deleted;
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by) WHERE NOT is_deleted;
CREATE INDEX idx_documents_category ON documents(document_category) WHERE NOT is_deleted;
CREATE INDEX idx_documents_created_at ON documents(created_at DESC) WHERE NOT is_deleted;
CREATE INDEX idx_documents_smart_name ON documents(smart_file_name) WHERE NOT is_deleted;
CREATE INDEX idx_documents_original_name ON documents(original_file_name) WHERE NOT is_deleted;
CREATE INDEX idx_documents_checksum ON documents(checksum) WHERE NOT is_deleted;
CREATE INDEX idx_documents_perceptual_hash ON documents(perceptual_hash) WHERE NOT is_deleted;
CREATE INDEX idx_documents_relevance_score ON documents(relevance_score DESC) WHERE NOT is_deleted;
CREATE INDEX idx_documents_temporal_classification ON documents(temporal_classification) WHERE NOT is_deleted;
CREATE INDEX idx_documents_content_analysis_gin ON documents USING GIN(content_analysis) WHERE NOT is_deleted;
CREATE INDEX idx_documents_duplicate_analysis_gin ON documents USING GIN(duplicate_analysis) WHERE NOT is_deleted;

-- Document associations indexes
CREATE INDEX idx_doc_associations_document_id ON document_associations(document_id);
CREATE INDEX idx_doc_associations_entity ON document_associations(entity_type, entity_id);
CREATE INDEX idx_doc_associations_type ON document_associations(association_type);

-- Access logs indexes
CREATE INDEX idx_doc_access_logs_document_id ON document_access_logs(document_id);
CREATE INDEX idx_doc_access_logs_user ON document_access_logs(accessed_by);
CREATE INDEX idx_doc_access_logs_timestamp ON document_access_logs(timestamp DESC);
CREATE INDEX idx_doc_access_logs_action ON document_access_logs(action);

-- Naming templates indexes
CREATE INDEX idx_naming_templates_company ON document_naming_templates(company_id) WHERE is_active;
CREATE INDEX idx_naming_templates_type ON document_naming_templates(document_type) WHERE is_active;

-- Document shares indexes
CREATE INDEX idx_doc_shares_document_id ON document_shares(document_id) WHERE is_active;
CREATE INDEX idx_doc_shares_token ON document_shares(share_token) WHERE is_active;
CREATE INDEX idx_doc_shares_expires ON document_shares(expires_at) WHERE is_active;

-- =====================================================
-- Triggers
-- =====================================================

-- Update timestamp trigger for documents
CREATE TRIGGER trigger_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp trigger for naming templates
CREATE TRIGGER trigger_naming_templates_updated_at
    BEFORE UPDATE ON document_naming_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Default Naming Templates
-- =====================================================

-- Insert default global naming templates
INSERT INTO document_naming_templates (
    company_id, document_type, template_pattern, description,
    priority, is_system_default, created_by
) VALUES
    (NULL, 'expense', 'Expense_{vendor}_{date}_{amount}', 'Default expense document naming', 1, true, NULL),
    (NULL, 'invoice', 'Invoice_{number}_{vendor}_{date}', 'Default invoice document naming', 1, true, NULL),
    (NULL, 'receipt', 'Receipt_{merchant}_{date}_{total}', 'Default receipt document naming', 1, true, NULL),
    (NULL, 'contract', 'Contract_{type}_{party}_{date}', 'Default contract document naming', 1, true, NULL),
    (NULL, 'report', 'Report_{type}_{period}_{date}', 'Default report document naming', 1, true, NULL),
    (NULL, 'business_card', 'BusinessCard_{name}_{company}_{date}', 'Default business card naming', 1, true, NULL),
    (NULL, 'statement', 'Statement_{account}_{period}_{date}', 'Default statement naming', 1, true, NULL),
    (NULL, 'purchase_order', 'PO_{number}_{vendor}_{date}', 'Default purchase order naming', 1, true, NULL),
    (NULL, 'quote', 'Quote_{number}_{vendor}_{date}', 'Default quote naming', 1, true, NULL),
    (NULL, 'other', 'Document_{type}_{date}_{time}', 'Default generic document naming', 10, true, NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Functions for Document Management
-- =====================================================

-- Function to check document access permissions
CREATE OR REPLACE FUNCTION check_document_access(
    p_document_id UUID,
    p_user_id UUID,
    p_action VARCHAR DEFAULT 'view'
) RETURNS BOOLEAN AS $$
DECLARE
    v_document_company UUID;
    v_document_owner UUID;
    v_user_company UUID;
    v_user_role VARCHAR;
    v_has_permission BOOLEAN DEFAULT false;
BEGIN
    -- Get document details
    SELECT company_id, uploaded_by INTO v_document_company, v_document_owner
    FROM documents
    WHERE id = p_document_id AND NOT is_deleted;

    IF v_document_company IS NULL THEN
        RETURN false; -- Document not found or deleted
    END IF;

    -- Get user details
    SELECT company_id, role INTO v_user_company, v_user_role
    FROM profiles
    WHERE user_id = p_user_id;

    -- Super-admin has access to everything
    IF v_user_role = 'super-admin' THEN
        RETURN true;
    END IF;

    -- Check company match
    IF v_document_company != v_user_company THEN
        RETURN false;
    END IF;

    -- Check permissions based on action
    CASE p_action
        WHEN 'view', 'download' THEN
            -- Owner can always view/download
            IF v_document_owner = p_user_id THEN
                v_has_permission := true;
            -- Admins can view/download all company documents
            ELSIF v_user_role = 'admin' THEN
                v_has_permission := true;
            -- Check if user has permission through associations
            ELSE
                v_has_permission := check_document_association_permission(p_document_id, p_user_id);
            END IF;
        WHEN 'update', 'rename', 'delete' THEN
            -- Only owner and admin can modify
            v_has_permission := (v_document_owner = p_user_id OR v_user_role = 'admin');
        ELSE
            v_has_permission := false;
    END CASE;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check document access through entity associations
CREATE OR REPLACE FUNCTION check_document_association_permission(
    p_document_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN DEFAULT false;
BEGIN
    -- Check if user has access to associated entities
    -- For expense associations, check if user is reviewer or has expense_review permission
    SELECT EXISTS (
        SELECT 1
        FROM document_associations da
        WHERE da.document_id = p_document_id
        AND da.entity_type = 'expense'
        AND EXISTS (
            SELECT 1
            FROM expenses e
            WHERE e.id = da.entity_id
            AND (
                e.submitted_by = p_user_id
                OR e.reviewer_id = p_user_id
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = p_user_id
                    AND up.permission_name = 'expenses.review'
                    AND up.is_granted = true
                )
            )
        )
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log document access
CREATE OR REPLACE FUNCTION log_document_access(
    p_document_id UUID,
    p_user_id UUID,
    p_action document_action,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO document_access_logs (
        document_id, accessed_by, action, ip_address,
        user_agent, action_details, timestamp
    ) VALUES (
        p_document_id, p_user_id, p_action, p_ip_address,
        p_user_agent, p_details, NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get smart document name
CREATE OR REPLACE FUNCTION get_smart_document_name(
    p_document_id UUID
) RETURNS VARCHAR AS $$
DECLARE
    v_smart_name VARCHAR;
    v_display_name VARCHAR;
BEGIN
    SELECT COALESCE(smart_file_name, display_name, original_file_name)
    INTO v_smart_name
    FROM documents
    WHERE id = p_document_id;

    RETURN v_smart_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Migration for existing expense receipts
-- =====================================================

-- Add document_id column to expenses table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'expenses' AND column_name = 'document_id'
    ) THEN
        ALTER TABLE expenses ADD COLUMN document_id UUID REFERENCES documents(id);
        CREATE INDEX idx_expenses_document_id ON expenses(document_id);
    END IF;
END $$;

-- =====================================================
-- Permissions for Document Management
-- =====================================================

-- Add document-related permissions to the system
INSERT INTO permissions (name, description, category) VALUES
    ('documents.view_own', 'View own uploaded documents', 'Documents'),
    ('documents.view_all', 'View all company documents', 'Documents'),
    ('documents.upload', 'Upload new documents', 'Documents'),
    ('documents.download_own', 'Download own documents', 'Documents'),
    ('documents.download_all', 'Download all company documents', 'Documents'),
    ('documents.delete_own', 'Delete own documents', 'Documents'),
    ('documents.delete_all', 'Delete any company document', 'Documents'),
    ('documents.rename', 'Rename documents', 'Documents'),
    ('documents.share', 'Share documents externally', 'Documents')
ON CONFLICT (name) DO NOTHING;

-- Grant default document permissions to roles
INSERT INTO role_permissions (role, permission_name, is_granted) VALUES
    -- Super-admin gets all permissions
    ('super-admin', 'documents.view_all', true),
    ('super-admin', 'documents.upload', true),
    ('super-admin', 'documents.download_all', true),
    ('super-admin', 'documents.delete_all', true),
    ('super-admin', 'documents.rename', true),
    ('super-admin', 'documents.share', true),

    -- Admin gets company-wide permissions
    ('admin', 'documents.view_all', true),
    ('admin', 'documents.upload', true),
    ('admin', 'documents.download_all', true),
    ('admin', 'documents.delete_all', true),
    ('admin', 'documents.rename', true),
    ('admin', 'documents.share', true),

    -- Regular users get own document permissions
    ('user', 'documents.view_own', true),
    ('user', 'documents.upload', true),
    ('user', 'documents.download_own', true),
    ('user', 'documents.delete_own', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE documents IS 'Central document repository with smart naming and company isolation';
COMMENT ON TABLE document_associations IS 'Links documents to various entities (expenses, vendors, etc.)';
COMMENT ON TABLE document_access_logs IS 'Audit trail for all document access and modifications';
COMMENT ON TABLE document_naming_templates IS 'Configurable smart naming patterns per document type';
COMMENT ON TABLE document_shares IS 'External document sharing with token-based access';

COMMENT ON COLUMN documents.smart_file_name IS 'AI-generated intelligent filename for better organization';
COMMENT ON COLUMN documents.naming_confidence IS 'Confidence score (0-1) for the smart naming accuracy';
COMMENT ON COLUMN documents.ai_extracted_data IS 'JSON data extracted by AI for smart naming and search';
COMMENT ON COLUMN document_associations.entity_type IS 'Type of entity the document is associated with';
COMMENT ON COLUMN document_naming_templates.template_pattern IS 'Pattern with variables like {vendor}, {date}, {amount}';