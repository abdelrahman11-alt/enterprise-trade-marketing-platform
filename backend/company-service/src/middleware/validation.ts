import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@trade-marketing/shared';

// Zod validation middleware factory
export const validateSchema = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const validatedData = schema.parse(data);
      
      // Replace the original data with validated data
      req[source] = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        return next(new ValidationError('Validation failed', validationErrors));
      }
      
      next(error);
    }
  };
};

// Validate multiple sources
export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: any[] = [];
      
      // Validate body
      if (schemas.body) {
        try {
          req.body = schemas.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              source: 'body',
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })));
          }
        }
      }
      
      // Validate query
      if (schemas.query) {
        try {
          req.query = schemas.query.parse(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              source: 'query',
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })));
          }
        }
      }
      
      // Validate params
      if (schemas.params) {
        try {
          req.params = schemas.params.parse(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              source: 'params',
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })));
          }
        }
      }
      
      if (errors.length > 0) {
        return next(new ValidationError('Validation failed', errors));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};