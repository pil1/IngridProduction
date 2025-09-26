import { Router, Response } from 'express';
import { AuthRequest, authorize } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { db } from '@/config/database';
import { param, body, validationResult } from 'express-validator';

const router = Router();

// Get permissions with plain English descriptions and hierarchy
router.get('/hierarchy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { role } = req.query;

    if (role && typeof role === 'string') {
      // Get permissions for a specific role
      const result = await db.query(`
        SELECT
          rp.*,
          p.permission_key,
          p.permission_name,
          p.description,
          p.category
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_name = $1
        ORDER BY p.category, p.permission_key
      `, [role]);

      res.json({
        success: true,
        data: result.rows
      });
    } else {
      // Get all permissions with hierarchy information
      const result = await db.query(`
        SELECT
          id,
          permission_key,
          permission_name,
          description,
          human_description,
          permission_group,
          ui_display_order,
          requires_permissions,
          category,
          module_id,
          is_system_permission
        FROM permissions
        ORDER BY permission_group, ui_display_order, permission_key
      `);

      // Group permissions by permission_group
      const groupedPermissions = result.rows.reduce((acc, permission) => {
        const group = permission.permission_group || 'General';
        if (!acc[group]) {
          acc[group] = [];
        }
        acc[group].push(permission);
        return acc;
      }, {} as Record<string, any[]>);

      res.json({
        success: true,
        data: {
          permissions: result.rows,
          grouped: groupedPermissions
        }
      });
    }
  })
);

// Get permission templates
router.get('/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await db.query(`
      SELECT
        id,
        template_name,
        display_name,
        description,
        target_role,
        permissions,
        is_system_template,
        created_at
      FROM permission_templates
      ORDER BY is_system_template DESC, target_role, display_name
    `);

    res.json({
      success: true,
      data: result.rows
    });
  })
);

// Validate permission dependencies
router.post('/validate',
  [
    body('user_id').isUUID().withMessage('Valid user ID is required'),
    body('permissions').isArray().withMessage('Permissions must be an array'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, permissions } = req.body;

    const result = await db.query(`
      SELECT * FROM validate_permission_dependencies($1, $2)
    `, [user_id, permissions]);

    res.json({
      success: true,
      data: result.rows
    });
  })
);

// Get user permissions with plain English descriptions
router.get('/user/:userId',
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.params;

    // Get user's role and permissions
    const userResult = await db.query(`
      SELECT
        p.role,
        p.company_id
      FROM profiles p
      WHERE p.user_id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get effective permissions (combines role and user permissions)
    const effectivePermissions = await db.query(`
      SELECT * FROM get_user_effective_permissions($1, $2)
    `, [userId, user.company_id]);

    res.json({
      success: true,
      data: {
        user_role: user.role,
        effective_permissions: effectivePermissions.rows
      }
    });
  })
);

// Grant or revoke user permission
router.post('/user/:userId/grant',
  authorize('admin', 'super-admin'),
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('permission_key').notEmpty().withMessage('Permission key is required'),
    body('is_granted').isBoolean().withMessage('is_granted must be boolean'),
    body('expires_at').optional().isISO8601().withMessage('expires_at must be valid date'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { permission_key, is_granted, expires_at } = req.body;

    try {
      await db.query('BEGIN');

      // Get permission ID
      const permissionResult = await db.query(`
        SELECT id FROM permissions WHERE permission_key = $1
      `, [permission_key]);

      if (permissionResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
      }

      const permissionId = permissionResult.rows[0].id;

      // Get user's company
      const userResult = await db.query(`
        SELECT company_id FROM profiles WHERE user_id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const companyId = userResult.rows[0].company_id;

      // Upsert user permission
      await db.query(`
        INSERT INTO user_permissions (
          user_id, permission_id, company_id, is_granted, granted_by, granted_at, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        ON CONFLICT (user_id, permission_id, company_id)
        DO UPDATE SET
          is_granted = EXCLUDED.is_granted,
          granted_by = EXCLUDED.granted_by,
          granted_at = EXCLUDED.granted_at,
          expires_at = EXCLUDED.expires_at
      `, [userId, permissionId, companyId, is_granted, req.user?.id, expires_at || null]);

      await db.query('COMMIT');

      res.json({
        success: true,
        message: `Permission ${is_granted ? 'granted' : 'revoked'} successfully`
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

export default router;