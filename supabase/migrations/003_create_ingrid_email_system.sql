-- Ingrid AI Email Automation System Database Schema
-- Phase 1: Core email infrastructure tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for managing Ingrid email accounts per company
CREATE TABLE ingrid_email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email_address VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) DEFAULT 'Ingrid AI Assistant',

    -- Email server configuration (encrypted)
    email_credentials JSONB, -- { "imap_host": "...", "imap_port": 993, "username": "...", "password_encrypted": "..." }

    -- Status and monitoring
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'setup')),
    last_checked_at TIMESTAMPTZ,
    last_email_received_at TIMESTAMPTZ,
    error_message TEXT,

    -- Settings
    check_interval_minutes INTEGER DEFAULT 5 CHECK (check_interval_minutes >= 1 AND check_interval_minutes <= 60),
    max_emails_per_check INTEGER DEFAULT 50 CHECK (max_emails_per_check >= 1 AND max_emails_per_check <= 100),

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),

    -- Constraints
    UNIQUE(company_id, email_address)
);

-- Table for email processing queue
CREATE TABLE email_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ingrid_account_id UUID NOT NULL REFERENCES ingrid_email_accounts(id) ON DELETE CASCADE,

    -- Email metadata
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    user_id UUID REFERENCES profiles(id), -- Matched user if found

    -- Email content
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    message_id VARCHAR(255), -- Original email message ID
    in_reply_to VARCHAR(255), -- For threading

    -- Attachments (stored as array of objects)
    attachments JSONB DEFAULT '[]'::jsonb,
    -- Format: [{"filename": "receipt.pdf", "content_type": "application/pdf", "size": 12345, "storage_path": "..."}]

    -- Processing status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1 = highest priority

    -- Processing results
    ai_analysis_result JSONB, -- Results from AI content analysis
    actions_taken JSONB DEFAULT '[]'::jsonb, -- Array of actions performed
    error_message TEXT,

    -- Timing
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    response_sent_at TIMESTAMPTZ,

    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for defining available Ingrid actions per company
CREATE TABLE ingrid_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Action definition
    action_type VARCHAR(50) NOT NULL, -- 'submit_expense', 'create_quote', 'add_contact', etc.
    action_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Configuration and rules
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    trigger_keywords TEXT[], -- Keywords that suggest this action
    file_type_filters TEXT[], -- ['pdf', 'jpg', 'png'] etc.

    -- Status and permissions
    is_active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false, -- If true, action needs user approval
    allowed_user_roles TEXT[] DEFAULT '{"admin", "user"}'::text[], -- Which user roles can trigger this action

    -- Response templates
    success_template TEXT, -- Template for successful action response
    error_template TEXT, -- Template for failed action response
    approval_template TEXT, -- Template when approval is needed

    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),

    -- Constraints
    UNIQUE(company_id, action_type, action_name)
);

-- Table for tracking action execution history
CREATE TABLE ingrid_action_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_queue_id UUID NOT NULL REFERENCES email_processing_queue(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    action_id UUID REFERENCES ingrid_actions(id),

    -- Action details
    action_type VARCHAR(50) NOT NULL,
    action_name VARCHAR(255),

    -- Execution results
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'failed', 'cancelled')),
    input_data JSONB, -- Data extracted from email for this action
    output_data JSONB, -- Results of action execution
    error_message TEXT,

    -- Performance metrics
    execution_time_ms INTEGER,
    ai_confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000

    -- User interaction
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,

    -- Reference to related records
    related_record_id UUID, -- ID of created expense, quote, contact, etc.
    related_record_type VARCHAR(50) -- 'expense', 'quote', 'contact', etc.
);

-- Table for Ingrid system settings and configuration
CREATE TABLE ingrid_system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Global settings
    is_enabled BOOLEAN DEFAULT true,
    default_response_language VARCHAR(10) DEFAULT 'en',

    -- AI model configuration
    ai_model_settings JSONB DEFAULT '{
        "model": "gpt-4",
        "temperature": 0.3,
        "max_tokens": 2000,
        "confidence_threshold": 0.7
    }'::jsonb,

    -- Email settings
    auto_reply_enabled BOOLEAN DEFAULT true,
    include_original_email BOOLEAN DEFAULT false,
    signature_template TEXT DEFAULT 'Best regards,\nIngrid AI Assistant\n{company_name}',

    -- Security settings
    allowed_sender_domains TEXT[], -- Restrict to specific domains
    blocked_sender_emails TEXT[], -- Block specific email addresses
    max_emails_per_day INTEGER DEFAULT 1000,
    max_attachment_size_mb INTEGER DEFAULT 25,

    -- Notification settings
    notify_admins_on_errors BOOLEAN DEFAULT true,
    daily_summary_enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One settings record per company
    UNIQUE(company_id)
);

-- Create indexes for performance
CREATE INDEX idx_ingrid_email_accounts_company_id ON ingrid_email_accounts(company_id);
CREATE INDEX idx_ingrid_email_accounts_status ON ingrid_email_accounts(status);
CREATE INDEX idx_ingrid_email_accounts_last_checked ON ingrid_email_accounts(last_checked_at);

CREATE INDEX idx_email_queue_company_id ON email_processing_queue(company_id);
CREATE INDEX idx_email_queue_status ON email_processing_queue(status);
CREATE INDEX idx_email_queue_sender_email ON email_processing_queue(sender_email);
CREATE INDEX idx_email_queue_received_at ON email_processing_queue(received_at);
CREATE INDEX idx_email_queue_priority_status ON email_processing_queue(priority, status);
CREATE INDEX idx_email_queue_next_retry ON email_processing_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;

