import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://admin:admin123@localhost:5432/trade_marketing_identity',
  },
  
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'tm:identity:',
    defaultTTL: 3600, // 1 hour
  },
  
  // Kafka Configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    clientId: 'identity-service',
    groupId: 'identity-service-group',
    topics: {
      userEvents: 'user.events',
      authEvents: 'auth.events',
      companyEvents: 'company.events',
    },
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
    issuer: 'trade-marketing-platform',
    audience: 'trade-marketing-users',
  },
  
  // Password Configuration
  password: {
    bcryptRounds: 12,
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90, // days
    historyCount: 5, // remember last 5 passwords
  },
  
  // Session Configuration
  session: {
    maxConcurrentSessions: 5,
    inactivityTimeout: 30 * 60, // 30 minutes
    absoluteTimeout: 8 * 60 * 60, // 8 hours
  },
  
  // Security Configuration
  security: {
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    passwordResetTokenExpiry: 60 * 60, // 1 hour
    emailVerificationTokenExpiry: 24 * 60 * 60, // 24 hours
    twoFactorWindowSize: 1, // TOTP window size
  },
  
  // Email Configuration
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
    from: process.env.EMAIL_FROM || 'noreply@trademarketing.com',
    templates: {
      welcomeEmail: 'welcome',
      passwordReset: 'password-reset',
      emailVerification: 'email-verification',
      twoFactorSetup: 'two-factor-setup',
    },
  },
  
  // OAuth Providers
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      callbackURL: process.env.MICROSOFT_CALLBACK_URL || '/auth/microsoft/callback',
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      scope: ['openid', 'profile', 'email', 'User.Read', 'Directory.Read.All'],
    },
  },

  // Office 365 Integration
  office365: {
    clientId: process.env.OFFICE365_CLIENT_ID || '',
    clientSecret: process.env.OFFICE365_CLIENT_SECRET || '',
    tenantId: process.env.OFFICE365_TENANT_ID || '',
    redirectUri: process.env.OFFICE365_REDIRECT_URI || '/auth/office365/callback',
    scopes: [
      'openid',
      'profile', 
      'email',
      'User.Read',
      'User.ReadBasic.All',
      'Directory.Read.All',
      'Group.Read.All',
      'Organization.Read.All'
    ],
    graphApiUrl: 'https://graph.microsoft.com/v1.0',
    loginUrl: 'https://login.microsoftonline.com',
    enableGroupSync: process.env.OFFICE365_ENABLE_GROUP_SYNC === 'true',
    syncInterval: parseInt(process.env.OFFICE365_SYNC_INTERVAL || '3600000', 10), // 1 hour
  },
  
  // SAML Configuration
  saml: {
    entryPoint: process.env.SAML_ENTRY_POINT || '',
    issuer: process.env.SAML_ISSUER || 'trade-marketing-platform',
    callbackUrl: process.env.SAML_CALLBACK_URL || '/auth/saml/callback',
    cert: process.env.SAML_CERT || '',
    privateCert: process.env.SAML_PRIVATE_CERT || '',
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 login attempts per windowMs
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // limit each IP to 3 password reset attempts per hour
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
  
  // Health Check Configuration
  healthCheck: {
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
  },
  
  // Multi-Factor Authentication
  mfa: {
    enabled: process.env.MFA_ENABLED === 'true',
    issuer: process.env.MFA_ISSUER || 'Trade Marketing Platform',
    window: parseInt(process.env.MFA_WINDOW || '1', 10),
    step: parseInt(process.env.MFA_STEP || '30', 10),
    backupCodes: {
      count: parseInt(process.env.MFA_BACKUP_CODES_COUNT || '10', 10),
      length: parseInt(process.env.MFA_BACKUP_CODES_LENGTH || '8', 10),
    },
  },

  // Encryption Configuration
  encryption: {
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    keyDerivation: process.env.KEY_DERIVATION || 'pbkdf2',
    iterations: parseInt(process.env.ENCRYPTION_ITERATIONS || '100000', 10),
    keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH || '32', 10),
    ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH || '16', 10),
    tagLength: parseInt(process.env.ENCRYPTION_TAG_LENGTH || '16', 10),
    masterKey: process.env.ENCRYPTION_MASTER_KEY || '',
  },

  // Zero Trust Security
  zeroTrust: {
    enabled: process.env.ZERO_TRUST_ENABLED === 'true',
    deviceTrust: {
      enabled: process.env.DEVICE_TRUST_ENABLED === 'true',
      requireRegistration: process.env.REQUIRE_DEVICE_REGISTRATION === 'true',
      maxDevicesPerUser: parseInt(process.env.MAX_DEVICES_PER_USER || '5', 10),
    },
    locationTrust: {
      enabled: process.env.LOCATION_TRUST_ENABLED === 'true',
      allowedCountries: process.env.ALLOWED_COUNTRIES?.split(',') || [],
      blockedCountries: process.env.BLOCKED_COUNTRIES?.split(',') || [],
    },
    riskAssessment: {
      enabled: process.env.RISK_ASSESSMENT_ENABLED === 'true',
      highRiskThreshold: parseFloat(process.env.HIGH_RISK_THRESHOLD || '0.8'),
      mediumRiskThreshold: parseFloat(process.env.MEDIUM_RISK_THRESHOLD || '0.5'),
    },
  },

  // Compliance Configuration
  compliance: {
    gdpr: {
      enabled: process.env.GDPR_ENABLED === 'true',
      dataRetentionDays: parseInt(process.env.GDPR_DATA_RETENTION_DAYS || '2555', 10), // 7 years
      rightToErasure: process.env.GDPR_RIGHT_TO_ERASURE === 'true',
      dataPortability: process.env.GDPR_DATA_PORTABILITY === 'true',
    },
    sox: {
      enabled: process.env.SOX_ENABLED === 'true',
      auditRetentionYears: parseInt(process.env.SOX_AUDIT_RETENTION_YEARS || '7', 10),
      segregationOfDuties: process.env.SOX_SEGREGATION_OF_DUTIES === 'true',
    },
    iso27001: {
      enabled: process.env.ISO27001_ENABLED === 'true',
      riskManagement: process.env.ISO27001_RISK_MANAGEMENT === 'true',
      incidentResponse: process.env.ISO27001_INCIDENT_RESPONSE === 'true',
    },
  },

  // Security Headers
  security: {
    headers: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrc: ["'self'", "https://login.microsoftonline.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://graph.microsoft.com", "https://login.microsoftonline.com"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'self'", "https://login.microsoftonline.com"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    },
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['https://app.trademarketing.com'],
      credentials: true,
      optionsSuccessStatus: 200,
    },
  },

  // Feature Flags
  features: {
    socialLogin: process.env.FEATURE_SOCIAL_LOGIN === 'true',
    twoFactorAuth: process.env.FEATURE_TWO_FACTOR_AUTH !== 'false', // Default enabled
    emailVerification: process.env.FEATURE_EMAIL_VERIFICATION !== 'false', // Default enabled
    passwordComplexity: process.env.FEATURE_PASSWORD_COMPLEXITY !== 'false', // Default enabled
    sessionManagement: process.env.FEATURE_SESSION_MANAGEMENT !== 'false', // Default enabled
    office365Sso: process.env.FEATURE_OFFICE365_SSO === 'true',
    deviceTrust: process.env.FEATURE_DEVICE_TRUST === 'true',
    riskBasedAuth: process.env.FEATURE_RISK_BASED_AUTH === 'true',
    biometricAuth: process.env.FEATURE_BIOMETRIC_AUTH === 'true',
  },
};

export default config;