import winston from 'winston';
import { config } from '../config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define format for console logs in development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${
      info.stack ? '\n' + info.stack : ''
    }${
      info.metadata && Object.keys(info.metadata).length > 0 
        ? '\n' + JSON.stringify(info.metadata, null, 2)
        : ''
    }`
  )
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: config.nodeEnv === 'development' ? consoleFormat : format,
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/combined.log',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create the logger
export const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const logWithContext = (level: string, message: string, context?: any) => {
  logger.log(level, message, { metadata: context });
};

export const logError = (error: Error, context?: any) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    metadata: context,
  });
};

export const logRequest = (req: any, res: any, responseTime?: number) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    userId: req.user?.id,
    companyId: req.user?.companyId,
    requestId: req.headers['x-request-id'],
    responseTime: responseTime ? `${responseTime}ms` : undefined,
  };

  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.http('HTTP Request', logData);
  }
};

export const logPerformance = (operation: string, duration: number, context?: any) => {
  logger.info(`Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    metadata: context,
  });
};

export const logSecurity = (event: string, context?: any) => {
  logger.warn(`Security: ${event}`, {
    event,
    metadata: context,
  });
};

export const logBusiness = (event: string, context?: any) => {
  logger.info(`Business: ${event}`, {
    event,
    metadata: context,
  });
};

// Ensure logs directory exists
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;