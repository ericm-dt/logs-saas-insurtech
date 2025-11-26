import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { prisma } from '../config/database';

const router = Router();

router.post('/organizations', async (req: Request, res: Response) => {
  try {
    const { name, slug, plan = 'free' } = req.body;
    
    // Check if slug is already taken
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Organization slug already exists' });
      return;
    }

    const organization = await prisma.organization.create({
      data: { name, slug, plan }
    });

    res.status(201).json({ success: true, data: organization });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create organization';
    res.status(400).json({ success: false, message });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, organizationId, role, orgRole } = req.body;
    const result = await authService.register(
      email, 
      password, 
      firstName, 
      lastName, 
      organizationId,
      role,
      orgRole
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    res.status(400).json({ success: false, message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    res.status(401).json({ success: false, message });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const payload = authService.verifyToken(token);
    res.json({ success: true, data: payload });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
