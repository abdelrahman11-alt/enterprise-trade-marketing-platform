import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://admin:admin123@localhost:5432/trade_marketing',
  },
  
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'tm:company:',
    defaultTTL: 3600, // 1 hour
  },
  
  // Kafka Configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    clientId: 'company-service',
    groupId: 'company-service-group',
    topics: {
      companyEvents: 'company.events',
      licenseEvents: 'license.events',
      userEvents: 'user.events',
    },
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    expiresIn: '15m',
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
  
  // License Configuration
  license: {
    gracePeriodDays: 30,
    warningDays: 7,
    checkIntervalMinutes: 60,
  },
  
  // Security Configuration
  security: {
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  
  // Health Check Configuration
  healthCheck: {
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
  },
};

export default config;