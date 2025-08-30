import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import passport from 'passport';
import { config } from './config';
import { logger } from './utils/logger';
import { DatabaseService } from './services/database';
import { CacheService } from './services/cache';
import { KafkaService } from './services/kafka';
import { SecurityService } from './services/SecurityService';
import { MFAService } from './auth/MFAService';
import { ZeroTrustService } from './auth/ZeroTrustService';
import { Office365AuthService } from './auth/Office365AuthService';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import mfaRoutes from './routes/mfa';
import securityRoutes from './routes/security';
import office365Routes from './routes/office365';
import adminRoutes from './routes/admin';

// Import middleware
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { securityHeadersMiddleware } from './middleware/security';
import { auditMiddleware } from './middleware/audit';
import { errorHandler } from './middleware/errorHandler';

class IdentityService {
  private app: express.Application;
  private server: any;
  private databaseService: DatabaseService;
  private cacheService: CacheService;
  private kafkaService: KafkaService;
  private securityService: SecurityService;
  private mfaService: MFAService;
  private zeroTrustService: ZeroTrustService;
  private office365Service: Office365AuthService;

  constructor() {
    this.app = express();
    this.databaseService = new DatabaseService();
    this.cacheService = new CacheService();
    this.kafkaService = new KafkaService();
    this.securityService = new SecurityService();
    this.mfaService = new MFAService();
    this.zeroTrustService = new ZeroTrustService();
    this.office365Service = new Office365AuthService();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize services
      await this.initializeServices();
      
      // Configure middleware
      this.configureMiddleware();
      
      // Configure routes
      this.configureRoutes();
      
      // Configure error handling
      this.configureErrorHandling();
      
      logger.info('Identity Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Identity Service', { error });
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    // Initialize database
    await this.databaseService.connect();
    
    // Initialize cache
    await this.cacheService.connect();
    
    // Initialize Kafka
    await this.kafkaService.connect();
    
    // Run database migrations
    await this.databaseService.migrate();
    
    logger.info('All services initialized');
  }

  private configureMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: config.security.headers.contentSecurityPolicy.directives,
      },
      hsts: config.security.headers.hsts,
    }));

    // Custom security headers
    this.app.use(securityHeadersMiddleware);

    // CORS
    this.app.use(cors(config.security.cors));

    // Compression
    this.app.use(compression());

    // Request logging
    this.app.use(morgan(config.logging.format, {
      stream: {
        write: (message: string) => {
          logger.info(message.trim());
        },
      },
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    this.app.use(rateLimitMiddleware);

    // Passport initialization
    this.app.use(passport.initialize());

    // Audit logging
    this.app.use(auditMiddleware);

    logger.info('Middleware configured');
  }

  private configureRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: this.databaseService.isHealthy(),
          cache: this.cacheService.isHealthy(),
          kafka: this.kafkaService.isHealthy(),
          mfa: this.mfaService.isHealthy(),
          zeroTrust: this.zeroTrustService.isHealthy(),
          office365: true, // Would implement health check
        },
        version: process.env.npm_package_version || '1.0.0',
      };

      const isHealthy = Object.values(health.services).every(Boolean);
      res.status(isHealthy ? 200 : 503).json(health);
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', authMiddleware, userRoutes);
    this.app.use('/api/mfa', authMiddleware, mfaRoutes);
    this.app.use('/api/security', authMiddleware, securityRoutes);
    this.app.use('/api/office365', office365Routes);
    this.app.use('/api/admin', authMiddleware, adminRoutes);

    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        title: 'Trade Marketing Identity Service API',
        version: '1.0.0',
        description: 'Enterprise identity and authentication service with Office 365 SSO, MFA, and Zero Trust security',
        endpoints: {
          authentication: '/api/auth',
          users: '/api/users',
          mfa: '/api/mfa',
          security: '/api/security',
          office365: '/api/office365',
          admin: '/api/admin',
        },
        features: {
          office365SSO: config.features.office365Sso,
          multiFactorAuth: config.features.twoFactorAuth,
          zeroTrust: config.zeroTrust.enabled,
          deviceTrust: config.features.deviceTrust,
          riskBasedAuth: config.features.riskBasedAuth,
        },
      });
    });

    // Catch-all for undefined routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: req.originalUrl,
      });
    });

    logger.info('Routes configured');
  }

  private configureErrorHandling(): void {
    // Global error handler
    this.app.use(errorHandler);

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', { error });
      process.exit(1);
    });

    logger.info('Error handling configured');
  }

  async start(): Promise<void> {
    try {
      this.server = this.app.listen(config.port, '0.0.0.0', () => {
        logger.info(`Identity Service started on port ${config.port}`, {
          environment: config.nodeEnv,
          features: {
            office365SSO: config.features.office365Sso,
            mfa: config.features.twoFactorAuth,
            zeroTrust: config.zeroTrust.enabled,
            deviceTrust: config.features.deviceTrust,
          },
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));

    } catch (error) {
      logger.error('Failed to start Identity Service', { error });
      throw error;
    }
  }

  private async shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    try {
      // Close server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // Close services
      await this.kafkaService.disconnect();
      await this.cacheService.disconnect();
      await this.databaseService.disconnect();

      logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  // Get application instance for testing
  getApp(): express.Application {
    return this.app;
  }
}

// Start the service
async function main() {
  const service = new IdentityService();
  
  try {
    await service.initialize();
    await service.start();
  } catch (error) {
    logger.error('Failed to start Identity Service', { error });
    process.exit(1);
  }
}

// Only start if this file is run directly
if (require.main === module) {
  main();
}

export default IdentityService;