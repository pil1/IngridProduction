/**
 * Module Permissions API Routes
 *
 * Handles Tier 2 module permissions (premium features)
 * Manages module provisioning, user module access, and module-specific permissions.
 *
 * @module routes/module-permissions
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, authorize, hasPermission } from '@/middleware/auth';
import { asyncHandler, validationError, notFoundError } from '@/middleware/errorHandler';

const router = Router();

// ================================================================
// GET ENHANCED MODULES (WITH TIER & PERMISSIONS)
// ================================================================

/**
 * Get all enhanced modules with tier information and included permissions
 * @route GET /api/module-permissions/modules
 * @access Authenticated users
 */
router.get('/modules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { tier, category } = req.query;

    let whereClause = 'WHERE m.is_active = true';
    const params: any[] = [];
    let paramIndex = 1;

    if (tier) {
      whereClause += ` AND m.module_tier = $${paramIndex}`;
      params.push(tier);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND m.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    const result = await db.query(`
      SELECT
        m.id,
        m.name,
        m.description,
        m.module_tier,
        m.category,
        m.is_active,
        m.default_monthly_price,
        m.default_per_user_price,
        m.included_permissions,
        m.sub_features,
        m.feature_limits,
        m.module_dependencies,
        m.api_endpoints,
        m.ui_components,
        m.created_at,
        m.updated_at
      FROM modules m
      ${whereClause}
      ORDER BY
        CASE m.module_tier
          WHEN 'core' THEN 1
          WHEN 'standard' THEN 2
          WHEN 'premium' THEN 3
        END,
        m.name
    `, params);

    // For each module, get the actual permission details
    const modulesWithPermissions = await Promise.all(
      result.rows.map(async (module) => {
        if (module.included_permissions && module.included_permissions.length > 0) {
          const permResult = await db.query(`
            SELECT
              permission_key,
              permission_name,
              description,
              permission_group
            FROM data_permissions
            WHERE permission_key = ANY($1)
          `, [module.included_permissions]);

          module.permission_details = permResult.rows;
        } else {
          module.permission_details = [];
        }

        return module;
      })
    );

    res.status(200).json({
      success: true,
      data: {
        modules: modulesWithPermissions,
        total_count: modulesWithPermissions.length,
        by_tier: {
          core: modulesWithPermissions.filter(m => m.module_tier === 'core').length,
          standard: modulesWithPermissions.filter(m => m.module_tier === 'standard').length,
          premium: modulesWithPermissions.filter(m => m.module_tier === 'premium').length
        }
      }
    });
  })
);

// ================================================================
// GET USER'S AVAILABLE MODULES
// ================================================================

/**
 * Get modules available to a user (considering company provisioning)
 * @route GET /api/module-permissions/user/:userId/available
 * @access Authenticated users (self or admins)
 */
router.get('/user/:userId/available',
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

    // Get modules with user and company status
    const result = await db.query(`
      SELECT
        m.id as module_id,
        m.name as module_name,
        m.description,
        m.module_tier,
        m.category,
        m.default_monthly_price,
        m.default_per_user_price,
        m.included_permissions,
        m.sub_features,

        -- Company provisioning status
        COALESCE(cm.is_enabled, false) as company_provisioned,
        cm.pricing_tier,
        cm.monthly_price as company_monthly_price,
        cm.per_user_price as company_per_user_price,
        cm.users_licensed,

        -- User access status
        COALESCE(um.is_enabled, false) as user_has_access,
        um.granted_at as user_granted_at,
        um.restrictions as user_restrictions,
        um.expires_at as user_expires_at,

        -- Determine final access
        CASE
          WHEN m.module_tier = 'core' THEN true
          WHEN $2 = 'super-admin' THEN true
          WHEN COALESCE(cm.is_enabled, false) = true AND COALESCE(um.is_enabled, false) = true THEN true
          ELSE false
        END as has_access

      FROM modules m
      LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $3
      LEFT JOIN user_modules um ON m.id = um.module_id AND um.user_id = $1
      WHERE m.is_active = true
      ORDER BY
        CASE m.module_tier
          WHEN 'core' THEN 1
          WHEN 'standard' THEN 2
          WHEN 'premium' THEN 3
        END,
        m.name
    `, [userId, targetUser.role, targetUser.company_id]);

    res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        company_id: targetUser.company_id,
        role: targetUser.role,
        modules: result.rows,
        summary: {
          total_modules: result.rows.length,
          modules_with_access: result.rows.filter(m => m.has_access).length,
          company_provisioned: result.rows.filter(m => m.company_provisioned).length,
          core_modules: result.rows.filter(m => m.module_tier === 'core').length
        }
      }
    });
  })
);

