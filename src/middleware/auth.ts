import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from '@/types';
import { jwtConfig } from '@/config';
import { getRepository } from '@/config/database';
import { User, UserSession } from '@/models';
import { logSecurityEvent } from '@/utils/logger';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, jwtConfig.secret) as any;
    
    // Check if session exists and is active
    const session = await getRepository(UserSession).findOne({
      where: {
        token,
        isActive: true,
        expiresAt: { $gt: new Date() } as any
      },
      relations: ['user']
    });

    if (!session || !session.user) {
      throw new AuthenticationError('Invalid or expired session');
    }

    // Check if user is active
    if (!session.user.isActive) {
      throw new AuthenticationError('User account is deactivated');
    }

    // Attach user to request
    (req as any).user = session.user;
    (req as any).session = session;

    next();

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logSecurityEvent('invalid_token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      next(new AuthenticationError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      logSecurityEvent('expired_token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      next(new AuthenticationError('Authentication required'));
      return;
    }

    if (!roles.includes(user.role)) {
      logSecurityEvent('unauthorized_access', {
        userId: user.id,
        userRole: user.role,
        requiredRoles: roles,
        path: req.path,
        ip: req.ip
      });
      next(new AuthorizationError('Insufficient permissions'));
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(['administrator']);
export const requireTrader = requireRole(['administrator', 'trader']);
export const requireAnalyst = requireRole(['administrator', 'trader', 'analyst']);

/**
 * Extract token from request headers or query parameters
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query parameter
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  // Check cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

/**
 * Optional authentication middleware
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = jwt.verify(token, jwtConfig.secret) as any;
      
      const session = await getRepository(UserSession).findOne({
        where: {
          token,
          isActive: true,
          expiresAt: { $gt: new Date() } as any
        },
        relations: ['user']
      });

      if (session && session.user && session.user.isActive) {
        (req as any).user = session.user;
        (req as any).session = session;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
