import { Router } from 'express';
import authRoutes from './auth.routes';
import policyRoutes from './policy.routes';
import claimRoutes from './claim.routes';
import customerRoutes from './customer.routes';
import quoteRoutes from './quote.routes';

const router = Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/policies', policyRoutes);
router.use('/claims', claimRoutes);
router.use('/customers', customerRoutes);
router.use('/quotes', quoteRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
