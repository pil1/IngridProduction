-- Test script to verify company_settings table structure
-- Run this in your Supabase SQL Editor to verify the migration worked

-- Check if the table exists
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'company_settings'
ORDER BY ordinal_position;

-- Check if any records exist
SELECT COUNT(*) as total_records FROM company_settings;

-- Check if RLS policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'company_settings';

-- Test a basic insert (this should work if RLS is configured correctly)
-- Replace 'your-company-id-here' with a real company ID from your companies table
-- INSERT INTO company_settings (company_id, openai_api_key)
-- VALUES ('your-company-id-here', 'test-key');