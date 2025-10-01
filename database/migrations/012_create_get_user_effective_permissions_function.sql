-- Migration: Create get_user_effective_permissions function
-- This function returns the effective permissions for a user by combining:
-- 1. Role-based permissions (from role_permissions)
-- 2. User-specific permissions (from user_permissions)
--
-- User-specific permissions override role permissions

CREATE OR REPLACE FUNCTION get_user_effective_permissions(
    user_id_param UUID,
    company_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
    permission_id UUID,
    permission_key VARCHAR(100),
    permission_name VARCHAR(255),
    description TEXT,
    category VARCHAR(50),
    module_id UUID,
    is_granted BOOLEAN,
    source VARCHAR(20)  -- 'role' or 'user'
) AS $$
BEGIN
    RETURN QUERY
    WITH user_role AS (
        -- Get the user's role
        SELECT p.role
        FROM profiles p
        WHERE p.user_id = user_id_param
          AND (company_id_param IS NULL OR p.company_id = company_id_param)
        LIMIT 1
    ),
    role_perms AS (
        -- Get permissions from user's role
        SELECT
            rp.permission_id,
            p.permission_key,
            p.permission_name,
            p.description,
            p.category,
            p.module_id,
            true AS is_granted,
            'role'::VARCHAR(20) AS source
        FROM role_permissions rp
        INNER JOIN permissions p ON rp.permission_id = p.id
        INNER JOIN user_role ur ON rp.role_name = ur.role
    ),
    user_perms AS (
        -- Get user-specific permissions (these override role permissions)
        SELECT
            up.permission_id,
            p.permission_key,
            p.permission_name,
            p.description,
            p.category,
            p.module_id,
            up.is_granted,
            'user'::VARCHAR(20) AS source
        FROM user_permissions up
        INNER JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = user_id_param
          AND (company_id_param IS NULL OR up.company_id = company_id_param)
          AND (up.expires_at IS NULL OR up.expires_at > NOW())
    ),
    combined_perms AS (
        -- Combine role and user permissions, with user permissions taking precedence
        SELECT * FROM user_perms
        UNION
        SELECT rp.*
        FROM role_perms rp
        WHERE NOT EXISTS (
            SELECT 1 FROM user_perms up
            WHERE up.permission_id = rp.permission_id
        )
    )
    SELECT * FROM combined_perms
    WHERE is_granted = true
    ORDER BY permission_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION get_user_effective_permissions(UUID, UUID) IS
'Returns the effective permissions for a user by combining role-based and user-specific permissions. User-specific permissions override role permissions.';
