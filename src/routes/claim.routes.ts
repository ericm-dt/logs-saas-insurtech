import { Router } from 'express';
import { claimController } from '../controllers/claim.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../types/auth.types';

const router = Router();

// All claim routes require authentication
router.use(authenticate);

router.post('/', claimController.create.bind(claimController));
router.get('/', authorize(UserRole.ADMIN, UserRole.AGENT), claimController.getAll.bind(claimController));
router.get('/:id', claimController.getById.bind(claimController));
router.get('/policy/:policyId', claimController.getByPolicy.bind(claimController));
router.put('/:id', authorize(UserRole.ADMIN, UserRole.AGENT), claimController.update.bind(claimController));

export default router;
