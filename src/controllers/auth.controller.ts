import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess, sendError, ApiError } from '../utils/response';
import { UserRole } from '../types/auth.types';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      if (!email || !password || !firstName || !lastName) {
        sendError(res, 'Missing required fields', 400);
        return;
      }

      const result = await authService.register(
        email,
        password,
        firstName,
        lastName,
        role || UserRole.CUSTOMER
      );

      sendSuccess(res, result, 'User registered successfully', 201);
    } catch (error) {
      if (error instanceof ApiError) {
        sendError(res, error.message, error.statusCode);
      } else {
        sendError(res, 'Registration failed', 500);
      }
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        sendError(res, 'Email and password are required', 400);
        return;
      }

      const result = await authService.login(email, password);
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      if (error instanceof ApiError) {
        sendError(res, error.message, error.statusCode);
      } else {
        sendError(res, 'Login failed', 500);
      }
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as any;
      sendSuccess(res, { user: authReq.user });
    } catch (error) {
      sendError(res, 'Failed to fetch user info', 500);
    }
  }
}

export const authController = new AuthController();
