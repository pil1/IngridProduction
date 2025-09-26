-- Create missing PostgreSQL functions for INFOtrac

-- Function: get_user_effective_permissions
-- Returns all effective permissions for a user from multiple sources (direct permissions, role-based permissions)
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
    -- Role-based permissions
    role_permissions_query AS (
        SELECT
            perm.permission_key,
            perm.permission_name,
            perm.description,
            perm.category,
            perm.module_id,
            rp.is_granted,
            'role' as source,
            rp.granted_by,
            rp.granted_at,
            rp.expires_at
        FROM user_profile up
        JOIN role_permissions rp ON rp.role_name = up.role
        JOIN permissions perm ON rp.permission_id = perm.id
        WHERE rp.is_granted = true
          AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
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

-- Grant execute permission to the application user
GRANT EXECUTE ON FUNCTION get_user_effective_permissions(UUID, UUID) TO infotrac_user;

-- Function: get_invitations_with_details
-- Returns invitations with company and user details
CREATE OR REPLACE FUNCTION get_invitations_with_details(
    company_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    role VARCHAR,
    company_id UUID,
    company_name VARCHAR,
    invited_by UUID,
    invited_by_name VARCHAR,
    expires_at TIMESTAMPTZ,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- For now, return empty results since we don't have an invitations table
    -- This can be expanded when the invitation system is implemented
    RETURN QUERY
    SELECT
        NULL::UUID as id,
        NULL::VARCHAR as email,
        NULL::VARCHAR as role,
        NULL::UUID as company_id,
        NULL::VARCHAR as company_name,
        NULL::UUID as invited_by,
        NULL::VARCHAR as invited_by_name,
        NULL::TIMESTAMPTZ as expires_at,
        NULL::VARCHAR as status,
        NULL::TIMESTAMPTZ as created_at,
        NULL::TIMESTAMPTZ as updated_at
    WHERE FALSE; -- Always return empty set until invitations table is created
END;
$$;

-- Grant execute permission to the application user
GRANT EXECUTE ON FUNCTION get_invitations_with_details(UUID) TO infotrac_user;

-- Add comment to the functions
COMMENT ON FUNCTION get_user_effective_permissions(UUID, UUID) IS 'Returns all effective permissions for a user combining direct and role-based permissions';
COMMENT ON FUNCTION get_invitations_with_details(UUID) IS 'Returns invitation details with company and user information (placeholder implementation)';