// ================================================================
// PROVISION MODULE TO COMPANY (SUPER-ADMIN ONLY)
// ================================================================

/**
 * Provision a module to a company with custom pricing
 * @route POST /api/module-permissions/company/:companyId/provision
 * @access Super-Admin only
 */
router.post('/company/:companyId/provision',
  authorize('super-admin'),
  [
    param('companyId').isUUID().withMessage('Valid company ID is required'),
    body('module_id').isUUID().withMessage('Valid module ID is required'),
    body('is_enabled').isBoolean().withMessage('is_enabled must be boolean'),
    body('pricing_tier').optional().isIn(['standard', 'custom', 'enterprise']),
    body('monthly_price').optional().isFloat({ min: 0 }),
    body('per_user_price').optional().isFloat({ min: 0 }),
    body('users_licensed').optional().isInt({ min: 0 }),
    body('configuration').optional().isObject(),
    body('usage_limits').optional().isObject(),
    body('billing_notes').optional().isString()
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { companyId } = req.params;
    const {
      module_id,
      is_enabled,
      pricing_tier = 'standard',
      monthly_price,
      per_user_price,
      users_licensed = 0,
      configuration = {},
      usage_limits = {},
      billing_notes
    } = req.body;

    try {
      await db.query('BEGIN');

      // Verify company exists
      const companyCheck = await db.query(`
        SELECT id, name FROM companies WHERE id = $1
      `, [companyId]);

      if (companyCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('Company not found');
      }

      // Verify module exists
      const moduleCheck = await db.query(`
        SELECT id, name, module_tier, default_monthly_price, default_per_user_price
        FROM modules WHERE id = $1 AND is_active = true
      `, [module_id]);

      if (moduleCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('Module not found or inactive');
      }

      const module = moduleCheck.rows[0];

      // Determine actual pricing
      const actualMonthlyPrice = monthly_price !== undefined
        ? monthly_price
        : module.default_monthly_price;

      const actualPerUserPrice = per_user_price !== undefined
        ? per_user_price
        : module.default_per_user_price;

      // Upsert company module
      const result = await db.query(`
        INSERT INTO company_modules (
          company_id,
          module_id,
          is_enabled,
          enabled_by,
          enabled_at,
          pricing_tier,
          monthly_price,
          per_user_price,
          users_licensed,
          configuration,
          usage_limits,
          billing_notes,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (company_id, module_id)
        DO UPDATE SET
          is_enabled = EXCLUDED.is_enabled,
          enabled_by = EXCLUDED.enabled_by,
          enabled_at = EXCLUDED.enabled_at,
          pricing_tier = EXCLUDED.pricing_tier,
          monthly_price = EXCLUDED.monthly_price,
          per_user_price = EXCLUDED.per_user_price,
          users_licensed = EXCLUDED.users_licensed,
          configuration = EXCLUDED.configuration,
          usage_limits = EXCLUDED.usage_limits,
          billing_notes = EXCLUDED.billing_notes,
          updated_at = NOW()
        RETURNING *
      `, [
        companyId,
        module_id,
        is_enabled,
        req.user?.id,
        pricing_tier,
        actualMonthlyPrice,
        actualPerUserPrice,
        users_licensed,
        JSON.stringify(configuration),
        JSON.stringify(usage_limits),
        billing_notes || null
      ]);

      await db.query('COMMIT');

      // Calculate monthly cost
      const monthlyCost = actualMonthlyPrice + (actualPerUserPrice * users_licensed);

      res.status(200).json({
        success: true,
        message: `Module ${is_enabled ? 'provisioned' : 'deprovisioned'} successfully`,
        data: {
          company_module: result.rows[0],
          company_name: companyCheck.rows[0].name,
          module_name: module.name,
          pricing: {
            pricing_tier,
            monthly_price: actualMonthlyPrice,
            per_user_price: actualPerUserPrice,
            users_licensed,
            monthly_cost: monthlyCost
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
// GRANT MODULE TO USER
// ================================================================

/**
 * Grant module access to a user (automatically grants required permissions)
 * @route POST /api/module-permissions/user/:userId/grant-module
 * @access Admin, Super-Admin
 */
router.post('/user/:userId/grant-module',
  authorize('admin', 'super-admin'),
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('module_id').isUUID().withMessage('Valid module ID is required'),
    body('company_id').isUUID().withMessage('Valid company ID is required'),
    body('restrictions').optional().isObject(),
    body('expires_at').optional().isISO8601()
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId } = req.params;
    const { module_id, company_id, restrictions = {}, expires_at } = req.body;

    // Permission check
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== company_id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You can only manage users in your own company'
        }
      });
    }

    try {
      await db.query('BEGIN');

      // Verify user exists and belongs to company
      const userCheck = await db.query(`
        SELECT user_id FROM profiles WHERE user_id = $1 AND company_id = $2
      `, [userId, company_id]);

      if (userCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('User not found in this company');
      }

      // Verify module is provisioned to company (unless core or user is super-admin)
      const moduleCheck = await db.query(`
        SELECT
          m.id,
          m.name,
          m.module_tier,
          m.included_permissions,
          cm.is_enabled as company_has_module
        FROM modules m
        LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $2
        WHERE m.id = $1 AND m.is_active = true
      `, [module_id, company_id]);

      if (moduleCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('Module not found or inactive');
      }

      const module = moduleCheck.rows[0];

      if (module.module_tier !== 'core' && !module.company_has_module && req.user?.role !== 'super-admin') {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: {
            message: 'Module must be provisioned to company first',
            module_name: module.name,
            module_tier: module.module_tier
          }
        });
      }

      // Use database function to grant module access (auto-grants permissions)
      await db.query(`
        SELECT grant_user_module_access($1, $2, $3, $4)
      `, [userId, module_id, company_id, req.user?.id]);

      // Update restrictions and expiry if provided
      if (Object.keys(restrictions).length > 0 || expires_at) {
        await db.query(`
          UPDATE user_modules
          SET
            restrictions = $1,
            expires_at = $2,
            updated_at = NOW()
          WHERE user_id = $3 AND module_id = $4 AND company_id = $5
        `, [
          JSON.stringify(restrictions),
          expires_at || null,
          userId,
          module_id,
          company_id
        ]);
      }

      // Get granted permissions
      const permResult = await db.query(`
        SELECT
          ump.permission_id,
          dp.permission_key,
          dp.permission_name,
          dp.permission_group
        FROM user_module_permissions ump
        JOIN data_permissions dp ON ump.permission_id = dp.id
        WHERE ump.user_id = $1 AND ump.module_id = $2 AND ump.is_granted = true
      `, [userId, module_id]);

      await db.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Module access granted successfully',
        data: {
          user_id: userId,
          module_id: module_id,
          module_name: module.name,
          module_tier: module.module_tier,
          permissions_granted: permResult.rows,
          restrictions: restrictions,
          expires_at: expires_at || null
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

// ================================================================
// REVOKE MODULE FROM USER
// ================================================================

/**
 * Revoke module access from a user (removes module permissions)
 * @route POST /api/module-permissions/user/:userId/revoke-module
 * @access Admin, Super-Admin
 */
router.post('/user/:userId/revoke-module',
  authorize('admin', 'super-admin'),
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('module_id').isUUID().withMessage('Valid module ID is required'),
    body('company_id').isUUID().withMessage('Valid company ID is required')
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId } = req.params;
    const { module_id, company_id } = req.body;

    // Permission check
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== company_id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You can only manage users in your own company'
        }
      });
    }

    try {
      await db.query('BEGIN');

      // Get module name
      const moduleCheck = await db.query(`
        SELECT name FROM modules WHERE id = $1
      `, [module_id]);

      if (moduleCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('Module not found');
      }

      const moduleName = moduleCheck.rows[0].name;

      // Use database function to revoke module access
      await db.query(`
        SELECT revoke_user_module_access($1, $2, $3)
      `, [userId, module_id, company_id]);

      await db.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Module access revoked successfully',
        data: {
          user_id: userId,
          module_id: module_id,
          module_name: moduleName
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

// ================================================================
// GET USER'S MODULE PERMISSIONS
// ================================================================

/**
 * Get specific module permissions for a user
 * @route GET /api/module-permissions/user/:userId/module/:moduleId
 * @access Authenticated users (self or admins)
 */
router.get('/user/:userId/module/:moduleId',
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    param('moduleId').isUUID().withMessage('Valid module ID is required')
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { userId, moduleId } = req.params;

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

    // Get module permissions
    const result = await db.query(`
      SELECT
        ump.id,
        ump.user_id,
        ump.module_id,
        ump.permission_id,
        ump.is_granted,
        ump.granted_by,
        ump.granted_at,
        ump.expires_at,
        dp.permission_key,
        dp.permission_name,
        dp.description,
        dp.permission_group,
        mp.is_required,
        mp.is_optional,
        granter.full_name as granted_by_name
      FROM user_module_permissions ump
      JOIN data_permissions dp ON ump.permission_id = dp.id
      JOIN module_permissions mp ON mp.module_id = ump.module_id AND mp.permission_id = ump.permission_id
      LEFT JOIN profiles granter ON ump.granted_by = granter.user_id
      WHERE ump.user_id = $1 AND ump.module_id = $2
      ORDER BY dp.permission_group, dp.permission_key
    `, [userId, moduleId]);

    res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        module_id: moduleId,
        permissions: result.rows,
        summary: {
          total: result.rows.length,
          granted: result.rows.filter(p => p.is_granted).length,
          required: result.rows.filter(p => p.is_required).length,
          optional: result.rows.filter(p => p.is_optional).length
        }
      }
    });
  })
);

