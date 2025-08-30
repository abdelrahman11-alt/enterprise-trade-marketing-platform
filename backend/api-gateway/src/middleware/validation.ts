import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@trade-marketing/shared';

// Express-validator middleware
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));
    
    return next(new ValidationError('Validation failed', validationErrors));
  }
  
  next();
};

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

// Sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Recursively sanitize strings in an object
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// File validation middleware
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = req.file;
    const files = req.files;
    
    if (options.required && !file && (!files || (Array.isArray(files) && files.length === 0))) {
      return next(new ValidationError('File is required'));
    }
    
    if (!file && !files) {
      return next();
    }
    
    const validateSingleFile = (fileToValidate: Express.Multer.File) => {
      // Check file size
      if (options.maxSize && fileToValidate.size > options.maxSize) {
        throw new ValidationError(`File size exceeds maximum allowed size of ${options.maxSize} bytes`);
      }
      
      // Check file type
      if (options.allowedTypes && !options.allowedTypes.includes(fileToValidate.mimetype)) {
        throw new ValidationError(`File type ${fileToValidate.mimetype} is not allowed`);
      }
    };
    
    try {
      if (file) {
        validateSingleFile(file);
      }
      
      if (files) {
        if (Array.isArray(files)) {
          files.forEach(validateSingleFile);
        } else {
          Object.values(files).flat().forEach(validateSingleFile);
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Custom validation middleware factory
export const customValidation = (
  validator: (req: Request) => Promise<void> | void
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await validator(req);
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Conditional validation
export const conditionalValidation = (
  condition: (req: Request) => boolean,
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!condition(req)) {
      return next();
    }
    
    return validateSchema(schema, source)(req, res, next);
  };
};