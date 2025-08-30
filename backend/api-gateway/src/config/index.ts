import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
  },
  
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'tm:',
    defaultTTL: 3600, // 1 hour
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardTier: {
      windowMs: 15 * 60 * 1000,
      max: 100,
    },
    premiumTier: {
      windowMs: 15 * 60 * 1000,
      max: 500,
    },
    enterpriseTier: {
      windowMs: 15 * 60 * 1000,
      max: 1000,
    },
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:54121', 'http://localhost:55491'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Company-Id', 'X-User-Id'],
  },
  
  // Microservices Configuration
  services: {
    companyService: {
      url: process.env.COMPANY_SERVICE_URL || 'http://localhost:3001',
      timeout: 30000,
    },
    identityService: {
      url: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3002',
      timeout: 30000,
    },
    tradeMarketingService: {
      url: process.env.TRADE_MARKETING_SERVICE_URL || 'http://localhost:3003',
      timeout: 30000,
    },
    analyticsService: {
      url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004',
      timeout: 30000,
    },
    integrationService: {
      url: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3005',
      timeout: 30000,
    },
    notificationService: {
      url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
      timeout: 30000,
    },
    fileService: {
      url: process.env.FILE_SERVICE_URL || 'http://localhost:3007',
      timeout: 30000,
    },
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
  
  // Security Configuration
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    },
  },
  
  // Health Check Configuration
  healthCheck: {
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
  },
  
  // API Documentation
  swagger: {
    title: 'Trade Marketing Platform API',
    version: '1.0.0',
    description: 'Comprehensive API for the Trade Marketing Platform',
    contact: {
      name: 'API Support',
      email: 'api-support@trademarketing.com',
    },
    license: {
      name: 'Proprietary',
    },
  },
};

export default config;