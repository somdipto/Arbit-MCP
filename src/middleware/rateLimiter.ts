import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { RateLimitError } from '@/types';
import { securityConfig } from '@/config';

// Create rate limiter instance
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req: Request) => {
    // Use IP address as key, or user ID if authenticated
    return (req as any).user?.id || req.ip;
  },
  points: securityConfig.rateLimitMaxRequests,
  duration: securityConfig.rateLimitWindowMs / 1000, // Convert to seconds
  blockDuration: 60 * 15, // Block for 15 minutes
});

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await rateLimiter.consume((req as any).user?.id || req.ip);
    next();
  } catch (error) {
    if (error instanceof Error) {
      next(new RateLimitError('Rate limit exceeded'));
    } else {
      next(new RateLimitError('Rate limit exceeded'));
    }
  }
};
