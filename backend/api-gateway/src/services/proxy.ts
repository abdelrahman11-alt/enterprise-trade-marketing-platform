import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// Service discovery and load balancing
class ServiceRegistry {
  private services: Map<string, string[]> = new Map();

  registerService(name: string, url: string): void {
    if (!this.services.has(name)) {
      this.services.set(name, []);
    }
    
    const urls = this.services.get(name)!;
    if (!urls.includes(url)) {
      urls.push(url);
      logger.info(`Service registered: ${name} -> ${url}`);
    }
  }

  unregisterService(name: string, url: string): void {
    const urls = this.services.get(name);
    if (urls) {
      const index = urls.indexOf(url);
      if (index > -1) {
        urls.splice(index, 1);
        logger.info(`Service unregistered: ${name} -> ${url}`);
      }
    }
  }

  getServiceUrl(name: string): string | null {
    const urls = this.services.get(name);
    if (!urls || urls.length === 0) {
      return null;
    }
    
    // Simple round-robin load balancing
    const url = urls[Math.floor(Math.random() * urls.length)];
    return url;
  }

  getServiceUrls(name: string): string[] {
    return this.services.get(name) || [];
  }

  getAllServices(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    this.services.forEach((urls, name) => {
      result[name] = [...urls];
    });
    return result;
  }
}

export const serviceRegistry = new ServiceRegistry();

// Initialize service registry with default services
serviceRegistry.registerService('company-service', config.services.companyService.url);
serviceRegistry.registerService('identity-service', config.services.identityService.url);
serviceRegistry.registerService('trade-marketing-service', config.services.tradeMarketingService.url);
serviceRegistry.registerService('analytics-service', config.services.analyticsService.url);
serviceRegistry.registerService('integration-service', config.services.integrationService.url);
serviceRegistry.registerService('notification-service', config.services.notificationService.url);
serviceRegistry.registerService('file-service', config.services.fileService.url);

// Create proxy middleware for each service
export const createServiceProxy = (serviceName: string, options: Partial<Options> = {}) => {
  const defaultOptions: Options = {
    target: '', // Will be set dynamically
    changeOrigin: true,
    timeout: config.services.companyService.timeout,
    proxyTimeout: config.services.companyService.timeout,
    
    // Dynamic target resolution
    router: (req: Request) => {
      const serviceUrl = serviceRegistry.getServiceUrl(serviceName);
      if (!serviceUrl) {
        logger.error(`Service not available: ${serviceName}`);
        throw new Error(`Service ${serviceName} is not available`);
      }
      return serviceUrl;
    },

    // Add authentication headers
    onProxyReq: (proxyReq, req: AuthenticatedRequest, res: Response) => {
      // Forward authentication token
      const authHeader = req.headers.authorization;
      if (authHeader) {
        proxyReq.setHeader('Authorization', authHeader);
      }

      // Add user context headers
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id);
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-Company-Id', req.user.companyId);
        proxyReq.setHeader('X-User-Roles', JSON.stringify(req.user.roles));
        proxyReq.setHeader('X-User-Permissions', JSON.stringify(req.user.permissions));
        proxyReq.setHeader('X-License-Type', req.user.licenseType);
      }

      // Add request tracking headers
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      proxyReq.setHeader('X-Request-Id', requestId);
      proxyReq.setHeader('X-Forwarded-For', req.ip);
      proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
      proxyReq.setHeader('X-Forwarded-Host', req.get('host') || '');

      // Log proxy request
      logger.debug(`Proxying request to ${serviceName}`, {
        method: req.method,
        url: req.url,
        target: proxyReq.getHeader('host'),
        userId: req.user?.id,
        requestId,
      });
    },

    // Handle proxy response
    onProxyRes: (proxyRes, req: Request, res: Response) => {
      // Add CORS headers
      proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
      proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';

      // Log proxy response
      logger.debug(`Proxy response from ${serviceName}`, {
        statusCode: proxyRes.statusCode,
        method: req.method,
        url: req.url,
        requestId: req.headers['x-request-id'],
      });
    },

    // Handle proxy errors
    onError: (err, req: Request, res: Response) => {
      logger.error(`Proxy error for ${serviceName}`, {
        error: err.message,
        method: req.method,
        url: req.url,
        requestId: req.headers['x-request-id'],
      });

      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: `Service ${serviceName} is temporarily unavailable`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    },

    // Custom log provider
    logProvider: () => ({
      log: logger.debug.bind(logger),
      debug: logger.debug.bind(logger),
      info: logger.info.bind(logger),
      warn: logger.warn.bind(logger),
      error: logger.error.bind(logger),
    }),

    ...options,
  };

  return createProxyMiddleware(defaultOptions);
};

