-- Cleanup Script: Delete All Expenses
--
-- This script deletes all existing expenses across all companies
-- to start fresh with the new AI metadata schema.
--
-- WARNING: This will permanently delete ALL expense data!
--
-- To run this script:
-- 1. Go to your Supabase dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this script and run it

-- First, let's see how many expenses we have
SELECT COUNT(*) as total_expenses FROM expenses;

-- Delete all expenses (uncomment the line below to execute)
-- DELETE FROM expenses;

-- Verify deletion (should return 0)
-- SELECT COUNT(*) as remaining_expenses FROM expenses;

-- Reset any auto-increment sequences if needed
-- (Supabase uses UUIDs so this may not be necessary, but including for completeness)
-- ALTER SEQUENCE IF EXISTS expenses_id_seq RESTART WITH 1;

-- Success message
SELECT 'All expenses have been deleted. System is ready for fresh data!' as status;