import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, hasPermission, requireCompany } from '@/middleware/auth';
import { asyncHandler, validationError, notFoundError } from '@/middleware/errorHandler';

const router = Router();

// Get all GL accounts for current company
router.get('/',
  requireCompany,
  hasPermission('gl_accounts.view'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let companyId = req.user?.company_id;

    // Allow super-admins to specify company via query param
    if (req.user?.role === 'super-admin' && req.query.company_id) {
      companyId = req.query.company_id as string;
    }

    const result = await db.query(`
      SELECT
        id,
        account_code,
        account_name,
        description,
        account_type,
        account_subtype,
        parent_account_id,
        account_level,
        is_active,
        is_system_account,
        allow_posting,
        created_at,
        updated_at
      FROM gl_accounts
      WHERE company_id = $1
      ORDER BY account_code ASC
    `, [companyId]);

    res.status(200).json({
      success: true,
      data: {
        gl_accounts: result.rows
      }
    });
  })
);

// Get single GL account
router.get('/:id',
  requireCompany,
  hasPermission('gl_accounts.view'),
  param('id').isUUID(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { id } = req.params;
    let companyId = req.user?.company_id;

    // Allow super-admins to query across companies
    if (req.user?.role === 'super-admin' && req.query.company_id) {
      companyId = req.query.company_id as string;
    }

    const result = await db.query(`
      SELECT *
      FROM gl_accounts
      WHERE id = $1 AND company_id = $2
    `, [id, companyId]);

    if (result.rows.length === 0) {
      throw notFoundError('GL Account not found');
    }

    res.status(200).json({
      success: true,
      data: {
        gl_account: result.rows[0]
      }
    });
  })
);

// Create GL account
router.post('/',
  requireCompany,
  hasPermission('gl_accounts.create'),
  [
    body('account_code').isString().trim().notEmpty().withMessage('Account code is required'),
    body('account_name').isString().trim().notEmpty().withMessage('Account name is required'),
    body('account_type').isIn(['asset', 'liability', 'equity', 'revenue', 'expense']).withMessage('Invalid account type'),
    body('description').optional().isString().trim(),
    body('account_subtype').optional().isString().trim(),
    body('parent_account_id').optional().isUUID(),
    body('account_level').optional().isInt({ min: 1 }),
    body('is_active').optional().isBoolean(),
    body('allow_posting').optional().isBoolean(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const {
      account_code,
      account_name,
      description,
      account_type,
      account_subtype,
      parent_account_id,
      account_level = 1,
      is_active = true,
      allow_posting = true
    } = req.body;

    const result = await db.query(`
      INSERT INTO gl_accounts (
        company_id, account_code, account_name, description, account_type,
        account_subtype, parent_account_id, account_level, is_active, allow_posting, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      req.user?.company_id, account_code, account_name, description, account_type,
      account_subtype, parent_account_id, account_level, is_active, allow_posting, req.user?.id
    ]);

    res.status(201).json({
      success: true,
      message: 'GL Account created successfully',
      data: {
        gl_account: result.rows[0]
      }
    });
  })
);

// Update GL account
router.put('/:id',
  requireCompany,
  hasPermission('gl_accounts.edit'),
  [
    param('id').isUUID(),
    body('account_code').optional().isString().trim().notEmpty(),
    body('account_name').optional().isString().trim().notEmpty(),
    body('description').optional().isString().trim(),
    body('account_type').optional().isIn(['asset', 'liability', 'equity', 'revenue', 'expense']),
    body('account_subtype').optional().isString().trim(),
    body('is_active').optional().isBoolean(),
    body('allow_posting').optional().isBoolean(),
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
      UPDATE gl_accounts
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [id, req.user?.company_id, ...values]);

    if (result.rows.length === 0) {
      throw notFoundError('GL Account not found');
    }

    res.status(200).json({
      success: true,
      message: 'GL Account updated successfully',
      data: {
        gl_account: result.rows[0]
      }
    });
  })
);

// Delete GL account
router.delete('/:id',
  requireCompany,
  hasPermission('gl_accounts.delete'),
  param('id').isUUID(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM gl_accounts
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `, [id, req.user?.company_id]);

    if (result.rows.length === 0) {
      throw notFoundError('GL Account not found');
    }

    res.status(200).json({
      success: true,
      message: 'GL Account deleted successfully'
    });
  })
);

export default router;