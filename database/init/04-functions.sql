-- ================================================================
-- INFOTRAC POSTGRESQL DATABASE INITIALIZATION - PART 4
-- ================================================================
-- Essential Database Functions (replacing Supabase functions)
-- ================================================================

-- ================================================================
-- AUTH FUNCTIONS
-- ================================================================

-- Function to create a new user with hashed password
CREATE OR REPLACE FUNCTION create_user(
    p_email VARCHAR,
    p_password VARCHAR,
    p_first_name VARCHAR DEFAULT NULL,
    p_last_name VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
    full_name_val VARCHAR;
BEGIN
    -- Generate full name
    full_name_val := TRIM(CONCAT(COALESCE(p_first_name, ''), ' ', COALESCE(p_last_name, '')));
    IF full_name_val = '' THEN
        full_name_val := NULL;
    END IF;

    -- Create user in auth_users
    INSERT INTO auth_users (email, password_hash, email_verified, is_active)
    VALUES (p_email, crypt(p_password, gen_salt('bf', 10)), false, true)
    RETURNING id INTO new_user_id;

    -- Create profile
    INSERT INTO profiles (user_id, email, first_name, last_name, full_name, role)
    VALUES (new_user_id, p_email, p_first_name, p_last_name, full_name_val, 'user');

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify user password
CREATE OR REPLACE FUNCTION verify_user_password(
    p_email VARCHAR,
    p_password VARCHAR
) RETURNS UUID AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Get user record
    SELECT id, password_hash, is_active INTO user_record
    FROM auth_users
    WHERE email = p_email;

    -- Check if user exists and is active
    IF NOT FOUND OR NOT user_record.is_active THEN
        RETURN NULL;
    END IF;

    -- Verify password
    IF crypt(p_password, user_record.password_hash) = user_record.password_hash THEN
        -- Update last sign in
        UPDATE auth_users
        SET last_sign_in = NOW(), sign_in_count = sign_in_count + 1
        WHERE id = user_record.id;

        -- Update profile last sign in
        UPDATE profiles
        SET last_sign_in = NOW()
        WHERE user_id = user_record.id;

        RETURN user_record.id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- PERMISSION FUNCTIONS
-- ================================================================

-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
    check_user_id UUID,
    permission_key_param VARCHAR,
    check_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := false;
    user_company_id UUID;
    user_role VARCHAR;
BEGIN
    -- Get user's company and role
    SELECT company_id, role INTO user_company_id, user_role
    FROM profiles
    WHERE user_id = check_user_id;

    -- Use provided company_id or user's company_id
    check_company_id := COALESCE(check_company_id, user_company_id);

    -- Super-admins have all permissions
    IF user_role = 'super-admin' THEN
        RETURN true;
    END IF;

    -- Check explicit user permission
    SELECT COALESCE(is_granted, false) INTO has_permission
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = check_user_id
      AND p.permission_key = permission_key_param
      AND up.company_id = check_company_id
      AND (up.expires_at IS NULL OR up.expires_at > NOW());

    -- If explicit permission found, return it
    IF has_permission IS NOT NULL THEN
        RETURN has_permission;
    END IF;

    -- Check role-based permissions
    SELECT COALESCE(rp.is_default, false) INTO has_permission
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_name = user_role
      AND p.permission_key = permission_key_param;

    RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible modules
CREATE OR REPLACE FUNCTION get_user_modules(check_user_id UUID)
RETURNS TABLE(
    module_id UUID,
    module_name VARCHAR,
    module_type VARCHAR,
    category VARCHAR,
    is_enabled BOOLEAN,
    has_access BOOLEAN
) AS $$
DECLARE
    user_company_id UUID;
    user_role VARCHAR;
BEGIN
    -- Get user's company and role
    SELECT company_id, role INTO user_company_id, user_role
    FROM profiles
    WHERE user_id = check_user_id;

    -- If no company found, return empty result
    IF user_company_id IS NULL THEN
        RETURN;
    END IF;

    -- Return modules based on company access and user grants
    RETURN QUERY
    SELECT
        m.id,
        m.name::VARCHAR,
        m.module_type::VARCHAR,
        m.category::VARCHAR,
        COALESCE(cm.is_enabled, false) as is_enabled,
        CASE
            WHEN user_role = 'super-admin' THEN true
            WHEN m.is_core_required THEN true
            WHEN COALESCE(cm.is_enabled, false) = false THEN false
            WHEN COALESCE(um.is_enabled, true) = true THEN true
            ELSE false
        END as has_access
    FROM modules m
    LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = user_company_id
    LEFT JOIN user_modules um ON m.id = um.module_id AND um.user_id = check_user_id AND um.company_id = user_company_id
    WHERE m.is_active = true
    ORDER BY m.module_type, m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if company has module enabled
CREATE OR REPLACE FUNCTION company_has_module(
    check_company_id UUID,
    module_name_param VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    module_enabled BOOLEAN := false;
BEGIN
    SELECT COALESCE(cm.is_enabled, false) INTO module_enabled
    FROM company_modules cm
    JOIN modules m ON cm.module_id = m.id
    WHERE cm.company_id = check_company_id
      AND m.name = module_name_param;

    RETURN COALESCE(module_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- INGRID AI FUNCTIONS
-- ================================================================

-- Function to increment category suggestion usage with deduplication
CREATE OR REPLACE FUNCTION increment_suggestion_usage(
    p_company_id UUID,
    p_suggested_name VARCHAR,
    p_confidence_score DECIMAL,
    p_context JSONB
) RETURNS UUID AS $$
DECLARE
    existing_suggestion_id UUID;
    new_suggestion_id UUID;
BEGIN
    -- Look for existing suggestion
    SELECT id INTO existing_suggestion_id
    FROM ingrid_suggested_categories
    WHERE company_id = p_company_id
      AND suggested_name = p_suggested_name
      AND status = 'pending';

    IF existing_suggestion_id IS NOT NULL THEN
        -- Update existing suggestion
        UPDATE ingrid_suggested_categories
        SET frequency_count = frequency_count + 1,
            last_suggested_at = NOW(),
            confidence_score = GREATEST(confidence_score, p_confidence_score),
            extraction_context = p_context
        WHERE id = existing_suggestion_id;

        RETURN existing_suggestion_id;
    ELSE
        -- Create new suggestion
        INSERT INTO ingrid_suggested_categories (
            company_id, suggested_name, confidence_score, extraction_context
        ) VALUES (
            p_company_id, p_suggested_name, p_confidence_score, p_context
        ) RETURNING id INTO new_suggestion_id;

        RETURN new_suggestion_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to increment vendor suggestion usage with deduplication
CREATE OR REPLACE FUNCTION increment_vendor_suggestion_usage(
    p_company_id UUID,
    p_suggested_name VARCHAR,
    p_confidence_score DECIMAL,
    p_context JSONB,
    p_web_data JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    existing_suggestion_id UUID;
    new_suggestion_id UUID;
BEGIN
    -- Look for existing suggestion
    SELECT id INTO existing_suggestion_id
    FROM ingrid_suggested_vendors
    WHERE company_id = p_company_id
      AND suggested_name = p_suggested_name
      AND status = 'pending';

    IF existing_suggestion_id IS NOT NULL THEN
        -- Update existing suggestion
        UPDATE ingrid_suggested_vendors
        SET frequency_count = frequency_count + 1,
            last_suggested_at = NOW(),
            confidence_score = GREATEST(confidence_score, p_confidence_score),
            extraction_context = p_context,
            web_enriched_data = COALESCE(p_web_data, web_enriched_data)
        WHERE id = existing_suggestion_id;

        RETURN existing_suggestion_id;
    ELSE
        -- Create new suggestion
        INSERT INTO ingrid_suggested_vendors (
            company_id, suggested_name, confidence_score, extraction_context, web_enriched_data
        ) VALUES (
            p_company_id, p_suggested_name, p_confidence_score, p_context, p_web_data
        ) RETURNING id INTO new_suggestion_id;

        RETURN new_suggestion_id;
    END IF;
END;
$$ LANGUAGE plpgsql;