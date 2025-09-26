import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { db } from '@/config/database';
import { authError, forbiddenError } from './errorHandler';
import { logger } from '@/utils/logger';

export interface AuthUser {
  id: string;
  email: string;
  role: 'super-admin' | 'admin' | 'user';
  company_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Authentication middleware called:', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!req.headers.authorization
    });

    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw authError('No token provided');
    }

    const token = authHeader.substring(7);

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as any;
    } catch (jwtError) {
      logger.warn('JWT verification failed:', {
        error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
        tokenPrefix: token.substring(0, 20) + '...'
      });
      throw authError(`Invalid token: ${jwtError instanceof Error ? jwtError.message : 'Token verification failed'}`);
    }

    if (!decoded || !decoded.userId) {
      logger.warn('JWT payload invalid:', { decoded });
      throw authError('Invalid token payload');
    }

    // Get user from database
    const userResult = await db.query(`
      SELECT
        u.id,
        u.email,
        u.is_active,
        p.first_name,
        p.last_name,
        p.full_name,
        p.role,
        p.company_id
      FROM auth_users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1 AND u.is_active = true
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      throw authError('User not found or inactive');
    }

    const user = userResult.rows[0];

    // Debug logging for user role
    logger.info('User authentication:', {
      userId: user.id,
      email: user.email,
      role: user.role,
      roleType: typeof user.role,
      userObject: user
    });

    // Add user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      company_id: user.company_id,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: user.full_name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(authError('Invalid token'));
    } else {
      next(error);
    }
  }
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    logger.info('Authorization middleware called:', {
      path: req.path,
      method: req.method,
      hasUser: !!req.user,
      user: req.user,
      requiredRoles: roles
    });

    if (!req.user) {
      logger.error('No user found in request - authentication failed');
      throw authError('Authentication required');
    }

    logger.info('Authorization check:', {
      userRole: req.user.role,
      userRoleType: typeof req.user.role,
      requiredRoles: roles,
      userEmail: req.user.email,
      includes: roles.includes(req.user.role)
    });

    if (!roles.includes(req.user.role)) {
      throw forbiddenError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
};

// Company access middleware
export const requireCompany = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw authError('Authentication required');
  }

  // Super admins can access any company
  if (req.user.role === 'super-admin') {
    next();
    return;
  }

  if (!req.user.company_id) {
    throw forbiddenError('User not assigned to a company');
  }

  next();
};

// Check if user has specific permission
export const hasPermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw authError('Authentication required');
      }

      // Super admins have all permissions
      if (req.user.role === 'super-admin') {
        next();
        return;
      }

      // Check permission using database function
      const result = await db.query(
        'SELECT user_has_permission($1, $2, $3) as has_permission',
        [req.user.id, permission, req.user.company_id]
      );

      if (!result.rows[0]?.has_permission) {
        throw forbiddenError(`Permission denied: ${permission}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Generate JWT token
export const generateToken = (userId: string, expiresIn: string = config.jwt.expiresIn): string => {
  return jwt.sign(
    { userId },
    config.jwt.secret,
    { expiresIn }
  );
};

// Generate refresh token
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};