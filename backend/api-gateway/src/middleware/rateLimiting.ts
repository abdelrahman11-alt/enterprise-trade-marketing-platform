import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config';
import { redisClient } from '../services/redis';
import { AuthenticatedRequest } from './auth';

// Custom key generator that considers user tier
const keyGenerator = (req: AuthenticatedRequest): string => {
  if (req.user) {
    return `rate_limit:user:${req.user.id}`;
  }
  return `rate_limit:ip:${req.ip}`;
};

// Custom rate limit handler
const rateLimitHandler = (req: Request, res: Response): void => {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      retryAfter: Math.round(req.rateLimit?.resetTime || Date.now() / 1000),
    },
  });
};

// Skip function for certain endpoints
const skipSuccessfulRequests = (req: Request, res: Response): boolean => {
  // Skip rate limiting for successful requests to health check endpoints
  return req.path === '/health' && res.statusCode < 400;
};

// Default rate limiter for unauthenticated requests
export const defaultRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip,
  skip: skipSuccessfulRequests,
});

// Authenticated user rate limiter with tier-based limits
export const authenticatedRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: async (req: AuthenticatedRequest) => {
    if (!req.user) {
      return config.rateLimit.max;
    }
    
    try {
      // Get user's license tier from session
      const userSession = await redisClient.get(`session:${req.user.id}`);
      if (!userSession) {
        return config.rateLimit.max;
      }
      
      const sessionData = JSON.parse(userSession);
      const licenseEdition = sessionData.licenseEdition || 'starter';
      
      switch (licenseEdition) {
        case 'enterprise':
        case 'platform':
          return config.rateLimit.enterpriseTier.max;
        case 'professional':
          return config.rateLimit.premiumTier.max;
        default:
          return config.rateLimit.standardTier.max;
      }
    } catch (error) {
      console.error('Error determining rate limit:', error);
      return config.rateLimit.max;
    }
  },
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: skipSuccessfulRequests,
});

// Strict rate limiter for sensitive endpoints
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each user to 5 requests per windowMs
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

// Login rate limiter
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `login:${req.ip}`,
  skipSuccessfulRequests: true,
});

// Password reset rate limiter
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset attempts per hour
  message: {
    success: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `password_reset:${req.ip}`,
});

// File upload rate limiter
export const fileUploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each user to 20 file uploads per windowMs
  message: {
    success: false,
    error: {
      code: 'FILE_UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Too many file uploads, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

// API key rate limiter for external integrations
export const apiKeyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for API keys
  message: {
    success: false,
    error: {
      code: 'API_KEY_RATE_LIMIT_EXCEEDED',
      message: 'API key rate limit exceeded, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const apiKey = req.headers['x-api-key'] as string;
    return apiKey ? `api_key:${apiKey}` : `ip:${req.ip}`;
  },
});

// Custom rate limiter factory
export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: any;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request, res: Response) => boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.max,
    message: options.message || rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || keyGenerator,
    skip: options.skip || skipSuccessfulRequests,
  });
};