-- ================================================================
-- REFACTOR PERMISSIONS SYSTEM - TWO-TIER ARCHITECTURE
-- ================================================================
-- Migration: 014_refactor_permissions_system
-- Date: September 30, 2025
-- Description: Refactors the permission system into two clear tiers:
--   1. Data Permissions: Basic operational permissions (foundation)
--   2. Module Permissions: Premium features with sub-permissions
-- ================================================================

BEGIN;

-- ================================================================
-- STEP 1: CREATE DATA PERMISSIONS TABLE
-- ================================================================

-- Rename existing permissions table to data_permissions for clarity
ALTER TABLE permissions RENAME TO data_permissions;

-- Add new columns to data_permissions
ALTER TABLE data_permissions
ADD COLUMN IF NOT EXISTS permission_group VARCHAR(100),
ADD COLUMN IF NOT EXISTS ui_display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_permissions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_foundation_permission BOOLEAN DEFAULT true;

-- Update permission_group for existing permissions based on category
UPDATE data_permissions SET permission_group = CASE
    WHEN permission_key LIKE 'company.%' THEN 'Company Configuration'
    WHEN permission_key LIKE 'customers.%' THEN 'Customer Relationship Management'
    WHEN permission_key LIKE 'vendors.%' THEN 'Vendor and Supplier Management'
    WHEN permission_key LIKE 'expenses.%' THEN 'Expense Operations'
    WHEN permission_key LIKE 'gl_accounts.%' THEN 'GL Account Management'
    WHEN permission_key LIKE 'expense_categories.%' THEN 'Expense Category Management'
    WHEN permission_key LIKE 'users.%' THEN 'User Management'
    WHEN permission_key LIKE 'notifications.%' THEN 'Notification Management'
    WHEN permission_key LIKE 'dashboard.%' OR permission_key LIKE 'analytics.%' THEN 'Dashboard & Analytics'
    ELSE 'General'
END;

-- Add human-friendly descriptions if not present
ALTER TABLE data_permissions
ADD COLUMN IF NOT EXISTS human_description TEXT;

UPDATE data_permissions SET human_description =
    permission_name || ' - ' || COALESCE(description, 'No description available')
WHERE human_description IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_data_permissions_group ON data_permissions(permission_group);
CREATE INDEX IF NOT EXISTS idx_data_permissions_key ON data_permissions(permission_key);

-- ================================================================
-- STEP 2: RENAME USER PERMISSIONS TABLE FOR CLARITY
-- ================================================================

-- Rename user_permissions to user_data_permissions
ALTER TABLE user_permissions RENAME TO user_data_permissions;

-- Update foreign key reference name (PostgreSQL will maintain the constraint)
ALTER TABLE user_data_permissions
RENAME CONSTRAINT user_permissions_permission_id_fkey TO user_data_permissions_permission_id_fkey;

ALTER TABLE user_data_permissions
RENAME CONSTRAINT user_permissions_user_id_fkey TO user_data_permissions_user_id_fkey;

ALTER TABLE user_data_permissions
RENAME CONSTRAINT user_permissions_company_id_fkey TO user_data_permissions_company_id_fkey;

-- Add metadata columns
ALTER TABLE user_data_permissions
ADD COLUMN IF NOT EXISTS granted_reason TEXT,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- ================================================================
-- STEP 3: ENHANCE MODULES TABLE
-- ================================================================

-- Add new module classification columns
ALTER TABLE modules
ADD COLUMN IF NOT EXISTS module_tier VARCHAR(50) DEFAULT 'core' CHECK (module_tier IN ('core', 'standard', 'premium')),
ADD COLUMN IF NOT EXISTS included_permissions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sub_features JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS feature_limits JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS module_dependencies TEXT[] DEFAULT '{}';

-- Set module tiers based on existing module_type and pricing
UPDATE modules SET module_tier = CASE
    WHEN module_type = 'core' OR is_core_required = true THEN 'core'
    WHEN default_monthly_price >= 30 OR default_per_user_price >= 6 THEN 'premium'
    ELSE 'standard'
END;

