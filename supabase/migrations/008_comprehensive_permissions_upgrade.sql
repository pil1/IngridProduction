-- Comprehensive Permissions Upgrade Migration
-- This migration enhances the existing permissions system with granular controls

-- ================================================================
-- 1. ENHANCE SYSTEM MODULES TABLE
-- ================================================================

-- Add new columns to modules table for better categorization
ALTER TABLE modules ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_core_required BOOLEAN DEFAULT false;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS requires_modules TEXT[] DEFAULT '{}';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS api_endpoints TEXT[] DEFAULT '{}';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS ui_components TEXT[] DEFAULT '{}';

-- Update existing module types and add index
DROP INDEX IF EXISTS idx_modules_type;
CREATE INDEX idx_modules_type ON modules(module_type, is_active);
CREATE INDEX idx_modules_category ON modules(category);

-- ================================================================
-- 2. CREATE ENHANCED PERMISSIONS TABLES
-- ================================================================

-- Create permissions table for granular feature permissions
CREATE TABLE IF NOT EXISTS permissions (
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

-- Create user permissions table for individual user permissions
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_granted BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, permission_id, company_id)
);

-- Create role permissions table for role-based permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(role_name, permission_id, module_id)
);

-- ================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_permissions_module_id ON permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions(permission_key);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_company_id ON user_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted ON user_permissions(is_granted, expires_at);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_module ON role_permissions(module_id);

-- ================================================================
-- 4. ENHANCE EXISTING TABLES
-- ================================================================

-- Add metadata to user_modules table
ALTER TABLE user_modules ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id);
ALTER TABLE user_modules ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE user_modules ADD COLUMN IF NOT EXISTS restrictions JSONB DEFAULT '{}';
ALTER TABLE user_modules ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add enhanced tracking to company_modules
ALTER TABLE company_modules ADD COLUMN IF NOT EXISTS enabled_by UUID REFERENCES auth.users(id);
ALTER TABLE company_modules ADD COLUMN IF NOT EXISTS enabled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE company_modules ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}';
ALTER TABLE company_modules ADD COLUMN IF NOT EXISTS usage_limits JSONB DEFAULT '{}';
ALTER TABLE company_modules ADD COLUMN IF NOT EXISTS billing_tier VARCHAR(50) DEFAULT 'standard';

-- ================================================================
-- 5. CREATE ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS on new tables
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Permissions table policies
CREATE POLICY "Super admins can manage all permissions" ON permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super-admin'
    )
  );

CREATE POLICY "Users can view permissions for their accessible modules" ON permissions
  FOR SELECT USING (
    module_id IN (
      SELECT cm.module_id FROM company_modules cm
      JOIN profiles p ON p.company_id = cm.company_id
      WHERE p.user_id = auth.uid() AND cm.is_enabled = true
    )
  );

-- User permissions policies
CREATE POLICY "Admins can manage user permissions in their company" ON user_permissions
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super-admin')
    )
  );

CREATE POLICY "Users can view their own permissions" ON user_permissions
  FOR SELECT USING (user_id = auth.uid());

-- Role permissions policies
CREATE POLICY "Super admins can manage role permissions" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super-admin'
    )
  );

