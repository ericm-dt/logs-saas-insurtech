import { Router, Request, Response, NextFunction } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { PrismaClient, Prisma } from '@prisma/client';
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

router.get('/', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;
  
  logger.info('Fetching policies list', { 
    requestId, 
    userId, 
    organizationId,
    filters: req.query,
    ip: req.ip 
  });
  
  try {
    const { 
      status, 
      type, 
      userId: queryUserId, 
      startDateFrom, 
      startDateTo,
      endDateFrom,
      endDateTo,
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
    if (queryUserId) where.userId = queryUserId;
    
    // Date range filters
    if (startDateFrom || startDateTo) {
      where.startDate = {};
      if (startDateFrom) where.startDate.gte = new Date(startDateFrom as string);
      if (startDateTo) where.startDate.lte = new Date(startDateTo as string);
    }
    
    if (endDateFrom || endDateTo) {
      where.endDate = {};
      if (endDateFrom) where.endDate.gte = new Date(endDateFrom as string);
      if (endDateTo) where.endDate.lte = new Date(endDateTo as string);
    }

    // Premium range
    if (minPremium || maxPremium) {
      where.premium = {};
      if (minPremium) where.premium.gte = parseFloat(minPremium as string);
      if (maxPremium) where.premium.lte = parseFloat(maxPremium as string);
    }

    // Search by policy number
    if (search) {
      where.policyNumber = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const startTime = Date.now();
    const [policies, total] = await Promise.all([
      prisma.policy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.policy.count({ where })
    ]);
    const queryDuration = Date.now() - startTime;

    logger.info('Policies fetched successfully', { 
      requestId, 
      userId, 
      organizationId,
      count: policies.length, 
      total, 
      page: pageNum,
      queryDuration,
      hasFilters: Object.keys(where).length > 1
    });

    res.json({
      success: true,
      data: policies,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch policies', { 
      requestId, 
      userId, 
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policies'
    });
  }
});

// Get policy by ID
router.get('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    const policy = await prisma.policy.findUnique({
      where: { id: req.params.id }
    });

    if (!policy) {
      res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
      return;
    }

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy'
    });
  }
});

// Get policy status history
router.get('/:id/history', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    const history = await prisma.policyStatusHistory.findMany({
      where: { policyId: req.params.id },
      orderBy: { changedAt: 'desc' }
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy history'
    });
  }
});

