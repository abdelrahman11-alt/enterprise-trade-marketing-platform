// Application Constants

// License Limits
export const LICENSE_LIMITS = {
  STARTER: {
    MAX_USERS: 50,
    MAX_COMPANIES: 1,
    MAX_PRODUCTS: 1000,
    MAX_CUSTOMERS: 500,
    MAX_PROMOTIONS: 100,
    FEATURES: [
      'basic_trade_spend',
      'promotion_planning',
      'basic_analytics',
      'mobile_app'
    ]
  },
  PROFESSIONAL: {
    MAX_USERS: 500,
    MAX_COMPANIES: 5,
    MAX_PRODUCTS: 10000,
    MAX_CUSTOMERS: 5000,
    MAX_PROMOTIONS: 1000,
    FEATURES: [
      'advanced_trade_spend',
      'promotion_planning',
      'field_execution',
      'advanced_analytics',
      'mobile_app',
      'api_access',
      'custom_reports'
    ]
  },
  ENTERPRISE: {
    MAX_USERS: -1, // Unlimited
    MAX_COMPANIES: -1, // Unlimited
    MAX_PRODUCTS: -1, // Unlimited
    MAX_CUSTOMERS: -1, // Unlimited
    MAX_PROMOTIONS: -1, // Unlimited
    FEATURES: [
      'all_features',
      'ai_analytics',
      'supply_chain_integration',
      'financial_management',
      'white_label',
      'dedicated_support'
    ]
  },
  PLATFORM: {
    MAX_USERS: -1, // Unlimited
    MAX_COMPANIES: -1, // Unlimited
    MAX_PRODUCTS: -1, // Unlimited
    MAX_CUSTOMERS: -1, // Unlimited
    MAX_PROMOTIONS: -1, // Unlimited
    FEATURES: [
      'all_features',
      'white_label',
      'api_platform',
      'custom_development',
      'dedicated_infrastructure'
    ]
  }
} as const;

// Default Permissions
export const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN: [
    'company:*',
    'user:*',
    'license:*',
    'system:*'
  ],
  COMPANY_ADMIN: [
    'company:read',
    'company:update',
    'user:*',
    'trade_spend:*',
    'promotion:*',
    'analytics:*',
    'integration:*'
  ],
  TRADE_MARKETING_MANAGER: [
    'trade_spend:*',
    'promotion:*',
    'analytics:read',
    'customer:read',
    'product:read'
  ],
  FIELD_SALES_REP: [
    'field_execution:*',
    'store:*',
    'task:*',
    'mobile:*'
  ],
  ANALYST: [
    'analytics:read',
    'report:*',
    'dashboard:*'
  ],
  VIEWER: [
    'dashboard:read',
    'report:read',
    'analytics:read'
  ]
} as const;

// API Rate Limits
export const RATE_LIMITS = {
  DEFAULT: {
    REQUESTS_PER_MINUTE: 100,
    REQUESTS_PER_HOUR: 1000,
    REQUESTS_PER_DAY: 10000
  },
  PREMIUM: {
    REQUESTS_PER_MINUTE: 500,
    REQUESTS_PER_HOUR: 5000,
    REQUESTS_PER_DAY: 50000
  },
  ENTERPRISE: {
    REQUESTS_PER_MINUTE: 1000,
    REQUESTS_PER_HOUR: 10000,
    REQUESTS_PER_DAY: 100000
  }
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
  USER_SESSION: 3600, // 1 hour
  COMPANY_DATA: 1800, // 30 minutes
  ANALYTICS_DATA: 900, // 15 minutes
  STATIC_DATA: 86400 // 24 hours
} as const;

// File Upload Limits
export const FILE_UPLOAD = {
  MAX_SIZE: {
    IMAGE: 5 * 1024 * 1024, // 5MB
    DOCUMENT: 10 * 1024 * 1024, // 10MB
    SPREADSHEET: 25 * 1024 * 1024, // 25MB
    VIDEO: 100 * 1024 * 1024 // 100MB
  },
  ALLOWED_TYPES: {
    IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    SPREADSHEET: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
    VIDEO: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv']
  }
} as const;

