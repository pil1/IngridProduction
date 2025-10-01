-- ================================================================
-- ENHANCE MODULES CLASSIFICATION SYSTEM
-- ================================================================
-- This migration adds module classification (Core vs Add-On) functionality
-- and enhanced pricing structure for the modern User Management system
-- ================================================================

BEGIN;

-- Add module_classification column to modules table
ALTER TABLE modules
ADD COLUMN module_classification VARCHAR(10) DEFAULT 'core'
CHECK (module_classification IN ('core', 'addon'));

-- Update existing modules based on current module_type and is_core_required
UPDATE modules
SET module_classification = CASE
    WHEN is_core_required = true OR module_type = 'core' THEN 'core'
    ELSE 'addon'
END;

-- Make the new column NOT NULL after setting defaults
ALTER TABLE modules ALTER COLUMN module_classification SET NOT NULL;

-- Add pricing enhancement columns to company_modules table
ALTER TABLE company_modules
ADD COLUMN base_module_price DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN per_user_price DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN pricing_tier VARCHAR(50) DEFAULT 'standard';

-- Copy existing pricing data
UPDATE company_modules
SET base_module_price = COALESCE(monthly_price, 0),
    per_user_price = COALESCE(per_user_price, 0);

-- Add audit trail columns for module changes
ALTER TABLE modules
ADD COLUMN classification_changed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN classification_changed_by UUID REFERENCES auth_users(id);

-- Create index for performance on new classification column
CREATE INDEX idx_modules_classification ON modules(module_classification);
CREATE INDEX idx_modules_classification_active ON modules(module_classification, is_active);

-- Add constraint to prevent disabling Core modules at company level
ALTER TABLE company_modules
ADD CONSTRAINT check_core_modules_enabled
CHECK (
    NOT (
        EXISTS (
            SELECT 1 FROM modules m
            WHERE m.id = module_id
            AND m.module_classification = 'core'
        )
        AND is_enabled = false
    )
);

-- Create function to get user modules with new classification logic
CREATE OR REPLACE FUNCTION get_user_modules_enhanced(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    module_type VARCHAR,
    module_classification VARCHAR,
    category VARCHAR,
    is_core_required BOOLEAN,
    is_active BOOLEAN,
    has_access BOOLEAN,
    is_enabled BOOLEAN,
    company_enabled BOOLEAN,
    access_source VARCHAR
) LANGUAGE plpgsql AS $$
DECLARE
    user_company_id UUID;
    user_role VARCHAR(50);
BEGIN
    -- Get user's company and role
    SELECT p.company_id, p.role
    INTO user_company_id, user_role
    FROM profiles p
    WHERE p.user_id = p_user_id;

    RETURN QUERY
    SELECT
        m.id,
        m.name,
        m.description,
        m.module_type,
        m.module_classification,
        m.category,
        m.is_core_required,
        m.is_active,
        -- Core modules: automatically accessible for company admins, inherited for users
        -- Add-On modules: require explicit enablement
        CASE
            WHEN m.module_classification = 'core' THEN true
            WHEN m.module_classification = 'addon' AND user_role = 'super-admin' THEN true
            WHEN m.module_classification = 'addon' AND COALESCE(cm.is_enabled, false) = true THEN true
            ELSE false
        END as has_access,
        -- Individual user enablement (mainly for Add-On modules)
        COALESCE(um.is_enabled,
            CASE
                WHEN m.module_classification = 'core' THEN true
                ELSE false
            END
        ) as is_enabled,
        -- Company-level enablement
        COALESCE(cm.is_enabled,
            CASE
                WHEN m.module_classification = 'core' THEN true
                ELSE false
            END
        ) as company_enabled,
        -- Access source for auditing
        CASE
            WHEN m.module_classification = 'core' THEN 'core_module'
            WHEN user_role = 'super-admin' THEN 'super_admin'
            WHEN um.is_enabled = true THEN 'user_specific'
            WHEN cm.is_enabled = true THEN 'company_default'
            ELSE 'no_access'
        END as access_source
    FROM modules m
    LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = user_company_id
    LEFT JOIN user_modules um ON m.id = um.module_id AND um.user_id = p_user_id
    WHERE m.is_active = true
    ORDER BY
        CASE m.module_classification WHEN 'core' THEN 1 ELSE 2 END,
        m.name;
END;
$$;

-- Create function to check if a module can be disabled for a company
CREATE OR REPLACE FUNCTION can_disable_company_module(p_company_id UUID, p_module_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
    is_core BOOLEAN;
BEGIN
    SELECT (module_classification = 'core')
    INTO is_core
    FROM modules
    WHERE id = p_module_id;

    -- Core modules cannot be disabled at company level
    RETURN NOT COALESCE(is_core, false);
END;
$$;

-- Create audit log table for module classification changes
CREATE TABLE module_classification_audit (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    old_classification VARCHAR(10),
    new_classification VARCHAR(10),
    changed_by UUID REFERENCES auth_users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    affected_companies INTEGER DEFAULT 0,
    affected_users INTEGER DEFAULT 0
);

-- Create trigger function for module classification changes
CREATE OR REPLACE FUNCTION audit_module_classification_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Only log if classification actually changed
    IF OLD.module_classification != NEW.module_classification THEN
        INSERT INTO module_classification_audit (
            module_id,
            old_classification,
            new_classification,
            changed_by,
            reason
        ) VALUES (
            NEW.id,
            OLD.module_classification,
            NEW.module_classification,
            NEW.classification_changed_by,
            'Module classification updated via admin interface'
        );

        -- Update the change tracking fields
        NEW.classification_changed_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for module classification audit
CREATE TRIGGER trigger_audit_module_classification
    BEFORE UPDATE ON modules
    FOR EACH ROW
    EXECUTE FUNCTION audit_module_classification_change();

-- Add helpful indexes for the new functionality
CREATE INDEX idx_company_modules_pricing ON company_modules(company_id, base_module_price);
CREATE INDEX idx_module_audit_changed_at ON module_classification_audit(changed_at DESC);
CREATE INDEX idx_modules_core_active ON modules(module_classification, is_active) WHERE module_classification = 'core';

-- Update existing modules to have proper default pricing
UPDATE modules
SET
    default_monthly_price = CASE
        WHEN module_classification = 'core' THEN 0.00  -- Core modules free by default
        WHEN name ILIKE '%ingrid%' OR name ILIKE '%ai%' THEN 29.99  -- AI modules premium
        ELSE 9.99  -- Standard add-on pricing
    END,
    default_per_user_price = CASE
        WHEN module_classification = 'core' THEN 0.00
        WHEN name ILIKE '%ingrid%' OR name ILIKE '%ai%' THEN 5.99
        ELSE 2.99
    END;

-- Create view for easy module management by super admins
CREATE OR REPLACE VIEW module_management_view AS
SELECT
    m.id,
    m.name,
    m.description,
    m.module_type,
    m.module_classification,
    m.category,
    m.is_core_required,
    m.is_active,
    m.default_monthly_price,
    m.default_per_user_price,
    m.classification_changed_at,
    m.classification_changed_by,
    changer.full_name as classification_changed_by_name,
    -- Count companies using this module
    (SELECT COUNT(*) FROM company_modules cm WHERE cm.module_id = m.id AND cm.is_enabled = true) as companies_using,
    -- Count users with explicit access
    (SELECT COUNT(*) FROM user_modules um WHERE um.module_id = m.id AND um.is_enabled = true) as users_with_access
FROM modules m
LEFT JOIN profiles changer ON m.classification_changed_by = changer.user_id
ORDER BY m.module_classification, m.name;

COMMIT;