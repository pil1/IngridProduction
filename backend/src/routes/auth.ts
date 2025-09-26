import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { db } from '@/config/database';
import { config } from '@/config';
import { AuthRequest, generateToken, generateRefreshToken, authenticate, authorize } from '@/middleware/auth';
import { asyncHandler, validationError, authError, AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

// Validation middleware
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').optional().isString().trim(),
  body('lastName').optional().isString().trim(),
];

// User registration
router.post('/register', registerValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array()[0].msg);
  }

  const { email, password, firstName, lastName } = req.body;

  try {
    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM auth_users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new AppError('User already exists with this email', 409);
    }

    // Create user using database function
    const result = await db.query(
      'SELECT create_user($1, $2, $3, $4) as user_id',
      [email, password, firstName, lastName]
    );

    const userId = result.rows[0].user_id;

    // Get created user profile
    const userProfile = await db.query(`
      SELECT
        u.id,
        u.email,
        p.first_name,
        p.last_name,
        p.full_name,
        p.role,
        p.company_id
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);

    const user = userProfile.rows[0];

    // Generate tokens
    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);

    logger.info('User registered successfully', { userId, email });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: user.full_name,
          role: user.role,
          companyId: user.company_id,
        },
        tokens: {
          accessToken: token,
          refreshToken,
          expiresIn: config.jwt.expiresIn,
        }
      }
    });

  } catch (error) {
    logger.error('Registration error', { error: error instanceof Error ? error.message : error, email });
    throw error;
  }
}));

// User login
router.post('/login', loginValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array()[0].msg);
  }

  const { email, password } = req.body;

  try {
    // Verify user credentials using database function
    const result = await db.query(
      'SELECT verify_user_password($1, $2) as user_id',
      [email, password]
    );

    const userId = result.rows[0].user_id;
    if (!userId) {
      throw authError('Invalid email or password');
    }

    // Get user profile
    const userProfile = await db.query(`
      SELECT
        u.id,
        u.email,
        p.first_name,
        p.last_name,
        p.full_name,
        p.role,
        p.company_id,
        p.profile_completed,
        p.onboarding_completed
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);

    const user = userProfile.rows[0];

    // Generate tokens
    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);

    logger.info('User logged in successfully', { userId, email });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: user.full_name,
          role: user.role,
          companyId: user.company_id,
          profileCompleted: user.profile_completed,
          onboardingCompleted: user.onboarding_completed,
        },
        tokens: {
          accessToken: token,
          refreshToken,
          expiresIn: config.jwt.expiresIn,
        }
      }
    });

  } catch (error) {
    logger.error('Login error', { error: error instanceof Error ? error.message : error, email });
    throw error;
  }
}));

// Get current user profile
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw authError('User not authenticated');
  }

  // Get detailed user profile
  const userProfile = await db.query(`
    SELECT
      u.id,
      u.email,
      u.last_sign_in,
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
      p.notification_preferences,
      c.name as company_name,
      c.slug as company_slug
    FROM auth_users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN companies c ON p.company_id = c.id
    WHERE u.id = $1
  `, [req.user.id]);

  const user = userProfile.rows[0];

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
        companySlug: user.company_slug,
        profileCompleted: user.profile_completed,
        onboardingCompleted: user.onboarding_completed,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        timezone: user.timezone,
        dateFormat: user.date_format,
        notificationPreferences: user.notification_preferences,
        lastSignIn: user.last_sign_in,
      }
    }
  });
}));

// Create user by admin (super-admin and admin only)
const createUserValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').isString().trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('last_name').isString().trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('role').isIn(['admin', 'user']).withMessage('Role must be admin or user'),
  body('company_id').isUUID().withMessage('Valid company ID is required'),
];

router.post('/create-user',
  authenticate,
  authorize('admin', 'super-admin'),
  createUserValidation,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw validationError(errors.array()[0].msg);
    }

    const { email, password, first_name, last_name, role, company_id } = req.body;

    try {
      // Check if user already exists
      const existingUser = await db.query('SELECT id FROM auth_users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        throw new AppError('User already exists with this email', 409);
      }

      // Permission check: admins can only create users for their company
      if (req.user?.role !== 'super-admin' && req.user?.company_id !== company_id) {
        throw new AppError('You can only create users for your own company', 403);
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Start transaction
      await db.query('BEGIN');

      try {
        // Create auth user
        const userResult = await db.query(
          'INSERT INTO auth_users (email, password_hash) VALUES ($1, $2) RETURNING id',
          [email, hashedPassword]
        );

        const userId = userResult.rows[0].id;

        // Create profile
        await db.query(`
          INSERT INTO profiles (user_id, first_name, last_name, full_name, role, company_id, profile_completed, onboarding_completed)
          VALUES ($1, $2, $3, $4, $5, $6, true, true)
        `, [userId, first_name, last_name, `${first_name} ${last_name}`, role, company_id]);

        await db.query('COMMIT');

        logger.info('User created by admin', {
          createdUserId: userId,
          createdByUserId: req.user?.id,
          email,
          role,
          companyId: company_id
        });

        res.status(201).json({
          success: true,
          message: 'User created successfully',
          data: {
            userId,
            email,
            firstName: first_name,
            lastName: last_name,
            role,
            companyId: company_id,
          }
        });

      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('User creation error', {
        error: error instanceof Error ? error.message : error,
        email,
        createdByUserId: req.user?.id
      });
      throw error;
    }
  })
);

// Logout (invalidate token)
router.post('/logout', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  // In a more complete implementation, you would add the token to a blacklist
  // For now, we'll just return success and let the client remove the token

  logger.info('User logged out', { userId: req.user?.id });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}));

export default router;