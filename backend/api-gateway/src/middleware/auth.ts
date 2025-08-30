import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { redisClient } from '../services/redis';
import { UnauthorizedError, ForbiddenError } from '@trade-marketing/shared';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    companyId: string;
    roles: string[];
    permissions: string[];
    licenseType: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }
    
    const token = authHeader.substring(7);
    
    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // Check if user session exists in Redis
    const userSession = await redisClient.get(`session:${decoded.userId}`);
    if (!userSession) {
      throw new UnauthorizedError('Session expired');
    }
    
    const sessionData = JSON.parse(userSession);
    
    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      companyId: decoded.companyId,
      roles: sessionData.roles || [],
      permissions: sessionData.permissions || [],
      licenseType: sessionData.licenseType || 'named_user',
    };
    
    // Update last activity
    await redisClient.setex(
      `session:${decoded.userId}`,
      config.redis.defaultTTL,
      JSON.stringify({
        ...sessionData,
        lastActivity: new Date().toISOString(),
      })
    );
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

export const authorize = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    const userPermissions = req.user.permissions;
    
    // Check if user has all required permissions
    const hasPermission = requiredPermissions.every(permission => {
      // Support wildcard permissions (e.g., 'user:*' matches 'user:read', 'user:write')
      return userPermissions.some(userPerm => {
        if (userPerm.endsWith(':*')) {
          const basePermission = userPerm.slice(0, -2);
          return permission.startsWith(basePermission);
        }
        return userPerm === permission;
      });
    });
    
    if (!hasPermission) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    
    next();
  };
};

export const requireCompanyAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  
  const companyId = req.headers['x-company-id'] as string || req.params.companyId || req.body.companyId;
  
  if (!companyId) {
    return next(new ForbiddenError('Company ID required'));
  }
  
  // For now, we'll allow access if the user has a companyId
  // In a full implementation, we'd check if the user has access to the specific company
  if (req.user.companyId !== companyId) {
    return next(new ForbiddenError('Access denied to this company'));
  }
  
  next();
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    
    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next();
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // Check if user session exists in Redis
    const userSession = await redisClient.get(`session:${decoded.userId}`);
    if (!userSession) {
      return next();
    }
    
    const sessionData = JSON.parse(userSession);
    
    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      companyId: decoded.companyId,
      roles: sessionData.roles || [],
      permissions: sessionData.permissions || [],
      licenseType: sessionData.licenseType || 'named_user',
    };
    
    next();
  } catch (error) {
    // If optional auth fails, just continue without user info
    next();
  }
};

export const checkLicenseLimit = (feature: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    try {
      // Check if user's license includes the required feature
      const userSession = await redisClient.get(`session:${req.user.id}`);
      if (!userSession) {
        return next(new UnauthorizedError('Session expired'));
      }
      
      const sessionData = JSON.parse(userSession);
      const licenseFeatures = sessionData.licenseFeatures || [];
      
      if (!licenseFeatures.includes(feature) && !licenseFeatures.includes('all_features')) {
        return next(new ForbiddenError(`Feature '${feature}' not available in your license`));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};