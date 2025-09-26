import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, requireCompany } from '@/middleware/auth';
import { asyncHandler, validationError, databaseError } from '@/middleware/errorHandler';

const router = Router();

// RPC: Get expenses with submitter details
router.post('/get_expenses_with_submitter',
  requireCompany,
  [
    body('company_id_param').optional().isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { company_id_param } = req.body;
    let companyId = company_id_param || req.user?.company_id;

    // Non-super-admins can only access their own company
    if (req.user?.role !== 'super-admin' && company_id_param) {
      companyId = req.user?.company_id;
    }

    const result = await db.query(`
      SELECT
        e.*,
        p.first_name as submitter_first_name,
        p.last_name as submitter_last_name,
        p.full_name as submitter_full_name,
        ec.name as category_name,
        v.name as vendor_display_name,
        gl.account_name as gl_account_name
      FROM expenses e
      LEFT JOIN profiles p ON e.submitted_by = p.user_id
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN gl_accounts gl ON e.gl_account_id = gl.id
      WHERE e.company_id = $1
      ORDER BY e.created_at DESC
      LIMIT 1000
    `, [companyId]);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  })
);

// RPC: Update expense status
router.post('/update_expense_status',
  requireCompany,
  [
    body('expense_id').isUUID().withMessage('Valid expense ID required'),
    body('new_status').isIn(['draft', 'submitted', 'approved', 'rejected', 'pending_review', 'info_requested', 'paid']),
    body('reviewer_notes').optional().isString(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { expense_id, new_status, reviewer_notes } = req.body;

    await db.transaction(async (client) => {
      // Update expense status
      const result = await client.query(`
        UPDATE expenses
        SET
          status = $1,
          reviewer_id = $2,
          reviewed_at = CASE WHEN $1 IN ('approved', 'rejected') THEN NOW() ELSE reviewed_at END,
          review_notes = COALESCE($3, review_notes),
          updated_at = NOW()
        WHERE id = $4 AND company_id = $5
        RETURNING *
      `, [new_status, req.user?.id, reviewer_notes, expense_id, req.user?.company_id]);

      if (result.rows.length === 0) {
        throw databaseError('Failed to update expense status');
      }

      // Create notification for expense status change
      await client.query(`
        INSERT INTO notifications (company_id, user_id, title, message, notification_type, source_module)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user?.company_id,
        result.rows[0].submitted_by,
        'Expense Status Updated',
        `Your expense has been ${new_status}`,
        new_status === 'approved' ? 'success' : new_status === 'rejected' ? 'error' : 'info',
        'Expense Management'
      ]);
    });

    res.status(200).json({
      success: true,
      message: 'Expense status updated successfully'
    });
  })
);

// RPC: Check user permission
router.post('/user_has_permission',
  [
    body('user_id_param').isUUID(),
    body('permission_key_param').isString(),
    body('company_id_param').optional().isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { user_id_param, permission_key_param, company_id_param } = req.body;

    const result = await db.query(
      'SELECT user_has_permission($1, $2, $3) as has_permission',
      [user_id_param, permission_key_param, company_id_param]
    );

    res.status(200).json({
      success: true,
      data: result.rows[0].has_permission
    });
  })
);

// RPC: Check company module access
router.post('/company_has_module',
  [
    body('company_id_param').isUUID(),
    body('module_name_param').isString(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { company_id_param, module_name_param } = req.body;

    const result = await db.query(
      'SELECT company_has_module($1, $2) as has_module',
      [company_id_param, module_name_param]
    );

    res.status(200).json({
      success: true,
      data: result.rows[0].has_module
    });
  })
);

// RPC: Increment category suggestion usage
router.post('/increment_suggestion_usage',
  requireCompany,
  [
    body('company_id_param').isUUID(),
    body('suggested_name_param').isString(),
    body('confidence_score_param').isDecimal(),
    body('context_param').isObject(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { company_id_param, suggested_name_param, confidence_score_param, context_param } = req.body;

    const result = await db.query(
      'SELECT increment_suggestion_usage($1, $2, $3, $4) as suggestion_id',
      [company_id_param, suggested_name_param, confidence_score_param, JSON.stringify(context_param)]
    );

    res.status(200).json({
      success: true,
      data: result.rows[0].suggestion_id
    });
  })
);

// RPC: Increment vendor suggestion usage
router.post('/increment_vendor_suggestion_usage',
  requireCompany,
  [
    body('company_id_param').isUUID(),
    body('suggested_name_param').isString(),
    body('confidence_score_param').isDecimal(),
    body('context_param').isObject(),
    body('web_data_param').optional().isObject(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const {
      company_id_param,
      suggested_name_param,
      confidence_score_param,
      context_param,
      web_data_param
    } = req.body;

    const result = await db.query(
      'SELECT increment_vendor_suggestion_usage($1, $2, $3, $4, $5) as suggestion_id',
      [
        company_id_param,
        suggested_name_param,
        confidence_score_param,
        JSON.stringify(context_param),
        web_data_param ? JSON.stringify(web_data_param) : null
      ]
    );

    res.status(200).json({
      success: true,
      data: result.rows[0].suggestion_id
    });
  })
);

// RPC: Get user effective permissions
router.post('/get_user_effective_permissions',
  [
    body('user_id_param').isUUID(),
    body('company_id_param').optional().isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { user_id_param, company_id_param } = req.body;

    const result = await db.query(
      'SELECT * FROM get_user_effective_permissions($1, $2)',
      [user_id_param, company_id_param]
    );

    res.status(200).json({
      success: true,
      data: result.rows
    });
  })
);

// RPC: Get user modules
router.post('/get_user_modules',
  [
    body('user_id_param').isUUID(),
    body('company_id_param').isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { user_id_param, company_id_param } = req.body;

    // Get user modules with enabled status
    const result = await db.query(`
      SELECT
        m.id,
        m.name,
        m.name as display_name,
        m.description,
        m.category as icon,
        '/' || LOWER(m.name) as route_path,
        m.is_core_required,
        COALESCE(um.is_enabled, false) as is_enabled,
        um.granted_by,
        um.granted_at
      FROM modules m
      LEFT JOIN user_modules um ON m.id = um.module_id
        AND um.user_id = $1
        AND um.company_id = $2
      WHERE m.is_active = true
      ORDER BY
        m.is_core_required DESC,
        m.name ASC
    `, [user_id_param, company_id_param]);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  })
);

export default router;