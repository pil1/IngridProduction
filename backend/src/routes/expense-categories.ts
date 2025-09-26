import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, hasPermission, requireCompany } from '@/middleware/auth';
import { asyncHandler, validationError, notFoundError } from '@/middleware/errorHandler';

const router = Router();

// Get all expense categories for current company
router.get('/',
  requireCompany,
  hasPermission('expense_categories.view'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let companyId = req.user?.company_id;

    // Allow super-admins to specify company via query param
    if (req.user?.role === 'super-admin' && req.query.company_id) {
      companyId = req.query.company_id as string;
    }

    const result = await db.query(`
      SELECT
        ec.id,
        ec.name,
        ec.description,
        ec.category_code,
        ec.gl_account_id,
        ec.is_active,
        ec.is_system_category,
        ec.requires_receipt,
        ec.daily_limit,
        ec.monthly_limit,
        ec.annual_limit,
        ec.created_at,
        ec.updated_at,
        gl.account_code as gl_account_code,
        gl.account_name as gl_account_name
      FROM expense_categories ec
      LEFT JOIN gl_accounts gl ON ec.gl_account_id = gl.id
      WHERE ec.company_id = $1
      ORDER BY ec.name ASC
    `, [companyId]);

    res.status(200).json({
      success: true,
      data: {
        expense_categories: result.rows
      }
    });
  })
);

// Get single expense category
router.get('/:id',
  requireCompany,
  hasPermission('expense_categories.view'),
  param('id').isUUID(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { id } = req.params;
    let companyId = req.user?.company_id;

    if (req.user?.role === 'super-admin' && req.query.company_id) {
      companyId = req.query.company_id as string;
    }

    const result = await db.query(`
      SELECT
        ec.*,
        gl.account_code as gl_account_code,
        gl.account_name as gl_account_name
      FROM expense_categories ec
      LEFT JOIN gl_accounts gl ON ec.gl_account_id = gl.id
      WHERE ec.id = $1 AND ec.company_id = $2
    `, [id, companyId]);

    if (result.rows.length === 0) {
      throw notFoundError('Expense category not found');
    }

    res.status(200).json({
      success: true,
      data: {
        expense_category: result.rows[0]
      }
    });
  })
);

// Create expense category
router.post('/',
  requireCompany,
  hasPermission('expense_categories.create'),
  [
    body('name').isString().trim().notEmpty().withMessage('Category name is required'),
    body('description').optional().isString().trim(),
    body('category_code').optional().isString().trim(),
    body('gl_account_id').optional().isUUID(),
    body('is_active').optional().isBoolean(),
    body('requires_receipt').optional().isBoolean(),
    body('daily_limit').optional().isDecimal(),
    body('monthly_limit').optional().isDecimal(),
    body('annual_limit').optional().isDecimal(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const {
      name,
      description,
      category_code,
      gl_account_id,
      is_active = true,
      requires_receipt = false,
      daily_limit,
      monthly_limit,
      annual_limit
    } = req.body;

    const result = await db.query(`
      INSERT INTO expense_categories (
        company_id, name, description, category_code, gl_account_id,
        is_active, requires_receipt, daily_limit, monthly_limit, annual_limit, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      req.user?.company_id, name, description, category_code, gl_account_id,
      is_active, requires_receipt, daily_limit, monthly_limit, annual_limit, req.user?.id
    ]);

    res.status(201).json({
      success: true,
      message: 'Expense category created successfully',
      data: {
        expense_category: result.rows[0]
      }
    });
  })
);

// Update expense category
router.put('/:id',
  requireCompany,
  hasPermission('expense_categories.edit'),
  [
    param('id').isUUID(),
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString().trim(),
    body('category_code').optional().isString().trim(),
    body('gl_account_id').optional().isUUID(),
    body('is_active').optional().isBoolean(),
    body('requires_receipt').optional().isBoolean(),
    body('daily_limit').optional().isDecimal(),
    body('monthly_limit').optional().isDecimal(),
    body('annual_limit').optional().isDecimal(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 3}`).join(', ');
    const values = Object.values(updates);

    const result = await db.query(`
      UPDATE expense_categories
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [id, req.user?.company_id, ...values]);

    if (result.rows.length === 0) {
      throw notFoundError('Expense category not found');
    }

    res.status(200).json({
      success: true,
      message: 'Expense category updated successfully',
      data: {
        expense_category: result.rows[0]
      }
    });
  })
);

// Delete expense category
router.delete('/:id',
  requireCompany,
  hasPermission('expense_categories.delete'),
  param('id').isUUID(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM expense_categories
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `, [id, req.user?.company_id]);

    if (result.rows.length === 0) {
      throw notFoundError('Expense category not found');
    }

    res.status(200).json({
      success: true,
      message: 'Expense category deleted successfully'
    });
  })
);

export default router;