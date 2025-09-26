import { Router, Request, Response } from 'express';
import { db } from '@/config/database';
import { config } from '@/config';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();

// Health check endpoint
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Check database health
    const dbHealth = await db.healthCheck();
    const responseTime = Date.now() - startTime;

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.server.env,
      version: '1.0.0',
      responseTime: `${responseTime}ms`,
      services: {
        database: {
          status: dbHealth.status,
          timestamp: dbHealth.timestamp,
        },
        api: {
          status: 'healthy',
          port: config.server.port,
        }
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: config.server.env,
      version: '1.0.0',
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        database: {
          status: 'unhealthy',
        },
        api: {
          status: 'healthy',
          port: config.server.port,
        }
      },
      uptime: process.uptime(),
    });
  }
}));

// Simple ping endpoint
router.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString(),
  });
});

export default router;