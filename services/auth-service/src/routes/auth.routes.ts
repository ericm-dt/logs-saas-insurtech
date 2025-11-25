import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    const result = await authService.register(email, password, firstName, lastName, role);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const payload = authService.verifyToken(token);
    res.json({ success: true, data: payload });
  } catch (error: any) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