CREATE INDEX idx_ingrid_actions_company_id ON ingrid_actions(company_id);
CREATE INDEX idx_ingrid_actions_type ON ingrid_actions(action_type);
CREATE INDEX idx_ingrid_actions_active ON ingrid_actions(is_active);

CREATE INDEX idx_action_history_email_queue_id ON ingrid_action_history(email_queue_id);
CREATE INDEX idx_action_history_company_id ON ingrid_action_history(company_id);
CREATE INDEX idx_action_history_user_id ON ingrid_action_history(user_id);
CREATE INDEX idx_action_history_status ON ingrid_action_history(status);
CREATE INDEX idx_action_history_created_at ON ingrid_action_history(created_at);

-- Create RLS (Row Level Security) policies
ALTER TABLE ingrid_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingrid_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingrid_action_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingrid_system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for ingrid_email_accounts
CREATE POLICY "Users can view their company's Ingrid email accounts" ON ingrid_email_accounts
    FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their company's Ingrid email accounts" ON ingrid_email_accounts
    FOR ALL USING (
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super-admin')
    );

-- Policies for email_processing_queue
CREATE POLICY "Users can view their company's email queue" ON email_processing_queue
    FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Policies for ingrid_actions
CREATE POLICY "Users can view their company's Ingrid actions" ON ingrid_actions
    FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their company's Ingrid actions" ON ingrid_actions
    FOR ALL USING (
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super-admin')
    );

-- Policies for ingrid_action_history
CREATE POLICY "Users can view their company's action history" ON ingrid_action_history
    FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Policies for ingrid_system_settings
CREATE POLICY "Users can view their company's Ingrid settings" ON ingrid_system_settings
    FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their company's Ingrid settings" ON ingrid_system_settings
    FOR ALL USING (
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super-admin')
    );

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ingrid_email_accounts_updated_at
    BEFORE UPDATE ON ingrid_email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingrid_actions_updated_at
    BEFORE UPDATE ON ingrid_actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingrid_system_settings_updated_at
    BEFORE UPDATE ON ingrid_system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system settings for existing companies
INSERT INTO ingrid_system_settings (company_id, is_enabled)
SELECT id, false FROM companies
ON CONFLICT (company_id) DO NOTHING;

-- Create some default action templates for companies
INSERT INTO ingrid_actions (company_id, action_type, action_name, description, action_config, trigger_keywords, file_type_filters, success_template, error_template)
SELECT
    id as company_id,
    'submit_expense',
    'Auto-Submit Expense from Receipt',
    'Automatically extract expense details from receipt images or PDFs and submit them',
    '{"auto_submit": false, "require_approval": true, "default_category": "general"}'::jsonb,
    ARRAY['receipt', 'expense', 'reimbursement', 'bill', 'invoice'],
    ARRAY['pdf', 'jpg', 'jpeg', 'png'],
    'Great! I''ve processed your receipt and created an expense entry for ${amount} from ${vendor}. The expense has been submitted for approval.',
    'I had trouble processing your receipt. Please check that the image is clear and contains expense information, then try again.'
FROM companies
ON CONFLICT (company_id, action_type, action_name) DO NOTHING;

INSERT INTO ingrid_actions (company_id, action_type, action_name, description, action_config, trigger_keywords, file_type_filters, success_template, error_template)
SELECT
    id as company_id,
    'add_contact',
    'Add Business Card to Contacts',
    'Extract contact information from business cards and add to your contact list',
    '{"auto_add": false, "require_approval": true, "duplicate_handling": "merge"}'::jsonb,
    ARRAY['business card', 'contact', 'add contact', 'new contact', 'card'],
    ARRAY['jpg', 'jpeg', 'png', 'pdf'],
    'Perfect! I''ve extracted the contact information for ${name} (${company}) and added them to your contacts.',
    'I couldn''t extract clear contact information from this image. Please ensure the business card is clearly visible and try again.'
FROM companies
ON CONFLICT (company_id, action_type, action_name) DO NOTHING;

INSERT INTO ingrid_actions (company_id, action_type, action_name, description, action_config, trigger_keywords, file_type_filters, success_template, error_template)
SELECT
    id as company_id,
    'create_quote',
    'Generate Quote from Request',
    'Analyze quote requests and generate professional quotes',
    '{"auto_generate": false, "require_approval": true, "default_terms": "Net 30", "include_logo": true}'::jsonb,
    ARRAY['quote', 'quotation', 'estimate', 'proposal', 'price', 'cost'],
    ARRAY['pdf', 'doc', 'docx', 'txt'],
    'I''ve prepared a quote based on your request. Please review the attached PDF and let me know if you need any adjustments.',
    'I need more information to create an accurate quote. Could you provide more details about the products or services needed?'
FROM companies
ON CONFLICT (company_id, action_type, action_name) DO NOTHING;

-- Create a view for email processing statistics
CREATE VIEW ingrid_email_stats AS
SELECT
    eq.company_id,
    c.name as company_name,
    COUNT(*) as total_emails,
    COUNT(CASE WHEN eq.status = 'completed' THEN 1 END) as completed_emails,
    COUNT(CASE WHEN eq.status = 'failed' THEN 1 END) as failed_emails,
    COUNT(CASE WHEN eq.status = 'pending' THEN 1 END) as pending_emails,
    AVG(EXTRACT(EPOCH FROM (eq.processing_completed_at - eq.processing_started_at)) * 1000)::INTEGER as avg_processing_time_ms,
    MAX(eq.received_at) as last_email_received
FROM email_processing_queue eq
JOIN companies c ON c.id = eq.company_id
GROUP BY eq.company_id, c.name;

-- Grant necessary permissions
GRANT SELECT ON ingrid_email_stats TO authenticated;