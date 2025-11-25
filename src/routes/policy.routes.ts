import { Router } from 'express';
import { policyController } from '../controllers/policy.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../types/auth.types';

const router = Router();

// All policy routes require authentication
router.use(authenticate);

router.post('/', authorize(UserRole.ADMIN, UserRole.AGENT), policyController.create.bind(policyController));
router.get('/', policyController.getAll.bind(policyController));
router.get('/:id', policyController.getById.bind(policyController));
router.get('/customer/:customerId', policyController.getByCustomer.bind(policyController));
router.put('/:id', authorize(UserRole.ADMIN, UserRole.AGENT), policyController.update.bind(policyController));
router.delete('/:id', authorize(UserRole.ADMIN), policyController.delete.bind(policyController));

export default router;
