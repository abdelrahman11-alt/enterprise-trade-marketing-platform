import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

import { config } from './config';
import { logger, morganStream } from './utils/logger';
import { db } from './services/database';
import { CacheService } from './services/cache';
import { EventPublisher } from './services/eventPublisher';
import { CompanyController } from './controllers/CompanyController';
import { LicenseController } from './controllers/LicenseController';
import { errorHandler, notFoundHandler, setupGlobalErrorHandlers } from './middleware/errorHandler';
import { authenticate, authorize } from './middleware/auth';
import { validateSchema } from './middleware/validation';
import { CreateCompanySchema, UpdateCompanySchema, PaginationSchema } from '@trade-marketing/shared';

class CompanyService {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupGlobalErrorHandlers();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupGlobalErrorHandlers(): void {
    setupGlobalErrorHandlers();
  }

  private setupMiddleware(): void {
    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(helmet());

    // CORS middleware
    this.app.use(cors(config.cors));

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    this.app.use(morgan(config.logging.format, { stream: morganStream }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      const requestId = req.headers['x-request-id'] as string || 
                       `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.headers['x-request-id'] = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // User context middleware (from API Gateway headers)
    this.app.use((req: any, res, next) => {
      const userId = req.headers['x-user-id'] as string;
      const userEmail = req.headers['x-user-email'] as string;
      const companyId = req.headers['x-company-id'] as string;
      const userRoles = req.headers['x-user-roles'] as string;
      const userPermissions = req.headers['x-user-permissions'] as string;

      if (userId) {
        req.user = {
          id: userId,
          email: userEmail,
          companyId,
          roles: userRoles ? JSON.parse(userRoles) : [],
          permissions: userPermissions ? JSON.parse(userPermissions) : [],
        };
      }

      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.nodeEnv,
        services: {
          database: db.isHealthy(),
          cache: CacheService.isHealthy(),
          eventPublisher: EventPublisher.isHealthy(),
        },
      };

      const isHealthy = Object.values(health.services).every(service => service);
      
      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: health,
      });
    });

    // Company routes
    this.app.post('/companies', 
      validateSchema(CreateCompanySchema),
      CompanyController.create
    );

    this.app.get('/companies', 
      CompanyController.getAll
    );

    this.app.get('/companies/root', 
      CompanyController.getRootCompanies
    );

    this.app.get('/companies/statistics', 
      CompanyController.getStatistics
    );

    this.app.get('/companies/:id', 
      CompanyController.getById
    );

    this.app.put('/companies/:id', 
      validateSchema(UpdateCompanySchema),
      CompanyController.update
    );

    this.app.delete('/companies/:id', 
      CompanyController.delete
    );

    this.app.get('/companies/:id/hierarchy', 
      CompanyController.getHierarchy
    );

    this.app.get('/companies/:id/subsidiaries', 
      CompanyController.getSubsidiaries
    );

    this.app.get('/companies/:id/statistics', 
      CompanyController.getStatistics
    );

    this.app.post('/companies/bulk', 
      CompanyController.bulkCreate
    );

    // License routes
    this.app.get('/licenses', 
      LicenseController.getAll
    );

    this.app.get('/licenses/statistics', 
      LicenseController.getStatistics
    );

    this.app.get('/licenses/expiring', 
      LicenseController.getExpiring
    );

    this.app.get('/licenses/:id', 
      LicenseController.getById
    );

    this.app.put('/licenses/:id', 
      LicenseController.update
    );

    this.app.post('/licenses/:id/renew', 
      LicenseController.renew
    );

    this.app.post('/licenses/:id/suspend', 
      LicenseController.suspend
    );

    this.app.post('/licenses/:id/activate', 
      LicenseController.activate
    );

    this.app.get('/licenses/:id/check', 
      LicenseController.checkValidity
    );

    this.app.get('/companies/:companyId/license', 
      LicenseController.getByCompanyId
    );

    // System routes
    this.app.get('/system/status', async (req, res) => {
      const status = {
        status: 'running',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.nodeEnv,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
          database: db.isHealthy(),
          cache: CacheService.isHealthy(),
          eventPublisher: EventPublisher.isHealthy(),
        },
      };

      res.json({
        success: true,
        data: status,
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      const metrics = {
        timestamp: new Date().toISOString(),
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
        },
        database: await db.getStats(),
        cache: await CacheService.getStats(),
      };

      res.json({
        success: true,
        data: metrics,
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await db.connect();
      logger.info('Connected to database');

      // Connect to cache
      await CacheService.connect();
      logger.info('Connected to cache');

      // Connect to event publisher
      await EventPublisher.connect();
      logger.info('Connected to event publisher');

      // Start the server
      this.server = this.app.listen(config.port, '0.0.0.0', () => {
        logger.info(`Company Service started on port ${config.port}`, {
          environment: config.nodeEnv,
          port: config.port,
        });
      });

      // Handle server errors
      this.server.on('error', (error: Error) => {
        logger.error('Server error', { error: error.message });
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start Company Service', { error });
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      // Stop accepting new connections
      if (this.server) {
        this.server.close(async () => {
          logger.info('HTTP server closed');

          try {
            // Close database connection
            await db.disconnect();
            logger.info('Database connection closed');

            // Close cache connection
            await CacheService.disconnect();
            logger.info('Cache connection closed');

            // Close event publisher connection
            await EventPublisher.disconnect();
            logger.info('Event publisher connection closed');

            logger.info('Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            logger.error('Error during graceful shutdown', { error });
            process.exit(1);
          }
        });
      }

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Listen for shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Create and start the Company Service
const companyService = new CompanyService();

if (require.main === module) {
  companyService.start().catch((error) => {
    logger.error('Failed to start application', { error });
    process.exit(1);
  });
}

export default companyService;