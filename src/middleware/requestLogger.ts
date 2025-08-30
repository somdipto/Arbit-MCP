import { Request, Response, NextFunction } from 'express';
import { logApiRequest } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate request ID
  const requestId = uuidv4();
  (req as any).requestId = requestId;

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Record start time
  const startTime = Date.now();

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const userId = (req as any).user?.id;

    // Log the request
    logApiRequest(
      req.method,
      req.path,
      res.statusCode,
      duration,
      userId
    );

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};
