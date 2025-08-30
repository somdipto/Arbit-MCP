import winston from 'winston';
import { loggingConfig } from '@/config';
import { LogLevel } from '@/types';

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: loggingConfig.level,
  format: logFormat,
  defaultMeta: {
    service: 'csab',
    version: '1.0.0'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for production
    new winston.transports.File({
      filename: loggingConfig.filePath,
      maxsize: loggingConfig.maxSize,
      maxFiles: loggingConfig.maxFiles,
      format: logFormat
    })
  ]
});

// Add request context to logger
export const createRequestLogger = (requestId: string, userId?: string) => {
  return logger.child({
    requestId,
    userId,
    context: 'request'
  });
};

// Add service context to logger
export const createServiceLogger = (serviceName: string) => {
  return logger.child({
    service: serviceName,
    context: 'service'
  });
};

// Add component context to logger
export const createComponentLogger = (componentName: string) => {
  return logger.child({
    component: componentName,
    context: 'component'
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info('Performance metric', {
    operation,
    duration,
    unit: 'ms',
    ...metadata
  });
};

// Error logging with context
export const logError = (error: Error, context?: any) => {
  logger.error('Application error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context
  });
};

// Security event logging
export const logSecurityEvent = (event: string, details: any) => {
  logger.warn('Security event', {
    event,
    details,
    context: 'security'
  });
};

// Trade execution logging
export const logTradeExecution = (tradeId: string, action: string, details: any) => {
  logger.info('Trade execution', {
    tradeId,
    action,
    details,
    context: 'trade'
  });
};

// Opportunity detection logging
export const logOpportunityDetection = (opportunityId: string, details: any) => {
  logger.info('Opportunity detected', {
    opportunityId,
    details,
    context: 'opportunity'
  });
};

// System health logging
export const logSystemHealth = (component: string, status: 'healthy' | 'degraded' | 'unhealthy', details?: any) => {
  const level = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';
  logger[level]('System health check', {
    component,
    status,
    details,
    context: 'health'
  });
};

// Database operation logging
export const logDatabaseOperation = (operation: string, table: string, duration: number, details?: any) => {
  logger.debug('Database operation', {
    operation,
    table,
    duration,
    unit: 'ms',
    details,
    context: 'database'
  });
};

// API request logging
export const logApiRequest = (method: string, path: string, statusCode: number, duration: number, userId?: string) => {
  const level = statusCode >= 400 ? 'warn' : 'info';
  logger[level]('API request', {
    method,
    path,
    statusCode,
    duration,
    unit: 'ms',
    userId,
    context: 'api'
  });
};

// MCP interaction logging
export const logMCPInteraction = (modelId: string, action: string, duration: number, details?: any) => {
  logger.info('MCP interaction', {
    modelId,
    action,
    duration,
    unit: 'ms',
    details,
    context: 'mcp'
  });
};

// Price update logging
export const logPriceUpdate = (exchange: string, tokenPair: string, price: number, details?: any) => {
  logger.debug('Price update', {
    exchange,
    tokenPair,
    price,
    details,
    context: 'price'
  });
};

// Alert logging
export const logAlert = (alertType: string, userId: string, details: any) => {
  logger.info('Alert generated', {
    alertType,
    userId,
    details,
    context: 'alert'
  });
};

// Export default logger
export { logger };

// Export log levels for type safety
export { LogLevel };