-- Map modules to their included permissions
UPDATE modules SET included_permissions = CASE
    WHEN name = 'Expense Management' THEN ARRAY['expenses.view', 'expenses.create', 'expenses.edit', 'expenses.approve', 'expenses.review']
    WHEN name = 'Ingrid AI' THEN ARRAY['ingrid.view', 'ingrid.approve', 'ingrid.configure', 'ingrid.analytics']
    WHEN name = 'Advanced Analytics' THEN ARRAY['analytics.advanced', 'analytics.export']
    WHEN name = 'Vendors' THEN ARRAY['vendors.view', 'vendors.create', 'vendors.edit', 'vendors.delete']
    WHEN name = 'Customers' THEN ARRAY['customers.view', 'customers.create', 'customers.edit', 'customers.delete']
    WHEN name = 'GL Accounts' THEN ARRAY['gl_accounts.view', 'gl_accounts.create', 'gl_accounts.edit', 'gl_accounts.delete']
    WHEN name = 'Expense Categories' THEN ARRAY['expense_categories.view', 'expense_categories.create', 'expense_categories.edit', 'expense_categories.delete']
    WHEN name = 'Dashboard' THEN ARRAY['dashboard.view', 'analytics.view']
    ELSE '{}'
END;

-- Add sub-features for complex modules
UPDATE modules SET sub_features = CASE
    WHEN name = 'Expense Management' THEN '[
        {"name": "Expense Approval Workflow", "key": "expense_approval"},
        {"name": "Multi-level Review System", "key": "multi_level_review"},
        {"name": "Assignment & Delegation", "key": "assignment_delegation"},
        {"name": "Advanced Filtering", "key": "advanced_filtering"}
    ]'::jsonb
    WHEN name = 'Ingrid AI' THEN '[
        {"name": "AI Category Suggestions", "key": "ai_category_suggestions"},
        {"name": "AI Vendor Suggestions", "key": "ai_vendor_suggestions"},
        {"name": "Smart Document Naming", "key": "smart_document_naming"},
        {"name": "Document Intelligence", "key": "document_intelligence"},
        {"name": "Chat Interface", "key": "chat_interface"}
    ]'::jsonb
    WHEN name = 'Advanced Analytics' THEN '[
        {"name": "Custom Report Builder", "key": "custom_reports"},
        {"name": "Advanced Visualizations", "key": "advanced_viz"},
        {"name": "Export to Excel/PDF", "key": "export_reports"},
        {"name": "Scheduled Reports", "key": "scheduled_reports"}
    ]'::jsonb
    ELSE '[]'::jsonb
END;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_modules_tier ON modules(module_tier);
CREATE INDEX IF NOT EXISTS idx_modules_included_permissions ON modules USING GIN(included_permissions);

-- ================================================================
-- STEP 4: ENHANCE COMPANY_MODULES TABLE
-- ================================================================

-- Add pricing and configuration columns
ALTER TABLE company_modules
ADD COLUMN IF NOT EXISTS pricing_tier VARCHAR(50) DEFAULT 'standard' CHECK (pricing_tier IN ('standard', 'custom', 'enterprise')),
ADD COLUMN IF NOT EXISTS users_licensed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS feature_configuration JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS billing_notes TEXT;

-- Migrate existing pricing data
UPDATE company_modules
SET
    pricing_tier = CASE
        WHEN monthly_price IS NOT NULL AND monthly_price != (SELECT default_monthly_price FROM modules WHERE id = module_id) THEN 'custom'
        ELSE 'standard'
    END;

-- Create indexes for reporting
CREATE INDEX IF NOT EXISTS idx_company_modules_pricing_tier ON company_modules(pricing_tier);
CREATE INDEX IF NOT EXISTS idx_company_modules_enabled ON company_modules(company_id, is_enabled);

-- ================================================================
-- STEP 5: CREATE MODULE PERMISSIONS JUNCTION TABLE
-- ================================================================

-- This table explicitly links modules to their required permissions
CREATE TABLE IF NOT EXISTS module_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES data_permissions(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT true, -- If true, this permission is always granted with module
    is_optional BOOLEAN DEFAULT false, -- If true, admin can choose to grant this
    permission_order INTEGER DEFAULT 0, -- Display order in UI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(module_id, permission_id)
);

