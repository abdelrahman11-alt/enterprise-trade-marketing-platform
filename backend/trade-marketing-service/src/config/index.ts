import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://admin:admin123@localhost:5432/trade_marketing_core',
  },
  
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'tm:core:',
    defaultTTL: 3600, // 1 hour
  },
  
  // Kafka Configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    clientId: 'trade-marketing-service',
    groupId: 'trade-marketing-service-group',
    topics: {
      campaignEvents: 'campaign.events',
      promotionEvents: 'promotion.events',
      performanceEvents: 'performance.events',
      budgetEvents: 'budget.events',
      claimEvents: 'claim.events',
      approvalEvents: 'approval.events',
    },
  },
  
  // Business Rules Configuration
  business: {
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
    fiscalYearStart: process.env.FISCAL_YEAR_START || '01-01', // MM-DD format
    workingDays: [1, 2, 3, 4, 5], // Monday to Friday
    holidays: [], // Will be loaded from database
    
    // Budget Management
    budget: {
      approvalThresholds: {
        low: parseFloat(process.env.BUDGET_APPROVAL_LOW || '10000'),
        medium: parseFloat(process.env.BUDGET_APPROVAL_MEDIUM || '50000'),
        high: parseFloat(process.env.BUDGET_APPROVAL_HIGH || '100000'),
      },
      allocationRules: {
        maxOverspend: parseFloat(process.env.MAX_OVERSPEND_PERCENTAGE || '0.1'), // 10%
        warningThreshold: parseFloat(process.env.BUDGET_WARNING_THRESHOLD || '0.8'), // 80%
        freezeThreshold: parseFloat(process.env.BUDGET_FREEZE_THRESHOLD || '0.95'), // 95%
      },
    },
    
    // Campaign Management
    campaign: {
      maxDurationDays: parseInt(process.env.MAX_CAMPAIGN_DURATION || '365', 10),
      minDurationDays: parseInt(process.env.MIN_CAMPAIGN_DURATION || '1', 10),
      leadTimeDays: parseInt(process.env.CAMPAIGN_LEAD_TIME || '14', 10),
      autoApprovalThreshold: parseFloat(process.env.CAMPAIGN_AUTO_APPROVAL || '5000'),
    },
    
    // Promotion Management
    promotion: {
      maxDurationDays: parseInt(process.env.MAX_PROMOTION_DURATION || '90', 10),
      minDurationDays: parseInt(process.env.MIN_PROMOTION_DURATION || '1', 10),
      leadTimeDays: parseInt(process.env.PROMOTION_LEAD_TIME || '7', 10),
      maxDiscountPercentage: parseFloat(process.env.MAX_DISCOUNT_PERCENTAGE || '0.5'), // 50%
      roiThreshold: parseFloat(process.env.MIN_ROI_THRESHOLD || '1.2'), // 120%
    },
    
    // Claims & Deductions
    claims: {
      validationPeriodDays: parseInt(process.env.CLAIM_VALIDATION_PERIOD || '30', 10),
      paymentTermsDays: parseInt(process.env.CLAIM_PAYMENT_TERMS || '45', 10),
      disputePeriodDays: parseInt(process.env.CLAIM_DISPUTE_PERIOD || '60', 10),
      autoValidationThreshold: parseFloat(process.env.CLAIM_AUTO_VALIDATION || '1000'),
    },
    
    // Performance Metrics
    performance: {
      calculationFrequency: process.env.PERFORMANCE_CALC_FREQUENCY || 'daily',
      retentionPeriodDays: parseInt(process.env.PERFORMANCE_RETENTION || '1095', 10), // 3 years
      benchmarkPeriods: ['previous_period', 'previous_year', 'industry_average'],
    },
  },
  
  // Integration Configuration
  integrations: {
    erp: {
      enabled: process.env.ERP_INTEGRATION_ENABLED === 'true',
      endpoint: process.env.ERP_ENDPOINT || '',
      apiKey: process.env.ERP_API_KEY || '',
      syncInterval: parseInt(process.env.ERP_SYNC_INTERVAL || '3600000', 10), // 1 hour
    },
    crm: {
      enabled: process.env.CRM_INTEGRATION_ENABLED === 'true',
      endpoint: process.env.CRM_ENDPOINT || '',
      apiKey: process.env.CRM_API_KEY || '',
      syncInterval: parseInt(process.env.CRM_SYNC_INTERVAL || '1800000', 10), // 30 minutes
    },
    pos: {
      enabled: process.env.POS_INTEGRATION_ENABLED === 'true',
      endpoint: process.env.POS_ENDPOINT || '',
      apiKey: process.env.POS_API_KEY || '',
      syncInterval: parseInt(process.env.POS_SYNC_INTERVAL || '900000', 10), // 15 minutes
    },
    analytics: {
      enabled: process.env.ANALYTICS_INTEGRATION_ENABLED === 'true',
      endpoint: process.env.ANALYTICS_ENDPOINT || '',
      apiKey: process.env.ANALYTICS_API_KEY || '',
    },
  },
  
  // File Storage Configuration
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local', // local, s3, gcs, azure
    local: {
      uploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
    },
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    allowedFileTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'text/plain'
    ],
  },
  
  // Queue Configuration
  queue: {
    redis: {
      host: process.env.QUEUE_REDIS_HOST || 'localhost',
      port: parseInt(process.env.QUEUE_REDIS_PORT || '6379', 10),
      password: process.env.QUEUE_REDIS_PASSWORD || '',
    },
    concurrency: {
      performance: parseInt(process.env.QUEUE_PERFORMANCE_CONCURRENCY || '5', 10),
      reporting: parseInt(process.env.QUEUE_REPORTING_CONCURRENCY || '3', 10),
      integration: parseInt(process.env.QUEUE_INTEGRATION_CONCURRENCY || '10', 10),
      notification: parseInt(process.env.QUEUE_NOTIFICATION_CONCURRENCY || '20', 10),
    },
  },
  
  // Caching Configuration
  cache: {
    performance: {
      ttl: parseInt(process.env.CACHE_PERFORMANCE_TTL || '1800', 10), // 30 minutes
    },
    products: {
      ttl: parseInt(process.env.CACHE_PRODUCTS_TTL || '3600', 10), // 1 hour
    },
    customers: {
      ttl: parseInt(process.env.CACHE_CUSTOMERS_TTL || '1800', 10), // 30 minutes
    },
    campaigns: {
      ttl: parseInt(process.env.CACHE_CAMPAIGNS_TTL || '900', 10), // 15 minutes
    },
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    campaigns: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
    },
    promotions: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
    },
    claims: {
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 requests per minute
    },
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
  
  // Monitoring Configuration
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9091', 10),
    enableTracing: process.env.ENABLE_TRACING === 'true',
  },
  
  // Feature Flags
  features: {
    advancedAnalytics: process.env.FEATURE_ADVANCED_ANALYTICS === 'true',
    mlPredictions: process.env.FEATURE_ML_PREDICTIONS === 'true',
    realTimeSync: process.env.FEATURE_REAL_TIME_SYNC === 'true',
    autoApprovals: process.env.FEATURE_AUTO_APPROVALS === 'true',
    smartBudgeting: process.env.FEATURE_SMART_BUDGETING === 'true',
    competitorAnalysis: process.env.FEATURE_COMPETITOR_ANALYSIS === 'true',
    customerInsights: process.env.FEATURE_CUSTOMER_INSIGHTS === 'true',
    performanceOptimization: process.env.FEATURE_PERFORMANCE_OPTIMIZATION === 'true',
  },
  
  // Notification Configuration
  notifications: {
    channels: ['email', 'sms', 'push', 'webhook'],
    templates: {
      campaignApproval: 'campaign-approval',
      promotionExpiry: 'promotion-expiry',
      budgetAlert: 'budget-alert',
      claimReceived: 'claim-received',
      performanceAlert: 'performance-alert',
    },
    escalation: {
      levels: 3,
      intervalMinutes: 30,
    },
  },
  
  // Reporting Configuration
  reporting: {
    formats: ['pdf', 'excel', 'csv', 'json'],
    schedules: ['daily', 'weekly', 'monthly', 'quarterly'],
    retention: {
      daily: 90, // days
      weekly: 52, // weeks
      monthly: 24, // months
      quarterly: 20, // quarters
    },
  },
  
  // Security Configuration
  security: {
    dataEncryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90,
    },
    auditLog: {
      retentionDays: 2555, // 7 years
      sensitiveFields: ['budget', 'amount', 'pricing'],
    },
    accessControl: {
      sessionTimeout: 8 * 60 * 60, // 8 hours
      maxConcurrentSessions: 3,
    },
  },
};

export default config;