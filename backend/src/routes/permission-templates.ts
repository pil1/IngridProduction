/**
 * Permission Templates API Routes
 *
 * Handles permission templates for quick user setup
 * Templates provide pre-configured sets of data permissions and modules.
 *
 * @module routes/permission-templates
 */

import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, authorize } from '@/middleware/auth';
import { asyncHandler, validationError, notFoundError } from '@/middleware/errorHandler';

const router = Router();

// ================================================================
// GET ALL PERMISSION TEMPLATES
// ================================================================

/**
 * Get all permission templates
 * @route GET /api/permission-templates
 * @access Authenticated users
 */
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { target_role } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];

    if (target_role) {
      whereClause += ' AND target_role = $1';
      params.push(target_role);
    }

    const result = await db.query(`
      SELECT
        id,
        template_name,
        display_name,
        description,
        target_role,
        data_permissions,
        modules,
        is_system_template,
        created_by,
        created_at,
        updated_at
      FROM permission_templates
      WHERE ${whereClause}
      ORDER BY
        is_system_template DESC,
        CASE target_role
          WHEN 'user' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'super-admin' THEN 3
        END,
        display_name
    `, params);

    // For each template, get permission details
    const templatesWithDetails = await Promise.all(
      result.rows.map(async (template) => {
        // Get data permission details
        if (template.data_permissions && template.data_permissions.length > 0) {
          const permResult = await db.query(`
            SELECT
              permission_key,
              permission_name,
              permission_group,
              human_description
            FROM data_permissions
            WHERE permission_key = ANY($1)
            ORDER BY permission_group, permission_key
          `, [template.data_permissions]);

          template.permission_details = permResult.rows;
        } else {
          template.permission_details = [];
        }

        // Get module details
        if (template.modules && template.modules.length > 0) {
          const moduleResult = await db.query(`
            SELECT
              id,
              name,
              module_tier,
              description
            FROM modules
            WHERE id = ANY($1)
            ORDER BY module_tier, name
          `, [template.modules]);

          template.module_details = moduleResult.rows;
        } else {
          template.module_details = [];
        }

        return template;
      })
    );

    res.status(200).json({
      success: true,
      data: {
        templates: templatesWithDetails,
        total_count: templatesWithDetails.length,
        system_templates: templatesWithDetails.filter(t => t.is_system_template).length,
        custom_templates: templatesWithDetails.filter(t => !t.is_system_template).length
      }
    });
  })
);

// ================================================================
// GET SINGLE PERMISSION TEMPLATE
// ================================================================

/**
 * Get a specific permission template by ID
 * @route GET /api/permission-templates/:templateId
 * @access Authenticated users
 */
router.get('/:templateId',
  param('templateId').isUUID().withMessage('Valid template ID is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { templateId } = req.params;

    const result = await db.query(`
      SELECT
        pt.*,
        creator.full_name as created_by_name
      FROM permission_templates pt
      LEFT JOIN profiles creator ON pt.created_by = creator.user_id
      WHERE pt.id = $1
    `, [templateId]);

    if (result.rows.length === 0) {
      throw notFoundError('Permission template not found');
    }

    const template = result.rows[0];

    // Get permission details
    if (template.data_permissions && template.data_permissions.length > 0) {
      const permResult = await db.query(`
        SELECT
          permission_key,
          permission_name,
          permission_group,
          human_description,
          requires_permissions
        FROM data_permissions
        WHERE permission_key = ANY($1)
        ORDER BY permission_group, permission_key
      `, [template.data_permissions]);

      template.permission_details = permResult.rows;
    }

    // Get module details
    if (template.modules && template.modules.length > 0) {
      const moduleResult = await db.query(`
        SELECT
          id,
          name,
          module_tier,
          description,
          included_permissions
        FROM modules
        WHERE id = ANY($1)
        ORDER BY module_tier, name
      `, [template.modules]);

      template.module_details = moduleResult.rows;
    }

    res.status(200).json({
      success: true,
      data: {
        template
      }
    });
  })
);

// ================================================================
// CREATE CUSTOM PERMISSION TEMPLATE
// ================================================================

/**
 * Create a custom permission template
 * @route POST /api/permission-templates
 * @access Admin, Super-Admin
 */
