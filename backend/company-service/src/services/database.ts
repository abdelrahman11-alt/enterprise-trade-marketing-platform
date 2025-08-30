import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../utils/logger';

class DatabaseService {
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.database.url,
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.prisma.$on('query', (e) => {
      if (config.nodeEnv === 'development') {
        logger.debug('Database query', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      }
    });

    this.prisma.$on('error', (e) => {
      logger.error('Database error', {
        target: e.target,
        message: e.message,
      });
    });

    this.prisma.$on('info', (e) => {
      logger.info('Database info', {
        target: e.target,
        message: e.message,
      });
    });

    this.prisma.$on('warn', (e) => {
      logger.warn('Database warning', {
        target: e.target,
        message: e.message,
      });
    });
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', { error });
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  // Transaction wrapper
  async transaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
    }
  ): Promise<T> {
    return this.prisma.$transaction(fn, {
      maxWait: options?.maxWait || 5000, // 5 seconds
      timeout: options?.timeout || 10000, // 10 seconds
    });
  }

  // Get Prisma client instance
  getClient(): PrismaClient {
    return this.prisma;
  }

  // Check if connected
  isHealthy(): boolean {
    return this.isConnected;
  }

  // Database statistics
  async getStats(): Promise<any> {
    try {
      const stats = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        LIMIT 10
      `;
      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', { error });
      return null;
    }
  }

  // Connection pool info
  async getConnectionInfo(): Promise<any> {
    try {
      const info = await this.prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      return info;
    } catch (error) {
      logger.error('Failed to get connection info', { error });
      return null;
    }
  }
}

// Create singleton instance
export const db = new DatabaseService();

// Export Prisma client for direct access when needed
export { PrismaClient } from '@prisma/client';
export default db;