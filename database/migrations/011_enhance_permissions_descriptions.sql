-- ================================================================
-- ENHANCE PERMISSIONS WITH PLAIN ENGLISH DESCRIPTIONS
-- ================================================================
-- This migration adds human-readable descriptions and hierarchical
-- dependencies for the permission system
-- ================================================================

BEGIN;

-- Add columns for human-readable descriptions and dependencies
ALTER TABLE permissions
ADD COLUMN human_description TEXT,
ADD COLUMN dependency_chain TEXT[],
ADD COLUMN permission_group VARCHAR(50),
ADD COLUMN ui_display_order INTEGER DEFAULT 0,
ADD COLUMN requires_permissions TEXT[];

-- Update existing permissions with plain English descriptions
UPDATE permissions SET
human_description = CASE permission_key
    -- Core Permissions
    WHEN 'dashboard.view' THEN 'View main dashboard and analytics'
    WHEN 'users.view' THEN 'View user accounts and profiles'
    WHEN 'users.create' THEN 'Add new users to the system'
    WHEN 'users.edit' THEN 'Edit user accounts and permissions'
    WHEN 'users.delete' THEN 'Remove users from the system'
    WHEN 'company.settings.view' THEN 'View company settings and configuration'
    WHEN 'company.settings.edit' THEN 'Modify company settings and preferences'
    WHEN 'notifications.view' THEN 'View system notifications'
    WHEN 'notifications.manage' THEN 'Manage and configure notifications'

    -- Operations Permissions
    WHEN 'vendors.view' THEN 'View vendor directory and information'
    WHEN 'vendors.create' THEN 'Add new vendors to the system'
    WHEN 'vendors.edit' THEN 'Modify vendor information and settings'
    WHEN 'vendors.delete' THEN 'Remove vendors from the system'
    WHEN 'customers.view' THEN 'View customer directory and information'
    WHEN 'customers.create' THEN 'Add new customers to the system'
    WHEN 'customers.edit' THEN 'Modify customer information and settings'
    WHEN 'customers.delete' THEN 'Remove customers from the system'
    WHEN 'expenses.view' THEN 'View expense reports and receipts'
    WHEN 'expenses.create' THEN 'Submit new expense reports'
    WHEN 'expenses.edit' THEN 'Modify existing expense reports'
    WHEN 'expenses.delete' THEN 'Delete expense reports'
    WHEN 'expenses.approve' THEN 'Approve or reject expense reports'
    WHEN 'expenses.review' THEN 'Review and process expense submissions'

    -- AI Permissions
    WHEN 'ingrid.suggestions.view' THEN 'View AI-generated suggestions and recommendations'
    WHEN 'ingrid.suggestions.approve' THEN 'Approve or reject AI suggestions'
    WHEN 'ingrid.configure' THEN 'Configure AI assistant settings'
    WHEN 'ingrid.analytics.view' THEN 'View AI performance analytics'

    -- Accounting Permissions
    WHEN 'gl_accounts.view' THEN 'View general ledger accounts'
    WHEN 'gl_accounts.create' THEN 'Create new general ledger accounts'
    WHEN 'gl_accounts.edit' THEN 'Modify general ledger accounts'
    WHEN 'gl_accounts.delete' THEN 'Remove general ledger accounts'
    WHEN 'expense_categories.view' THEN 'View expense categories and classifications'
    WHEN 'expense_categories.create' THEN 'Create new expense categories'
    WHEN 'expense_categories.edit' THEN 'Modify expense categories'
    WHEN 'expense_categories.delete' THEN 'Remove expense categories'

    -- Automation Permissions
    WHEN 'automation.view' THEN 'View automated workflows and processes'
    WHEN 'automation.create' THEN 'Create new automated workflows'
    WHEN 'automation.edit' THEN 'Modify automated workflows'
    WHEN 'automation.delete' THEN 'Remove automated workflows'
    WHEN 'automation.execute' THEN 'Run and execute automated processes'

    -- Analytics Permissions
    WHEN 'analytics.view' THEN 'View reports and analytics dashboards'
    WHEN 'analytics.export' THEN 'Export reports and data'
    WHEN 'analytics.advanced' THEN 'Access advanced analytics features'

    ELSE 'Manage ' || REPLACE(REPLACE(permission_key, '.', ' '), '_', ' ')
END,

