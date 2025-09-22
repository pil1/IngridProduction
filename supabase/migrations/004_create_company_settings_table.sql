-- Create Company Settings Table
-- This table stores company-specific AI and system configuration settings

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Basic Company Settings
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

  -- AI Processing Settings
  auto_approval_threshold DECIMAL(3,2) DEFAULT 0.85,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(company_id),
  CHECK (auto_approval_threshold >= 0 AND auto_approval_threshold <= 1),
  CHECK (ai_provider IN ('openai', 'mock')),
  CHECK (ocr_provider IN ('openai-vision', 'google-vision', 'aws-textract', 'azure-document', 'mock'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);

-- Enable RLS (Row Level Security)
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see/edit settings for their own company
CREATE POLICY "Users can view their company settings" ON company_settings
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update their company settings" ON company_settings
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super-admin')
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_settings_updated_at();

-- Insert default settings for existing companies
INSERT INTO company_settings (company_id)
SELECT id FROM companies
WHERE id NOT IN (SELECT company_id FROM company_settings)
ON CONFLICT (company_id) DO NOTHING;

-- Add helpful comment
COMMENT ON TABLE company_settings IS 'Stores company-specific configuration including AI/OCR settings, feature toggles, and business rules';