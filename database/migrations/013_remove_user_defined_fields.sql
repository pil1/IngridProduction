-- ================================================================
-- Migration: Remove User Defined Fields from Customers Table
-- ================================================================
-- Removes user_def_1, user_def_2, udf_data, background_color_int,
-- and foreground_color_int fields from customers table as they are
-- not needed until robust Spire API is built later
-- ================================================================

-- Remove User Defined Fields columns from customers table
ALTER TABLE customers
    DROP COLUMN IF EXISTS user_def_1,
    DROP COLUMN IF EXISTS user_def_2,
    DROP COLUMN IF EXISTS udf_data,
    DROP COLUMN IF EXISTS background_color_int,
    DROP COLUMN IF EXISTS foreground_color_int;

-- Log migration completion
INSERT INTO migration_log (migration_name, applied_at, description)
VALUES (
    '013_remove_user_defined_fields',
    NOW(),
    'Removed user_def_1, user_def_2, udf_data, background_color_int, and foreground_color_int columns from customers table'
) ON CONFLICT (migration_name) DO NOTHING;