// Notification Settings
export const NOTIFICATION_SETTINGS = {
  CHANNELS: {
    EMAIL: 'email',
    SMS: 'sms',
    PUSH: 'push',
    IN_APP: 'in_app',
    WEBHOOK: 'webhook'
  },
  PRIORITIES: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  },
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 5000 // 5 seconds
} as const;

// Analytics Constants
export const ANALYTICS = {
  DEFAULT_METRICS: [
    'revenue',
    'volume',
    'roi',
    'market_share',
    'customer_satisfaction',
    'promotion_effectiveness'
  ],
  DEFAULT_DIMENSIONS: [
    'time',
    'product',
    'customer',
    'channel',
    'region',
    'brand'
  ],
  AGGREGATION_FUNCTIONS: [
    'sum',
    'avg',
    'count',
    'min',
    'max',
    'median',
    'percentile'
  ],
  TIME_GRANULARITIES: [
    'hour',
    'day',
    'week',
    'month',
    'quarter',
    'year'
  ]
} as const;

// AI/ML Constants
export const AI_MODELS = {
  DEMAND_FORECASTING: {
    NAME: 'demand_forecast_v1',
    MIN_DATA_POINTS: 24, // 2 years of monthly data
    RETRAIN_FREQUENCY: 'monthly',
    ACCURACY_THRESHOLD: 0.85
  },
  PRICE_OPTIMIZATION: {
    NAME: 'price_optimization_v1',
    MIN_DATA_POINTS: 100,
    RETRAIN_FREQUENCY: 'weekly',
    ACCURACY_THRESHOLD: 0.80
  },
  PROMOTION_EFFECTIVENESS: {
    NAME: 'promotion_effectiveness_v1',
    MIN_DATA_POINTS: 50,
    RETRAIN_FREQUENCY: 'monthly',
    ACCURACY_THRESHOLD: 0.75
  },
  COMPUTER_VISION: {
    NAME: 'shelf_recognition_v1',
    CONFIDENCE_THRESHOLD: 0.90,
    MAX_IMAGE_SIZE: 5 * 1024 * 1024 // 5MB
  }
} as const;

// Field Execution Constants
export const FIELD_EXECUTION = {
  TASK_TYPES: [
    'shelf_audit',
    'planogram_check',
    'price_check',
    'promotion_setup',
    'display_build',
    'inventory_count',
    'training_session',
    'relationship_building'
  ],
  PHOTO_TYPES: [
    'before',
    'after',
    'compliance',
    'issue',
    'general'
  ],
  GPS_ACCURACY_THRESHOLD: 100, // meters
  OFFLINE_SYNC_INTERVAL: 300000, // 5 minutes
  MAX_OFFLINE_STORAGE: 100 * 1024 * 1024 // 100MB
} as const;

// Integration Constants
export const INTEGRATIONS = {
  ERP_SYSTEMS: [
    'sap',
    'oracle',
    'microsoft_dynamics',
    'netsuite',
    'custom'
  ],
  CRM_SYSTEMS: [
    'salesforce',
    'microsoft_dynamics',
    'hubspot',
    'custom'
  ],
  SSO_PROVIDERS: [
    'saml',
    'oauth2',
    'openid_connect',
    'ldap',
    'active_directory'
  ],
  DATA_WAREHOUSES: [
    'snowflake',
    'redshift',
    'bigquery',
    'databricks',
    'custom'
  ],
  SYNC_FREQUENCIES: [
    'real_time',
    'hourly',
    'daily',
    'weekly',
    'monthly'
  ]
} as const;

// Security Constants
export const SECURITY = {
  JWT: {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    ALGORITHM: 'HS256'
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 900000 // 15 minutes
  },
  SESSION: {
    TIMEOUT: 3600000, // 1 hour
    CONCURRENT_SESSIONS: 3,
    REMEMBER_ME_DURATION: 2592000000 // 30 days
  },
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16
  }
} as const;

// Database Constants
export const DATABASE = {
  CONNECTION_POOL: {
    MIN: 2,
    MAX: 10,
    IDLE_TIMEOUT: 30000,
    ACQUIRE_TIMEOUT: 60000
  },
  QUERY_TIMEOUT: 30000,
  TRANSACTION_TIMEOUT: 60000,
  BATCH_SIZE: 1000
} as const;

