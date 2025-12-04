import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { prisma } from '../config/database';
import logger from '../utils/logger';

const router = Router();

router.post('/organizations', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { name, slug, plan = 'free' } = req.body;
  
  logger.info('Organization creation requested', { requestId, slug, plan, ip: req.ip });
  
  try {
    // Check if slug is already taken
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      logger.warn('Organization creation failed - slug already exists', { requestId, slug, existingOrgId: existing.id });
      res.status(400).json({ success: false, message: 'Organization slug already exists' });
      return;
    }

    const organization = await prisma.organization.create({
      data: { name, slug, plan }
    });

    logger.info('Organization created successfully', { 
      requestId, 
      organizationId: organization.id, 
      slug, 
      plan,
      createdAt: organization.createdAt 
    });

    res.status(201).json({ success: true, data: organization });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create organization';
    logger.error('Organization creation failed', { 
      requestId, 
      slug, 
      error: message, 
      stack: error instanceof Error ? error.stack : undefined 
    });
    res.status(400).json({ success: false, message });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { email, firstName, lastName, organizationId, role, orgRole } = req.body;
  
  logger.info('User registration started', { 
    requestId, 
    email, 
    organizationId, 
    role, 
    orgRole,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
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
    
    logger.info('User registered successfully', { 
      requestId, 
      userId: result.user.id, 
      email, 
      organizationId,
      role,
      duration,
      hasToken: !!result.token
    });
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    logger.error('User registration failed', { 
      requestId, 
      email, 
      organizationId, 
      error: message,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(400).json({ success: false, message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { email } = req.body;
  
  logger.info('Login attempt started', { 
    requestId, 
    email, 
    ip: req.ip, 
    userAgent: req.get('user-agent') 
  });
  
  try {
    const startTime = Date.now();
    const result = await authService.login(email, req.body.password);
    const duration = Date.now() - startTime;
    
    logger.info('Login successful', { 
      requestId, 
      userId: result.user.id, 
      email, 
      organizationId: result.user.organizationId,
      role: result.user.role,
      duration,
      ip: req.ip
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    logger.warn('Login failed', { 
      requestId, 
      email, 
      reason: message, 
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(401).json({ success: false, message });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { token } = req.body;
    const payload = authService.verifyToken(token);
    
    logger.debug('Token verified successfully', { 
      requestId, 
      userId: payload.userId, 
      email: payload.email,
      ip: req.ip 
    });
    
    res.json({ success: true, data: payload });
  } catch (error) {
    logger.warn('Token verification failed', { 
      requestId, 
      reason: error instanceof Error ? error.message : 'Invalid token', 
      ip: req.ip 
    });
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Get current user failed - no token provided', { requestId, ip: req.ip });
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
      logger.error('User not found for valid token', { requestId, userId: payload.userId, email: payload.email });
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    logger.debug('Current user retrieved', { requestId, userId: user.id, email: user.email, organizationId: user.organizationId });
    res.json({ success: true, data: user });
  } catch (error) {
    logger.warn('Get current user failed - invalid token', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Invalid token', 
      ip: req.ip 
    });
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
