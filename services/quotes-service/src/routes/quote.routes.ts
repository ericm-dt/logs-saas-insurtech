import { Router, Request, Response, NextFunction } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3002';

// Validation middleware
const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    for (const validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: result.array()
        });
        return;
      }
    }
    next();
  };
};

// Validate customer exists
async function validateCustomer(customerId: string, token: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `${CUSTOMER_SERVICE_URL}/api/customers/${customerId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.success;
  } catch (error) {
    return false;
  }
}

// Calculate premium (simple example - 1.5% of coverage)
function calculatePremium(coverageAmount: number, type: string): number {
  const baseRate = 0.015; // 1.5%
  const typeMultipliers: Record<string, number> = {
    AUTO: 1.0,
    HOME: 1.2,
    LIFE: 0.8,
    HEALTH: 1.5,
    BUSINESS: 2.0
  };
  
  const multiplier = typeMultipliers[type] || 1.0;
  return parseFloat((coverageAmount * baseRate * multiplier).toFixed(2));
}

// Get all quotes
router.get('/', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: quotes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotes'
    });
  }
});

// Get quote by ID
router.get('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id }
    });

    if (!quote) {
      res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
      return;
    }

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quote'
    });
  }
});

// Create quote
router.post(
  '/',
  authenticate,
  validate([
    body('customerId').notEmpty().withMessage('Customer ID is required'),
    body('quoteNumber').notEmpty().withMessage('Quote number is required'),
    body('type').isIn(['AUTO', 'HOME', 'LIFE', 'HEALTH', 'BUSINESS']).withMessage('Invalid policy type'),
    body('coverageAmount').isNumeric().withMessage('Coverage amount must be numeric'),
    body('expiresAt').optional().isISO8601().withMessage('Valid expiration date required')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { customerId, quoteNumber, type, coverageAmount, expiresAt } = req.body;

      // Validate customer exists
      const token = req.headers.authorization?.substring(7) || '';
      const customerExists = await validateCustomer(customerId, token);
      
      if (!customerExists) {
        res.status(400).json({
          success: false,
          message: 'Customer not found'
        });
        return;
      }

      // Calculate premium
      const premium = calculatePremium(parseFloat(coverageAmount), type);

      // Default expiration: 30 days from now
      const defaultExpiration = new Date();
      defaultExpiration.setDate(defaultExpiration.getDate() + 30);

      const quote = await prisma.quote.create({
        data: {
          customerId,
          quoteNumber,
          type,
          coverageAmount,
          premium,
          expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiration,
          status: 'ACTIVE'
        }
      });

      res.status(201).json({
        success: true,
        data: quote,
        message: `Quote created with calculated premium: $${premium}`
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        res.status(400).json({
          success: false,
          message: 'Quote number already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to create quote'
      });
    }
  }
);

// Update quote status
router.put(
  '/:id/status',
  authenticate,
  param('id').isUUID(),
  validate([
    body('status').isIn(['ACTIVE', 'EXPIRED', 'CONVERTED']).withMessage('Invalid status')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { status } = req.body;

      const quote = await prisma.quote.update({
        where: { id: req.params.id },
        data: { status }
      });

      res.json({
        success: true,
        data: quote
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        res.status(404).json({
          success: false,
          message: 'Quote not found'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to update quote'
      });
    }
  }
);

// Delete quote
router.delete('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    await prisma.quote.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Quote deleted successfully'
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to delete quote'
    });
  }
});// Expire old quotes (utility endpoint)
router.post('/expire-old', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const now = new Date();
    
    const result = await prisma.quote.updateMany({
      where: {
        expiresAt: { lt: now },
        status: 'ACTIVE'
      },
      data: {
        status: 'EXPIRED'
      }
    });

    res.json({
      success: true,
      data: { expiredCount: result.count },
      message: `Expired ${result.count} quote(s)`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to expire quotes'
    });
  }
});

export default router;
