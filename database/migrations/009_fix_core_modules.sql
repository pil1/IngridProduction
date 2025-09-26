-- ================================================================
-- INFOTRAC DATABASE MIGRATION 009
-- ================================================================
-- Fix Core Modules - Set Customers, Expense Categories, GL Accounts, and Vendors as core required
-- ================================================================

-- Update modules to be core required
UPDATE modules
SET is_core_required = true
WHERE name IN ('Vendors', 'Customers', 'GL Accounts', 'Expense Categories');

-- Ensure all existing companies have these core modules enabled
INSERT INTO company_modules (company_id, module_id, is_enabled, enabled_at)
SELECT
    c.id,
    m.id,
    true,
    NOW()
FROM companies c
CROSS JOIN modules m
WHERE m.name IN ('Vendors', 'Customers', 'GL Accounts', 'Expense Categories')
  AND NOT EXISTS (
    SELECT 1
    FROM company_modules cm
    WHERE cm.company_id = c.id AND cm.module_id = m.id
  );

-- Update existing company_modules to be enabled if they're disabled
UPDATE company_modules
SET is_enabled = true, enabled_at = NOW()
WHERE module_id IN (
    SELECT id FROM modules
    WHERE name IN ('Vendors', 'Customers', 'GL Accounts', 'Expense Categories')
)
AND is_enabled = false;