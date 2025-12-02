import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';

interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
  orgRole: string;
}

export class AuthService {
  async register(
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string, 
    organizationId: string,
    role: UserRole = UserRole.CUSTOMER,
    orgRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER',
    customerData?: {
      dateOfBirth?: Date;
      phone?: string;
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    }
  ) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({ 
      where: { id: organizationId } 
    });
    if (!organization) {
      throw new Error('Organization not found');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        orgRole: orgRole as any,
        organizationId,
        ...(customerData && {
          dateOfBirth: customerData.dateOfBirth,
          phone: customerData.phone,
          street: customerData.street,
          city: customerData.city,
          state: customerData.state,
          zipCode: customerData.zipCode,
          country: customerData.country,
        }),
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    const token = this.generateToken({ 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      organizationId: user.organizationId,
      orgRole: user.orgRole
    });

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
    const token = this.generateToken({ 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      organizationId: user.organizationId,
      orgRole: user.orgRole
    });

    return { user: userWithoutPassword, token };
  }

  generateToken(payload: AuthTokenPayload): string {
    const secret = process.env.JWT_SECRET || 'secret';
    return jwt.sign(payload, secret, { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    } as jwt.SignOptions);
  }

  verifyToken(token: string): AuthTokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthTokenPayload;
  }
}

export const authService = new AuthService();
