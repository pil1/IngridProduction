import { Pool, PoolConfig } from 'pg';
import { config } from './index';
import { logger } from '@/utils/logger';

class DatabaseService {
  private pool: Pool;
  private static instance: DatabaseService;

  private constructor() {
    const poolConfig: PoolConfig = {
      connectionString: config.database.url,
      ssl: config.database.ssl ? {
        rejectUnauthorized: false
      } : false,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', err);
    });

    // Handle pool connection events
    this.pool.on('connect', (client) => {
      logger.debug('Database client connected');
    });

    this.pool.on('remove', (client) => {
      logger.debug('Database client removed');
    });
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn('Slow query detected', {
          query: text,
          duration: `${duration}ms`,
          params: params?.length || 0
        });
      }

      return result;
    } catch (error) {
      logger.error('Database query error', {
        query: text,
        params: params?.length || 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const result = await this.query('SELECT NOW() as timestamp');
      return {
        status: 'healthy',
        timestamp: result.rows[0].timestamp
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool closed');
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();