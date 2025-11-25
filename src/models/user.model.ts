import { User, UserRole } from '../types/auth.types';
import { prisma } from '../config/database';

class UserModel {
  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        organizationId: userData.organizationId,
      },
    });

    return user as User;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return user ? (user as User) : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    return user ? (user as User) : undefined;
  }

  async update(id: string, updates: Partial<User>): Promise<User | undefined> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: updates,
      });

      return user as User;
    } catch (error) {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany();
    return users as User[];
  }
}

export const userModel = new UserModel();
