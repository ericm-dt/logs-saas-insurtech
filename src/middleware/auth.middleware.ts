import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../types/express.types';
import { ApiError, sendError } from '../utils/response';
import { UserRole } from '../types/auth.types';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'No token provided');
    }

    const token = authHeader.substring(7);
    const payload = authService.verifyToken(token);

    (req as AuthRequest).user = payload;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      sendError(res, error.message, error.statusCode);
    } else {
      sendError(res, 'Authentication failed', 401);
    }
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (!roles.includes(authReq.user.role)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }

    next();
  };
};
