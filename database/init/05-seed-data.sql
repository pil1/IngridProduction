-- ================================================================
-- INFOTRAC POSTGRESQL DATABASE INITIALIZATION - PART 5
-- ================================================================
-- Default Data and Seed Records
-- ================================================================

-- ================================================================
-- INSERT DEFAULT CURRENCIES
-- ================================================================
INSERT INTO currencies (code, name, symbol) VALUES
('USD', 'US Dollar', '$'),
('EUR', 'Euro', '€'),
('GBP', 'British Pound', '£'),
('CAD', 'Canadian Dollar', 'C$'),
('AUD', 'Australian Dollar', 'A$'),
('JPY', 'Japanese Yen', '¥'),
('CHF', 'Swiss Franc', 'Fr'),
('CNY', 'Chinese Yuan', '¥');

-- ================================================================
-- INSERT DEFAULT MODULES
-- ================================================================
INSERT INTO modules (name, description, module_type, category, is_core_required, default_monthly_price, default_per_user_price) VALUES
-- Core modules (always required)
('Dashboard', 'Main dashboard and analytics', 'core', 'core', true, 0, 0),
('User Management', 'User and permission management', 'core', 'core', true, 0, 0),
('Company Settings', 'Company configuration and settings', 'core', 'core', true, 0, 0),
('Notifications', 'User notification system', 'core', 'core', true, 0, 0),

-- Operations modules (core required)
('Vendors', 'Vendor and supplier management', 'core', 'operations', true, 0, 0),
('Customers', 'Customer relationship management', 'core', 'operations', true, 0, 0),
('GL Accounts', 'General ledger account management', 'core', 'accounting', true, 0, 0),
('Expense Categories', 'Expense categorization', 'core', 'accounting', true, 0, 0),

-- Add-on modules
('Ingrid AI', 'AI-powered document processing assistant', 'add-on', 'ai', false, 29.99, 4.99),
('Expense Management', 'Advanced expense tracking and approval', 'add-on', 'operations', false, 25.00, 3.00),
('Process Automation', 'Email-based document processing automation', 'add-on', 'automation', false, 75.00, 8.00),
('Advanced Analytics', 'Detailed reporting and analytics', 'add-on', 'analytics', false, 50.00, 5.00),
('API Management', 'API key management and integration tools', 'add-on', 'integration', false, 15.00, 1.50);

-- ================================================================
-- INSERT DEFAULT PERMISSIONS
-- ================================================================
INSERT INTO permissions (permission_key, permission_name, description, category, module_id) VALUES
-- Core permissions
('dashboard.view', 'View Dashboard', 'Access to main dashboard', 'core', (SELECT id FROM modules WHERE name = 'Dashboard')),
('users.view', 'View Users', 'View user listings', 'core', (SELECT id FROM modules WHERE name = 'User Management')),
('users.create', 'Create Users', 'Create new users', 'core', (SELECT id FROM modules WHERE name = 'User Management')),
('users.edit', 'Edit Users', 'Modify user details', 'core', (SELECT id FROM modules WHERE name = 'User Management')),
('users.delete', 'Delete Users', 'Remove users', 'core', (SELECT id FROM modules WHERE name = 'User Management')),
('company.settings.view', 'View Company Settings', 'View company configuration', 'core', (SELECT id FROM modules WHERE name = 'Company Settings')),
('company.settings.edit', 'Edit Company Settings', 'Modify company settings', 'core', (SELECT id FROM modules WHERE name = 'Company Settings')),

-- Operations permissions
('vendors.view', 'View Vendors', 'View vendor listings', 'operations', (SELECT id FROM modules WHERE name = 'Vendors')),
('vendors.create', 'Create Vendors', 'Create new vendors', 'operations', (SELECT id FROM modules WHERE name = 'Vendors')),
('vendors.edit', 'Edit Vendors', 'Modify vendor details', 'operations', (SELECT id FROM modules WHERE name = 'Vendors')),
('vendors.delete', 'Delete Vendors', 'Remove vendors', 'operations', (SELECT id FROM modules WHERE name = 'Vendors')),
('customers.view', 'View Customers', 'View customer listings', 'operations', (SELECT id FROM modules WHERE name = 'Customers')),
('customers.create', 'Create Customers', 'Create new customers', 'operations', (SELECT id FROM modules WHERE name = 'Customers')),
('customers.edit', 'Edit Customers', 'Modify customer details', 'operations', (SELECT id FROM modules WHERE name = 'Customers')),
('customers.delete', 'Delete Customers', 'Remove customers', 'operations', (SELECT id FROM modules WHERE name = 'Customers')),

