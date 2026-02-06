import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import logger from '../utils/logger';

const router = Router();

// Get all users (customer data)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.info({ 
    requestId, 
    operation: 'list_users',
    filters: req.query,
    ip: req.ip
  }, 'Fetching all users');

  try {
    const startTime = Date.now();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
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
    const queryDuration = Date.now() - startTime;

    logger.info({ 
      requestId, 
      operation: 'list_users_success',
      results: { count: users.length },
      performance: { queryDuration }
    }, `Fetched ${users.length} user(s)`);

    res.json({ success: true, data: users });
  } catch (error) {
    logger.error({ 
      requestId, 
      operation: 'list_users_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch users');
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    res.status(500).json({ success: false, message });
  }
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.params.id;

  logger.info({ 
    requestId, 
    userId,
    operation: 'get_user_by_id',
    ip: req.ip
  }, 'Fetching user by ID');

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
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
      logger.warn({ 
        requestId, 
        userId,
        operation: 'get_user_not_found'
      }, 'User not found');
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    logger.info({ 
      requestId, 
      userId,
      operation: 'get_user_success',
      user: {
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      }
    }, 'User fetched successfully');

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error({ 
      requestId, 
      userId,
      operation: 'get_user_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch user');
    const message = error instanceof Error ? error.message : 'Failed to fetch user';
    res.status(500).json({ success: false, message });
  }
});

// Update user (customer data)
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.params.id;
  const { dateOfBirth, phone, street, city, state, zipCode, country, firstName, lastName } = req.body;

  logger.info({ 
    requestId, 
    userId,
    operation: 'update_user',
    updates: { firstName, lastName, phone, city, state, country },
    ip: req.ip
  }, 'Updating user profile');

  try {
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
        organizationId: true,
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

    logger.info({ 
      requestId, 
      userId,
      operation: 'update_user_success',
      user: {
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      }
    }, 'User profile updated successfully');

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error({ 
      requestId, 
      userId,
      operation: 'update_user_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to update user');
    const message = error instanceof Error ? error.message : 'Failed to update user';
    res.status(400).json({ success: false, message });
  }
});

// Delete user
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.params.id;

  logger.info({ 
    requestId, 
    userId,
    operation: 'delete_user',
    ip: req.ip
  }, 'Deleting user');

  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    logger.info({ 
      requestId, 
      userId,
      operation: 'delete_user_success'
    }, 'User deleted successfully');

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    logger.error({ 
      requestId, 
      userId,
      operation: 'delete_user_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to delete user');
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    res.status(400).json({ success: false, message });
  }
});

export default router;
