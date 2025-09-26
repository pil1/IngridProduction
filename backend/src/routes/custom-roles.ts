import { Router, Response } from 'express';
import { query, body, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, authorize } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();

// Get custom roles for a company
router.get('/',
  authorize('admin', 'super-admin'),
  [
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

    const { company_id, is_active = true } = req.query;

    const result = await db.query(`
      SELECT *
      FROM custom_roles
      WHERE company_id = $1
        AND is_active = $2
      ORDER BY name
    `, [company_id, is_active]);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  })
);

// Create custom role
router.post('/',
  authorize('admin', 'super-admin'),
  [
    body('company_id').isUUID(),
    body('role_name').isString().trim().isLength({ min: 1 }),
    body('name').isString().trim().isLength({ min: 1 }),
    body('description').optional().isString(),
    body('based_on_role').optional().isIn(['user', 'admin', 'super-admin']),
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

    const {
      company_id,
      name,
      description,
      permissions
    } = req.body;

    const result = await db.query(`
      INSERT INTO custom_roles (
        company_id,
        name,
        description,
        permissions,
        is_active,
        created_by
      )
      VALUES ($1, $2, $3, $4, true, $5)
      RETURNING *
    `, [
      company_id,
      name,
      description || null,
      JSON.stringify(permissions || {}),
      req.user?.id
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  })
);

// Update custom role
router.put('/:id',
  authorize('admin', 'super-admin'),
  [
    body('name').optional().isString().trim().isLength({ min: 1 }),
    body('description').optional().isString(),
    body('is_active').optional().isBoolean(),
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
    const { name, description, is_active } = req.body;

    const result = await db.query(`
      UPDATE custom_roles
      SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, name, description, is_active]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Custom role not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  })
);

// Delete custom role (soft delete)
router.delete('/:id',
  authorize('admin', 'super-admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE custom_roles
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Custom role not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Custom role deleted successfully'
    });
  })
);

export default router;