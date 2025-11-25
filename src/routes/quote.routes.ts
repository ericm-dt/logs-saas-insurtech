import { Router } from 'express';
import { quoteController } from '../controllers/quote.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../types/auth.types';

const router = Router();

// All quote routes require authentication
router.use(authenticate);

router.post('/', quoteController.create.bind(quoteController));
router.get('/', authorize(UserRole.ADMIN, UserRole.AGENT), quoteController.getAll.bind(quoteController));
router.get('/:id', quoteController.getById.bind(quoteController));
router.get('/customer/:customerId', quoteController.getByCustomer.bind(quoteController));
router.put('/:id', authorize(UserRole.ADMIN, UserRole.AGENT), quoteController.update.bind(quoteController));

export default router;
