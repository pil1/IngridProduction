-- Foundation Tables Migration
-- This migration creates the core tables that other migrations depend on
-- Should be run first before all other migrations

-- ================================================================
-- 1. CREATE COMPANIES TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS companies (
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

-- Create indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_subscription ON companies(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);

-- ================================================================
-- 2. CREATE PROFILES TABLE (extends auth.users)
-- ================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super-admin')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  avatar_url VARCHAR(500),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_sign_in TIMESTAMP WITH TIME ZONE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one profile per user
  UNIQUE(user_id)
);

-- Create indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ================================================================
-- 3. CREATE MODULES TABLE (for permission system)
-- ================================================================

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  module_type VARCHAR(50) DEFAULT 'core' CHECK (module_type IN ('core', 'add-on', 'super')),
  is_active BOOLEAN DEFAULT true,
  default_monthly_price DECIMAL(10,2) DEFAULT 0,
  default_per_user_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for modules
CREATE INDEX IF NOT EXISTS idx_modules_name ON modules(name);
CREATE INDEX IF NOT EXISTS idx_modules_type ON modules(module_type);
CREATE INDEX IF NOT EXISTS idx_modules_active ON modules(is_active);

-- ================================================================
-- 4. CREATE COMPANY_MODULES TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS company_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  monthly_price DECIMAL(10,2),
  per_user_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique company-module pairs
  UNIQUE(company_id, module_id)
);

-- Create indexes for company_modules
CREATE INDEX IF NOT EXISTS idx_company_modules_company_id ON company_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_module_id ON company_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_enabled ON company_modules(is_enabled);

-- ================================================================
-- 5. CREATE USER_MODULES TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique user-module-company combinations
  UNIQUE(user_id, module_id, company_id)
);

-- Create indexes for user_modules
CREATE INDEX IF NOT EXISTS idx_user_modules_user_id ON user_modules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_modules_module_id ON user_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_user_modules_company_id ON user_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_user_modules_enabled ON user_modules(is_enabled);

-- ================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_modules ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 7. CREATE BASIC RLS POLICIES
-- ================================================================

-- Companies policies
CREATE POLICY "Super admins can manage all companies" ON companies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super-admin'
    )
  );

CREATE POLICY "Admins can view their company" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view profiles in their company" ON profiles
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super-admin')
    )
  );

-- Modules policies
CREATE POLICY "Everyone can view active modules" ON modules
  FOR SELECT USING (is_active = true);

CREATE POLICY "Super admins can manage modules" ON modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super-admin'
    )
  );

-- Company modules policies
CREATE POLICY "Users can view their company modules" ON company_modules
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage their company modules" ON company_modules
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super-admin')
    )
  );

-- User modules policies
CREATE POLICY "Users can view their own modules" ON user_modules
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user modules in their company" ON user_modules
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super-admin')
    )
  );

-- ================================================================
-- 8. CREATE UPDATE TRIGGERS
-- ================================================================

-- Create trigger function for updating updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_modules_updated_at
  BEFORE UPDATE ON company_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_modules_updated_at
  BEFORE UPDATE ON user_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 9. INSERT SEED DATA
-- ================================================================

-- ================================================================
-- 10. CREATE BUSINESS ENTITY TABLES
-- ================================================================

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
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

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id, name)
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
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

-- Create indexes for business entities
CREATE INDEX IF NOT EXISTS idx_vendors_company_id ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active);

CREATE INDEX IF NOT EXISTS idx_expense_categories_company_id ON expense_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_name ON expense_categories(name);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON expense_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);

-- Enable RLS on business entities
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for business entities
CREATE POLICY "Users can view their company vendors" ON vendors
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their company vendors" ON vendors
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super-admin')
    )
  );

CREATE POLICY "Users can view their company expense categories" ON expense_categories
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their company expense categories" ON expense_categories
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super-admin')
    )
  );

CREATE POLICY "Users can view their company customers" ON customers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their company customers" ON customers
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super-admin')
    )
  );

-- Create update triggers for business entities
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 11. INSERT SEED DATA
-- ================================================================

-- Insert basic modules
INSERT INTO modules (name, description, module_type, is_active, default_monthly_price, default_per_user_price)
VALUES
  ('Dashboard', 'Core dashboard functionality', 'core', true, 0, 0),
  ('User Management', 'User administration features', 'core', true, 0, 0),
  ('Company Settings', 'Company configuration', 'core', true, 0, 0),
  ('Expense Management', 'Expense tracking and management', 'add-on', true, 25, 3),
  ('Analytics', 'Business intelligence and reporting', 'add-on', true, 30, 4),
  ('Vendor Management', 'Vendor and supplier management', 'add-on', true, 20, 2),
  ('Customer Management', 'Customer relationship management', 'add-on', true, 20, 2),
  ('Process Automation', 'Workflow automation', 'add-on', true, 50, 5),
  ('Ingrid AI', 'AI-powered document processing', 'add-on', true, 75, 8),
  ('Advanced Analytics', 'Enhanced reporting features', 'add-on', true, 40, 6)
ON CONFLICT (name) DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE companies IS 'Company/organization records';
COMMENT ON TABLE profiles IS 'User profile information extending auth.users';
COMMENT ON TABLE modules IS 'System modules/features available for licensing';
COMMENT ON TABLE company_modules IS 'Modules enabled for each company';
COMMENT ON TABLE user_modules IS 'Individual user access to modules within their company';

-- ================================================================
-- FOUNDATION MIGRATION COMPLETE
-- ================================================================