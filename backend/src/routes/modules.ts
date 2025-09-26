import { Router, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, authorize } from '@/middleware/auth';
import { asyncHandler, validationError, notFoundError } from '@/middleware/errorHandler';

const router = Router();

// Get all modules (public endpoint for all authenticated users)
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await db.query(`
      SELECT
        id,
        name,
        description,
        module_type,
        category,
        is_core_required,
        is_active,
        default_monthly_price,
        default_per_user_price,
        requires_modules,
        feature_flags,
        api_endpoints,
        ui_components,
        created_at,
        updated_at
      FROM modules
      WHERE is_active = true
      ORDER BY module_type, name ASC
    `);

    // Return data in the format expected by permissions service
    res.status(200).json({
      success: true,
      data: {
        modules: result.rows
      }
    });
  })
);

// Get module management view for super admins
router.get('/management',
  authorize('super-admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await db.query(`
      SELECT * FROM modules
      ORDER BY category, name
    `);

    res.status(200).json({
      success: true,
      data: {
        modules: result.rows
      }
    });
  })
);

// Add alias route for classification audit (frontend expects this URL)
router.get('/classification/audit',
  authorize('super-admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await db.query(`
      SELECT
        mca.*,
        m.name as module_name,
        p.full_name as changed_by_name
      FROM module_classification_audit mca
      JOIN modules m ON mca.module_id = m.id
      LEFT JOIN profiles p ON mca.changed_by = p.user_id
      ORDER BY mca.changed_at DESC
      LIMIT 100
    `);

    res.status(200).json({
      success: true,
      data: {
        audit_log: result.rows
      }
    });
  })
);

// Get single module
router.get('/:id',
  param('id').isUUID(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { id } = req.params;

    const result = await db.query(`
      SELECT * FROM modules WHERE id = $1 AND is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      throw notFoundError('Module not found');
    }

    res.status(200).json({
      success: true,
      data: {
        module: result.rows[0]
      }
    });
  })
);

// Get user's accessible modules
router.get('/user/accessible',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      return res.status(200).json({
        success: true,
        data: { modules: [] }
      });
    }

    const result = await db.query(
      'SELECT * FROM get_user_modules($1)',
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      data: {
        modules: result.rows
      }
    });
  })
);

// Get company modules (admin only)
router.get('/company/:companyId',
  authorize('admin', 'super-admin'),
  param('companyId').isUUID(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { companyId } = req.params;

    // Check if user can access this company
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== companyId) {
      throw notFoundError('Company not found');
    }

    const result = await db.query(`
      SELECT
        m.id,
        m.name,
        m.description,
        m.module_type,
        m.category,
        m.is_core_required,
        m.default_monthly_price,
        m.default_per_user_price,
        cm.is_enabled,
        cm.enabled_at,
        cm.configuration,
        cm.monthly_price,
        cm.per_user_price
      FROM modules m
      LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $1
      WHERE m.is_active = true
      ORDER BY m.module_type, m.name ASC
    `, [companyId]);

    res.status(200).json({
      success: true,
      data: {
        modules: result.rows
      }
    });
  })
);

// Enable module for company (super-admin only)
router.post('/company/:companyId/enable/:moduleId',
  authorize('super-admin'),
  [
    param('companyId').isUUID(),
    param('moduleId').isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { companyId, moduleId } = req.params;

    const result = await db.query(`
      INSERT INTO company_modules (company_id, module_id, is_enabled, enabled_by)
      VALUES ($1, $2, true, $3)
      ON CONFLICT (company_id, module_id)
      DO UPDATE SET is_enabled = true, enabled_by = $3, enabled_at = NOW()
      RETURNING *
    `, [companyId, moduleId, req.user?.id]);

    res.status(200).json({
      success: true,
      message: 'Module enabled for company',
      data: {
        company_module: result.rows[0]
      }
    });
  })
);

