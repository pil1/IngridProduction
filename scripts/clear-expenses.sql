-- Clear existing expenses script
-- This removes all old expenses that were created before the enhancements

-- First, check how many expenses exist
SELECT 'Before deletion - Total expenses:' as info, COUNT(*) as count FROM expenses;

-- Delete all expenses (this will cascade to related tables due to foreign key constraints)
DELETE FROM expenses;

-- Check the result
SELECT 'After deletion - Total expenses:' as info, COUNT(*) as count FROM expenses;

-- Reset the ID sequence to start fresh
-- This ensures new expenses start with ID 1
SELECT setval(pg_get_serial_sequence('expenses', 'id'), 1, false);

SELECT 'Cleanup completed successfully - all old expenses removed' as status;