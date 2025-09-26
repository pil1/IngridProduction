import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { AuthRequest, hasPermission, authorize } from '@/middleware/auth';
import { asyncHandler, validationError, notFoundError } from '@/middleware/errorHandler';

const router = Router();

// Get all users (admin only)
router.get('/',
  authorize('admin', 'super-admin'),
  hasPermission('users.view'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let query = `
      SELECT
        u.id,
        u.email,
        u.last_sign_in,
        u.is_active,
        p.first_name,
        p.last_name,
        p.full_name,
        p.role,
        p.company_id,
        p.profile_completed,
        p.onboarding_completed,
        c.name as company_name
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Filter by company for non-super-admins
    if (req.user?.role !== 'super-admin' && req.user?.company_id) {
      query += ` AND (p.company_id = $${params.length + 1} OR p.company_id IS NULL)`;
      params.push(req.user.company_id);
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await db.query(query, params);

    res.status(200).json({
      success: true,
      data: {
        users: result.rows.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: user.full_name,
          role: user.role,
          companyId: user.company_id,
          companyName: user.company_name,
          profileCompleted: user.profile_completed,
          onboardingCompleted: user.onboarding_completed,
          lastSignIn: user.last_sign_in,
          isActive: user.is_active,
        }))
      }
    });
  })
);

// Get single user
router.get('/:id',
  hasPermission('users.view'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        u.id,
        u.email,
        u.last_sign_in,
        u.is_active,
        p.first_name,
        p.last_name,
        p.full_name,
        p.role,
        p.company_id,
        p.profile_completed,
        p.onboarding_completed,
        p.avatar_url,
        p.phone,
        p.timezone,
        p.date_format,
        c.name as company_name
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw notFoundError('User not found');
    }

    const user = result.rows[0];

    // Check access permissions
    if (req.user?.role !== 'super-admin' &&
        req.user?.company_id !== user.company_id &&
        req.user?.id !== user.id) {
      throw notFoundError('User not found');
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: user.full_name,
          role: user.role,
          companyId: user.company_id,
          companyName: user.company_name,
          profileCompleted: user.profile_completed,
          onboardingCompleted: user.onboarding_completed,
          avatarUrl: user.avatar_url,
          phone: user.phone,
          timezone: user.timezone,
          dateFormat: user.date_format,
          lastSignIn: user.last_sign_in,
          isActive: user.is_active,
        }
      }
    });
  })
);

// Create new user (admin/super-admin only)
router.post('/',
  authorize('admin', 'super-admin'),
  hasPermission('users.create'),
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('role').isIn(['user', 'admin', 'super-admin']).withMessage('Valid role is required'),
    body('company_id').notEmpty().withMessage('Company ID is required'),
    body('password').optional(),
    body('send_invitation').isBoolean().optional(),
    body('welcome_message').optional(),
    body('modules').isArray().optional(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError('Validation failed', errors.array());
    }

    const {
      email,
      first_name,
      last_name,
      role,
      company_id,
      password,
      send_invitation = true,
      welcome_message = '',
      modules = []
    } = req.body;

    // Construct full name from first and last name
    const full_name = `${first_name.trim()} ${last_name.trim()}`.trim();

    // Permission check: non-super-admins can only create users in their own company
    if (req.user?.role !== 'super-admin' && req.user?.company_id !== company_id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You can only create users in your own company'
        }
      });
    }

    try {
      await db.query('BEGIN');

      // Check if user already exists
      const existingUser = await db.query(
        'SELECT id FROM auth_users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        await db.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: {
            message: 'A user with this email already exists'
          }
        });
      }

      // Generate user ID
      const userId = require('crypto').randomUUID();

      // Use database function to create user with proper password hashing
      const tempPassword = password || require('crypto').randomBytes(32).toString('hex');

      await db.query(`
        INSERT INTO auth_users (id, email, password_hash, email_verified, is_active, created_at, updated_at)
        VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4, $5, NOW(), NOW())
      `, [
        userId,
        email.toLowerCase(),
        tempPassword,
        !send_invitation, // Auto-verify if not sending invitation
        true
      ]);

      // Create profile
      await db.query(`
        INSERT INTO profiles (user_id, email, first_name, last_name, full_name, role, company_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `, [userId, email.toLowerCase(), first_name.trim(), last_name.trim(), full_name, role, company_id]);

      // Assign modules if specified
      if (modules.length > 0) {
        for (const moduleId of modules) {
          await db.query(`
            INSERT INTO user_modules (user_id, module_id, company_id, is_enabled, granted_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          `, [userId, moduleId, company_id, true, req.user?.id]);
        }
      }

      await db.query('COMMIT');

      // Return created user data
      const userResult = await db.query(`
        SELECT
          u.id,
          u.email,
          u.is_active,
          p.first_name,
          p.last_name,
          p.full_name,
          p.role,
          p.company_id,
          c.name as company_name
        FROM auth_users u
        LEFT JOIN profiles p ON u.id = p.user_id
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE u.id = $1
      `, [userId]);

      const user = userResult.rows[0];

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            fullName: user.full_name,
            role: user.role,
            companyId: user.company_id,
            companyName: user.company_name,
            isActive: user.is_active,
          }
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  })
);

export default router;