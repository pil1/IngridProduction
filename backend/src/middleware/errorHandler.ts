import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

export interface ApiError extends Error {
  status?: number;
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  public readonly status: number;
  public readonly isOperational: boolean = true;

  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
    this.name = 'AppError';

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set default error status
  const status = error.status || error.statusCode || 500;

  // Log error details
  logger.error('API Error', {
    message: error.message,
    stack: error.stack,
    status,
    path: req.path,
    method: req.method,
    body: req.body,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Send error response
  res.status(status).json({
    success: false,
    error: {
      message: error.message || 'Internal server error',
      status,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });
};

// Async wrapper to catch async errors
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error handler
export const validationError = (message: string): AppError => {
  return new AppError(message, 400);
};

// Authentication error handler
export const authError = (message: string = 'Authentication required'): AppError => {
  return new AppError(message, 401);
};

// Authorization error handler
export const forbiddenError = (message: string = 'Access forbidden'): AppError => {
  return new AppError(message, 403);
};

// Not found error handler
export const notFoundError = (message: string = 'Resource not found'): AppError => {
  return new AppError(message, 404);
};

// Conflict error handler
export const conflictError = (message: string): AppError => {
  return new AppError(message, 409);
};

// Database error handler
export const databaseError = (message: string = 'Database error'): AppError => {
  return new AppError(message, 500);
};