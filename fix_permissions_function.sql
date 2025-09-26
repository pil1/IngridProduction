-- Fix the get_user_effective_permissions function to match actual table structure

CREATE OR REPLACE FUNCTION get_user_effective_permissions(
    user_id_param UUID,
    company_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
    permission_key VARCHAR,
    permission_name VARCHAR,
    description TEXT,
    category VARCHAR,
    module_id UUID,
    is_granted BOOLEAN,
    source VARCHAR,
    granted_by UUID,
    granted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH user_profile AS (
        SELECT p.role, p.company_id
        FROM profiles p
        WHERE p.user_id = user_id_param
    ),
    -- Direct user permissions
    direct_permissions AS (
        SELECT
            perm.permission_key,
            perm.permission_name,
            perm.description,
            perm.category,
            perm.module_id,
            up.is_granted,
            'direct' as source,
            up.granted_by,
            up.granted_at,
            up.expires_at
        FROM user_permissions up
        JOIN permissions perm ON up.permission_id = perm.id
        WHERE up.user_id = user_id_param
          AND (company_id_param IS NULL OR up.company_id = company_id_param)
          AND up.is_granted = true
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
    ),
    -- Role-based permissions (default permissions for the user's role)
    role_permissions_query AS (
        SELECT
            perm.permission_key,
            perm.permission_name,
            perm.description,
            perm.category,
            perm.module_id,
            true as is_granted, -- Role permissions are always granted if they exist
            'role' as source,
            NULL::UUID as granted_by, -- No specific grantor for role permissions
            rp.created_at as granted_at,
            NULL::TIMESTAMPTZ as expires_at -- Role permissions don't expire
        FROM user_profile up
        JOIN role_permissions rp ON rp.role_name = up.role
        JOIN permissions perm ON rp.permission_id = perm.id
        WHERE rp.is_default = true -- Only include default role permissions
          AND (company_id_param IS NULL OR up.company_id = company_id_param)
    )
    -- Combine and deduplicate permissions (direct permissions override role permissions)
    SELECT DISTINCT ON (dp.permission_key)
        dp.permission_key,
        dp.permission_name,
        dp.description,
        dp.category,
        dp.module_id,
        dp.is_granted,
        dp.source,
        dp.granted_by,
        dp.granted_at,
        dp.expires_at
    FROM (
        SELECT * FROM direct_permissions
        UNION ALL
        SELECT * FROM role_permissions_query
    ) dp
    ORDER BY dp.permission_key,
             CASE WHEN dp.source = 'direct' THEN 1 ELSE 2 END; -- Direct permissions take precedence
END;
$$;