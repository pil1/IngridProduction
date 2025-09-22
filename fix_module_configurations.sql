-- Fix for 406 Not Acceptable error on /expenses page
-- This script creates the missing module_configurations table

-- Create module_configurations table
CREATE TABLE IF NOT EXISTS module_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id UUID NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(company_id, module_id, config_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_module_configurations_company_id ON module_configurations(company_id);
CREATE INDEX IF NOT EXISTS idx_module_configurations_module_id ON module_configurations(module_id);
CREATE INDEX IF NOT EXISTS idx_module_configurations_config_key ON module_configurations(config_key);

-- Enable RLS
ALTER TABLE module_configurations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their company module configurations" ON module_configurations;
DROP POLICY IF EXISTS "Admins can manage their company module configurations" ON module_configurations;

-- Create RLS policies for module_configurations
CREATE POLICY "Users can view their company module configurations" ON module_configurations
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage their company module configurations" ON module_configurations
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super-admin')
    )
  );

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_module_configurations_updated_at ON module_configurations;

-- Create trigger
CREATE TRIGGER update_module_configurations_updated_at
  BEFORE UPDATE ON module_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comment
COMMENT ON TABLE module_configurations IS 'Company-specific module configuration settings';