import { Router } from 'express';
import { createResilientProxy } from '../services/proxy';
import { authenticate, authorize, optionalAuth, checkLicenseLimit } from '../middleware/auth';
import { authenticatedRateLimit, strictRateLimit, loginRateLimit } from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { LoginSchema, RefreshTokenSchema } from '@trade-marketing/shared';

const router = Router();

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    },
  });
}));

// Authentication routes (proxied to identity service)
router.post('/auth/login', 
  loginRateLimit,
  validateSchema(LoginSchema),
  createResilientProxy('identity-service')
);

router.post('/auth/refresh',
  strictRateLimit,
  validateSchema(RefreshTokenSchema),
  createResilientProxy('identity-service')
);

router.post('/auth/logout',
  authenticate,
  createResilientProxy('identity-service')
);

router.post('/auth/forgot-password',
  strictRateLimit,
  createResilientProxy('identity-service')
);

router.post('/auth/reset-password',
  strictRateLimit,
  createResilientProxy('identity-service')
);

// Company management routes
router.use('/api/companies',
  authenticatedRateLimit,
  authenticate,
  authorize(['company:read']),
  createResilientProxy('company-service')
);

// User management routes
router.use('/api/users',
  authenticatedRateLimit,
  authenticate,
  authorize(['user:read']),
  createResilientProxy('identity-service')
);

// Trade spend management routes
router.use('/api/trade-spend',
  authenticatedRateLimit,
  authenticate,
  authorize(['trade_spend:read']),
  checkLicenseLimit('trade_spend_management'),
  createResilientProxy('trade-marketing-service')
);

// Promotion management routes
router.use('/api/promotions',
  authenticatedRateLimit,
  authenticate,
  authorize(['promotion:read']),
  checkLicenseLimit('promotion_planning'),
  createResilientProxy('trade-marketing-service')
);

// Analytics routes
router.use('/api/analytics',
  authenticatedRateLimit,
  authenticate,
  authorize(['analytics:read']),
  checkLicenseLimit('analytics'),
  createResilientProxy('analytics-service')
);

// Field execution routes
router.use('/api/field-execution',
  authenticatedRateLimit,
  authenticate,
  authorize(['field_execution:read']),
  checkLicenseLimit('field_execution'),
  createResilientProxy('trade-marketing-service')
);

// Supply chain routes
router.use('/api/supply-chain',
  authenticatedRateLimit,
  authenticate,
  authorize(['supply_chain:read']),
  checkLicenseLimit('supply_chain_integration'),
  createResilientProxy('trade-marketing-service')
);

// Financial management routes
router.use('/api/financial',
  authenticatedRateLimit,
  authenticate,
  authorize(['financial:read']),
  checkLicenseLimit('financial_management'),
  createResilientProxy('trade-marketing-service')
);

// AI & ML routes
router.use('/api/ai',
  authenticatedRateLimit,
  authenticate,
  authorize(['ai:read']),
  checkLicenseLimit('ai_analytics'),
  createResilientProxy('analytics-service')
);

// Integration routes
router.use('/api/integrations',
  authenticatedRateLimit,
  authenticate,
  authorize(['integration:read']),
  createResilientProxy('integration-service')
);

// Notification routes
router.use('/api/notifications',
  authenticatedRateLimit,
  authenticate,
  createResilientProxy('notification-service')
);

// File management routes
router.use('/api/files',
  authenticatedRateLimit,
  authenticate,
  createResilientProxy('file-service')
);

// Public routes (no authentication required)
router.use('/api/public',
  optionalAuth,
  createResilientProxy('trade-marketing-service')
);

// Admin routes (super admin only)
router.use('/api/admin',
  authenticatedRateLimit,
  authenticate,
  authorize(['admin:*']),
  createResilientProxy('company-service')
);

// System routes (internal use)
router.use('/api/system',
  strictRateLimit,
  authenticate,
  authorize(['system:*']),
  createResilientProxy('company-service')
);

// Webhook routes (for external integrations)
router.use('/webhooks',
  createResilientProxy('integration-service')
);

// API documentation routes
router.get('/api/docs', (req, res) => {
  res.redirect('/api-docs');
});

export default router;