-- Set permission groups for better organization
permission_group = CASE
    WHEN permission_key LIKE 'dashboard.%' OR permission_key LIKE 'company.%' OR permission_key LIKE 'users.%' OR permission_key LIKE 'notifications.%' THEN 'Core System'
    WHEN permission_key LIKE 'vendors.%' OR permission_key LIKE 'customers.%' OR permission_key LIKE 'expenses.%' THEN 'Operations'
    WHEN permission_key LIKE 'ingrid.%' THEN 'AI Assistant'
    WHEN permission_key LIKE 'gl_accounts.%' OR permission_key LIKE 'expense_categories.%' THEN 'Accounting'
    WHEN permission_key LIKE 'automation.%' THEN 'Automation'
    WHEN permission_key LIKE 'analytics.%' THEN 'Analytics'
    ELSE 'General'
END,

-- Set display order for UI
ui_display_order = CASE permission_group
    WHEN 'Core System' THEN 100
    WHEN 'Operations' THEN 200
    WHEN 'Accounting' THEN 300
    WHEN 'AI Assistant' THEN 400
    WHEN 'Automation' THEN 500
    WHEN 'Analytics' THEN 600
    ELSE 900
END + CASE
    WHEN permission_key LIKE '%.view' THEN 1
    WHEN permission_key LIKE '%.create' THEN 2
    WHEN permission_key LIKE '%.edit' THEN 3
    WHEN permission_key LIKE '%.approve' OR permission_key LIKE '%.review' THEN 4
    WHEN permission_key LIKE '%.delete' THEN 5
    ELSE 9
END,

-- Set hierarchical dependencies (view -> create -> edit -> delete)
requires_permissions = CASE
    WHEN permission_key LIKE '%.create' THEN ARRAY[REPLACE(permission_key, '.create', '.view')]
    WHEN permission_key LIKE '%.edit' THEN ARRAY[REPLACE(permission_key, '.edit', '.view')]
    WHEN permission_key LIKE '%.delete' THEN ARRAY[REPLACE(permission_key, '.delete', '.view'), REPLACE(permission_key, '.delete', '.edit')]
    WHEN permission_key LIKE '%.approve' THEN ARRAY[REPLACE(permission_key, '.approve', '.view')]
    WHEN permission_key LIKE '%.review' THEN ARRAY[REPLACE(permission_key, '.review', '.view')]
    WHEN permission_key = 'company.settings.edit' THEN ARRAY['company.settings.view']
    WHEN permission_key = 'notifications.manage' THEN ARRAY['notifications.view']
    WHEN permission_key = 'ingrid.suggestions.approve' THEN ARRAY['ingrid.suggestions.view']
    WHEN permission_key = 'ingrid.configure' THEN ARRAY['ingrid.suggestions.view']
    WHEN permission_key = 'analytics.export' THEN ARRAY['analytics.view']
    WHEN permission_key = 'analytics.advanced' THEN ARRAY['analytics.view']
    WHEN permission_key = 'automation.execute' THEN ARRAY['automation.view']
    ELSE ARRAY[]::TEXT[]
END;

-- Create function to get hierarchical permissions for a user role
CREATE OR REPLACE FUNCTION get_role_permissions_hierarchy(p_role VARCHAR(50))
RETURNS TABLE (
    permission_key VARCHAR,
    human_description TEXT,
    permission_group VARCHAR,
    has_permission BOOLEAN,
    dependency_met BOOLEAN,
    required_permissions TEXT[]
) LANGUAGE plpgsql AS $$
DECLARE
    role_permissions TEXT[];
BEGIN
    -- Get all permissions for the role
    SELECT ARRAY_AGG(p.permission_key)
    INTO role_permissions
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_name = p_role;

    RETURN QUERY
    SELECT
        p.permission_key,
        p.human_description,
        p.permission_group,
        (p.permission_key = ANY(role_permissions)) as has_permission,
        -- Check if all required permissions are met
        CASE
            WHEN p.requires_permissions IS NULL OR array_length(p.requires_permissions, 1) IS NULL THEN true
            ELSE (
                SELECT BOOL_AND(req_perm = ANY(role_permissions))
                FROM unnest(p.requires_permissions) AS req_perm
            )
        END as dependency_met,
        p.requires_permissions as required_permissions
    FROM permissions p
    ORDER BY p.permission_group, p.ui_display_order, p.permission_key;
END;
$$;

