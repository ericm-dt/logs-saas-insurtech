import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/user.model';
import { User, UserRole, AuthTokenPayload } from '../types/auth.types';
import { config } from '../config';
import { ApiError } from '../utils/response';

export class AuthService {
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: UserRole = UserRole.CUSTOMER
  ): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await userModel.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
    });

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async login(email: string, password: string): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const user = await userModel.findByEmail(email);
    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as AuthTokenPayload;
    } catch (error) {
      throw new ApiError(401, 'Invalid or expired token');
    }
  }
}

export const authService = new AuthService();
