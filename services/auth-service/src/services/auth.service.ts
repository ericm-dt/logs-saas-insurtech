import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export class AuthService {
  async register(email: string, password: string, firstName: string, lastName: string, role: string = 'CUSTOMER') {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role as any,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    const token = this.generateToken({ userId: user.id, email: user.email, role: user.role });

    return { user: userWithoutPassword, token };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const { password: _, ...userWithoutPassword } = user;
    const token = this.generateToken({ userId: user.id, email: user.email, role: user.role });

    return { user: userWithoutPassword, token };
  }

  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  }

  verifyToken(token: string): AuthTokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthTokenPayload;
  }
}

export const authService = new AuthService();
