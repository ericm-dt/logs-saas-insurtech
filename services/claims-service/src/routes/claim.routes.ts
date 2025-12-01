import { Router, Request, Response, NextFunction } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://localhost:3003';

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

// Validate policy exists and is active
async function validatePolicy(policyId: string, token: string): Promise<{ valid: boolean; policy?: any }> {
  try {
    const response = await axios.get(
      `${POLICY_SERVICE_URL}/api/policies/${policyId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (response.data.success) {
      const policy = response.data.data;
      if (policy.status === 'ACTIVE') {
        return { valid: true, policy };
      }
    }
    return { valid: false };
  } catch (error) {
    return { valid: false };
  }
}

// Get all claims
router.get('/', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const {
      status,
      policyId,
      userId,
      incidentDateFrom,
      incidentDateTo,
      minClaimAmount,
      maxClaimAmount,
      search,
      page = '1',
      limit = '50'
    } = req.query;

    // Build dynamic where clause
    const where: any = {
      organizationId: (req as AuthRequest).user!.organizationId // Multi-tenant filter
    };

    if (status) where.status = status;
    if (policyId) where.policyId = policyId;
    if (userId) where.userId = userId;

    // Incident date range
    if (incidentDateFrom || incidentDateTo) {
      where.incidentDate = {};
      if (incidentDateFrom) where.incidentDate.gte = new Date(incidentDateFrom as string);
      if (incidentDateTo) where.incidentDate.lte = new Date(incidentDateTo as string);
    }

    // Claim amount range
    if (minClaimAmount || maxClaimAmount) {
      where.claimAmount = {};
      if (minClaimAmount) where.claimAmount.gte = parseFloat(minClaimAmount as string);
      if (maxClaimAmount) where.claimAmount.lte = parseFloat(maxClaimAmount as string);
    }

    // Search by claim number or description
    if (search) {
      where.OR = [
        { claimNumber: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.claim.count({ where })
    ]);

    res.json({
      success: true,
      data: claims,
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
      message: 'Failed to fetch claims'
    });
  }
});

// Get claim by ID
router.get('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id }
    });

    if (!claim) {
      res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
      return;
    }

    res.json({
      success: true,
      data: claim
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim'
    });
  }
});

// Get claim status history
router.get('/:id/history', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    const history = await prisma.claimStatusHistory.findMany({
      where: { claimId: req.params.id },
      orderBy: { changedAt: 'desc' }
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim history'
    });
  }
});

// Create claim
router.post(
  '/',
  authenticate,
  validate([
    body('policyId').notEmpty().withMessage('Policy ID is required'),
    body('claimNumber').notEmpty().withMessage('Claim number is required'),
    body('incidentDate').isISO8601().withMessage('Valid incident date required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('claimAmount').isNumeric().withMessage('Claim amount must be numeric')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { policyId, claimNumber, incidentDate, description, claimAmount } = req.body;
      
      // Use userId from authenticated token
      const userId = (req as AuthRequest).user!.userId;

      const token = req.headers.authorization?.substring(7) || '';

      // Validate policy exists and is active
      const policyValidation = await validatePolicy(policyId, token);
      if (!policyValidation.valid) {
        res.status(400).json({
          success: false,
          message: 'Policy not found or not active'
        });
        return;
      }

      // Verify policy belongs to same organization (multi-tenant security)
      if (policyValidation.policy.organizationId !== (req as AuthRequest).user!.organizationId) {
        res.status(403).json({
          success: false,
          message: 'Policy belongs to a different organization'
        });
        return;
      }

      const claim = await prisma.claim.create({
        data: {
          userId,
          organizationId: (req as AuthRequest).user!.organizationId,
          policyId,
          claimNumber,
          incidentDate: new Date(incidentDate),
          description,
          claimAmount,
          status: 'SUBMITTED'
        }
      });

      res.status(201).json({
        success: true,
        data: claim
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        res.status(400).json({
          success: false,
          message: 'Claim number already exists'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to create claim'
      });
    }
  }
);

// Update claim status (workflow transitions)
router.put(
  '/:id/status',
  authenticate,
  param('id').isUUID(),
  validate([
    body('status').isIn(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'PAID'])
      .withMessage('Invalid status'),
    body('approvedAmount').optional().isNumeric().withMessage('Approved amount must be numeric'),
    body('denialReason').optional().isString().withMessage('Denial reason must be string')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { status, approvedAmount, denialReason } = req.body;

      // Business logic: validate status transitions
      const currentClaim = await prisma.claim.findUnique({
        where: { id: req.params.id }
      });

      if (!currentClaim) {
        res.status(404).json({
          success: false,
          message: 'Claim not found'
        });
        return;
      }

      // Validate status workflow
      const validTransitions: Record<string, string[]> = {
        SUBMITTED: ['UNDER_REVIEW', 'DENIED'],
        UNDER_REVIEW: ['APPROVED', 'DENIED'],
        APPROVED: ['PAID'],
        DENIED: [],
        PAID: []
      };

      if (!validTransitions[currentClaim.status].includes(status)) {
        res.status(400).json({
          success: false,
          message: `Invalid status transition from ${currentClaim.status} to ${status}`
        });
        return;
      }

      // Require approval amount for APPROVED status
      if (status === 'APPROVED' && !approvedAmount) {
        res.status(400).json({
          success: false,
          message: 'Approved amount required for APPROVED status'
        });
        return;
      }

      // Require denial reason for DENIED status
      if (status === 'DENIED' && !denialReason) {
        res.status(400).json({
          success: false,
          message: 'Denial reason required for DENIED status'
        });
        return;
      }

      // Use transaction to update claim and create history entry atomically
      const result = await prisma.$transaction(async (tx: any) => {
        // Update the claim
        const updatedClaim = await tx.claim.update({
          where: { id: req.params.id },
          data: {
            status,
            ...(approvedAmount && { approvedAmount }),
            ...(denialReason && { denialReason })
          }
        });

        // Create status history entry
        await tx.claimStatusHistory.create({
          data: {
            claimId: req.params.id,
            organizationId: currentClaim.organizationId,
            oldStatus: currentClaim.status,
            newStatus: status,
            changedBy: (req as AuthRequest).user!.userId,
            reason: denialReason || undefined,
            metadata: {
              approvedAmount: approvedAmount || null,
              previousStatus: currentClaim.status
            }
          }
        });

        return updatedClaim;
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        res.status(404).json({
          success: false,
          message: 'Claim not found'
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to update claim status'
      });
    }
  }
);

// Approve claim (workflow action)
router.post('/:id/approve', authenticate, param('id').isUUID(), validate([
  body('approvedAmount').isNumeric().withMessage('Approved amount must be numeric'),
  body('reason').optional().isString().withMessage('Reason must be string')
]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { approvedAmount, reason } = req.body;
    
    const currentClaim = await prisma.claim.findUnique({
      where: { id: req.params.id }
    });

    if (!currentClaim) {
      res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
      return;
    }

    if (currentClaim.status !== 'UNDER_REVIEW') {
      res.status(400).json({
        success: false,
        message: 'Only claims under review can be approved'
      });
      return;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedClaim = await tx.claim.update({
        where: { id: req.params.id },
        data: {
          status: 'APPROVED',
          approvedAmount
        }
      });

      await tx.claimStatusHistory.create({
        data: {
          claimId: req.params.id,
          organizationId: currentClaim.organizationId,
          oldStatus: currentClaim.status,
          newStatus: 'APPROVED',
          changedBy: (req as AuthRequest).user!.userId,
          reason: reason || 'Claim approved',
          metadata: { approvedAmount }
        }
      });

      return updatedClaim;
    });

    res.json({
      success: true,
      data: result,
      message: 'Claim approved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve claim'
    });
  }
});

// Deny claim (workflow action)
router.post('/:id/deny', authenticate, param('id').isUUID(), validate([
  body('reason').notEmpty().withMessage('Denial reason is required')
]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { reason } = req.body;
    
    const currentClaim = await prisma.claim.findUnique({
      where: { id: req.params.id }
    });

    if (!currentClaim) {
      res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
      return;
    }

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(currentClaim.status)) {
      res.status(400).json({
        success: false,
        message: 'Only submitted or under-review claims can be denied'
      });
      return;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedClaim = await tx.claim.update({
        where: { id: req.params.id },
        data: {
          status: 'DENIED',
          denialReason: reason
        }
      });

      await tx.claimStatusHistory.create({
        data: {
          claimId: req.params.id,
          organizationId: currentClaim.organizationId,
          oldStatus: currentClaim.status,
          newStatus: 'DENIED',
          changedBy: (req as AuthRequest).user!.userId,
          reason,
          metadata: { denialReason: reason }
        }
      });

      return updatedClaim;
    });

    res.json({
      success: true,
      data: result,
      message: 'Claim denied'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to deny claim'
    });
  }
});

// Get my claims (user-scoped endpoint)
router.get('/my/claims', authenticate, async (req: AuthRequest, res): Promise<void> => {
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

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.claim.count({ where })
    ]);

    res.json({
      success: true,
      data: claims,
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
      message: 'Failed to fetch your claims'
    });
  }
});

// Delete claim
router.delete('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  try {
    await prisma.claim.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Claim deleted successfully'
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to delete claim'
    });
  }
});

export default router;
