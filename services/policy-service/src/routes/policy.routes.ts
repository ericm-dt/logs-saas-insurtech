import { Router, Request, Response, NextFunction } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

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

// Validate user exists
async function validateUser(userId: string, token: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}/api/users/${userId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.success;
  } catch (error) {
    return false;
  }
}

// Get all policies
router.get('/', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { 
      status, 
      type, 
      userId, 
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
    if (userId) where.userId = userId;
    
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
    body('userId').notEmpty().withMessage('User ID is required'),
    body('policyNumber').notEmpty().withMessage('Policy number is required'),
    body('type').isIn(['AUTO', 'HOME', 'LIFE', 'HEALTH', 'BUSINESS']).withMessage('Invalid policy type'),
    body('startDate').isISO8601().withMessage('Valid start date required'),
    body('endDate').isISO8601().withMessage('Valid end date required'),
    body('premium').isNumeric().withMessage('Premium must be numeric'),
    body('coverageAmount').isNumeric().withMessage('Coverage amount must be numeric')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { userId, policyNumber, type, startDate, endDate, premium, coverageAmount, status } = req.body;

      // Validate user exists
      const token = req.headers.authorization?.substring(7) || '';
      const userExists = await validateUser(userId, token);
      
      if (!userExists) {
        res.status(400).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      const policy = await prisma.policy.create({        data: {
          userId,
          organizationId: (req as AuthRequest).user!.organizationId,
          policyNumber,
          type,
          status: status || 'PENDING',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          premium,
          coverageAmount
        }
      });

      res.status(201).json({
        success: true,
        data: policy
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(400).json({
          success: false,
          message: 'Policy number already exists'
        });
        return;
      }
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
    try {
      const { status, premium, coverageAmount, endDate, statusChangeReason } = req.body;

      // Get current policy for status history
      const currentPolicy = await prisma.policy.findUnique({
        where: { id: req.params.id }
      });

      if (!currentPolicy) {
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
        }

        return updatedPolicy;
      });

      res.json({
        success: true,
        data: result
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
        message: 'Failed to update policy'
      });
    }
  }
);

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
