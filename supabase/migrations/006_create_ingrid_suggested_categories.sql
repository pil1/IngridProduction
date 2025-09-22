-- Migration: Create Ingrid Suggested Categories Table
-- This table stores category suggestions from Ingrid AI for controller approval

-- Create suggested_categories table
CREATE TABLE IF NOT EXISTS suggested_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Suggestion details
  suggested_name VARCHAR(255) NOT NULL,
  suggested_description TEXT,
  suggested_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- AI context and confidence
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_reasoning TEXT,
  source_document_name VARCHAR(255),
  vendor_context VARCHAR(255),
  amount_context DECIMAL(15,2),

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,

  -- If approved, reference to created category
  created_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,

  -- Usage tracking
  usage_count INTEGER DEFAULT 1,
  first_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_suggested_categories_company_id ON suggested_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_suggested_categories_status ON suggested_categories(status);
CREATE INDEX IF NOT EXISTS idx_suggested_categories_suggested_name ON suggested_categories(suggested_name);
CREATE INDEX IF NOT EXISTS idx_suggested_categories_created_at ON suggested_categories(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_suggested_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_suggested_categories_updated_at
  BEFORE UPDATE ON suggested_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_suggested_categories_updated_at();

-- Add RLS (Row Level Security)
ALTER TABLE suggested_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see suggestions for their company
CREATE POLICY suggested_categories_company_access ON suggested_categories
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create a function to increment usage count for existing suggestions
CREATE OR REPLACE FUNCTION increment_suggestion_usage(
  p_company_id UUID,
  p_suggested_name VARCHAR(255),
  p_confidence_score DECIMAL(3,2),
  p_context JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  suggestion_id UUID;
  existing_suggestion_id UUID;
BEGIN
  -- Check if a similar suggestion already exists (case-insensitive)
  SELECT id INTO existing_suggestion_id
  FROM suggested_categories
  WHERE company_id = p_company_id
    AND LOWER(suggested_name) = LOWER(p_suggested_name)
    AND status = 'pending';

  IF existing_suggestion_id IS NOT NULL THEN
    -- Update existing suggestion
    UPDATE suggested_categories
    SET
      usage_count = usage_count + 1,
      last_suggested_at = NOW(),
      confidence_score = GREATEST(confidence_score, p_confidence_score)
    WHERE id = existing_suggestion_id;

    RETURN existing_suggestion_id;
  ELSE
    -- Create new suggestion
    INSERT INTO suggested_categories (
      company_id,
      suggested_name,
      suggested_description,
      confidence_score,
      ai_reasoning,
      source_document_name,
      vendor_context,
      amount_context
    ) VALUES (
      p_company_id,
      p_suggested_name,
      (p_context->>'description')::TEXT,
      p_confidence_score,
      (p_context->>'reasoning')::TEXT,
      (p_context->>'document_name')::TEXT,
      (p_context->>'vendor_name')::TEXT,
      (p_context->>'amount')::DECIMAL(15,2)
    ) RETURNING id INTO suggestion_id;

    RETURN suggestion_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to approve a suggestion and create the category
CREATE OR REPLACE FUNCTION approve_category_suggestion(
  p_suggestion_id UUID,
  p_reviewer_id UUID,
  p_final_name VARCHAR(255) DEFAULT NULL,
  p_final_description TEXT DEFAULT NULL,
  p_gl_account_id UUID DEFAULT NULL,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  suggestion_record suggested_categories%ROWTYPE;
  new_category_id UUID;
  final_category_name VARCHAR(255);
  final_category_description TEXT;
BEGIN
  -- Get the suggestion
  SELECT * INTO suggestion_record
  FROM suggested_categories
  WHERE id = p_suggestion_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or already processed';
  END IF;

  -- Use provided names or fall back to suggested names
  final_category_name := COALESCE(p_final_name, suggestion_record.suggested_name);
  final_category_description := COALESCE(p_final_description, suggestion_record.suggested_description);

  -- Create the expense category
  INSERT INTO expense_categories (
    company_id,
    name,
    description,
    gl_account_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    suggestion_record.company_id,
    final_category_name,
    final_category_description,
    p_gl_account_id,
    true,
    NOW(),
    NOW()
  ) RETURNING id INTO new_category_id;

  -- Update the suggestion as approved
  UPDATE suggested_categories
  SET
    status = 'approved',
    reviewed_by_user_id = p_reviewer_id,
    reviewed_at = NOW(),
    review_notes = p_review_notes,
    created_category_id = new_category_id,
    updated_at = NOW()
  WHERE id = p_suggestion_id;

  RETURN new_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add some helpful comments
COMMENT ON TABLE suggested_categories IS 'Stores AI-generated category suggestions from Ingrid for controller approval';
COMMENT ON COLUMN suggested_categories.usage_count IS 'Number of times this category suggestion has been encountered';
COMMENT ON COLUMN suggested_categories.confidence_score IS 'AI confidence score (0.0 to 1.0) for this suggestion';
COMMENT ON FUNCTION increment_suggestion_usage IS 'Increments usage count for existing suggestions or creates new ones';
COMMENT ON FUNCTION approve_category_suggestion IS 'Approves a suggestion and creates the corresponding expense category';