-- Accounting permissions
('gl_accounts.view', 'View GL Accounts', 'View general ledger accounts', 'accounting', (SELECT id FROM modules WHERE name = 'GL Accounts')),
('gl_accounts.create', 'Create GL Accounts', 'Create new GL accounts', 'accounting', (SELECT id FROM modules WHERE name = 'GL Accounts')),
('gl_accounts.edit', 'Edit GL Accounts', 'Modify GL accounts', 'accounting', (SELECT id FROM modules WHERE name = 'GL Accounts')),
('expense_categories.view', 'View Expense Categories', 'View expense categories', 'accounting', (SELECT id FROM modules WHERE name = 'Expense Categories')),
('expense_categories.create', 'Create Expense Categories', 'Create new expense categories', 'accounting', (SELECT id FROM modules WHERE name = 'Expense Categories')),
('expense_categories.edit', 'Edit Expense Categories', 'Modify expense categories', 'accounting', (SELECT id FROM modules WHERE name = 'Expense Categories')),

-- Expense management permissions
('expenses.view', 'View Expenses', 'View expense reports', 'operations', (SELECT id FROM modules WHERE name = 'Expense Management')),
('expenses.create', 'Create Expenses', 'Submit new expenses', 'operations', (SELECT id FROM modules WHERE name = 'Expense Management')),
('expenses.edit', 'Edit Expenses', 'Modify expense details', 'operations', (SELECT id FROM modules WHERE name = 'Expense Management')),
('expenses.approve', 'Approve Expenses', 'Approve expense submissions', 'operations', (SELECT id FROM modules WHERE name = 'Expense Management')),
('expenses.delete', 'Delete Expenses', 'Remove expenses', 'operations', (SELECT id FROM modules WHERE name = 'Expense Management')),

-- AI permissions
('ingrid.chat', 'Chat with Ingrid AI', 'Access to Ingrid AI chat interface', 'ai', (SELECT id FROM modules WHERE name = 'Ingrid AI')),
('ingrid.suggestions.view', 'View AI Suggestions', 'View category and vendor suggestions', 'ai', (SELECT id FROM modules WHERE name = 'Ingrid AI')),
('ingrid.suggestions.approve', 'Approve AI Suggestions', 'Approve or reject AI suggestions', 'ai', (SELECT id FROM modules WHERE name = 'Ingrid AI')),
('ingrid.configure', 'Configure Ingrid AI', 'Configure AI settings and providers', 'ai', (SELECT id FROM modules WHERE name = 'Ingrid AI')),
('ingrid.analytics.view', 'View AI Analytics', 'View AI usage analytics', 'ai', (SELECT id FROM modules WHERE name = 'Ingrid AI')),

-- Automation permissions
('automation.view', 'View Automations', 'View automation rules', 'automation', (SELECT id FROM modules WHERE name = 'Process Automation')),
('automation.create', 'Create Automations', 'Create new automation rules', 'automation', (SELECT id FROM modules WHERE name = 'Process Automation')),
('automation.edit', 'Edit Automations', 'Modify automation rules', 'automation', (SELECT id FROM modules WHERE name = 'Process Automation')),

-- Analytics permissions
('analytics.view', 'View Analytics', 'Access analytics dashboards', 'analytics', (SELECT id FROM modules WHERE name = 'Advanced Analytics')),
('analytics.export', 'Export Analytics', 'Export analytics data', 'analytics', (SELECT id FROM modules WHERE name = 'Advanced Analytics')),

-- API permissions
('api.manage', 'Manage API Keys', 'Manage company API keys', 'integration', (SELECT id FROM modules WHERE name = 'API Management'));

