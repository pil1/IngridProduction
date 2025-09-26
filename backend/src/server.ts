import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { logger, morganStream } from '@/utils/logger';
import { db } from '@/config/database';

// Import routes
import authRoutes from '@/routes/auth';
import userRoutes from '@/routes/users';
import profileRoutes from '@/routes/profiles';
import companyRoutes from '@/routes/companies';
import vendorRoutes from '@/routes/vendors';
import customerRoutes from '@/routes/customers';
import expenseRoutes from '@/routes/expenses';
import glAccountRoutes from '@/routes/gl-accounts';
import expenseCategoryRoutes from '@/routes/expense-categories';
import moduleRoutes from '@/routes/modules';
import currencyRoutes from '@/routes/currencies';
import userRoleAssignmentRoutes from '@/routes/user-role-assignments';
import customRoleRoutes from '@/routes/custom-roles';
import permissionRoutes from '@/routes/permissions';
import rpcRoutes from '@/routes/rpc';
import documentRoutes from '@/routes/documents';
import healthRoutes from '@/routes/health';

// Import middleware
import { errorHandler } from '@/middleware/errorHandler';
import { authenticate } from '@/middleware/auth';

class Server {
  public app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow inline scripts for development
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.server.corsOrigin.split(','),
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression middleware
    this.app.use(compression());

    // Request logging
    this.app.use(morgan(config.logging.format, { stream: morganStream }));

    // Rate limiting - DISABLED for development
    // const limiter = rateLimit({
    //   windowMs: config.rateLimit.windowMs,
    //   max: config.rateLimit.maxRequests,
    //   message: {
    //     error: 'Too many requests from this IP, please try again later.'
    //   },
    //   standardHeaders: true,
    //   legacyHeaders: false,
    // });
    // this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.method !== 'GET' ? req.body : undefined,
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check route (no authentication required)
    this.app.use('/health', healthRoutes);

    // API routes
    this.app.use('/api/auth', authRoutes);

    // Authenticated routes
    this.app.use('/api/users', authenticate, userRoutes);
    this.app.use('/api/profiles', authenticate, profileRoutes);
    this.app.use('/api/companies', authenticate, companyRoutes);
    this.app.use('/api/vendors', authenticate, vendorRoutes);
    this.app.use('/api/customers', authenticate, customerRoutes);
    this.app.use('/api/expenses', authenticate, expenseRoutes);
    this.app.use('/api/gl-accounts', authenticate, glAccountRoutes);
    this.app.use('/api/expense-categories', authenticate, expenseCategoryRoutes);
    this.app.use('/api/modules', authenticate, moduleRoutes);
    this.app.use('/api/currencies', authenticate, currencyRoutes);
    this.app.use('/api/user_role_assignments', authenticate, userRoleAssignmentRoutes);
    this.app.use('/api/custom_roles', authenticate, customRoleRoutes);
    this.app.use('/api/permissions', authenticate, permissionRoutes);
    this.app.use('/api/documents', authenticate, documentRoutes);
    this.app.use('/api/rpc', authenticate, rpcRoutes);

    // Serve uploaded files
    this.app.use('/uploads', express.static('uploads'));

    // 404 handler for API routes
    this.app.use('/api/*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'INFOtrac Backend API',
        version: '1.0.0',
        environment: config.server.env,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      const dbHealth = await db.healthCheck();
      logger.info('Database connection established', dbHealth);

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`Server running on port ${this.port}`, {
          environment: config.server.env,
          port: this.port,
          corsOrigin: config.server.corsOrigin,
        });
      });

      // Graceful shutdown handlers
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));

    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  private async shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    try {
      // Close database connections
      await db.close();
      logger.info('Database connections closed');

      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }
}

// Create and start server
const server = new Server();

// Handle unhandled rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  server.start();
}

export default server;