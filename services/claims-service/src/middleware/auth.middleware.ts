import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    organizationId: string;
    orgRole: string;
  };
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided'
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token with auth service
    const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      token
    });

    if (response.data.success) {
      (req as AuthRequest).user = response.data.data;
      next();
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}
