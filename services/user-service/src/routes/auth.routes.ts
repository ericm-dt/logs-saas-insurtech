import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { prisma } from '../config/database';
import logger from '../utils/logger';

const router = Router();

router.post('/organizations', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { name, slug, plan = 'free' } = req.body;
  
  logger.info({ 
    requestId, 
    slug, 
    plan, 
    organizationName: name,
    operation: 'organization.create',
    ip: req.ip,
    userAgent: req.get('user-agent')
  }, 'Organization creation requested');
  
  try {
    // Check if slug is already taken
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      logger.warn({ 
        requestId, 
        slug, 
        existingOrgId: existing.id,
        existingOrgName: existing.name,
        operation: 'organization.create.duplicate',
        attemptedName: name,
        ip: req.ip
      }, 'Organization creation failed - slug already exists in system');
      res.status(400).json({ success: false, message: 'Organization slug already exists' });
      return;
    }

    const organization = await prisma.organization.create({
      data: { name, slug, plan }
    });

    logger.info({ 
      requestId, 
      organizationId: organization.id, 
      slug, 
      plan,
      organizationName: organization.name,
      createdAt: organization.createdAt,
      operation: 'organization.create.success',
      organization: {
        id: organization.id,
        name: organization.name,
        slug,
        plan,
        status: organization.status
      }
    }, 'Organization created successfully - ready for user registration');

    res.status(201).json({ success: true, data: organization });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create organization';
    logger.error({ 
      requestId, 
      slug, 
      attemptedName: name,
      operation: 'organization.create.error',
      error: {
        message: message,
        stack: error instanceof Error ? error.stack : undefined
      },
      ip: req.ip
    }, 'Organization creation failed unexpectedly');
    res.status(400).json({ success: false, message });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { email, firstName, lastName, organizationId, role, orgRole } = req.body;
  
  logger.info({ 
    requestId, 
    email, 
    organizationId, 
    role, 
    orgRole,
    operation: 'user.register',
    userDetails: {
      email,
      firstName,
      lastName,
      role,
      orgRole
    },
    ip: req.ip,
    userAgent: req.get('user-agent')
  }, 'User registration initiated');
  
  try {
    const startTime = Date.now();
    const result = await authService.register(
      email, 
      req.body.password, 
      firstName, 
      lastName, 
      organizationId,
      role,
      orgRole
    );
    const duration = Date.now() - startTime;
    
    logger.info({ 
      requestId, 
      duration,
      hasToken: !!result.token,
      operation: 'user.register.success',
      user: {
        id: result.user.id,
        email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role,
        orgRole,
        organizationId
      },
      performance: {
        registrationTimeMs: duration,
        passwordHashingIncluded: true
      }
    }, 'User registered successfully - account created with authentication token');
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    logger.error({ 
      requestId, 
      email, 
      organizationId, 
      attemptedRole: role,
      operation: 'user.register.error',
      error: {
        message: message,
        stack: error instanceof Error ? error.stack : undefined
      },
      ip: req.ip
    }, 'User registration failed unexpectedly');
    res.status(400).json({ success: false, message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { email } = req.body;
  
  logger.info({ 
    requestId, 
    email, 
    operation: 'auth.login.attempt',
    ip: req.ip, 
    userAgent: req.get('user-agent')
  }, 'User login attempt initiated');
  
  try {
    const startTime = Date.now();
    const result = await authService.login(email, req.body.password);
    const duration = Date.now() - startTime;
    
    logger.info({ 
      requestId, 
      duration,
      ip: req.ip,
      operation: 'auth.login.success',
      user: {
        id: result.user.id,
        email,
        organizationId: result.user.organizationId,
        role: result.user.role,
        orgRole: result.user.orgRole
      },
      performance: {
        loginTimeMs: duration,
        passwordVerificationIncluded: true
      },
      security: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')?.substring(0, 100)
      }
    }, 'User login successful - authentication token issued');
    
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    logger.warn({ 
      requestId, 
      email, 
      reason: message, 
      ip: req.ip,
      userAgent: req.get('user-agent'),
      operation: 'auth.login.failed',
      failureType: message.includes('Invalid') ? 'invalid_credentials' : 'other'
    }, 'User login failed - authentication rejected');
    res.status(401).json({ success: false, message });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { token } = req.body;
    const payload = authService.verifyToken(token);
    
    logger.debug({ 
      requestId, 
      userId: payload.userId, 
      email: payload.email,
      organizationId: payload.organizationId,
      operation: 'auth.verify_token.success',
      tokenPayload: {
        userId: payload.userId,
        email: payload.email,
        organizationId: payload.organizationId,
        role: payload.role
      },
      ip: req.ip
    }, 'JWT token verified successfully');
    
    res.json({ success: true, data: payload });
  } catch (error) {
    logger.warn({ 
      requestId, 
      reason: error instanceof Error ? error.message : 'Invalid token', 
      operation: 'auth.verify_token.failed',
      errorType: error instanceof Error ? error.name : 'TokenError',
      ip: req.ip
    }, 'JWT token verification failed - invalid or expired token');
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ 
        requestId, 
        operation: 'user.get_current.no_token',
        endpoint: '/auth/me',
        ip: req.ip
      }, 'Get current user failed - no authentication token provided');
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = authService.verifyToken(token);
    
    const user = await prisma.user.findUnique({ 
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        orgRole: true,
        organizationId: true,
        dateOfBirth: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      logger.error({ 
        requestId, 
        userId: payload.userId, 
        email: payload.email,
        operation: 'user.get_current.not_found',
        issue: 'valid_token_but_user_deleted',
        ip: req.ip
      }, 'INCONSISTENCY - User not found for valid JWT token (possible data integrity issue)');
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    logger.debug({ 
      requestId, 
      userId: user.id, 
      email: user.email, 
      organizationId: user.organizationId,
      operation: 'user.get_current.success',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        orgRole: user.orgRole,
        organizationId: user.organizationId
      }
    }, 'Current user profile retrieved successfully');
    res.json({ success: true, data: user });
  } catch (error) {
    logger.warn({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Invalid token', 
      operation: 'user.get_current.invalid_token',
      errorType: error instanceof Error ? error.name : 'TokenError',
      ip: req.ip
    }, 'Get current user failed - JWT token is invalid or expired');
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
