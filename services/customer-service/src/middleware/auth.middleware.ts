import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token with auth service
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    const response = await axios.post(`${authServiceUrl}/api/auth/verify`, { token });

    if (response.data.success) {
      (req as any).user = response.data.data;
      next();
    } else {
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } catch (error) {
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
}
