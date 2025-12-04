import { Router, Request, Response, NextFunction } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

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
  const premium = parseFloat((coverageAmount * baseRate * multiplier).toFixed(2));
  
  logger.debug('Premium calculated', { coverageAmount, type, baseRate, multiplier, calculatedPremium: premium });
  
  return premium;
}

// Get all quotes
router.get('/', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const {
      status,
      type,
      userId,
      expiresAfter,
      expiresBefore,
      minCoverage,
      maxCoverage,
      minPremium,
      maxPremium,
      search,
      page = '1',
      limit = '50'
    } = req.query;

    // Build dynamic where clause
    const where: any = {
      organizationId: (req as AuthRequest).user!.organizationId // Multi-tenant filter
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (userId) where.userId = userId;

    // Expiration date filters
    if (expiresAfter || expiresBefore) {
      where.expiresAt = {};
      if (expiresAfter) where.expiresAt.gte = new Date(expiresAfter as string);
      if (expiresBefore) where.expiresAt.lte = new Date(expiresBefore as string);
    }

    // Coverage amount range
    if (minCoverage || maxCoverage) {
      where.coverageAmount = {};
      if (minCoverage) where.coverageAmount.gte = parseFloat(minCoverage as string);
      if (maxCoverage) where.coverageAmount.lte = parseFloat(maxCoverage as string);
    }

    // Premium range
    if (minPremium || maxPremium) {
      where.premium = {};
      if (minPremium) where.premium.gte = parseFloat(minPremium as string);
      if (maxPremium) where.premium.lte = parseFloat(maxPremium as string);
    }

    // Search by quote number
    if (search) {
      where.quoteNumber = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.quote.count({ where })
    ]);

    res.json({
      success: true,
      data: quotes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
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

// Get quote status history
router.get('/:id/history', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    const history = await prisma.quoteStatusHistory.findMany({
      where: { quoteId: req.params.id },
      orderBy: { changedAt: 'desc' }
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quote history'
    });
  }
});

// Create quote
router.post(
  '/',
  authenticate,
  validate([
    body('quoteNumber').notEmpty().withMessage('Quote number is required'),
    body('type').isIn(['AUTO', 'HOME', 'LIFE', 'HEALTH', 'BUSINESS']).withMessage('Invalid policy type'),
    body('coverageAmount').isNumeric().withMessage('Coverage amount must be numeric'),
    body('expiresAt').optional().isISO8601().withMessage('Valid expiration date required')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { quoteNumber, type, coverageAmount, expiresAt } = req.body;
    const userId = (req as AuthRequest).user!.userId;
    const organizationId = (req as AuthRequest).user!.organizationId;
    
    logger.info('Creating new quote', { 
      requestId, 
      userId, 
      organizationId, 
      quoteNumber, 
      type, 
      coverageAmount 
    });
    
    try {
      // Calculate premium
      const premium = calculatePremium(parseFloat(coverageAmount), type);

      // Default expiration: 30 days from now
      const defaultExpiration = new Date();
      defaultExpiration.setDate(defaultExpiration.getDate() + 30);
      const expirationDate = expiresAt ? new Date(expiresAt) : defaultExpiration;

      const quote = await prisma.quote.create({
        data: {
          userId,
          organizationId,
          quoteNumber,
          type,
          coverageAmount,
          premium,
          expiresAt: expirationDate,
          status: 'ACTIVE'
        }
      });

      logger.info('Quote created successfully', { 
        requestId, 
        quoteId: quote.id, 
        userId, 
        organizationId,
        quoteNumber, 
        type, 
        coverageAmount,
        calculatedPremium: premium,
        expiresAt: expirationDate,
        createdAt: quote.createdAt
      });

      res.status(201).json({
        success: true,
        data: quote,
        message: `Quote created with calculated premium: $${premium}`
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        logger.warn('Quote creation failed - duplicate quote number', { 
          requestId, 
          userId, 
          organizationId,
          quoteNumber 
        });
        res.status(400).json({
          success: false,
          message: 'Quote number already exists'
        });
        return;
      }
      logger.error('Quote creation failed', { 
        requestId, 
        userId, 
        organizationId,
        quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
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
    body('status').isIn(['ACTIVE', 'EXPIRED', 'CONVERTED']).withMessage('Invalid status'),
    body('statusChangeReason').optional().isString().withMessage('Status change reason must be string')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { status, statusChangeReason } = req.body;

      // Get current quote for status history
      const currentQuote = await prisma.quote.findUnique({
        where: { id: req.params.id }
      });

      if (!currentQuote) {
        res.status(404).json({
          success: false,
          message: 'Quote not found'
        });
        return;
      }

      // Use transaction to update quote and create history entry atomically
      const result = await prisma.$transaction(async (tx: any) => {
        // Update the quote
        const updatedQuote = await tx.quote.update({
          where: { id: req.params.id },
          data: { status }
        });

        // Create status history entry if status changed
        if (status !== currentQuote.status) {
          await tx.quoteStatusHistory.create({
            data: {
              quoteId: req.params.id,
              organizationId: currentQuote.organizationId,
              oldStatus: currentQuote.status,
              newStatus: status,
              changedBy: (req as AuthRequest).user!.userId,
              reason: statusChangeReason || undefined,
              metadata: {
                previousStatus: currentQuote.status
              }
            }
          });
        }

        return updatedQuote;
      });

      res.json({
        success: true,
        data: result
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
});// Convert quote to policy (workflow endpoint)
router.post('/:id/convert', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const quoteId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  
  logger.info('Converting quote to policy', { requestId, quoteId, userId });
  
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id }
    });

    if (!quote) {
      logger.warn('Quote conversion failed - quote not found', { requestId, quoteId, userId });
      res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
      return;
    }

    if (quote.status !== 'ACTIVE') {
      logger.warn('Quote conversion rejected - quote not active', { 
        requestId, 
        quoteId, 
        userId, 
        quoteStatus: quote.status 
      });
      res.status(400).json({
        success: false,
        message: 'Only ACTIVE quotes can be converted to policies'
      });
      return;
    }

    if (new Date() > quote.expiresAt) {
      logger.warn('Quote conversion rejected - quote expired', { 
        requestId, 
        quoteId, 
        userId, 
        expiresAt: quote.expiresAt, 
        now: new Date() 
      });
      res.status(400).json({
        success: false,
        message: 'Quote has expired'
      });
      return;
    }

    // Call policy service to create policy
    const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://policy-service:3003';
    const token = req.headers.authorization?.substring(7) || '';
    const policyNumber = `POL-${Date.now()}`;

    logger.info('Calling policy service to create policy from quote', { 
      requestId, 
      quoteId, 
      policyNumber, 
      serviceUrl: POLICY_SERVICE_URL 
    });

    try {
      const startTime = Date.now();
      const policyResponse = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies`,
        {
          policyNumber,
          type: quote.type,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          premium: quote.premium,
          coverageAmount: quote.coverageAmount,
          status: 'ACTIVE'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const policyServiceDuration = Date.now() - startTime;

      // Update quote status to CONVERTED
      const updatedQuote = await prisma.quote.update({
        where: { id: req.params.id },
        data: { status: 'CONVERTED' }
      });

      logger.info('Quote converted to policy successfully', { 
        requestId, 
        quoteId: updatedQuote.id, 
        policyId: policyResponse.data.data.id,
        userId,
        organizationId: quote.organizationId,
        policyNumber,
        premium: quote.premium,
        coverageAmount: quote.coverageAmount,
        policyServiceDuration
      });

      res.status(201).json({
        success: true,
        data: {
          quote: updatedQuote,
          policy: policyResponse.data.data
        },
        message: 'Quote successfully converted to policy'
      });
    } catch (policyError) {
      logger.error('Policy service call failed during quote conversion', { 
        requestId, 
        quoteId, 
        policyNumber,
        serviceUrl: POLICY_SERVICE_URL,
        error: policyError instanceof Error ? policyError.message : 'Unknown error',
        stack: policyError instanceof Error ? policyError.stack : undefined
      });
      res.status(500).json({
        success: false,
        message: 'Failed to create policy from quote'
      });
    }
  } catch (error) {
    logger.error('Quote conversion failed', { 
      requestId, 
      quoteId, 
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      message: 'Failed to convert quote'
    });
  }
});

// Calculate premium without creating quote (pre-quote workflow)
router.post('/calculate', authenticate, validate([
  body('type').isIn(['AUTO', 'HOME', 'LIFE', 'HEALTH', 'BUSINESS']).withMessage('Invalid policy type'),
  body('coverageAmount').isNumeric().withMessage('Coverage amount must be numeric')
]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { type, coverageAmount } = req.body;
    const premium = calculatePremium(parseFloat(coverageAmount), type);

    res.json({
      success: true,
      data: {
        type,
        coverageAmount: parseFloat(coverageAmount),
        estimatedPremium: premium,
        calculatedAt: new Date().toISOString()
      },
      message: 'Premium calculated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to calculate premium'
    });
  }
});

// Get my quotes (user-scoped endpoint)
router.get('/my/quotes', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { status, page = '1', limit = '50' } = req.query;
    
    const where: any = {
      userId: (req as AuthRequest).user!.userId,
      organizationId: (req as AuthRequest).user!.organizationId
    };

    if (status) where.status = status;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.quote.count({ where })
    ]);

    res.json({
      success: true,
      data: quotes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your quotes'
    });
  }
});

// Expire old quotes (utility endpoint)
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
