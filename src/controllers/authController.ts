import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getRepository } from '@/config/database';
import { User, UserSession } from '@/models';
import { UserRole, ValidationError, AuthenticationError } from '@/types';
import { jwtConfig, securityConfig } from '@/config';
import { logSecurityEvent } from '@/utils/logger';
import Joi from 'joi';

const router = Router();

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid(...Object.values(UserRole)).default(UserRole.TRADER)
});

/**
 * User registration
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { username, email, password, role } = value;

    // Check if user already exists
    const userRepository = getRepository(User);
    const existingUser = await userRepository.findOne({
      where: [{ username }, { email }]
    });

    if (existingUser) {
      throw new ValidationError('Username or email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, securityConfig.bcryptRounds);

    // Create user
    const user = new User();
    user.username = username;
    user.email = email;
    user.passwordHash = passwordHash;
    user.role = role;
    user.isActive = true;

    await userRepository.save(user);

    // Create session
    const session = await createUserSession(user, req.ip, req.get('User-Agent') || '');

    logSecurityEvent('user_registered', {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    });
  }
});

/**
 * User login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { username, password } = value;

    // Find user
    const userRepository = getRepository(User);
    const user = await userRepository.findOne({
      where: [
        { username },
        { email: username }
      ]
    });

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      logSecurityEvent('failed_login', {
        username,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      throw new AuthenticationError('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    await userRepository.save(user);

    // Create session
    const session = await createUserSession(user, req.ip, req.get('User-Agent') || '');

    logSecurityEvent('user_login', {
      userId: user.id,
      username: user.username,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    });
  }
});

/**
 * Refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Find session by refresh token
    const sessionRepository = getRepository(UserSession);
    const session = await sessionRepository.findOne({
      where: {
        refreshToken,
        isActive: true,
        expiresAt: { $gt: new Date() } as any
      },
      relations: ['user']
    });

    if (!session || !session.user) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if user is still active
    if (!session.user.isActive) {
      throw new AuthenticationError('User account is deactivated');
    }

    // Create new session
    const newSession = await createUserSession(session.user, req.ip, req.get('User-Agent') || '');

    // Deactivate old session
    session.isActive = false;
    session.revokedAt = new Date();
    await sessionRepository.save(session);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newSession.token,
        refreshToken: newSession.refreshToken,
        expiresAt: newSession.expiresAt
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed'
    });
  }
});

/**
 * Logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const sessionRepository = getRepository(UserSession);
      const session = await sessionRepository.findOne({
        where: { token }
      });

      if (session) {
        session.isActive = false;
        session.revokedAt = new Date();
        await sessionRepository.save(session);

        logSecurityEvent('user_logout', {
          userId: session.userId,
          ip: req.ip
        });
      }
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * Get current user profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get profile'
    });
  }
});

/**
 * Create user session
 */
async function createUserSession(
  user: User,
  ipAddress: string,
  userAgent: string
): Promise<UserSession> {
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    jwtConfig.secret,
    { expiresIn: jwtConfig.refreshExpiresIn }
  );

  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + getJwtExpirationTime(jwtConfig.expiresIn));

  const session = new UserSession();
  session.userId = user.id;
  session.token = token;
  session.refreshToken = refreshToken;
  session.expiresAt = expiresAt;
  session.ipAddress = ipAddress;
  session.userAgent = userAgent;
  session.isActive = true;

  const sessionRepository = getRepository(UserSession);
  return await sessionRepository.save(session);
}

/**
 * Get JWT expiration time in milliseconds
 */
function getJwtExpirationTime(expiresIn: string): number {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1));

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000; // Default to 24 hours
  }
}

export { router as authRoutes };