// Disable module for company (super-admin only)
router.post('/company/:companyId/disable/:moduleId',
  authorize('super-admin'),
  [
    param('companyId').isUUID(),
    param('moduleId').isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { companyId, moduleId } = req.params;

    try {
      await db.query('BEGIN');

      // First, disable the module for the company
      const result = await db.query(`
        UPDATE company_modules
        SET is_enabled = false, updated_at = NOW()
        WHERE company_id = $1 AND module_id = $2
        RETURNING *
      `, [companyId, moduleId]);

      if (result.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('Module not enabled for this company');
      }

      // CASCADE: Disable the module for ALL users in this company
      const userDisableResult = await db.query(`
        UPDATE user_modules
        SET is_enabled = false, updated_at = NOW()
        WHERE company_id = $1 AND module_id = $2
        RETURNING user_id
      `, [companyId, moduleId]);

      await db.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Module disabled for company and ${userDisableResult.rows.length} users`,
        data: {
          company_module: result.rows[0],
          affected_users: userDisableResult.rows.length
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

// Enable module for specific user (super-admin and admin)
router.post('/user/:userId/enable/:moduleId',
  authorize('admin', 'super-admin'),
  [
    param('userId').isUUID(),
    param('moduleId').isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId, moduleId } = req.params;

    // Check if user exists and get their company
    const userResult = await db.query(`
      SELECT u.id, p.company_id, p.role
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw notFoundError('User not found');
    }

    const targetUser = userResult.rows[0];

    // Permission check: admins can only manage users in their company
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== targetUser.company_id) {
      throw notFoundError('User not found');
    }

    const result = await db.query(`
      INSERT INTO user_modules (user_id, module_id, company_id, is_enabled, granted_by)
      VALUES ($1, $2, $3, true, $4)
      ON CONFLICT (user_id, module_id, company_id)
      DO UPDATE SET is_enabled = true, granted_by = $4, updated_at = NOW()
      RETURNING *
    `, [userId, moduleId, targetUser.company_id, req.user?.id]);

    res.status(200).json({
      success: true,
      message: 'Module enabled for user',
      data: {
        user_module: result.rows[0]
      }
    });
  })
);

// Disable module for specific user (super-admin and admin)
router.post('/user/:userId/disable/:moduleId',
  authorize('admin', 'super-admin'),
  [
    param('userId').isUUID(),
    param('moduleId').isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId, moduleId } = req.params;

    // Check if user exists and get their company
    const userResult = await db.query(`
      SELECT u.id, p.company_id, p.role
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw notFoundError('User not found');
    }

    const targetUser = userResult.rows[0];

    // Permission check: admins can only manage users in their company
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== targetUser.company_id) {
      throw notFoundError('User not found');
    }

    const result = await db.query(`
      UPDATE user_modules
      SET is_enabled = false, updated_at = NOW()
      WHERE user_id = $1 AND module_id = $2 AND company_id = $3
      RETURNING *
    `, [userId, moduleId, targetUser.company_id]);

    if (result.rows.length === 0) {
      // Create disabled entry if none exists
      const insertResult = await db.query(`
        INSERT INTO user_modules (user_id, module_id, company_id, is_enabled, granted_by)
        VALUES ($1, $2, $3, false, $4)
        ON CONFLICT (user_id, module_id, company_id)
        DO UPDATE SET is_enabled = false, granted_by = $4, updated_at = NOW()
        RETURNING *
      `, [userId, moduleId, targetUser.company_id, req.user?.id]);

      res.status(200).json({
        success: true,
        message: 'Module disabled for user',
        data: {
          user_module: insertResult.rows[0]
        }
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'Module disabled for user',
        data: {
          user_module: result.rows[0]
        }
      });
    }
  })
);

// Get user's modules
router.get('/user/:userId',
  authorize('admin', 'super-admin'),
  param('userId').isUUID(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId } = req.params;

    // Check if user exists and get their company
    const userResult = await db.query(`
      SELECT u.id, p.company_id, p.role
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw notFoundError('User not found');
    }

    const targetUser = userResult.rows[0];

    // Permission check: admins can only view users in their company
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== targetUser.company_id) {
      throw notFoundError('User not found');
    }

    const result = await db.query(`
      SELECT
        m.id,
        m.name,
        m.module_type,
        m.is_core_required,
        COALESCE(um.is_enabled, false) as is_enabled,
        COALESCE(cm.is_enabled, false) as company_enabled
      FROM modules m
      LEFT JOIN user_modules um ON m.id = um.module_id AND um.user_id = $1
      LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $2
      WHERE m.is_active = true
      ORDER BY m.module_type, m.name
    `, [userId, targetUser.company_id]);

    res.status(200).json({
      success: true,
      data: {
        modules: result.rows
      }
    });
  })
);


