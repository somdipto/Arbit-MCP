import { Request, Response, NextFunction } from 'express';
import { CSAABError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, RateLimitError } from '@/types';
import { logger, logError } from '@/utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logError(error, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id
  });

  // Handle known application errors
  if (error instanceof CSAABError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle validation errors
  if (error instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
      details: error.context,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle authentication errors
  if (error instanceof AuthenticationError) {
    res.status(401).json({
      success: false,
      error: error.message,
      code: 'AUTHENTICATION_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle authorization errors
  if (error instanceof AuthorizationError) {
    res.status(403).json({
      success: false,
      error: error.message,
      code: 'AUTHORIZATION_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle not found errors
  if (error instanceof NotFoundError) {
    res.status(404).json({
      success: false,
      error: error.message,
      code: 'NOT_FOUND_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle rate limit errors
  if (error instanceof RateLimitError) {
    res.status(429).json({
      success: false,
      error: error.message,
      code: 'RATE_LIMIT_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle database errors
  if (error.name === 'QueryFailedError' || error.name === 'EntityNotFoundError') {
    res.status(400).json({
      success: false,
      error: 'Database operation failed',
      code: 'DATABASE_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'JWT_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'JWT_EXPIRED',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle validation errors from libraries
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: (error as any).details,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle network errors
  if (error.name === 'NetworkError' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'NETWORK_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle timeout errors
  if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
    res.status(408).json({
      success: false,
      error: 'Request timeout',
      code: 'TIMEOUT_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Default error handler
  const statusCode = (error as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    }),
    timestamp: new Date().toISOString()
  });
};
