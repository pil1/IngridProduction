import { Router, Response } from 'express';
import { AuthRequest, authorize, hasPermission } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { db } from '@/config/database';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all companies with Supabase-style query support
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Parse query parameters for Supabase-style filtering
    const { select = '*', order, limit } = req.query as Record<string, string>;
    const isActiveFilter = req.query['is_active[eq]'];

    // Build SELECT clause
    let selectClause = 'c.*';
    if (select === 'id, name, slug') {
      selectClause = 'c.id, c.name, c.slug';
    } else if (select === 'id, name') {
      selectClause = 'c.id, c.name';
    } else if (select !== '*') {
      // For other specific selects, use as-is but prefix with c.
      selectClause = select.split(',').map(field => `c.${field.trim()}`).join(', ');
    }

    // Build WHERE clause
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (isActiveFilter === 'true') {
      whereClause = 'WHERE c.is_active = $' + paramIndex;
      params.push(true);
      paramIndex++;
    }

    // Build ORDER clause
    let orderClause = 'ORDER BY c.created_at DESC';
    if (order) {
      const [field, direction] = order.split('.');
      orderClause = `ORDER BY c.${field} ${direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    // Build LIMIT clause
    let limitClause = '';
    if (limit) {
      limitClause = `LIMIT $${paramIndex}`;
      params.push(parseInt(limit));
    }

    const query = `
      SELECT ${selectClause}
      FROM companies c
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;

    const result = await db.query(query, params);

    // Return data directly for Supabase compatibility
    res.status(200).json({
      success: true,
      data: result.rows
    });
  })
);

// Get current user's company
router.get('/current',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.company_id) {
      return res.status(200).json({
        success: true,
        data: { company: null }
      });
    }

    const result = await db.query(`
      SELECT * FROM companies WHERE id = $1
    `, [req.user.company_id]);

    res.status(200).json({
      success: true,
      data: {
        company: result.rows[0] || null
      }
    });
  })
);

