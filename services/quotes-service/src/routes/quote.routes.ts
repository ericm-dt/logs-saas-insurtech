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
  
  logger.debug({ 
    coverageAmount, 
    type, 
    baseRate, 
    multiplier, 
    calculatedPremium: premium,
    operation: 'calculate_premium',
    formula: `${coverageAmount} * ${baseRate} * ${multiplier}`,
    monthlyPremium: (premium / 12).toFixed(2)
  }, 'Premium calculated for quote');
  
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

    logger.info({ 
      organizationId: (req as AuthRequest).user!.organizationId,
      userId: (req as AuthRequest).user!.userId,
      operation: 'list_quotes',
      results: {
        quotesReturned: quotes.length,
        totalMatching: total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        hasMore: (pageNum * limitNum) < total
      },
      searchParams: {
        status,
        type,
        userId,
        expiresAfter,
        expiresBefore,
        minCoverage,
        maxCoverage,
        minPremium,
        maxPremium,
        search
      },
      ip: req.ip
    }, 'Quotes retrieved for organization');

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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const quoteId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    quoteId, 
    userId, 
    organizationId,
    operation: 'get_quote_by_id',
    ip: req.ip
  }, 'Fetching quote by ID');

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id }
    });

    if (!quote) {
      logger.warn({ 
        requestId, 
        quoteId, 
        userId, 
        organizationId,
        operation: 'get_quote_not_found'
      }, 'Quote not found by ID');
      res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
      return;
    }

    logger.info({ 
      requestId, 
      quoteId: quote.id, 
      userId, 
      organizationId,
      operation: 'get_quote_success',
      quote: {
        quoteNumber: quote.quoteNumber,
        type: quote.type,
        status: quote.status,
        premium: quote.premium,
        coverageAmount: quote.coverageAmount,
        expiresAt: quote.expiresAt
      }
    }, 'Quote retrieved successfully');

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      quoteId, 
      userId, 
      organizationId,
      operation: 'get_quote_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch quote by ID');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quote'
    });
  }
});

