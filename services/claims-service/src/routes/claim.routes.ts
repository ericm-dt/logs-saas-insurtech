import { Router, Request, Response, NextFunction } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
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

// Get all claims
router.get('/', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const claims = await prisma.claim.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: claims
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

// Create claim
router.post(
  '/',
  authenticate,
  validate([
    body('userId').notEmpty().withMessage('User ID is required'),
    body('policyId').notEmpty().withMessage('Policy ID is required'),
    body('claimNumber').notEmpty().withMessage('Claim number is required'),
    body('incidentDate').isISO8601().withMessage('Valid incident date required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('claimAmount').isNumeric().withMessage('Claim amount must be numeric')
  ]),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { userId, policyId, claimNumber, incidentDate, description, claimAmount } = req.body;

      const token = req.headers.authorization?.substring(7) || '';

      // Validate user exists
      const userExists = await validateUser(userId, token);
      if (!userExists) {
        res.status(400).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Validate policy exists and is active
      const policyValidation = await validatePolicy(policyId, token);
      if (!policyValidation.valid) {
        res.status(400).json({
          success: false,
          message: 'Policy not found or not active'
        });
        return;
      }

      // Verify user owns the policy
      if (policyValidation.policy.userId !== userId) {
        res.status(400).json({
          success: false,
          message: 'Policy does not belong to this user'
        });
        return;
      }

      const claim = await prisma.claim.create({
        data: {
          userId,
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

      const claim = await prisma.claim.update({
        where: { id: req.params.id },
        data: {
          status,
          ...(approvedAmount && { approvedAmount }),
          ...(denialReason && { denialReason })
        }
      });

      res.json({
        success: true,
        data: claim
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
