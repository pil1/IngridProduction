-- Migration: Create Ingrid Suggested Vendors Table
-- This table stores vendor suggestions from Ingrid AI for controller approval

-- Create suggested_vendors table
CREATE TABLE IF NOT EXISTS suggested_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Vendor suggestion details
  suggested_name VARCHAR(255) NOT NULL,
  suggested_email VARCHAR(255),
  suggested_phone VARCHAR(50),
  suggested_address_line1 VARCHAR(255),
  suggested_address_line2 VARCHAR(255),
  suggested_city VARCHAR(100),
  suggested_state VARCHAR(100),
  suggested_country VARCHAR(100),
  suggested_postal_code VARCHAR(20),
  suggested_website VARCHAR(255),
  suggested_tax_id VARCHAR(50),
  suggested_description TEXT,
  suggested_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- AI context and confidence
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_reasoning TEXT,
  source_document_name VARCHAR(255),
  extraction_context JSONB DEFAULT '{}'::JSONB,
  web_enrichment_data JSONB DEFAULT '{}'::JSONB,
  web_enrichment_confidence DECIMAL(3,2) CHECK (web_enrichment_confidence >= 0 AND web_enrichment_confidence <= 1),

  -- Matching context
  vendor_match_type VARCHAR(20) CHECK (vendor_match_type IN ('exact', 'fuzzy', 'semantic', 'new', 'web_enriched')),
  existing_vendor_similarity DECIMAL(3,2),
  similar_vendor_ids UUID[] DEFAULT '{}',

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  reviewed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,

  -- If approved, reference to created vendor
  created_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,

  -- Usage tracking
  usage_count INTEGER DEFAULT 1,
  first_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_suggested_vendors_company_id ON suggested_vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_suggested_vendors_status ON suggested_vendors(status);
CREATE INDEX IF NOT EXISTS idx_suggested_vendors_suggested_name ON suggested_vendors(suggested_name);
CREATE INDEX IF NOT EXISTS idx_suggested_vendors_created_at ON suggested_vendors(created_at);
CREATE INDEX IF NOT EXISTS idx_suggested_vendors_confidence_score ON suggested_vendors(confidence_score);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_suggested_vendors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_suggested_vendors_updated_at
  BEFORE UPDATE ON suggested_vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_suggested_vendors_updated_at();

