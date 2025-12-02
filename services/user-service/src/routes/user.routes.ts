import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';

const router = Router();

// Get all users (customer data)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        dateOfBirth: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        createdAt: true,
        updatedAt: true,
        // Exclude password
      }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    res.status(500).json({ success: false, message });
  }
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        dateOfBirth: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user';
    res.status(500).json({ success: false, message });
  }
});

// Update user (customer data)
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateOfBirth, phone, street, city, state, zipCode, country, firstName, lastName } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(phone && { phone }),
        ...(street && { street }),
        ...(city && { city }),
        ...(state && { state }),
        ...(zipCode && { zipCode }),
        ...(country && { country }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        dateOfBirth: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.json({ success: true, data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    res.status(400).json({ success: false, message });
  }
});

// Delete user
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    res.status(400).json({ success: false, message });
  }
});

export default router;
