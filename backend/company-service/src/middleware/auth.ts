import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '@trade-marketing/shared';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    companyId: string;
    roles: string[];
    permissions: string[];
  };
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  
  next();
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