-- Create user_table_preferences table for table customization settings
-- This table stores user preferences for table layouts, column widths, sorting, etc.

CREATE TABLE IF NOT EXISTS user_table_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL, -- e.g., 'expenses', 'vendors', 'customers'
  preferences JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Ensure one preference record per user per table
  UNIQUE(user_id, table_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_table_preferences_user_id ON user_table_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_table_preferences_table_name ON user_table_preferences(table_name);
CREATE INDEX IF NOT EXISTS idx_user_table_preferences_user_table ON user_table_preferences(user_id, table_name);

-- Enable Row Level Security
ALTER TABLE user_table_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only access their own table preferences
CREATE POLICY "Users can view their own table preferences" ON user_table_preferences
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own table preferences
CREATE POLICY "Users can create their own table preferences" ON user_table_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own table preferences
CREATE POLICY "Users can update their own table preferences" ON user_table_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own table preferences
CREATE POLICY "Users can delete their own table preferences" ON user_table_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_table_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_user_table_preferences_updated_at
  BEFORE UPDATE ON user_table_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_table_preferences_updated_at();

-- Add helpful comments
COMMENT ON TABLE user_table_preferences IS 'User preferences for table customization including column widths, sorting, filters';
COMMENT ON COLUMN user_table_preferences.table_name IS 'Name of the table these preferences apply to (e.g., expenses, vendors)';
COMMENT ON COLUMN user_table_preferences.preferences IS 'JSON object containing user preferences: {columnWidths: {}, sortBy: "", filters: {}, etc.}';

-- Example preferences structure:
/*
{
  "columnWidths": {
    "amount": 120,
    "description": 200,
    "category": 150
  },
  "sortBy": "created_at",
  "sortDirection": "desc",
  "filters": {
    "status": "pending",
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  },
  "hiddenColumns": ["id", "internal_notes"],
  "pageSize": 25,
  "groupBy": null
}
*/