// Message Queue Constants
export const MESSAGE_QUEUE = {
  TOPICS: {
    USER_EVENTS: 'user.events',
    COMPANY_EVENTS: 'company.events',
    TRADE_SPEND_EVENTS: 'trade_spend.events',
    PROMOTION_EVENTS: 'promotion.events',
    ANALYTICS_EVENTS: 'analytics.events',
    NOTIFICATION_EVENTS: 'notification.events',
    INTEGRATION_EVENTS: 'integration.events'
  },
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 5000,
  DEAD_LETTER_QUEUE: 'dlq'
} as const;

// Monitoring Constants
export const MONITORING = {
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  METRICS_COLLECTION_INTERVAL: 60000, // 1 minute
  LOG_LEVELS: ['error', 'warn', 'info', 'debug'],
  ALERT_THRESHOLDS: {
    CPU_USAGE: 80,
    MEMORY_USAGE: 85,
    DISK_USAGE: 90,
    RESPONSE_TIME: 5000, // 5 seconds
    ERROR_RATE: 5 // 5%
  }
} as const;

// Localization Constants
export const LOCALIZATION = {
  DEFAULT_LOCALE: 'en-US',
  DEFAULT_TIMEZONE: 'UTC',
  DEFAULT_CURRENCY: 'USD',
  SUPPORTED_LOCALES: [
    'en-US',
    'en-GB',
    'es-ES',
    'fr-FR',
    'de-DE',
    'it-IT',
    'pt-BR',
    'ja-JP',
    'ko-KR',
    'zh-CN',
    'zh-TW'
  ],
  SUPPORTED_CURRENCIES: [
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CNY',
    'INR',
    'BRL',
    'CAD',
    'AUD',
    'MXN'
  ]
} as const;

// Business Rules Constants
export const BUSINESS_RULES = {
  TRADE_SPEND: {
    MIN_AMOUNT: 0,
    MAX_AMOUNT: 10000000, // 10M
    APPROVAL_THRESHOLDS: {
      MANAGER: 10000,
      DIRECTOR: 50000,
      VP: 100000,
      CEO: 500000
    }
  },
  PROMOTION: {
    MIN_DURATION_DAYS: 1,
    MAX_DURATION_DAYS: 365,
    MIN_DISCOUNT: 0.01, // 1%
    MAX_DISCOUNT: 0.75, // 75%
    LEAD_TIME_DAYS: 14
  },
  FORECAST: {
    MIN_ACCURACY: 0.60, // 60%
    CONFIDENCE_LEVELS: [0.80, 0.90, 0.95, 0.99],
    MAX_HORIZON_MONTHS: 24
  }
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication & Authorization
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  INSUFFICIENT_PERMISSIONS: 'AUTH_003',
  ACCOUNT_LOCKED: 'AUTH_004',
  
  // Validation
  VALIDATION_FAILED: 'VAL_001',
  REQUIRED_FIELD_MISSING: 'VAL_002',
  INVALID_FORMAT: 'VAL_003',
  VALUE_OUT_OF_RANGE: 'VAL_004',
  
  // Business Logic
  BUSINESS_RULE_VIOLATION: 'BIZ_001',
  INSUFFICIENT_BUDGET: 'BIZ_002',
  APPROVAL_REQUIRED: 'BIZ_003',
  DUPLICATE_ENTRY: 'BIZ_004',
  
  // System
  INTERNAL_SERVER_ERROR: 'SYS_001',
  SERVICE_UNAVAILABLE: 'SYS_002',
  DATABASE_ERROR: 'SYS_003',
  EXTERNAL_SERVICE_ERROR: 'SYS_004',
  
  // License
  LICENSE_EXPIRED: 'LIC_001',
  LICENSE_LIMIT_EXCEEDED: 'LIC_002',
  FEATURE_NOT_AVAILABLE: 'LIC_003',
  
  // Integration
  INTEGRATION_ERROR: 'INT_001',
  SYNC_FAILED: 'INT_002',
  MAPPING_ERROR: 'INT_003'
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Regular Expressions
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]+$/,
  URL: /^https?:\/\/.+/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  CURRENCY: /^\d+(\.\d{1,2})?$/
} as const;