// Get quote status history
router.get('/:id/history', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const quoteId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    quoteId, 
    userId, 
    organizationId,
    operation: 'get_quote_history',
    ip: req.ip
  }, 'Fetching quote status history');

  try {
    const history = await prisma.quoteStatusHistory.findMany({
      where: { quoteId: req.params.id },
      orderBy: { changedAt: 'desc' }
    });

    logger.info({ 
      requestId, 
      quoteId, 
      userId, 
      organizationId,
      operation: 'get_quote_history_success',
      historyCount: history.length
    }, 'Quote history retrieved successfully');

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      quoteId, 
      userId, 
      organizationId,
      operation: 'get_quote_history_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch quote history');
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
    body('type').isIn(['AUTO', 'HOME', 'LIFE', 'HEALTH', 'BUSINESS']).withMessage('Invalid policy type'),
    body('coverageAmount').isNumeric().withMessage('Coverage amount must be numeric'),
    body('expiresAt').optional().isISO8601().withMessage('Valid expiration date required')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { type, coverageAmount, expiresAt } = req.body;
    const userId = (req as AuthRequest).user!.userId;
    const organizationId = (req as AuthRequest).user!.organizationId;
    
    // Generate quote number server-side
    const quoteNumber = `QUO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    logger.info({ 
      requestId, 
      userId, 
      organizationId, 
      quoteNumber, 
      type, 
      coverageAmount,
      operation: 'create_quote',
      quoteData: {
        quoteNumber,
        type,
        coverageAmount,
        expiresAt: req.body.expiresAt
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    }, 'Creating new quote for customer');
    
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

      logger.info({ 
        requestId, 
        quoteId: quote.id, 
        userId, 
        organizationId,
        quoteNumber, 
        type, 
        coverageAmount,
        calculatedPremium: premium,
        expiresAt: expirationDate,
        createdAt: quote.createdAt,
        operation: 'create_quote_success',
        quote: {
          id: quote.id,
          number: quoteNumber,
          type,
          status: 'ACTIVE',
          coverage: coverageAmount,
          premium
        },
        business: {
          annualPremium: premium,
          monthlyPremium: (premium / 12).toFixed(2),
          coverageRatio: (coverageAmount / premium).toFixed(2),
          validityDays: Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        }
      }, 'Quote created successfully with calculated premium');

      res.status(201).json({
        success: true,
        data: quote,
        message: `Quote created with calculated premium: $${premium}`
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        logger.warn({ 
          requestId, 
          userId, 
          organizationId,
          quoteNumber,
          operation: 'create_quote_duplicate',
          errorCode: error.code
        }, 'Quote creation failed - duplicate quote number detected');
        res.status(400).json({
          success: false,
          message: 'Quote number already exists'
        });
        return;
      }
      logger.error({ 
        requestId, 
        userId, 
        organizationId,
        quoteNumber,
        operation: 'create_quote_error',
        quoteData: {
          quoteNumber,
          type,
          coverageAmount
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }, 'Quote creation failed unexpectedly');
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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const quoteId = req.params.id;
    const userId = (req as AuthRequest).user!.userId;
    const organizationId = (req as AuthRequest).user!.organizationId;
    const { status, statusChangeReason } = req.body;

    logger.info({ 
      requestId, 
      quoteId, 
      userId, 
      organizationId,
      operation: 'update_quote_status',
      newStatus: status,
      reason: statusChangeReason,
      ip: req.ip
    }, 'Updating quote status');

    try {
      // Get current quote for status history
      const currentQuote = await prisma.quote.findUnique({
        where: { id: req.params.id }
      });

      if (!currentQuote) {
        logger.warn({ 
          requestId, 
          quoteId, 
          userId, 
          organizationId,
          operation: 'update_quote_status_not_found'
        }, 'Quote status update failed - quote not found');
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

      logger.info({ 
        requestId, 
        quoteId, 
        userId, 
        organizationId,
        operation: 'update_quote_status_success',
        transition: {
          from: currentQuote.status,
          to: status,
          reason: statusChangeReason
        },
        quote: {
          quoteNumber: currentQuote.quoteNumber,
          type: currentQuote.type
        }
      }, 'Quote status updated successfully');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        logger.warn({ 
          requestId, 
          quoteId, 
          userId, 
          organizationId,
          operation: 'update_quote_status_not_found_transaction',
          errorCode: error.code
        }, 'Quote status update failed - quote not found in transaction');
        res.status(404).json({
          success: false,
          message: 'Quote not found'
        });
        return;
      }
      logger.error({ 
        requestId, 
        quoteId, 
        userId, 
        organizationId,
        operation: 'update_quote_status_error',
        attemptedStatus: status,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }, 'Failed to update quote status');
      res.status(500).json({
        success: false,
        message: 'Failed to update quote'
      });
    }
  }
);

// Delete quote
router.delete('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const quoteId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    quoteId, 
    userId, 
    organizationId,
    operation: 'delete_quote',
    ip: req.ip
  }, 'Deleting quote');

  try {
    await prisma.quote.delete({
      where: { id: req.params.id }
    });

    logger.info({ 
      requestId, 
      quoteId, 
      userId, 
      organizationId,
      operation: 'delete_quote_success'
    }, 'Quote deleted successfully');

    res.json({
      success: true,
      message: 'Quote deleted successfully'
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      logger.warn({ 
        requestId, 
        quoteId, 
        userId, 
        organizationId,
        operation: 'delete_quote_not_found',
        errorCode: error.code
      }, 'Quote deletion failed - quote not found');
      res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
      return;
    }
    logger.error({ 
      requestId, 
      quoteId, 
      userId, 
      organizationId,
      operation: 'delete_quote_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to delete quote');
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
  
  logger.info({ 
    requestId, 
    quoteId, 
    userId,
    operation: 'convert_quote_to_policy',
    ip: req.ip,
    userAgent: req.get('user-agent')
  }, 'Starting quote to policy conversion workflow');
  
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id }
    });

    if (!quote) {
      logger.warn({ 
        requestId, 
        quoteId, 
        userId,
        operation: 'convert_quote_not_found'
      }, 'Quote conversion failed - quote not found in database');
      res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
      return;
    }

    if (quote.status !== 'ACTIVE') {
      logger.warn({ 
        requestId, 
        quoteId, 
        userId, 
        quoteStatus: quote.status,
        organizationId: quote.organizationId,
        operation: 'convert_quote_invalid_status',
        quoteNumber: quote.quoteNumber
      }, 'Quote conversion rejected - quote status is not ACTIVE');
      res.status(400).json({
        success: false,
        message: 'Only ACTIVE quotes can be converted to policies'
      });
      return;
    }

    if (new Date() > quote.expiresAt) {
      logger.warn({ 
        requestId, 
        quoteId, 
        userId, 
        expiresAt: quote.expiresAt, 
        now: new Date(),
        organizationId: quote.organizationId,
        operation: 'convert_quote_expired',
        expiredDays: Math.ceil((new Date().getTime() - quote.expiresAt.getTime()) / (1000 * 60 * 60 * 24)),
        quoteNumber: quote.quoteNumber
      }, 'Quote conversion rejected - quote has expired');
      res.status(400).json({
        success: false,
        message: 'Quote has expired'
      });
      return;
    }

    // Call policy service to create policy
    const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://policy-service:3003';
    const token = req.headers.authorization?.substring(7) || '';

    logger.info({ 
      requestId, 
      quoteId, 
      serviceUrl: POLICY_SERVICE_URL,
      operation: 'convert_quote_calling_policy_service',
      policyData: {
        type: quote.type,
        premium: quote.premium,
        coverageAmount: quote.coverageAmount
      }
    }, 'Calling policy service to create policy from quote (policyNumber will be generated by policy-service)');

    try {
      const startTime = Date.now();
      const policyResponse = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies`,
        {
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

      logger.info({ 
        requestId, 
        quoteId: updatedQuote.id, 
        policyId: policyResponse.data.data.id,
        userId,
        organizationId: quote.organizationId,
        policyNumber: policyResponse.data.data.policyNumber,
        premium: quote.premium,
        coverageAmount: quote.coverageAmount,
        policyServiceDuration,
        operation: 'convert_quote_success',
        conversion: {
          quoteId: updatedQuote.id,
          quoteNumber: quote.quoteNumber,
          policyId: policyResponse.data.data.id,
          policyNumber: policyResponse.data.data.policyNumber,
          status: 'CONVERTED'
        },
        business: {
          type: quote.type,
          annualPremium: quote.premium,
          coverage: quote.coverageAmount,
          conversionTime: new Date().toISOString()
        },
        performance: {
          policyServiceCallMs: policyServiceDuration,
          totalConversionMs: Date.now() - startTime
        }
      }, 'Quote successfully converted to policy');

      res.status(201).json({
        success: true,
        data: {
          quote: updatedQuote,
          policy: policyResponse.data.data
        },
        message: 'Quote successfully converted to policy'
      });
    } catch (policyError) {
      logger.error({ 
        requestId, 
        quoteId,
        serviceUrl: POLICY_SERVICE_URL,
        operation: 'convert_quote_policy_service_error',
        service: 'policy-service',
        error: {
          message: policyError instanceof Error ? policyError.message : 'Unknown error',
          name: policyError instanceof Error ? policyError.name : 'Error',
          isAxiosError: (policyError as any).isAxiosError,
          responseStatus: (policyError as any).response?.status,
          stack: policyError instanceof Error ? policyError.stack : undefined
        },
        quoteData: {
          type: quote.type,
          premium: quote.premium,
          coverageAmount: quote.coverageAmount
        }
      }, 'Policy service call failed during quote conversion - external service error');
      res.status(500).json({
        success: false,
        message: 'Failed to create policy from quote'
      });
    }
  } catch (error) {
    logger.error({ 
      requestId, 
      quoteId, 
      userId,
      operation: 'convert_quote_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Quote conversion failed unexpectedly - internal error');
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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;
  const { type, coverageAmount } = req.body;

  logger.info({ 
    requestId, 
    userId, 
    organizationId,
    operation: 'calculate_premium',
    type,
    coverageAmount,
    ip: req.ip
  }, 'Calculating premium for quote');

  try {
    const premium = calculatePremium(parseFloat(coverageAmount), type);

    logger.info({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'calculate_premium_success',
      calculation: {
        type,
        coverageAmount: parseFloat(coverageAmount),
        premium,
        monthlyPremium: (premium / 12).toFixed(2)
      }
    }, 'Premium calculated successfully');

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
    logger.error({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'calculate_premium_error',
      type,
      coverageAmount,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to calculate premium');
    res.status(500).json({
      success: false,
      message: 'Failed to calculate premium'
    });
  }
});

// Get my quotes (user-scoped endpoint)
router.get('/my/quotes', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    userId, 
    organizationId,
    operation: 'get_my_quotes',
    filters: req.query,
    ip: req.ip
  }, 'Fetching user-scoped quotes');

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

    const startTime = Date.now();
    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.quote.count({ where })
    ]);
    const queryDuration = Date.now() - startTime;

    logger.info({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'get_my_quotes_success',
      results: {
        count: quotes.length,
        total,
        page: pageNum
      },
      performance: { queryDuration }
    }, 'User quotes fetched successfully');

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
    logger.error({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'get_my_quotes_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch user quotes');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your quotes'
    });
  }
});

// Expire old quotes (utility endpoint)
router.post('/expire-old', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    userId, 
    organizationId,
    operation: 'expire_old_quotes',
    ip: req.ip
  }, 'Expiring old active quotes');

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

    logger.info({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'expire_old_quotes_success',
      expiredCount: result.count,
      timestamp: now
    }, `Expired ${result.count} old quote(s)`);

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
