import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import { config } from './config';
import { logger, morganStream } from './utils/logger';
import { redisClient } from './services/redis';
import { errorHandler, notFoundHandler, setupGlobalErrorHandlers, timeoutHandler } from './middleware/errorHandler';
import { defaultRateLimit } from './middleware/rateLimiting';
import { sanitizeInput } from './middleware/validation';
import routes from './routes';

class ApiGateway {
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
    this.app.use(helmet(config.security.helmet));

    // CORS middleware
    this.app.use(cors(config.cors));

    // Compression middleware
    this.app.use(compression());

    // Request timeout middleware
    this.app.use(timeoutHandler(30000)); // 30 seconds

    // Logging middleware
    this.app.use(morgan(config.logging.format, { stream: morganStream }));

    // Rate limiting middleware
    this.app.use(defaultRateLimit);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Input sanitization middleware
    this.app.use(sanitizeInput);

    // Request ID middleware
    this.app.use((req, res, next) => {
      const requestId = req.headers['x-request-id'] as string || 
                       `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.headers['x-request-id'] = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Response time middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        
        // Log slow requests
        if (responseTime > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            url: req.url,
            responseTime: `${responseTime}ms`,
            statusCode: res.statusCode,
            requestId: req.headers['x-request-id'],
          });
        }
      });
      
      next();
    });
  }

  private setupRoutes(): void {
    // API documentation
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: config.swagger.title,
          version: config.swagger.version,
          description: config.swagger.description,
          contact: config.swagger.contact,
          license: config.swagger.license,
        },
        servers: [
          {
            url: `http://localhost:${config.port}`,
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      apis: ['./src/routes/*.ts', './src/middleware/*.ts'],
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Trade Marketing Platform API',
    }));

    // Serve swagger spec as JSON
    this.app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // Main routes
    this.app.use('/', routes);

    // System status endpoint
    this.app.get('/status', async (req, res) => {
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.nodeEnv,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
          redis: redisClient.isHealthy(),
        },
      };

      res.json({
        success: true,
        data: status,
      });
    });

    // Metrics endpoint (for monitoring)
    this.app.get('/metrics', (req, res) => {
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
      // Connect to Redis
      await redisClient.connect();
      logger.info('Connected to Redis');

      // Start the server
      this.server = this.app.listen(config.port, '0.0.0.0', () => {
        logger.info(`API Gateway started on port ${config.port}`, {
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
      logger.error('Failed to start API Gateway', { error });
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
            // Close Redis connection
            await redisClient.disconnect();
            logger.info('Redis connection closed');

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

// Create and start the API Gateway
const apiGateway = new ApiGateway();

if (require.main === module) {
  apiGateway.start().catch((error) => {
    logger.error('Failed to start application', { error });
    process.exit(1);
  });
}

export default apiGateway;