-- ================================================================
-- INSERT DEFAULT ROLE PERMISSIONS
-- ================================================================
-- Admin permissions
INSERT INTO role_permissions (role_name, permission_id, is_default) VALUES
('admin', (SELECT id FROM permissions WHERE permission_key = 'dashboard.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'users.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'users.create'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'users.edit'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'users.delete'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'company.settings.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'company.settings.edit'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'vendors.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'vendors.create'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'vendors.edit'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'vendors.delete'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'customers.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'customers.create'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'customers.edit'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'customers.delete'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'gl_accounts.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'gl_accounts.create'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'gl_accounts.edit'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'expense_categories.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'expense_categories.create'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'expense_categories.edit'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'expenses.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'expenses.create'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'expenses.edit'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'expenses.approve'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'ingrid.suggestions.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'ingrid.suggestions.approve'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'ingrid.configure'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'automation.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'automation.create'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'automation.edit'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'analytics.view'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'analytics.export'), true),
('admin', (SELECT id FROM permissions WHERE permission_key = 'api.manage'), true);

-- User permissions (limited)
INSERT INTO role_permissions (role_name, permission_id, is_default) VALUES
('user', (SELECT id FROM permissions WHERE permission_key = 'dashboard.view'), true),
('user', (SELECT id FROM permissions WHERE permission_key = 'vendors.view'), true),
('user', (SELECT id FROM permissions WHERE permission_key = 'customers.view'), true),
('user', (SELECT id FROM permissions WHERE permission_key = 'expense_categories.view'), true),
('user', (SELECT id FROM permissions WHERE permission_key = 'expenses.view'), true),
('user', (SELECT id FROM permissions WHERE permission_key = 'expenses.create'), true),
('user', (SELECT id FROM permissions WHERE permission_key = 'expenses.edit'), true),
('user', (SELECT id FROM permissions WHERE permission_key = 'ingrid.chat'), true),
('user', (SELECT id FROM permissions WHERE permission_key = 'ingrid.suggestions.view'), true);

-- ================================================================
-- CREATE DEMO COMPANY AND SUPER ADMIN
-- ================================================================

-- Create demo company
INSERT INTO companies (
    name, slug, description, website, email, phone,
    address_line_1, city, state, postal_code, country,
    is_active
) VALUES (
    'Demo Company', 'demo-company', 'Demo company for testing INFOtrac',
    'https://demo.infotrac.com', 'admin@demo.infotrac.com', '+1-555-0123',
    '123 Demo Street', 'Demo City', 'CA', '90210', 'United States',
    true
);

-- Create super admin user
-- Note: Password 'admin123' will be hashed
SELECT create_user(
    'admin@infotrac.com',
    'admin123',
    'Super',
    'Admin'
);

-- Update the super admin profile
UPDATE profiles
SET role = 'super-admin',
    profile_completed = true,
    onboarding_completed = true
WHERE email = 'admin@infotrac.com';

-- Create demo admin user
SELECT create_user(
    'admin@demo.infotrac.com',
    'demo123',
    'Demo',
    'Admin'
);

-- Update demo admin profile and assign to demo company
UPDATE profiles
SET role = 'admin',
    company_id = (SELECT id FROM companies WHERE slug = 'demo-company'),
    profile_completed = true,
    onboarding_completed = true
WHERE email = 'admin@demo.infotrac.com';

-- Enable core modules for demo company
INSERT INTO company_modules (company_id, module_id, is_enabled, enabled_by)
SELECT
    c.id,
    m.id,
    true,
    (SELECT user_id FROM profiles WHERE email = 'admin@demo.infotrac.com')
FROM companies c
CROSS JOIN modules m
WHERE c.slug = 'demo-company' AND m.is_core_required = true;

-- Enable additional modules for demo company
INSERT INTO company_modules (company_id, module_id, is_enabled, enabled_by)
SELECT
    c.id,
    m.id,
    true,
    (SELECT user_id FROM profiles WHERE email = 'admin@demo.infotrac.com')
FROM companies c
CROSS JOIN modules m
WHERE c.slug = 'demo-company'
  AND m.name IN ('Vendors', 'Customers', 'GL Accounts', 'Expense Categories', 'Expense Management', 'Ingrid AI');

-- Create company settings for demo company
INSERT INTO company_settings (company_id, currency, timezone, expense_approval_required, ai_enabled)
SELECT id, 'USD', 'America/New_York', false, true
FROM companies
WHERE slug = 'demo-company';

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================
DO $$
BEGIN
    RAISE NOTICE 'INFOtrac PostgreSQL database initialization completed successfully!';
    RAISE NOTICE 'Super Admin: admin@infotrac.com / admin123';
    RAISE NOTICE 'Demo Admin: admin@demo.infotrac.com / demo123';
END $$;