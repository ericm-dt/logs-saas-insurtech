import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../types/auth.types';

const router = Router();

// All customer routes require authentication
router.use(authenticate);

router.post('/', authorize(UserRole.ADMIN, UserRole.AGENT), customerController.create.bind(customerController));
router.get('/', authorize(UserRole.ADMIN, UserRole.AGENT), customerController.getAll.bind(customerController));
router.get('/:id', customerController.getById.bind(customerController));
router.put('/:id', customerController.update.bind(customerController));
router.delete('/:id', authorize(UserRole.ADMIN), customerController.delete.bind(customerController));

export default router;
