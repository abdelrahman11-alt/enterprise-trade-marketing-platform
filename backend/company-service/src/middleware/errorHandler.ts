import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from '@trade-marketing/shared';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  requestId?: string;
  timestamp: string;
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
                   req.headers['x-correlation-id'] as string ||
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log error with context
  const errorContext = {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    userId: (req as any).user?.id,
    companyId: (req as any).user?.companyId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle known error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
    
    // Log level based on status code
    if (statusCode >= 500) {
      logger.error('Application error', { ...errorContext, details });
    } else if (statusCode >= 400) {
      logger.warn('Client error', { ...errorContext, details });
    }
  } else if (error instanceof ValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = error.message;
    details = error.details;
    
    logger.warn('Validation error', { ...errorContext, details });
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = error.message;
    
    logger.warn('Not found error', errorContext);
  } else if (error instanceof UnauthorizedError) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = error.message;
    
    logger.warn('Unauthorized error', errorContext);
  } else if (error instanceof ForbiddenError) {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = error.message;
    
    logger.warn('Forbidden error', errorContext);
  } else {
    // Handle other known error types
    switch (error.name) {
      case 'PrismaClientKnownRequestError':
        const prismaError = error as any;
        if (prismaError.code === 'P2002') {
          statusCode = 409;
          errorCode = 'DUPLICATE_ENTRY';
          message = 'A record with this information already exists';
        } else if (prismaError.code === 'P2025') {
          statusCode = 404;
          errorCode = 'NOT_FOUND';
          message = 'Record not found';
        } else {
          statusCode = 400;
          errorCode = 'DATABASE_ERROR';
          message = 'Database operation failed';
        }
        logger.warn('Prisma error', { ...errorContext, prismaCode: prismaError.code });
        break;
        
      case 'PrismaClientValidationError':
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Invalid data provided';
        logger.warn('Prisma validation error', errorContext);
        break;
        
      case 'SyntaxError':
        if (error.message.includes('JSON')) {
          statusCode = 400;
          errorCode = 'INVALID_JSON';
          message = 'Invalid JSON in request body';
          logger.warn('JSON syntax error', errorContext);
        } else {
          logger.error('Syntax error', errorContext);
        }
        break;
        
      default:
        logger.error('Unhandled error', errorContext);
    }
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details && { details }),
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    },
    requestId,
    timestamp: new Date().toISOString(),
  };

  // Set security headers for error responses
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  });

  res.status(statusCode).json(errorResponse);
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global uncaught exception handler
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
    
    // Graceful shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.toString(),
      stack: reason?.stack,
      promise: promise.toString(),
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};