// Health check for services
export const checkServiceHealth = async (serviceName: string): Promise<boolean> => {
  const serviceUrl = serviceRegistry.getServiceUrl(serviceName);
  if (!serviceUrl) {
    return false;
  }

  try {
    const response = await fetch(`${serviceUrl}/health`, {
      method: 'GET',
      timeout: 5000,
    });
    return response.ok;
  } catch (error) {
    logger.warn(`Health check failed for ${serviceName}`, {
      serviceUrl,
      error: (error as Error).message,
    });
    return false;
  }
};

// Circuit breaker implementation
class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 1 minute

  isServiceAvailable(serviceName: string): boolean {
    const failures = this.failures.get(serviceName) || 0;
    const lastFailure = this.lastFailureTime.get(serviceName) || 0;
    
    if (failures >= this.failureThreshold) {
      const timeSinceLastFailure = Date.now() - lastFailure;
      if (timeSinceLastFailure < this.recoveryTimeout) {
        return false; // Circuit is open
      } else {
        // Reset circuit breaker
        this.failures.set(serviceName, 0);
        this.lastFailureTime.delete(serviceName);
      }
    }
    
    return true;
  }

  recordFailure(serviceName: string): void {
    const failures = (this.failures.get(serviceName) || 0) + 1;
    this.failures.set(serviceName, failures);
    this.lastFailureTime.set(serviceName, Date.now());
    
    if (failures >= this.failureThreshold) {
      logger.warn(`Circuit breaker opened for ${serviceName}`, {
        failures,
        threshold: this.failureThreshold,
      });
    }
  }

  recordSuccess(serviceName: string): void {
    this.failures.set(serviceName, 0);
    this.lastFailureTime.delete(serviceName);
  }

  getStatus(): Record<string, { failures: number; isOpen: boolean }> {
    const status: Record<string, { failures: number; isOpen: boolean }> = {};
    
    this.failures.forEach((failures, serviceName) => {
      status[serviceName] = {
        failures,
        isOpen: !this.isServiceAvailable(serviceName),
      };
    });
    
    return status;
  }
}

export const circuitBreaker = new CircuitBreaker();

// Enhanced proxy with circuit breaker
export const createResilientProxy = (serviceName: string, options: Partial<Options> = {}) => {
  const proxy = createServiceProxy(serviceName, {
    ...options,
    onError: (err, req: Request, res: Response) => {
      circuitBreaker.recordFailure(serviceName);
      
      if (options.onError) {
        options.onError(err, req, res);
      } else {
        logger.error(`Resilient proxy error for ${serviceName}`, {
          error: err.message,
          method: req.method,
          url: req.url,
          requestId: req.headers['x-request-id'],
        });

        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: `Service ${serviceName} is temporarily unavailable`,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    },
    onProxyRes: (proxyRes, req: Request, res: Response) => {
      if (proxyRes.statusCode < 500) {
        circuitBreaker.recordSuccess(serviceName);
      }
      
      if (options.onProxyRes) {
        options.onProxyRes(proxyRes, req, res);
      }
    },
  });

  // Wrap proxy with circuit breaker check
  return (req: Request, res: Response, next: any) => {
    if (!circuitBreaker.isServiceAvailable(serviceName)) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_CIRCUIT_OPEN',
          message: `Service ${serviceName} is temporarily unavailable due to repeated failures`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    return proxy(req, res, next);
  };
};