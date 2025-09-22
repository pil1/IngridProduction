-- Create Missing Tables for Notifications and Module Configurations

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

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

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_module_configurations_updated_at
  BEFORE UPDATE ON module_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE notifications IS 'User notifications and alerts';
COMMENT ON TABLE module_configurations IS 'Company-specific module configuration settings';