// ================================================================
// GET COMPANY MODULE COSTS
// ================================================================

/**
 * Get monthly costs for all modules provisioned to a company
 * @route GET /api/module-permissions/company/:companyId/costs
 * @access Admin, Super-Admin
 */
router.get('/company/:companyId/costs',
  authorize('admin', 'super-admin'),
  param('companyId').isUUID().withMessage('Valid company ID is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { companyId } = req.params;

    // Permission check
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== companyId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You can only view costs for your own company'
        }
      });
    }

    const result = await db.query(`
      SELECT
        m.id as module_id,
        m.name as module_name,
        m.module_tier,
        cm.pricing_tier,
        cm.monthly_price,
        cm.per_user_price,
        cm.users_licensed,
        cm.is_enabled,
        -- Count actual users with module access
        (SELECT COUNT(*) FROM user_modules um
         WHERE um.module_id = m.id
           AND um.company_id = cm.company_id
           AND um.is_enabled = true) as users_with_access,
        -- Calculate costs
        cm.monthly_price + (cm.per_user_price * cm.users_licensed) as licensed_monthly_cost,
        cm.monthly_price + (cm.per_user_price * (SELECT COUNT(*) FROM user_modules um
                                                   WHERE um.module_id = m.id
                                                     AND um.company_id = cm.company_id
                                                     AND um.is_enabled = true)) as actual_monthly_cost
      FROM company_modules cm
      JOIN modules m ON cm.module_id = m.id
      WHERE cm.company_id = $1 AND cm.is_enabled = true
      ORDER BY m.module_tier, m.name
    `, [companyId]);

    const totalLicensedCost = result.rows.reduce((sum, row) => sum + parseFloat(row.licensed_monthly_cost || 0), 0);
    const totalActualCost = result.rows.reduce((sum, row) => sum + parseFloat(row.actual_monthly_cost || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        company_id: companyId,
        modules: result.rows,
        summary: {
          total_modules: result.rows.length,
          total_licensed_cost: totalLicensedCost,
          total_actual_cost: totalActualCost,
          cost_difference: totalLicensedCost - totalActualCost,
          by_tier: {
            core: result.rows.filter(m => m.module_tier === 'core').length,
            standard: result.rows.filter(m => m.module_tier === 'standard').length,
            premium: result.rows.filter(m => m.module_tier === 'premium').length
          }
        }
      }
    });
  })
);

export default router;
