-- Quick Fix for Permissions System Tables
-- Run this first to get the basic permissions system working

-- Create permissions table for granular feature permissions
CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_key VARCHAR(100) NOT NULL UNIQUE,
  permission_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  module_id UUID,
  is_system_permission BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user permissions table for individual user permissions
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  is_granted BOOLEAN DEFAULT false,
  granted_by UUID,
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
  module_id UUID,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(role_name, permission_id, module_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_permissions_module_id ON permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions(permission_key);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_company_id ON user_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_module ON role_permissions(module_id);

-- Enable RLS on new tables
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Users can view permissions" ON permissions FOR SELECT USING (true);
CREATE POLICY "Users can view their own permissions" ON user_permissions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view role permissions" ON role_permissions FOR SELECT USING (true);

-- Insert core permissions
INSERT INTO permissions (permission_key, permission_name, description, category, is_system_permission)
VALUES
  ('dashboard.view', 'View Dashboard', 'Access to main dashboard', 'core', true),
  ('users.view', 'View Users', 'View user list and details', 'admin', false),
  ('users.create', 'Create Users', 'Create new users and send invitations', 'admin', false),
  ('users.edit', 'Edit Users', 'Modify user details and permissions', 'admin', false),
  ('vendors.view', 'View Vendors', 'Access vendor list and details', 'operations', false),
  ('vendors.create', 'Create Vendors', 'Add new vendors to the system', 'operations', false),
  ('vendors.edit', 'Edit Vendors', 'Modify vendor information', 'operations', false),
  ('expenses.view', 'View Expenses', 'Access expense list and details', 'operations', false),
  ('expenses.create', 'Create Expenses', 'Submit new expense reports', 'operations', false),
  ('expenses.approve', 'Approve Expenses', 'Review and approve expense reports', 'operations', false),
  ('ingrid.suggestions.view', 'View AI Suggestions', 'Access Ingrid AI suggestions', 'ai', false),
  ('ingrid.suggestions.approve', 'Approve AI Suggestions', 'Approve or reject Ingrid AI suggestions', 'ai', false)
ON CONFLICT (permission_key) DO NOTHING;

-- Insert default role permissions for users
INSERT INTO role_permissions (role_name, permission_id, is_default)
SELECT 'user', p.id, true
FROM permissions p
WHERE p.permission_key IN ('dashboard.view', 'vendors.view', 'expenses.view', 'expenses.create')
ON CONFLICT (role_name, permission_id, module_id) DO NOTHING;

-- Insert default role permissions for admins
INSERT INTO role_permissions (role_name, permission_id, is_default)
SELECT 'admin', p.id, true
FROM permissions p
WHERE p.permission_key LIKE '%view%' OR p.permission_key LIKE '%create%' OR p.permission_key LIKE '%edit%' OR p.permission_key LIKE '%approve%'
ON CONFLICT (role_name, permission_id, module_id) DO NOTHING;

-- Insert default role permissions for super-admins
INSERT INTO role_permissions (role_name, permission_id, is_default)
SELECT 'super-admin', p.id, true
FROM permissions p
ON CONFLICT (role_name, permission_id, module_id) DO NOTHING;

-- Create basic permission check function
CREATE OR REPLACE FUNCTION user_has_permission(
  check_user_id UUID,
  permission_key_param VARCHAR,
  check_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
  user_role VARCHAR;
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM profiles
  WHERE user_id = check_user_id;

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

COMMENT ON TABLE permissions IS 'Granular permissions for system features';
COMMENT ON TABLE user_permissions IS 'Individual user permission grants and restrictions';
COMMENT ON TABLE role_permissions IS 'Default permissions for user roles';