-- Add RLS (Row Level Security)
ALTER TABLE suggested_vendors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see vendor suggestions for their company
CREATE POLICY suggested_vendors_company_access ON suggested_vendors
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create a function to increment usage count for existing vendor suggestions
CREATE OR REPLACE FUNCTION increment_vendor_suggestion_usage(
  p_company_id UUID,
  p_suggested_name VARCHAR(255),
  p_confidence_score DECIMAL(3,2),
  p_context JSONB DEFAULT '{}'::JSONB,
  p_web_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  suggestion_id UUID;
  existing_suggestion_id UUID;
BEGIN
  -- Check if a similar vendor suggestion already exists (case-insensitive)
  SELECT id INTO existing_suggestion_id
  FROM suggested_vendors
  WHERE company_id = p_company_id
    AND LOWER(suggested_name) = LOWER(p_suggested_name)
    AND status = 'pending';

  IF existing_suggestion_id IS NOT NULL THEN
    -- Update existing suggestion
    UPDATE suggested_vendors
    SET
      usage_count = usage_count + 1,
      last_suggested_at = NOW(),
      confidence_score = GREATEST(confidence_score, p_confidence_score),
      extraction_context = COALESCE(p_context, extraction_context),
      web_enrichment_data = COALESCE(p_web_data, web_enrichment_data)
    WHERE id = existing_suggestion_id;

    RETURN existing_suggestion_id;
  ELSE
    -- Create new vendor suggestion
    INSERT INTO suggested_vendors (
      company_id,
      suggested_name,
      suggested_email,
      suggested_phone,
      suggested_address_line1,
      suggested_address_line2,
      suggested_city,
      suggested_state,
      suggested_country,
      suggested_postal_code,
      suggested_website,
      suggested_tax_id,
      suggested_description,
      confidence_score,
      ai_reasoning,
      source_document_name,
      extraction_context,
      web_enrichment_data,
      web_enrichment_confidence,
      vendor_match_type
    ) VALUES (
      p_company_id,
      p_suggested_name,
      (p_context->>'email')::TEXT,
      (p_context->>'phone')::TEXT,
      (p_context->>'address_line1')::TEXT,
      (p_context->>'address_line2')::TEXT,
      (p_context->>'city')::TEXT,
      (p_context->>'state')::TEXT,
      (p_context->>'country')::TEXT,
      (p_context->>'postal_code')::TEXT,
      (p_web_data->>'website')::TEXT,
      (p_context->>'tax_id')::TEXT,
      (p_context->>'description')::TEXT,
      p_confidence_score,
      (p_context->>'reasoning')::TEXT,
      (p_context->>'document_name')::TEXT,
      p_context,
      p_web_data,
      (p_web_data->>'confidence')::DECIMAL(3,2),
      (p_context->>'match_type')::TEXT
    ) RETURNING id INTO suggestion_id;

    RETURN suggestion_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to approve a vendor suggestion and create the vendor
CREATE OR REPLACE FUNCTION approve_vendor_suggestion(
  p_suggestion_id UUID,
  p_reviewer_id UUID,
  p_final_name VARCHAR(255) DEFAULT NULL,
  p_final_email VARCHAR(255) DEFAULT NULL,
  p_final_phone VARCHAR(50) DEFAULT NULL,
  p_final_address_line1 VARCHAR(255) DEFAULT NULL,
  p_final_address_line2 VARCHAR(255) DEFAULT NULL,
  p_final_city VARCHAR(100) DEFAULT NULL,
  p_final_state VARCHAR(100) DEFAULT NULL,
  p_final_country VARCHAR(100) DEFAULT NULL,
  p_final_postal_code VARCHAR(20) DEFAULT NULL,
  p_final_website VARCHAR(255) DEFAULT NULL,
  p_final_tax_id VARCHAR(50) DEFAULT NULL,
  p_final_description TEXT DEFAULT NULL,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  suggestion_record suggested_vendors%ROWTYPE;
  new_vendor_id UUID;
  final_vendor_name VARCHAR(255);
  final_vendor_email VARCHAR(255);
  final_vendor_phone VARCHAR(50);
  final_vendor_address_line1 VARCHAR(255);
  final_vendor_address_line2 VARCHAR(255);
  final_vendor_city VARCHAR(100);
  final_vendor_state VARCHAR(100);
  final_vendor_country VARCHAR(100);
  final_vendor_postal_code VARCHAR(20);
  final_vendor_website VARCHAR(255);
  final_vendor_tax_id VARCHAR(50);
  final_vendor_description TEXT;
BEGIN
  -- Get the suggestion
  SELECT * INTO suggestion_record
  FROM suggested_vendors
  WHERE id = p_suggestion_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor suggestion not found or already processed';
  END IF;

  -- Use provided values or fall back to suggested values
  final_vendor_name := COALESCE(p_final_name, suggestion_record.suggested_name);
  final_vendor_email := COALESCE(p_final_email, suggestion_record.suggested_email);
  final_vendor_phone := COALESCE(p_final_phone, suggestion_record.suggested_phone);
  final_vendor_address_line1 := COALESCE(p_final_address_line1, suggestion_record.suggested_address_line1);
  final_vendor_address_line2 := COALESCE(p_final_address_line2, suggestion_record.suggested_address_line2);
  final_vendor_city := COALESCE(p_final_city, suggestion_record.suggested_city);
  final_vendor_state := COALESCE(p_final_state, suggestion_record.suggested_state);
  final_vendor_country := COALESCE(p_final_country, suggestion_record.suggested_country);
  final_vendor_postal_code := COALESCE(p_final_postal_code, suggestion_record.suggested_postal_code);
  final_vendor_website := COALESCE(p_final_website, suggestion_record.suggested_website);
  final_vendor_tax_id := COALESCE(p_final_tax_id, suggestion_record.suggested_tax_id);
  final_vendor_description := COALESCE(p_final_description, suggestion_record.suggested_description);

  -- Create the vendor
  INSERT INTO vendors (
    company_id,
    name,
    email,
    phone,
    address_line1,
    address_line2,
    city,
    state,
    country,
    postal_code,
    website,
    tax_id,
    description,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    suggestion_record.company_id,
    final_vendor_name,
    final_vendor_email,
    final_vendor_phone,
    final_vendor_address_line1,
    final_vendor_address_line2,
    final_vendor_city,
    final_vendor_state,
    final_vendor_country,
    final_vendor_postal_code,
    final_vendor_website,
    final_vendor_tax_id,
    final_vendor_description,
    true,
    NOW(),
    NOW()
  ) RETURNING id INTO new_vendor_id;

  -- Update the suggestion as approved
  UPDATE suggested_vendors
  SET
    status = 'approved',
    reviewed_by_user_id = p_reviewer_id,
    reviewed_at = NOW(),
    review_notes = p_review_notes,
    created_vendor_id = new_vendor_id,
    updated_at = NOW()
  WHERE id = p_suggestion_id;

  RETURN new_vendor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add some helpful comments
COMMENT ON TABLE suggested_vendors IS 'Stores AI-generated vendor suggestions from Ingrid for controller approval';
COMMENT ON COLUMN suggested_vendors.usage_count IS 'Number of times this vendor suggestion has been encountered';
COMMENT ON COLUMN suggested_vendors.confidence_score IS 'AI confidence score (0.0 to 1.0) for this suggestion';
COMMENT ON COLUMN suggested_vendors.web_enrichment_data IS 'Data found via web search to enhance vendor information';
COMMENT ON COLUMN suggested_vendors.similar_vendor_ids IS 'Array of existing vendor IDs that are similar to this suggestion';
COMMENT ON FUNCTION increment_vendor_suggestion_usage IS 'Increments usage count for existing vendor suggestions or creates new ones';
COMMENT ON FUNCTION approve_vendor_suggestion IS 'Approves a vendor suggestion and creates the corresponding vendor';