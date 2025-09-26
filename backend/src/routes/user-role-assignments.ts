import { Router, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, authorize, hasPermission } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();

// Get user role assignment
router.get('/',
  authorize('admin', 'super-admin'),
  [
    query('user_id').isUUID(),
    query('company_id').isUUID(),
    query('is_active').optional().isBoolean(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user_id, company_id, is_active = true } = req.query;

    const result = await db.query(`
      SELECT
        ura.*,
        cr.name as role_name,
        cr.description as role_description,
        cr.permissions as role_permissions
      FROM user_role_assignments ura
      JOIN custom_roles cr ON ura.custom_role_id = cr.id
      WHERE ura.user_id = $1
        AND ura.company_id = $2
        AND ura.is_active = $3
      ORDER BY ura.assigned_at DESC
    `, [user_id, company_id, is_active]);

    res.status(200).json({
      success: true,
      data: result.rows.length > 0 ? result.rows[0] : null
    });
  })
);

// Create user role assignment
router.post('/',
  authorize('admin', 'super-admin'),
  [
    body('user_id').isUUID(),
    body('custom_role_id').optional().isUUID(),
    body('company_id').isUUID(),
    body('expires_at').optional().isISO8601(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user_id, custom_role_id, company_id, expires_at } = req.body;

    // Validate that custom_role_id is provided if we're creating an assignment
    if (!custom_role_id) {
      return res.status(400).json({
        success: false,
        error: 'custom_role_id is required for role assignment'
      });
    }

    // Check if assignment already exists
    const existingResult = await db.query(`
      SELECT id FROM user_role_assignments
      WHERE user_id = $1 AND custom_role_id = $2 AND company_id = $3 AND is_active = true
    `, [user_id, custom_role_id, company_id]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User role assignment already exists'
      });
    }

    const result = await db.query(`
      INSERT INTO user_role_assignments (user_id, custom_role_id, company_id, assigned_by, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [user_id, custom_role_id, company_id, req.user?.id, expires_at || null]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  })
);

// Update user role assignment
router.put('/:id',
  authorize('admin', 'super-admin'),
  [
    body('is_active').optional().isBoolean(),
    body('expires_at').optional().isISO8601(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { is_active, expires_at } = req.body;

    const result = await db.query(`
      UPDATE user_role_assignments
      SET
        is_active = COALESCE($2, is_active),
        expires_at = COALESCE($3, expires_at),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $4
      RETURNING *
    `, [id, is_active, expires_at, req.user?.company_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User role assignment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  })
);

// Delete user role assignment
router.delete('/:id',
  authorize('admin', 'super-admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE user_role_assignments
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [id, req.user?.company_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User role assignment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User role assignment deactivated successfully'
    });
  })
);

export default router;