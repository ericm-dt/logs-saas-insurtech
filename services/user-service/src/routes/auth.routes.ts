import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { prisma } from '../config/database';
import logger from '../utils/logger';

const router = Router();

router.post('/organizations', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { name, slug, plan = 'free' } = req.body;
  
  logger.info({ requestId, slug, plan, ip: req.ip }, 'Organization creation requested');
  
  try {
    // Check if slug is already taken
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      logger.warn({ requestId, slug, existingOrgId: existing.id }, 'Organization creation failed - slug already exists');
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
      createdAt: organization.createdAt 
    }, 'Organization created successfully');

    res.status(201).json({ success: true, data: organization });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create organization';
    logger.error({ 
      requestId, 
      slug, 
      error: message, 
      stack: error instanceof Error ? error.stack : undefined 
    }, 'Organization creation failed');
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
    ip: req.ip,
    userAgent: req.get('user-agent')
  }, 'User registration started');
  
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
      userId: result.user.id, 
      email, 
      organizationId,
      role,
      duration,
      hasToken: !!result.token
    }, 'User registered successfully');
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    logger.error({ 
      requestId, 
      email, 
      organizationId, 
      error: message,
      stack: error instanceof Error ? error.stack : undefined
    }, 'User registration failed');
    res.status(400).json({ success: false, message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { email } = req.body;
  
  logger.info({ 
    requestId, 
    email, 
    ip: req.ip, 
    userAgent: req.get('user-agent') 
  }, 'Login attempt started');
  
  try {
    const startTime = Date.now();
    const result = await authService.login(email, req.body.password);
    const duration = Date.now() - startTime;
    
    logger.info({ 
      requestId, 
      userId: result.user.id, 
      email, 
      organizationId: result.user.organizationId,
      role: result.user.role,
      duration,
      ip: req.ip
    }, 'Login successful');
    
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    logger.warn({ 
      requestId, 
      email, 
      reason: message, 
      ip: req.ip,
      userAgent: req.get('user-agent')
    }, 'Login failed');
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
      ip: req.ip 
    }, 'Token verified successfully');
    
    res.json({ success: true, data: payload });
  } catch (error) {
    logger.warn({ 
      requestId, 
      reason: error instanceof Error ? error.message : 'Invalid token', 
      ip: req.ip 
    }, 'Token verification failed');
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ requestId, ip: req.ip }, 'Get current user failed - no token provided');
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
      logger.error({ requestId, userId: payload.userId, email: payload.email }, 'User not found for valid token');
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    logger.debug({ requestId, userId: user.id, email: user.email, organizationId: user.organizationId }, 'Current user retrieved');
    res.json({ success: true, data: user });
  } catch (error) {
    logger.warn({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Invalid token', 
      ip: req.ip 
    }, 'Get current user failed - invalid token');
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