// Create policy
router.post(
  '/',
  authenticate,
  validate([
    body('policyNumber').notEmpty().withMessage('Policy number is required'),
    body('type').isIn(['AUTO', 'HOME', 'LIFE', 'HEALTH', 'BUSINESS']).withMessage('Invalid policy type'),
    body('startDate').isISO8601().withMessage('Valid start date required'),
    body('endDate').isISO8601().withMessage('Valid end date required'),
    body('premium').isNumeric().withMessage('Premium must be numeric'),
    body('coverageAmount').isNumeric().withMessage('Coverage amount must be numeric')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { policyNumber, type, premium, coverageAmount } = req.body;
    const userId = (req as AuthRequest).user!.userId;
    const organizationId = (req as AuthRequest).user!.organizationId;
    
    logger.info('Creating new policy', { 
      requestId, 
      userId, 
      organizationId, 
      policyNumber, 
      type, 
      premium, 
      coverageAmount 
    });
    
    try {
      const { startDate, endDate, status } = req.body;

      const policy = await prisma.policy.create({        data: {
          userId,
          organizationId,
          policyNumber,
          type,
          status: status || 'PENDING',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          premium,
          coverageAmount
        }
      });

      logger.info('Policy created successfully', { 
        requestId, 
        policyId: policy.id, 
        userId, 
        organizationId,
        policyNumber, 
        type, 
        status: policy.status,
        premium,
        coverageAmount,
        createdAt: policy.createdAt
      });

      res.status(201).json({
        success: true,
        data: policy
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        logger.warn('Policy creation failed - duplicate policy number', { 
          requestId, 
          userId, 
          organizationId,
          policyNumber 
        });
        res.status(400).json({
          success: false,
          message: 'Policy number already exists'
        });
        return;
      }
      logger.error('Policy creation failed', { 
        requestId, 
        userId, 
        organizationId,
        policyNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({
        success: false,
        message: 'Failed to create policy'
      });
    }
  }
);

// Update policy
router.put(
  '/:id',
  authenticate,
  param('id').isUUID(),
  async (req: AuthRequest, res): Promise<void> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const policyId = req.params.id;
    const userId = (req as AuthRequest).user!.userId;
    const organizationId = (req as AuthRequest).user!.organizationId;
    const { status, premium, coverageAmount, endDate, statusChangeReason } = req.body;
    
    logger.info('Updating policy', { 
      requestId, 
      policyId, 
      userId, 
      organizationId,
      updates: { status, premium, coverageAmount, endDate: !!endDate },
      hasReason: !!statusChangeReason
    });
    
    try {
      // Get current policy for status history
      const currentPolicy = await prisma.policy.findUnique({
        where: { id: req.params.id }
      });

      if (!currentPolicy) {
        logger.warn('Policy update failed - policy not found', { requestId, policyId, userId });
        res.status(404).json({
          success: false,
          message: 'Policy not found'
        });
        return;
      }

      // Use transaction to update policy and create history entry atomically
      const result = await prisma.$transaction(async (tx) => {
        // Update the policy
        const updatedPolicy = await tx.policy.update({
          where: { id: req.params.id },
          data: {
            ...(status && { status }),
            ...(premium && { premium }),
            ...(coverageAmount && { coverageAmount }),
            ...(endDate && { endDate: new Date(endDate) })
          }
        });

        // Create status history entry if status changed
        if (status && status !== currentPolicy.status) {
          await tx.policyStatusHistory.create({
            data: {
              policyId: req.params.id,
              organizationId: currentPolicy.organizationId,
              oldStatus: currentPolicy.status,
              newStatus: status,
              changedBy: (req as AuthRequest).user!.userId,
              reason: statusChangeReason || undefined,
              metadata: {
                premiumChanged: premium !== undefined,
                coverageChanged: coverageAmount !== undefined,
                endDateChanged: endDate !== undefined
              }
            }
          });
          
          logger.info('Policy status changed', { 
            requestId, 
            policyId, 
            userId,
            oldStatus: currentPolicy.status, 
            newStatus: status,
            reason: statusChangeReason
          });
        }

        return updatedPolicy;
      });

      logger.info('Policy updated successfully', { 
        requestId, 
        policyId, 
        userId, 
        organizationId,
        statusChanged: status && status !== currentPolicy.status,
        newStatus: status
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        logger.warn('Policy update failed - policy not found', { requestId, policyId, userId });
        res.status(404).json({
          success: false,
          message: 'Policy not found'
        });
        return;
      }
      logger.error('Policy update failed', { 
        requestId, 
        policyId, 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update policy'
      });
    }
  }
);

// File claim from policy (workflow endpoint)
router.post('/:id/file-claim', authenticate, param('id').isUUID(), validate([
  body('incidentDate').isISO8601().withMessage('Valid incident date required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('claimAmount').isNumeric().withMessage('Claim amount must be numeric')
]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const policy = await prisma.policy.findUnique({
      where: { id: req.params.id }
    });

    if (!policy) {
      res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
      return;
    }

    if (policy.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: 'Claims can only be filed on ACTIVE policies'
      });
      return;
    }

    const { incidentDate, description, claimAmount } = req.body;

    // Call claims service to create claim
    const CLAIMS_SERVICE_URL = process.env.CLAIMS_SERVICE_URL || 'http://localhost:3004';
    const token = req.headers.authorization?.substring(7) || '';

    try {
      const claimResponse = await axios.post(
        `${CLAIMS_SERVICE_URL}/api/claims`,
        {
          userId: policy.userId,
          policyId: policy.id,
          claimNumber: `CLM-${Date.now()}`,
          incidentDate,
          description,
          claimAmount
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      res.status(201).json({
        success: true,
        data: claimResponse.data.data,
        message: 'Claim filed successfully'
      });
    } catch (claimError) {
      res.status(500).json({
        success: false,
        message: 'Failed to create claim'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to file claim'
    });
  }
});

// Get my policies (user-scoped endpoint)
router.get('/my/policies', authenticate, async (req: AuthRequest, res): Promise<void> => {
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

    const [policies, total] = await Promise.all([
      prisma.policy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.policy.count({ where })
    ]);

    res.json({
      success: true,
      data: policies,
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
      message: 'Failed to fetch your policies'
    });
  }
});

// Delete policy
router.delete('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    await prisma.policy.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to delete policy'
    });
  }
});

export default router;