// Create new company (super-admin only)
router.post('/',
  authorize('super-admin'),
  [
    body('name').notEmpty().withMessage('Company name is required'),
    body('domain').optional(),
    body('default_currency').notEmpty().withMessage('Default currency is required'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const { name, domain, default_currency } = req.body;

    try {
      // Generate slug
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      // Check for duplicates
      const duplicateCheck = await db.query(`
        SELECT id, name, slug FROM companies
        WHERE name = $1 OR slug = $2
      `, [name, slug]);

      if (duplicateCheck.rows.length > 0) {
        const existing = duplicateCheck.rows[0];
        if (existing.name === name) {
          return res.status(409).json({
            success: false,
            error: 'A company with this name already exists'
          });
        }
        if (existing.slug === slug) {
          return res.status(409).json({
            success: false,
            error: 'A company with this slug already exists'
          });
        }
      }

      // Start transaction
      await db.query('BEGIN');

      // Create company (using 'website' column, not 'domain')
      const companyResult = await db.query(`
        INSERT INTO companies (name, website, slug, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        name,
        domain || null,
        slug,
        true
      ]);

      const company = companyResult.rows[0];

      // Create company settings with default currency
      if (default_currency) {
        await db.query(`
          INSERT INTO company_settings (company_id, currency)
          VALUES ($1, $2)
        `, [company.id, default_currency]);
      }

      // Enable all core required modules for new company
      await db.query(`
        INSERT INTO company_modules (company_id, module_id, is_enabled, enabled_at)
        SELECT $1, id, true, NOW()
        FROM modules
        WHERE is_core_required = true
      `, [company.id]);

      await db.query('COMMIT');

      // Return data in format expected by SuperAdminCompanySetupPage
      res.status(201).json(company);

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

// Comprehensive company provisioning endpoint (super-admin only)
router.post('/provision',
  authorize('super-admin'),
  [
    body('name').notEmpty().withMessage('Company name is required'),
    body('slug').notEmpty().withMessage('Company slug is required'),
    body('country').notEmpty().withMessage('Country is required'),
    body('base_currency').notEmpty().withMessage('Base currency is required'),
    body('enabled_modules').isArray().withMessage('Enabled modules must be an array'),
    body('admin_user.email').isEmail().withMessage('Valid admin email is required'),
    body('admin_user.first_name').notEmpty().withMessage('Admin first name is required'),
    body('admin_user.last_name').notEmpty().withMessage('Admin last name is required'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    console.log('Provision endpoint received request body:', JSON.stringify(req.body, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    console.log('Validation passed, proceeding with company creation');

    const {
      name,
      slug,
      description,
      website,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      phone,
      email,
      base_currency,
      enabled_modules,
      module_pricing,
      admin_user
    } = req.body;

    try {
      // Start transaction
      await db.query('BEGIN');

      // Check for duplicates
      const duplicateCheck = await db.query(`
        SELECT id, name, slug FROM companies
        WHERE name = $1 OR slug = $2
      `, [name, slug]);

      if (duplicateCheck.rows.length > 0) {
        await db.query('ROLLBACK');
        const existing = duplicateCheck.rows[0];
        return res.status(409).json({
          success: false,
          message: existing.name === name
            ? 'A company with this name already exists'
            : 'A company with this slug already exists'
        });
      }

      // Create company with comprehensive details
      const companyResult = await db.query(`
        INSERT INTO companies (
          name, slug, description, website,
          address_line_1, address_line_2, city, state, postal_code, country, phone, email,
          is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING *
      `, [
        name, slug, description, website,
        address_line1, address_line2, city, state, postal_code, country, phone, email,
        true
      ]);

      const company = companyResult.rows[0];

      // Create company settings with base currency
      await db.query(`
        INSERT INTO company_settings (company_id, currency, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
      `, [company.id, base_currency]);

      // Get all core modules
      const coreModulesResult = await db.query(`
        SELECT id FROM modules
        WHERE is_core_required = true OR module_classification = 'core'
      `);
      const coreModuleIds = coreModulesResult.rows.map(row => row.id);

      // Combine core modules with selected modules
      const allEnabledModules = [...new Set([...coreModuleIds, ...enabled_modules])];

      // Enable modules for the company with custom pricing
      if (allEnabledModules.length > 0) {
        for (const moduleId of allEnabledModules) {
          const pricing = module_pricing?.[moduleId];

          await db.query(`
            INSERT INTO company_modules (
              company_id, module_id, is_enabled, enabled_by, enabled_at, monthly_price, per_user_price
            )
            VALUES ($1, $2, $3, $4, NOW(), $5, $6)
          `, [
            company.id,
            moduleId,
            true,
            req.user?.id,
            pricing?.monthly_price || null,
            pricing?.per_user_price || null
          ]);
        }
      }

      let adminUserResult = null;

      // Create admin user (always required)
      if (admin_user) {
        const userId = uuidv4();

        // Create auth user with database-compatible password hashing
        if (admin_user.password) {
          // Use PostgreSQL's crypt function for password hashing
          await db.query(`
            INSERT INTO auth_users (
              id, email, password_hash, email_verified, created_at, updated_at
            )
            VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, NOW(), NOW())
          `, [
            userId,
            admin_user.email.toLowerCase(),
            admin_user.password,
            true // Mark email as verified since password is set
          ]);
        } else {
          // Create user without password (will need invitation)
          await db.query(`
            INSERT INTO auth_users (
              id, email, password_hash, email_verified, created_at, updated_at
            )
            VALUES ($1, $2, NULL, $3, NOW(), NOW())
          `, [
            userId,
            admin_user.email.toLowerCase(),
            false // Email not verified without password
          ]);
        }

        // Create user profile
        const fullName = `${admin_user.first_name} ${admin_user.last_name}`;

        await db.query(`
          INSERT INTO profiles (
            user_id, email, full_name, first_name, last_name, role, company_id,
            phone, profile_completed, onboarding_completed, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `, [
          userId,
          admin_user.email.toLowerCase(),
          fullName,
          admin_user.first_name,
          admin_user.last_name,
          'admin',
          company.id,
          admin_user.phone,
          true,
          true
        ]);

        // Grant admin permissions for all enabled modules
        const adminPermissions = [
          'dashboard.view',
          'users.view', 'users.create', 'users.edit', 'users.delete',
          'company.settings.view', 'company.settings.edit',
          'vendors.view', 'vendors.create', 'vendors.edit', 'vendors.delete',
          'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
          'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete', 'expenses.approve', 'expenses.review',
          'expense_categories.view', 'expense_categories.create', 'expense_categories.edit',
          'gl_accounts.view', 'gl_accounts.create', 'gl_accounts.edit',
          'analytics.view', 'analytics.export',
          'notifications.view', 'notifications.manage'
        ];

        // Get permission IDs
        const permissionResult = await db.query(`
          SELECT id, permission_key FROM permissions
          WHERE permission_key = ANY($1)
        `, [adminPermissions]);

        // Grant permissions
        if (permissionResult.rows.length > 0) {
          const permissionValues = permissionResult.rows.map((perm, index) => {
            const offset = index * 5;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
          }).join(', ');

          const permissionParams = permissionResult.rows.flatMap(perm => [
            userId,
            perm.id,
            company.id,
            true,
            req.user?.id
          ]);

          await db.query(`
            INSERT INTO user_permissions (
              user_id, permission_id, company_id, is_granted, granted_by
            )
            VALUES ${permissionValues}
          `, permissionParams);
        }

        adminUserResult = {
          id: userId,
          email: admin_user.email.toLowerCase(),
          full_name: fullName,
          first_name: admin_user.first_name,
          last_name: admin_user.last_name,
          role: 'admin',
          invitation_sent: !admin_user.password,
          password_set: !!admin_user.password
        };

        // TODO: If no password was set, send invitation email via email service
        if (!admin_user.password) {
          // This would integrate with your email service
          console.log(`TODO: Send invitation email to ${admin_user.email} for company ${company.name}`);
        }
      }

      await db.query('COMMIT');

      // Return comprehensive response
      res.status(201).json({
        success: true,
        message: 'Company provisioned successfully',
        data: {
          company,
          admin_user: adminUserResult,
          enabled_modules: allEnabledModules,
          module_count: allEnabledModules.length
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Company provisioning error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to provision company',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;