// Update module classification (super-admin only)
router.patch('/:moduleId/classification',
  authorize('super-admin'),
  [
    param('moduleId').isUUID(),
    body('classification').isIn(['core', 'addon']),
    body('reason').optional().isString()
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { moduleId } = req.params;
    const { classification, reason } = req.body;

    // Check if module exists
    const moduleCheck = await db.query(`
      SELECT id, name, module_classification FROM modules WHERE id = $1
    `, [moduleId]);

    if (moduleCheck.rows.length === 0) {
      throw notFoundError('Module not found');
    }

    const currentModule = moduleCheck.rows[0];

    // If changing from core to addon, check if it would break existing companies
    if (currentModule.module_classification === 'core' && classification === 'addon') {
      const companiesUsingCore = await db.query(`
        SELECT COUNT(*) as count FROM company_modules cm
        WHERE cm.module_id = $1 AND cm.is_enabled = true
      `, [moduleId]);

      if (parseInt(companiesUsingCore.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot change core module to add-on while companies are using it',
          data: {
            affected_companies: companiesUsingCore.rows[0].count
          }
        });
      }
    }

    // Update module classification
    const result = await db.query(`
      UPDATE modules
      SET
        module_classification = $1,
        classification_changed_by = $2,
        classification_changed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [classification, req.user?.id, moduleId]);

    res.status(200).json({
      success: true,
      message: `Module classification updated from ${currentModule.module_classification} to ${classification}`,
      data: {
        module: result.rows[0],
        change_reason: reason || 'No reason provided'
      }
    });
  })
);

// Update company module pricing (super-admin only)
router.patch('/company/:companyId/pricing/:moduleId',
  authorize('super-admin'),
  [
    param('companyId').isUUID(),
    param('moduleId').isUUID(),
    body('base_module_price').optional().isFloat({ min: 0 }),
    body('per_user_price').optional().isFloat({ min: 0 })
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { companyId, moduleId } = req.params;
    const { base_module_price, per_user_price } = req.body;

    // Create the upsert query with proper parameter binding
    const result = await db.query(`
      INSERT INTO company_modules (company_id, module_id, is_enabled, monthly_price, per_user_price, enabled_by)
      VALUES ($1, $2, true, $3, $4, $5)
      ON CONFLICT (company_id, module_id)
      DO UPDATE SET
        monthly_price = EXCLUDED.monthly_price,
        per_user_price = EXCLUDED.per_user_price,
        updated_at = NOW()
      RETURNING *
    `, [
      companyId,
      moduleId,
      base_module_price !== undefined ? base_module_price : null,
      per_user_price !== undefined ? per_user_price : null,
      req.user?.id
    ]);

    res.status(200).json({
      success: true,
      message: 'Module pricing updated successfully',
      data: {
        company_module: result.rows[0]
      }
    });
  })
);

// Get module classification audit log (super-admin only)
router.get('/audit/classification',
  authorize('super-admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await db.query(`
      SELECT
        mca.*,
        m.name as module_name,
        p.full_name as changed_by_name
      FROM module_classification_audit mca
      JOIN modules m ON mca.module_id = m.id
      LEFT JOIN profiles p ON mca.changed_by = p.user_id
      ORDER BY mca.changed_at DESC
      LIMIT 100
    `);

    res.status(200).json({
      success: true,
      data: {
        audit_logs: result.rows
      }
    });
  })
);

// Get enhanced user modules using new function
router.get('/user/:userId/enhanced',
  authorize('admin', 'super-admin'),
  param('userId').isUUID(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId } = req.params;

    // Check if user exists and get their company
    const userResult = await db.query(`
      SELECT u.id, p.company_id, p.role
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw notFoundError('User not found');
    }

    const targetUser = userResult.rows[0];

    // Permission check: admins can only view users in their company
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== targetUser.company_id) {
      throw notFoundError('User not found');
    }

    const result = await db.query(
      'SELECT * FROM get_user_modules_enhanced($1)',
      [userId]
    );

    res.status(200).json({
      success: true,
      data: {
        modules: result.rows,
        user_info: {
          id: targetUser.id,
          company_id: targetUser.company_id,
          role: targetUser.role
        }
      }
    });
  })
);

export default router;