CREATE POLICY "Users can view role permissions for their role" ON role_permissions
  FOR SELECT USING (
    role_name IN (
      SELECT role FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ================================================================
-- 6. CREATE UPDATED_AT TRIGGERS
-- ================================================================

CREATE TRIGGER update_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 7. INSERT DEFAULT SYSTEM MODULES AND PERMISSIONS
-- ================================================================

-- Insert core system modules if they don't exist
INSERT INTO modules (name, description, module_type, category, is_core_required, is_active, default_monthly_price, default_per_user_price)
VALUES
  ('Dashboard', 'Core dashboard and analytics', 'core', 'core', true, true, 0, 0),
  ('User Management', 'User administration and permissions', 'core', 'core', true, true, 0, 0),
  ('Company Settings', 'Company configuration and settings', 'core', 'core', true, true, 0, 0),
  ('Notifications', 'System notifications and alerts', 'core', 'core', true, true, 0, 0),
  ('Vendors', 'Vendor management and tracking', 'core', 'operations', false, true, 0, 0),
  ('Customers', 'Customer management and tracking', 'core', 'operations', false, true, 0, 0),
  ('GL Accounts', 'General ledger account management', 'core', 'accounting', false, true, 0, 0),
  ('Expense Categories', 'Expense category management', 'core', 'accounting', false, true, 0, 0),
  ('Ingrid AI', 'AI-powered document processing and suggestions', 'add-on', 'ai', false, true, 50, 5),
  ('Expense Management', 'Expense tracking and approval workflow', 'add-on', 'operations', false, true, 25, 3),
  ('Process Automation', 'Email-based process automation', 'add-on', 'automation', false, true, 75, 8),
  ('Advanced Analytics', 'Enhanced reporting and analytics', 'add-on', 'analytics', false, true, 30, 4)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  module_type = EXCLUDED.module_type,
  category = EXCLUDED.category,
  is_core_required = EXCLUDED.is_core_required;

-- Insert core permissions
INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'dashboard.view', 'View Dashboard', 'Access to main dashboard', 'core', m.id, true
FROM modules m WHERE m.name = 'Dashboard'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'users.view', 'View Users', 'View user list and details', 'admin', m.id, false
FROM modules m WHERE m.name = 'User Management'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'users.create', 'Create Users', 'Create new users and send invitations', 'admin', m.id, false
FROM modules m WHERE m.name = 'User Management'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'users.edit', 'Edit Users', 'Modify user details and permissions', 'admin', m.id, false
FROM modules m WHERE m.name = 'User Management'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'users.delete', 'Delete Users', 'Remove users from the system', 'admin', m.id, false
FROM modules m WHERE m.name = 'User Management'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'vendors.view', 'View Vendors', 'Access vendor list and details', 'operations', m.id, false
FROM modules m WHERE m.name = 'Vendors'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'vendors.create', 'Create Vendors', 'Add new vendors to the system', 'operations', m.id, false
FROM modules m WHERE m.name = 'Vendors'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'vendors.edit', 'Edit Vendors', 'Modify vendor information', 'operations', m.id, false
FROM modules m WHERE m.name = 'Vendors'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'ingrid.suggestions.view', 'View AI Suggestions', 'Access Ingrid AI suggestions', 'ai', m.id, false
FROM modules m WHERE m.name = 'Ingrid AI'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'ingrid.suggestions.approve', 'Approve AI Suggestions', 'Approve or reject Ingrid AI suggestions', 'ai', m.id, false
FROM modules m WHERE m.name = 'Ingrid AI'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'expenses.view', 'View Expenses', 'Access expense list and details', 'operations', m.id, false
FROM modules m WHERE m.name = 'Expense Management'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'expenses.create', 'Create Expenses', 'Submit new expense reports', 'operations', m.id, false
FROM modules m WHERE m.name = 'Expense Management'
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO permissions (permission_key, permission_name, description, category, module_id, is_system_permission)
SELECT
  'expenses.approve', 'Approve Expenses', 'Review and approve expense reports', 'operations', m.id, false
FROM modules m WHERE m.name = 'Expense Management'
ON CONFLICT (permission_key) DO NOTHING;

-- Insert default role permissions
INSERT INTO role_permissions (role_name, permission_id, is_default)
SELECT 'user', p.id, true
FROM permissions p
WHERE p.permission_key IN ('dashboard.view', 'vendors.view', 'vendors.create', 'expenses.view', 'expenses.create')
ON CONFLICT (role_name, permission_id, module_id) DO NOTHING;

INSERT INTO role_permissions (role_name, permission_id, is_default)
SELECT 'admin', p.id, true
FROM permissions p
WHERE p.permission_key LIKE '%view%' OR p.permission_key LIKE '%create%' OR p.permission_key LIKE '%edit%' OR p.permission_key LIKE '%approve%'
ON CONFLICT (role_name, permission_id, module_id) DO NOTHING;

INSERT INTO role_permissions (role_name, permission_id, is_default)
SELECT 'super-admin', p.id, true
FROM permissions p
ON CONFLICT (role_name, permission_id, module_id) DO NOTHING;

-- ================================================================
-- 8. CREATE HELPER FUNCTIONS
-- ================================================================

-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
  check_user_id UUID,
  permission_key_param VARCHAR,
  check_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
  user_company_id UUID;
  user_role VARCHAR;
BEGIN
  -- Get user's company and role
  SELECT company_id, role INTO user_company_id, user_role
  FROM profiles
  WHERE user_id = check_user_id;

  -- Use provided company_id or user's company_id
  check_company_id := COALESCE(check_company_id, user_company_id);

  -- Super admins have all permissions
  IF user_role = 'super-admin' THEN
    RETURN true;
  END IF;

  -- Check direct user permission
  SELECT EXISTS(
    SELECT 1 FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = check_user_id
      AND p.permission_key = permission_key_param
      AND up.company_id = check_company_id
      AND up.is_granted = true
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
  ) INTO has_permission;

  -- If no direct permission, check role permission
  IF NOT has_permission THEN
    SELECT EXISTS(
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_name = user_role
        AND p.permission_key = permission_key_param
        AND rp.is_default = true
    ) INTO has_permission;
  END IF;

  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a company has a module enabled
CREATE OR REPLACE FUNCTION company_has_module(
  check_company_id UUID,
  module_name_param VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM company_modules cm
    JOIN modules m ON cm.module_id = m.id
    WHERE cm.company_id = check_company_id
      AND m.name = module_name_param
      AND cm.is_enabled = true
      AND m.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible modules
CREATE OR REPLACE FUNCTION get_user_modules(check_user_id UUID)
RETURNS TABLE(
  module_id UUID,
  module_name VARCHAR,
  module_type VARCHAR,
  category VARCHAR,
  is_enabled BOOLEAN,
  has_access BOOLEAN
) AS $$
DECLARE
  user_company_id UUID;
  user_role VARCHAR;
BEGIN
  -- Get user's company and role
  SELECT company_id, role INTO user_company_id, user_role
  FROM profiles
  WHERE user_id = check_user_id;

  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.module_type,
    m.category,
    COALESCE(cm.is_enabled, false) as is_enabled,
    CASE
      WHEN user_role = 'super-admin' THEN true
      WHEN m.is_core_required THEN true
      WHEN um.is_enabled IS NOT NULL THEN um.is_enabled
      WHEN cm.is_enabled = true THEN true
      ELSE false
    END as has_access
  FROM modules m
  LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = user_company_id
  LEFT JOIN user_modules um ON m.id = um.module_id AND um.user_id = check_user_id
  WHERE m.is_active = true
  ORDER BY
    CASE m.module_type
      WHEN 'core' THEN 1
      WHEN 'super' THEN 2
      WHEN 'add-on' THEN 3
    END,
    m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE permissions IS 'Granular permissions for system features';
COMMENT ON TABLE user_permissions IS 'Individual user permission grants and restrictions';
COMMENT ON TABLE role_permissions IS 'Default permissions for user roles';
COMMENT ON FUNCTION user_has_permission IS 'Check if a user has a specific permission';
COMMENT ON FUNCTION company_has_module IS 'Check if a company has a module enabled';
COMMENT ON FUNCTION get_user_modules IS 'Get all modules accessible to a user';

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================