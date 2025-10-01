/**
 * Data Permissions API Routes
 *
 * Handles Tier 1 foundation permissions (non-module permissions)
 * These are basic operational permissions that control access to core features.
 *
 * @module routes/data-permissions
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, authorize, hasPermission } from '@/middleware/auth';
import { asyncHandler, validationError, notFoundError } from '@/middleware/errorHandler';

const router = Router();

// ================================================================
// GET ALL DATA PERMISSIONS
// ================================================================

/**
 * Get all data permissions with optional grouping
 * @route GET /api/data-permissions
 * @access Authenticated users
 */
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { grouped, foundation_only, company_id } = req.query;

    // Build query with optional filters
    let query = `
      SELECT DISTINCT
        dp.id,
        dp.permission_key,
        dp.permission_name,
        dp.description,
        dp.human_description,
        dp.permission_group,
        dp.ui_display_order,
        dp.requires_permissions,
        dp.is_foundation_permission,
        dp.is_system_permission,
        dp.created_at,
        dp.updated_at
      FROM data_permissions dp
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // Filter by company's provisioned modules
    if (company_id) {
      paramCount++;
      query += `
        LEFT JOIN modules m ON dp.permission_key = ANY(m.included_permissions)
        LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $${paramCount}
      `;
      params.push(company_id);
      // Include permissions that are either:
      // 1. Foundation permissions (always available), OR
      // 2. Included in a provisioned module for this company
      conditions.push('(dp.is_foundation_permission = true OR cm.is_enabled = true)');
    }

    // Add foundation filter if requested
    if (foundation_only === 'true') {
      conditions.push('dp.is_foundation_permission = true');
    }

    // Add WHERE clause if we have conditions
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY dp.permission_group, dp.ui_display_order, dp.permission_key';

    const result = await db.query(query, params);

    if (grouped === 'true') {
      // Group permissions by permission_group
      const groupedPermissions = result.rows.reduce((acc, permission) => {
        const group = permission.permission_group || 'General';
        if (!acc[group]) {
          acc[group] = [];
        }
        acc[group].push(permission);
        return acc;
      }, {} as Record<string, any[]>);

      res.status(200).json({
        success: true,
        data: {
          permissions: result.rows,
          grouped: groupedPermissions,
          total_count: result.rows.length,
          groups: Object.keys(groupedPermissions)
        }
      });
    } else {
      res.status(200).json({
        success: true,
        data: {
          permissions: result.rows,
          total_count: result.rows.length
        }
      });
    }
  })
);

// ================================================================
// GET USER DATA PERMISSIONS
// ================================================================

/**
 * Get all data permissions for a specific user
 * @route GET /api/data-permissions/user/:userId
 * @access Admin, Super-Admin, or self
 */
router.get('/user/:userId',
  param('userId').isUUID().withMessage('Valid user ID is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId } = req.params;

    // Permission check: users can view their own permissions, admins can view company users
    const userCheck = await db.query(`
      SELECT company_id, role FROM profiles WHERE user_id = $1
    `, [userId]);

    if (userCheck.rows.length === 0) {
      throw notFoundError('User not found');
    }

    const targetUser = userCheck.rows[0];

    if (req.user?.role !== 'super-admin' &&
        req.user?.id !== userId &&
        (req.user?.role !== 'admin' || req.user?.company_id !== targetUser.company_id)) {
      throw notFoundError('User not found');
    }

    // Get user's data permissions
    const result = await db.query(`
      SELECT
        udp.id,
        udp.user_id,
        udp.permission_id,
        udp.company_id,
        udp.is_granted,
        udp.granted_by,
        udp.granted_at,
        udp.granted_reason,
        udp.last_used_at,
        udp.expires_at,
        dp.permission_key,
        dp.permission_name,
        dp.description,
        dp.human_description,
        dp.permission_group,
        dp.requires_permissions,
        granter.full_name as granted_by_name
      FROM user_data_permissions udp
      JOIN data_permissions dp ON udp.permission_id = dp.id
      LEFT JOIN profiles granter ON udp.granted_by = granter.user_id
      WHERE udp.user_id = $1
        AND (udp.expires_at IS NULL OR udp.expires_at > NOW())
      ORDER BY dp.permission_group, dp.permission_key
    `, [userId]);

    // Group by permission_group
    const groupedPermissions = result.rows.reduce((acc, perm) => {
      const group = perm.permission_group || 'General';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(perm);
      return acc;
    }, {} as Record<string, any[]>);

    // Count granted permissions
    const grantedCount = result.rows.filter(p => p.is_granted).length;

    res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        company_id: targetUser.company_id,
        role: targetUser.role,
        permissions: result.rows,
        grouped_permissions: groupedPermissions,
        total_permissions: result.rows.length,
        granted_permissions: grantedCount,
        denied_permissions: result.rows.length - grantedCount
      }
    });
  })
);

// ================================================================
// GET USER'S COMPLETE PERMISSIONS (DATA + MODULE + ROLE)
// ================================================================

/**
 * Get user's complete effective permissions from all sources
 * @route GET /api/data-permissions/user/:userId/complete
 * @access Admin, Super-Admin, or self
 */
router.get('/user/:userId/complete',
  param('userId').isUUID().withMessage('Valid user ID is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId } = req.params;

    // Permission check
    const userCheck = await db.query(`
      SELECT company_id, role FROM profiles WHERE user_id = $1
    `, [userId]);

    if (userCheck.rows.length === 0) {
      throw notFoundError('User not found');
    }

    const targetUser = userCheck.rows[0];

    if (req.user?.role !== 'super-admin' &&
        req.user?.id !== userId &&
        (req.user?.role !== 'admin' || req.user?.company_id !== targetUser.company_id)) {
      throw notFoundError('User not found');
    }

    // Use database function to get complete permissions
    const result = await db.query(`
      SELECT * FROM get_user_complete_permissions($1, $2)
      ORDER BY permission_key
    `, [userId, targetUser.company_id]);

    // Group by source
    const bySource = result.rows.reduce((acc, perm) => {
      const source = perm.permission_source || 'unknown';
      if (!acc[source]) {
        acc[source] = [];
      }
      acc[source].push(perm);
      return acc;
    }, {} as Record<string, any[]>);

    res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        company_id: targetUser.company_id,
        role: targetUser.role,
        complete_permissions: result.rows,
        by_source: bySource,
        summary: {
          total_permissions: result.rows.length,
          from_data: (bySource['data'] || []).length,
          from_modules: (bySource['module'] || []).length,
          from_role: (bySource['role'] || []).length
        }
      }
    });
  })
);

// ================================================================
// GRANT/REVOKE DATA PERMISSION
// ================================================================

/**
 * Grant or revoke a data permission for a user
 * @route POST /api/data-permissions/user/:userId/grant
 * @access Admin, Super-Admin
 */
router.post('/user/:userId/grant',
  authorize('admin', 'super-admin'),
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('permission_key').notEmpty().withMessage('Permission key is required'),
    body('company_id').isUUID().withMessage('Valid company ID is required'),
    body('is_granted').isBoolean().withMessage('is_granted must be boolean'),
    body('reason').optional().isString().withMessage('Reason must be a string'),
    body('expires_at').optional().isISO8601().withMessage('expires_at must be valid date')
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId } = req.params;
    const { permission_key, company_id, is_granted, reason, expires_at } = req.body;

    // Permission check: admins can only manage users in their company
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== company_id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You can only manage permissions in your own company'
        }
      });
    }

    try {
      await db.query('BEGIN');

      // Get permission ID
      const permResult = await db.query(`
        SELECT id, permission_name, permission_group, requires_permissions
        FROM data_permissions
        WHERE permission_key = $1
      `, [permission_key]);

      if (permResult.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('Permission not found');
      }

      const permission = permResult.rows[0];

      // Check if user exists and belongs to company
      const userCheck = await db.query(`
        SELECT user_id FROM profiles WHERE user_id = $1 AND company_id = $2
      `, [userId, company_id]);

      if (userCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('User not found in this company');
      }

      // If granting, check permission dependencies
      if (is_granted && permission.requires_permissions && permission.requires_permissions.length > 0) {
        const depsResult = await db.query(`
          SELECT dp.permission_key
          FROM data_permissions dp
          LEFT JOIN user_data_permissions udp ON dp.id = udp.permission_id
            AND udp.user_id = $1
            AND udp.company_id = $2
            AND udp.is_granted = true
          WHERE dp.permission_key = ANY($3)
          AND udp.id IS NULL
        `, [userId, company_id, permission.requires_permissions]);

        if (depsResult.rows.length > 0) {
          const missingDeps = depsResult.rows.map(r => r.permission_key);
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: {
              message: 'Missing required permission dependencies',
              missing_dependencies: missingDeps
            }
          });
        }
      }

      // Upsert user data permission
      const result = await db.query(`
        INSERT INTO user_data_permissions (
          user_id,
          permission_id,
          company_id,
          is_granted,
          granted_by,
          granted_at,
          granted_reason,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        ON CONFLICT (user_id, permission_id, company_id)
        DO UPDATE SET
          is_granted = EXCLUDED.is_granted,
          granted_by = EXCLUDED.granted_by,
          granted_at = EXCLUDED.granted_at,
          granted_reason = EXCLUDED.granted_reason,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
        RETURNING *
      `, [
        userId,
        permission.id,
        company_id,
        is_granted,
        req.user?.id,
        reason || null,
        expires_at || null
      ]);

      await db.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Permission ${is_granted ? 'granted' : 'revoked'} successfully`,
        data: {
          permission_grant: result.rows[0],
          permission_details: {
            key: permission_key,
            name: permission.permission_name,
            group: permission.permission_group
          }
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

// ================================================================
// BULK GRANT/REVOKE DATA PERMISSIONS
// ================================================================

/**
 * Grant or revoke multiple data permissions for a user
 * @route POST /api/data-permissions/user/:userId/bulk-grant
 * @access Admin, Super-Admin
 */
router.post('/user/:userId/bulk-grant',
  authorize('admin', 'super-admin'),
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('permissions').isArray().withMessage('Permissions must be an array'),
    body('permissions.*.permission_key').notEmpty().withMessage('Each permission must have a key'),
    body('permissions.*.is_granted').isBoolean().withMessage('Each permission must specify is_granted'),
    body('company_id').isUUID().withMessage('Valid company ID is required'),
    body('reason').optional().isString()
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId } = req.params;
    const { permissions, company_id, reason } = req.body;

    // Permission check
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== company_id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You can only manage permissions in your own company'
        }
      });
    }

    try {
      await db.query('BEGIN');

      const results = [];
      const errors = [];

      for (const perm of permissions) {
        try {
          // Get permission ID
          const permResult = await db.query(`
            SELECT id, permission_name FROM data_permissions WHERE permission_key = $1
          `, [perm.permission_key]);

          if (permResult.rows.length === 0) {
            errors.push({
              permission_key: perm.permission_key,
              error: 'Permission not found'
            });
            continue;
          }

          const permission = permResult.rows[0];

          // Upsert permission
          await db.query(`
            INSERT INTO user_data_permissions (
              user_id, permission_id, company_id, is_granted,
              granted_by, granted_at, granted_reason
            )
            VALUES ($1, $2, $3, $4, $5, NOW(), $6)
            ON CONFLICT (user_id, permission_id, company_id)
            DO UPDATE SET
              is_granted = EXCLUDED.is_granted,
              granted_by = EXCLUDED.granted_by,
              granted_at = EXCLUDED.granted_at,
              granted_reason = EXCLUDED.granted_reason,
              updated_at = NOW()
          `, [
            userId,
            permission.id,
            company_id,
            perm.is_granted,
            req.user?.id,
            reason || null
          ]);

          results.push({
            permission_key: perm.permission_key,
            permission_name: permission.permission_name,
            is_granted: perm.is_granted,
            success: true
          });

        } catch (error) {
          errors.push({
            permission_key: perm.permission_key,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await db.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Bulk operation completed: ${results.length} permissions updated, ${errors.length} errors`,
        data: {
          results,
          errors,
          summary: {
            total_requested: permissions.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

// ================================================================
// CHECK PERMISSION
// ================================================================

/**
 * Check if a user has a specific permission
 * @route GET /api/data-permissions/user/:userId/check/:permissionKey
 * @access Authenticated users (self or admins)
 */
router.get('/user/:userId/check/:permissionKey',
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    param('permissionKey').notEmpty().withMessage('Permission key is required')
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId, permissionKey } = req.params;

    // Permission check
    const userCheck = await db.query(`
      SELECT company_id FROM profiles WHERE user_id = $1
    `, [userId]);

    if (userCheck.rows.length === 0) {
      throw notFoundError('User not found');
    }

    const targetUser = userCheck.rows[0];

    if (req.user?.role !== 'super-admin' &&
        req.user?.id !== userId &&
        (req.user?.role !== 'admin' || req.user?.company_id !== targetUser.company_id)) {
      throw notFoundError('User not found');
    }

    // Check permission using database function
    const result = await db.query(`
      SELECT user_has_permission($1, $2, $3) as has_permission
    `, [userId, permissionKey, targetUser.company_id]);

    const hasPermission = result.rows[0].has_permission;

    res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        permission_key: permissionKey,
        has_permission: hasPermission
      }
    });
  })
);

// ================================================================
// GET PERMISSION DEPENDENCIES
// ================================================================

/**
 * Get permission dependencies (what other permissions are required)
 * @route GET /api/data-permissions/:permissionKey/dependencies
 * @access Authenticated users
 */
router.get('/:permissionKey/dependencies',
  param('permissionKey').notEmpty().withMessage('Permission key is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { permissionKey } = req.params;

    const result = await db.query(`
      SELECT
        dp.permission_key,
        dp.permission_name,
        dp.permission_group,
        dp.requires_permissions
      FROM data_permissions dp
      WHERE dp.permission_key = $1
    `, [permissionKey]);

    if (result.rows.length === 0) {
      throw notFoundError('Permission not found');
    }

    const permission = result.rows[0];
    const dependencies = permission.requires_permissions || [];

    // Get details of dependent permissions
    let dependencyDetails = [];
    if (dependencies.length > 0) {
      const depsResult = await db.query(`
        SELECT
          permission_key,
          permission_name,
          permission_group,
          human_description
        FROM data_permissions
        WHERE permission_key = ANY($1)
      `, [dependencies]);

      dependencyDetails = depsResult.rows;
    }

    res.status(200).json({
      success: true,
      data: {
        permission: {
          key: permission.permission_key,
          name: permission.permission_name,
          group: permission.permission_group
        },
        requires_permissions: dependencies,
        dependency_details: dependencyDetails,
        has_dependencies: dependencies.length > 0
      }
    });
  })
);

// ================================================================
// GET PERMISSION AUDIT LOG
// ================================================================

/**
 * Get audit log for permission changes
 * @route GET /api/data-permissions/audit
 * @access Admin, Super-Admin
 */
router.get('/audit',
  authorize('admin', 'super-admin'),
  [
    query('user_id').optional().isUUID(),
    query('affected_user_id').optional().isUUID(),
    query('company_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      user_id,
      affected_user_id,
      company_id,
      limit = 50,
      offset = 0
    } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (user_id) {
      whereClause += ` AND pca.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (affected_user_id) {
      whereClause += ` AND pca.affected_user_id = $${paramIndex}`;
      params.push(affected_user_id);
      paramIndex++;
    }

    if (company_id) {
      whereClause += ` AND pca.company_id = $${paramIndex}`;
      params.push(company_id);
      paramIndex++;
    } else if (req.user?.role === 'admin') {
      // Admins can only see their company's audit log
      whereClause += ` AND pca.company_id = $${paramIndex}`;
      params.push(req.user.company_id);
      paramIndex++;
    }

    params.push(limit, offset);

    const result = await db.query(`
      SELECT
        pca.*,
        performer.full_name as performed_by_name,
        affected.full_name as affected_user_name,
        c.name as company_name
      FROM permission_change_audit pca
      LEFT JOIN profiles performer ON pca.user_id = performer.user_id
      LEFT JOIN profiles affected ON pca.affected_user_id = affected.user_id
      LEFT JOIN companies c ON pca.company_id = c.id
      WHERE ${whereClause}
      ORDER BY pca.performed_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM permission_change_audit pca
      WHERE ${whereClause}
    `, params.slice(0, -2));

    res.status(200).json({
      success: true,
      data: {
        audit_log: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          has_more: parseInt(countResult.rows[0].total) > (parseInt(offset as string) + parseInt(limit as string))
        }
      }
    });
  })
);

export default router;