-- Create function to validate permission dependencies
CREATE OR REPLACE FUNCTION validate_permission_dependencies(p_user_id UUID, p_permissions TEXT[])
RETURNS TABLE (
    permission_key VARCHAR,
    is_valid BOOLEAN,
    missing_dependencies TEXT[],
    error_message TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH permission_check AS (
        SELECT
            perm as permission_key,
            p.requires_permissions,
            CASE
                WHEN p.requires_permissions IS NULL OR array_length(p.requires_permissions, 1) IS NULL THEN true
                ELSE (
                    SELECT BOOL_AND(req_perm = ANY(p_permissions))
                    FROM unnest(p.requires_permissions) AS req_perm
                )
            END as dependencies_met,
            CASE
                WHEN p.requires_permissions IS NULL OR array_length(p.requires_permissions, 1) IS NULL THEN ARRAY[]::TEXT[]
                ELSE (
                    SELECT ARRAY_AGG(req_perm)
                    FROM unnest(p.requires_permissions) AS req_perm
                    WHERE req_perm != ALL(p_permissions)
                )
            END as missing_deps
        FROM unnest(p_permissions) AS perm
        LEFT JOIN permissions p ON p.permission_key = perm
    )
    SELECT
        pc.permission_key::VARCHAR,
        COALESCE(pc.dependencies_met, false) as is_valid,
        COALESCE(pc.missing_deps, ARRAY[]::TEXT[]) as missing_dependencies,
        CASE
            WHEN NOT COALESCE(pc.dependencies_met, false) THEN
                'Missing required permissions: ' || array_to_string(pc.missing_deps, ', ')
            ELSE 'Valid'
        END as error_message
    FROM permission_check pc;
END;
$$;

-- Create view for permission management UI
CREATE OR REPLACE VIEW permission_management_view AS
SELECT
    p.id,
    p.permission_key,
    p.permission_name,
    p.human_description,
    p.permission_group,
    p.ui_display_order,
    p.requires_permissions,
    p.category,
    p.module_id,
    m.name as module_name,
    m.module_classification,
    -- Count how many roles have this permission
    (SELECT COUNT(*) FROM role_permissions rp WHERE rp.permission_id = p.id) as roles_with_permission,
    -- Count how many users have explicit grants
    (SELECT COUNT(*) FROM user_permissions up WHERE up.permission_id = p.id AND up.is_granted = true) as users_with_explicit_grant
FROM permissions p
LEFT JOIN modules m ON p.module_id = m.id
ORDER BY p.permission_group, p.ui_display_order, p.permission_key;

-- Create table for permission templates (role-based permission sets)
CREATE TABLE permission_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    target_role VARCHAR(50) NOT NULL,
    permissions TEXT[] NOT NULL,
    is_system_template BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default permission templates
INSERT INTO permission_templates (template_name, display_name, description, target_role, permissions, is_system_template) VALUES
('basic_user', 'Basic User', 'Standard permissions for regular users', 'user', ARRAY[
    'dashboard.view',
    'expenses.view',
    'expenses.create',
    'vendors.view',
    'customers.view',
    'expense_categories.view',
    'gl_accounts.view',
    'notifications.view'
], true),

('admin_user', 'Administrator', 'Full administrative permissions except super-admin functions', 'admin', ARRAY[
    'dashboard.view',
    'users.view', 'users.create', 'users.edit',
    'company.settings.view', 'company.settings.edit',
    'vendors.view', 'vendors.create', 'vendors.edit',
    'customers.view', 'customers.create', 'customers.edit',
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.approve', 'expenses.review',
    'expense_categories.view', 'expense_categories.create', 'expense_categories.edit',
    'gl_accounts.view', 'gl_accounts.create', 'gl_accounts.edit',
    'ingrid.suggestions.view', 'ingrid.suggestions.approve',
    'analytics.view', 'analytics.export',
    'notifications.view', 'notifications.manage'
], true),

('expense_manager', 'Expense Manager', 'Focused on expense management and approval', 'admin', ARRAY[
    'dashboard.view',
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.approve', 'expenses.review',
    'vendors.view', 'vendors.create', 'vendors.edit',
    'expense_categories.view', 'expense_categories.create', 'expense_categories.edit',
    'gl_accounts.view',
    'analytics.view', 'analytics.export',
    'notifications.view'
], true);

-- Create indexes for better performance
CREATE INDEX idx_permissions_group_order ON permissions(permission_group, ui_display_order);
CREATE INDEX idx_permissions_requires ON permissions USING GIN(requires_permissions);
CREATE INDEX idx_permission_templates_role ON permission_templates(target_role);

-- Create trigger to update permission template modified time
CREATE OR REPLACE FUNCTION update_permission_template_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_permission_template_updated_at
    BEFORE UPDATE ON permission_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_permission_template_updated_at();

COMMIT;