router.post('/',
  authorize('admin', 'super-admin'),
  [
    body('template_name').notEmpty().withMessage('Template name is required'),
    body('display_name').notEmpty().withMessage('Display name is required'),
    body('description').optional().isString(),
    body('target_role').isIn(['user', 'admin', 'super-admin']).withMessage('Valid target role is required'),
    body('data_permissions').isArray().withMessage('Data permissions must be an array'),
    body('modules').optional().isArray().withMessage('Modules must be an array')
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const {
      template_name,
      display_name,
      description,
      target_role,
      data_permissions,
      modules = []
    } = req.body;

    try {
      await db.query('BEGIN');

      // Check if template name already exists
      const nameCheck = await db.query(`
        SELECT id FROM permission_templates WHERE template_name = $1
      `, [template_name]);

      if (nameCheck.rows.length > 0) {
        await db.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: {
            message: 'A template with this name already exists'
          }
        });
      }

      // Verify all permission keys exist
      if (data_permissions.length > 0) {
        const permCheck = await db.query(`
          SELECT permission_key
          FROM data_permissions
          WHERE permission_key = ANY($1)
        `, [data_permissions]);

        if (permCheck.rows.length !== data_permissions.length) {
          const foundKeys = permCheck.rows.map(r => r.permission_key);
          const missingKeys = data_permissions.filter((k: string) => !foundKeys.includes(k));

          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: {
              message: 'Invalid permission keys',
              missing_keys: missingKeys
            }
          });
        }
      }

      // Verify all module IDs exist
      if (modules.length > 0) {
        const moduleCheck = await db.query(`
          SELECT id FROM modules WHERE id = ANY($1) AND is_active = true
        `, [modules]);

        if (moduleCheck.rows.length !== modules.length) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: {
              message: 'Invalid module IDs or modules not active'
            }
          });
        }
      }

      // Create template
      const result = await db.query(`
        INSERT INTO permission_templates (
          template_name,
          display_name,
          description,
          target_role,
          data_permissions,
          modules,
          is_system_template,
          created_by,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, false, $7, NOW(), NOW())
        RETURNING *
      `, [
        template_name,
        display_name,
        description || null,
        target_role,
        data_permissions,
        modules,
        req.user?.id
      ]);

      await db.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Permission template created successfully',
        data: {
          template: result.rows[0]
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

// ================================================================
// UPDATE PERMISSION TEMPLATE
// ================================================================

/**
 * Update a custom permission template
 * @route PUT /api/permission-templates/:templateId
 * @access Admin, Super-Admin (cannot modify system templates)
 */
router.put('/:templateId',
  authorize('admin', 'super-admin'),
  [
    param('templateId').isUUID().withMessage('Valid template ID is required'),
    body('display_name').optional().notEmpty(),
    body('description').optional().isString(),
    body('data_permissions').optional().isArray(),
    body('modules').optional().isArray()
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { templateId } = req.params;
    const { display_name, description, data_permissions, modules } = req.body;

    try {
      await db.query('BEGIN');

      // Check if template exists and is not a system template
      const templateCheck = await db.query(`
        SELECT id, is_system_template, created_by
        FROM permission_templates
        WHERE id = $1
      `, [templateId]);

      if (templateCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('Permission template not found');
      }

      const template = templateCheck.rows[0];

      if (template.is_system_template) {
        await db.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: {
            message: 'Cannot modify system templates'
          }
        });
      }

      // Permission check: only creator or super-admin can modify
      if (req.user?.role !== 'super-admin' && req.user?.id !== template.created_by) {
        await db.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: {
            message: 'You can only modify templates you created'
          }
        });
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (display_name !== undefined) {
        updates.push(`display_name = $${paramIndex}`);
        params.push(display_name);
        paramIndex++;
      }

      if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(description);
        paramIndex++;
      }

      if (data_permissions !== undefined) {
        updates.push(`data_permissions = $${paramIndex}`);
        params.push(data_permissions);
        paramIndex++;
      }

      if (modules !== undefined) {
        updates.push(`modules = $${paramIndex}`);
        params.push(modules);
        paramIndex++;
      }

      if (updates.length === 0) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: {
            message: 'No fields to update'
          }
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(templateId);

      const result = await db.query(`
        UPDATE permission_templates
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);

      await db.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Permission template updated successfully',
        data: {
          template: result.rows[0]
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

// ================================================================
// DELETE PERMISSION TEMPLATE
// ================================================================

/**
 * Delete a custom permission template
 * @route DELETE /api/permission-templates/:templateId
 * @access Admin, Super-Admin (cannot delete system templates)
 */
router.delete('/:templateId',
  authorize('admin', 'super-admin'),
  param('templateId').isUUID().withMessage('Valid template ID is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { templateId } = req.params;

    // Check if template exists and is not a system template
    const templateCheck = await db.query(`
      SELECT id, is_system_template, created_by, template_name
      FROM permission_templates
      WHERE id = $1
    `, [templateId]);

    if (templateCheck.rows.length === 0) {
      throw notFoundError('Permission template not found');
    }

    const template = templateCheck.rows[0];

    if (template.is_system_template) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Cannot delete system templates'
        }
      });
    }

    // Permission check
    if (req.user?.role !== 'super-admin' && req.user?.id !== template.created_by) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You can only delete templates you created'
        }
      });
    }

    await db.query(`
      DELETE FROM permission_templates WHERE id = $1
    `, [templateId]);

    res.status(200).json({
      success: true,
      message: 'Permission template deleted successfully',
      data: {
        template_id: templateId,
        template_name: template.template_name
      }
    });
  })
);

// ================================================================
// APPLY TEMPLATE TO USER
// ================================================================

/**
 * Apply a permission template to a user
 * @route POST /api/permission-templates/:templateId/apply
 * @access Admin, Super-Admin
 */
router.post('/:templateId/apply',
  authorize('admin', 'super-admin'),
  [
    param('templateId').isUUID().withMessage('Valid template ID is required'),
    body('user_id').isUUID().withMessage('Valid user ID is required'),
    body('company_id').isUUID().withMessage('Valid company ID is required')
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { templateId } = req.params;
    const { user_id, company_id } = req.body;

    // Permission check
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== company_id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You can only apply templates to users in your own company'
        }
      });
    }

    try {
      await db.query('BEGIN');

      // Get template
      const templateResult = await db.query(`
        SELECT * FROM permission_templates WHERE id = $1
      `, [templateId]);

      if (templateResult.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('Permission template not found');
      }

      const template = templateResult.rows[0];

      // Verify user exists and belongs to company
      const userCheck = await db.query(`
        SELECT user_id FROM profiles WHERE user_id = $1 AND company_id = $2
      `, [user_id, company_id]);

      if (userCheck.rows.length === 0) {
        await db.query('ROLLBACK');
        throw notFoundError('User not found in this company');
      }

      const results = {
        data_permissions_granted: 0,
        modules_granted: 0,
        errors: [] as any[]
      };

      // Apply data permissions
      if (template.data_permissions && template.data_permissions.length > 0) {
        for (const permKey of template.data_permissions) {
          try {
            const permResult = await db.query(`
              SELECT id FROM data_permissions WHERE permission_key = $1
            `, [permKey]);

            if (permResult.rows.length > 0) {
              await db.query(`
                INSERT INTO user_data_permissions (
                  user_id, permission_id, company_id, is_granted,
                  granted_by, granted_at, granted_reason
                )
                VALUES ($1, $2, $3, true, $4, NOW(), $5)
                ON CONFLICT (user_id, permission_id, company_id)
                DO UPDATE SET
                  is_granted = true,
                  granted_by = $4,
                  granted_at = NOW(),
                  granted_reason = $5
              `, [
                user_id,
                permResult.rows[0].id,
                company_id,
                req.user?.id,
                `Applied from template: ${template.display_name}`
              ]);

              results.data_permissions_granted++;
            }
          } catch (error) {
            results.errors.push({
              type: 'data_permission',
              key: permKey,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      // Apply modules
      if (template.modules && template.modules.length > 0) {
        for (const moduleId of template.modules) {
          try {
            // Use database function to grant module access
            await db.query(`
              SELECT grant_user_module_access($1, $2, $3, $4)
            `, [user_id, moduleId, company_id, req.user?.id]);

            results.modules_granted++;
          } catch (error) {
            results.errors.push({
              type: 'module',
              module_id: moduleId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      await db.query('COMMIT');

      res.status(200).json({
        success: true,
        message: 'Permission template applied successfully',
        data: {
          user_id,
          template_id: templateId,
          template_name: template.display_name,
          results
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

export default router;