-- Populate module_permissions from modules.included_permissions
INSERT INTO module_permissions (module_id, permission_id, is_required, permission_order)
SELECT
    m.id as module_id,
    dp.id as permission_id,
    true as is_required,
    idx as permission_order
FROM modules m
CROSS JOIN LATERAL unnest(m.included_permissions) WITH ORDINALITY AS t(permission_key, idx)
JOIN data_permissions dp ON dp.permission_key = t.permission_key
ON CONFLICT (module_id, permission_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_module_permissions_module ON module_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_module_permissions_permission ON module_permissions(permission_id);

-- ================================================================
-- STEP 6: CREATE USER MODULE PERMISSIONS TABLE
-- ================================================================

-- This tracks which specific module permissions a user has
CREATE TABLE IF NOT EXISTS user_module_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES data_permissions(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    is_granted BOOLEAN DEFAULT false,
    granted_by UUID REFERENCES auth_users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, module_id, permission_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_module_permissions_user ON user_module_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_module ON user_module_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_company ON user_module_permissions(company_id);

-- ================================================================
-- STEP 7: CREATE PERMISSION TEMPLATES
-- ================================================================

-- Permission templates for quick user setup
CREATE TABLE IF NOT EXISTS permission_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    target_role VARCHAR(50) CHECK (target_role IN ('user', 'admin', 'super-admin')),
    data_permissions TEXT[] DEFAULT '{}', -- Array of permission keys
    modules TEXT[] DEFAULT '{}', -- Array of module IDs
    is_system_template BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default templates
INSERT INTO permission_templates (template_name, display_name, description, target_role, data_permissions, modules) VALUES
(
    'basic_user',
    'Basic User',
    'Standard employee with basic data access',
    'user',
    ARRAY['dashboard.view', 'expenses.view', 'expenses.create', 'notifications.view'],
    ARRAY[]::TEXT[]
),
(
    'expense_reviewer',
    'Expense Reviewer',
    'Can review and approve expenses',
    'user',
    ARRAY['dashboard.view', 'expenses.view', 'expenses.create', 'expenses.review', 'expenses.approve', 'analytics.view'],
    ARRAY[]::TEXT[]
),
(
    'department_manager',
    'Department Manager',
    'Manager with full operational access',
    'admin',
    ARRAY[
        'dashboard.view', 'analytics.view',
        'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.approve', 'expenses.review',
        'vendors.view', 'vendors.create', 'vendors.edit',
        'customers.view', 'customers.create', 'customers.edit',
        'users.view', 'notifications.view', 'notifications.manage'
    ],
    ARRAY[]::TEXT[]
),
(
    'controller',
    'Controller',
    'Full financial and accounting access',
    'admin',
    ARRAY[
        'dashboard.view', 'analytics.view', 'analytics.export',
        'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.approve', 'expenses.review', 'expenses.delete',
        'vendors.view', 'vendors.create', 'vendors.edit', 'vendors.delete',
        'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
        'gl_accounts.view', 'gl_accounts.create', 'gl_accounts.edit', 'gl_accounts.delete',
        'expense_categories.view', 'expense_categories.create', 'expense_categories.edit', 'expense_categories.delete',
        'users.view', 'users.create', 'users.edit',
        'company.settings.view', 'company.settings.edit',
        'notifications.view', 'notifications.manage'
    ],
    ARRAY[]::TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_permission_templates_role ON permission_templates(target_role);

-- ================================================================
-- STEP 8: CREATE HELPER FUNCTIONS
-- ================================================================

-- Function to get user's complete effective permissions (data + module)
CREATE OR REPLACE FUNCTION get_user_complete_permissions(
    p_user_id UUID,
    p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
    permission_key VARCHAR(100),
    permission_name VARCHAR(255),
    permission_source VARCHAR(50), -- 'data', 'module', 'role'
    module_name VARCHAR(100),
    is_granted BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH user_info AS (
        SELECT p.role, p.company_id
        FROM profiles p
        WHERE p.user_id = p_user_id
        LIMIT 1
    ),
    -- Data permissions from user_data_permissions
    data_perms AS (
        SELECT
            dp.permission_key,
            dp.permission_name,
            'data'::VARCHAR(50) as permission_source,
            NULL::VARCHAR(100) as module_name,
            udp.is_granted
        FROM user_data_permissions udp
        JOIN data_permissions dp ON udp.permission_id = dp.id
        WHERE udp.user_id = p_user_id
          AND (p_company_id IS NULL OR udp.company_id = p_company_id)
          AND (udp.expires_at IS NULL OR udp.expires_at > NOW())
    ),
    -- Module permissions from user_modules + module_permissions
    module_perms AS (
        SELECT
            dp.permission_key,
            dp.permission_name,
            'module'::VARCHAR(50) as permission_source,
            m.name as module_name,
            um.is_enabled as is_granted
        FROM user_modules um
        JOIN modules m ON um.module_id = m.id
        JOIN module_permissions mp ON mp.module_id = m.id AND mp.is_required = true
        JOIN data_permissions dp ON mp.permission_id = dp.id
        WHERE um.user_id = p_user_id
          AND (p_company_id IS NULL OR um.company_id = p_company_id)
          AND um.is_enabled = true
          AND (um.expires_at IS NULL OR um.expires_at > NOW())
    ),
    -- Role-based permissions
    role_perms AS (
        SELECT
            dp.permission_key,
            dp.permission_name,
            'role'::VARCHAR(50) as permission_source,
            NULL::VARCHAR(100) as module_name,
            true as is_granted
        FROM user_info ui
        JOIN role_permissions rp ON rp.role_name = ui.role
        JOIN data_permissions dp ON rp.permission_id = dp.id
    )
    SELECT * FROM data_perms WHERE is_granted = true
    UNION
    SELECT * FROM module_perms WHERE is_granted = true
    UNION
    SELECT * FROM role_perms
    ORDER BY permission_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to grant module access (automatically grants required permissions)
CREATE OR REPLACE FUNCTION grant_user_module_access(
    p_user_id UUID,
    p_module_id UUID,
    p_company_id UUID,
    p_granted_by UUID
)
RETURNS VOID AS $$
BEGIN
    -- Enable the module for the user
    INSERT INTO user_modules (user_id, module_id, company_id, is_enabled, granted_by, granted_at)
    VALUES (p_user_id, p_module_id, p_company_id, true, p_granted_by, NOW())
    ON CONFLICT (user_id, module_id, company_id)
    DO UPDATE SET is_enabled = true, granted_by = p_granted_by, granted_at = NOW();

    -- Automatically grant all required module permissions
    INSERT INTO user_module_permissions (user_id, module_id, permission_id, company_id, is_granted, granted_by)
    SELECT
        p_user_id,
        p_module_id,
        mp.permission_id,
        p_company_id,
        true,
        p_granted_by
    FROM module_permissions mp
    WHERE mp.module_id = p_module_id
      AND mp.is_required = true
    ON CONFLICT (user_id, module_id, permission_id, company_id)
    DO UPDATE SET is_granted = true, granted_by = p_granted_by, granted_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to revoke module access (removes module permissions)
CREATE OR REPLACE FUNCTION revoke_user_module_access(
    p_user_id UUID,
    p_module_id UUID,
    p_company_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Disable the module
    UPDATE user_modules
    SET is_enabled = false, updated_at = NOW()
    WHERE user_id = p_user_id
      AND module_id = p_module_id
      AND company_id = p_company_id;

    -- Revoke module permissions
    UPDATE user_module_permissions
    SET is_granted = false, updated_at = NOW()
    WHERE user_id = p_user_id
      AND module_id = p_module_id
      AND company_id = p_company_id;
END;
$$ LANGUAGE plpgsql;

-- Drop existing function if it exists to avoid parameter name conflicts
DROP FUNCTION IF EXISTS user_has_permission(UUID, VARCHAR, UUID);
DROP FUNCTION IF EXISTS user_has_permission(UUID, VARCHAR);

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_permission_key VARCHAR(100),
    p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    has_perm BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM get_user_complete_permissions(p_user_id, p_company_id)
        WHERE permission_key = p_permission_key AND is_granted = true
    ) INTO has_perm;

    RETURN has_perm;
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- STEP 9: CREATE AUDIT LOGGING
-- ================================================================

CREATE TABLE IF NOT EXISTS permission_change_audit (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth_users(id),
    affected_user_id UUID REFERENCES auth_users(id),
    company_id UUID REFERENCES companies(id),
    change_type VARCHAR(50) CHECK (change_type IN ('grant_data_permission', 'revoke_data_permission', 'grant_module', 'revoke_module', 'grant_module_permission', 'revoke_module_permission')),
    permission_key VARCHAR(100),
    module_id UUID REFERENCES modules(id),
    old_value BOOLEAN,
    new_value BOOLEAN,
    reason TEXT,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_user ON permission_change_audit(affected_user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_performed_at ON permission_change_audit(performed_at DESC);

-- Trigger function to log permission changes
CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.is_granted IS DISTINCT FROM NEW.is_granted THEN
            INSERT INTO permission_change_audit (
                affected_user_id,
                company_id,
                change_type,
                permission_key,
                old_value,
                new_value,
                performed_at
            ) VALUES (
                NEW.user_id,
                NEW.company_id,
                CASE WHEN NEW.is_granted THEN 'grant_data_permission' ELSE 'revoke_data_permission' END,
                (SELECT permission_key FROM data_permissions WHERE id = NEW.permission_id),
                OLD.is_granted,
                NEW.is_granted,
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_log_data_permission_changes ON user_data_permissions;
CREATE TRIGGER trigger_log_data_permission_changes
    AFTER UPDATE ON user_data_permissions
    FOR EACH ROW
    EXECUTE FUNCTION log_permission_change();

-- ================================================================
-- STEP 10: UPDATE VIEWS
-- ================================================================

-- Create view for user permission overview
CREATE OR REPLACE VIEW user_permission_overview AS
SELECT
    p.user_id,
    p.company_id,
    p.role,
    au.email,
    p.full_name,
    c.name as company_name,
    (SELECT COUNT(*) FROM user_data_permissions udp WHERE udp.user_id = p.user_id AND udp.is_granted = true) as data_permissions_count,
    (SELECT COUNT(*) FROM user_modules um WHERE um.user_id = p.user_id AND um.is_enabled = true) as modules_count,
    (SELECT array_agg(DISTINCT m.name) FROM user_modules um JOIN modules m ON um.module_id = m.id WHERE um.user_id = p.user_id AND um.is_enabled = true) as active_modules
FROM profiles p
JOIN auth_users au ON p.user_id = au.id
LEFT JOIN companies c ON p.company_id = c.id
WHERE au.is_active = true;

-- ================================================================
-- STEP 11: MIGRATE EXISTING DATA
-- ================================================================

-- Migrate existing user_permissions that were role-based to user_data_permissions
-- (Already renamed, so this step ensures consistency)

-- Ensure all users with modules have the appropriate module permissions
INSERT INTO user_module_permissions (user_id, module_id, permission_id, company_id, is_granted, granted_by)
SELECT
    um.user_id,
    um.module_id,
    mp.permission_id,
    um.company_id,
    um.is_enabled,
    um.granted_by
FROM user_modules um
JOIN module_permissions mp ON mp.module_id = um.module_id AND mp.is_required = true
WHERE um.is_enabled = true
ON CONFLICT (user_id, module_id, permission_id, company_id) DO NOTHING;

-- ================================================================
-- FINALIZE
-- ================================================================

-- Add helpful comments
COMMENT ON TABLE data_permissions IS 'Foundation-level permissions for basic operational access (no cost)';
COMMENT ON TABLE user_data_permissions IS 'Individual user grants for data permissions';
COMMENT ON TABLE module_permissions IS 'Defines which permissions are included in each module';
COMMENT ON TABLE user_module_permissions IS 'Tracks specific module permission grants for users';
COMMENT ON TABLE permission_templates IS 'Pre-configured permission sets for quick user setup';

COMMIT;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Run these after migration to verify:
-- SELECT * FROM data_permissions ORDER BY permission_group, permission_key;
-- SELECT * FROM modules WHERE module_tier = 'premium';
-- SELECT * FROM permission_templates;
-- SELECT * FROM user_permission_overview LIMIT 10;
