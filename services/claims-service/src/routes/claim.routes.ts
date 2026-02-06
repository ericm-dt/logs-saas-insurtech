import { Router, Request, Response, NextFunction } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://policy-service:3003';

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
  const requestId = `policy_val_${Date.now()}`;
  
  logger.debug({ 
    requestId, 
    policyId, 
    operation: 'validate_policy',
    serviceUrl: POLICY_SERVICE_URL,
    hasAuth: !!token
  }, 'Starting policy validation with policy-service');
  
  try {
    const startTime = Date.now();
    const response = await axios.get(
      `${POLICY_SERVICE_URL}/api/policies/${policyId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const duration = Date.now() - startTime;
    
    if (response.data.success) {
      const policy = response.data.data;
      const isActive = policy.status === 'ACTIVE';
      
      logger.debug({ 
        requestId, 
        policyId, 
        operation: 'validate_policy_success',
        validation: {
          isActive, 
          policyStatus: policy.status,
          policyType: policy.type,
          policyNumber: policy.policyNumber,
          policyOrganizationId: policy.organizationId
        },
        performance: {
          duration,
          responseTime: `${duration}ms`
        }
      }, 'Policy validation complete from policy-service');
      
      if (isActive) {
        return { valid: true, policy };
      }
    }
    return { valid: false };
  } catch (error) {
    logger.error({ 
      requestId, 
      policyId, 
      operation: 'validate_policy_error',
      service: 'policy-service',
      serviceUrl: POLICY_SERVICE_URL,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Error',
        code: (error as any).code,
        isAxiosError: (error as any).isAxiosError
      }
    }, 'Policy validation failed - policy service unavailable or error');
    return { valid: false };
  }
}

// Get all claims
router.get('/', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    userId, 
    organizationId,
    operation: 'list_claims',
    filters: req.query,
    ip: req.ip
  }, 'Fetching claims list for organization');

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

    const startTime = Date.now();
    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.claim.count({ where })
    ]);
    const queryDuration = Date.now() - startTime;

    logger.info({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'list_claims_success',
      results: {
        count: claims.length,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        hasMore: (pageNum * limitNum) < total
      },
      performance: {
        queryDuration,
        avgPerClaim: claims.length > 0 ? (queryDuration / claims.length).toFixed(2) : 0
      },
      filters: {
        applied: Object.keys(where).length - 1, // -1 for organizationId
        hasDateFilter: !!(incidentDateFrom || incidentDateTo),
        hasAmountFilter: !!(minClaimAmount || maxClaimAmount)
      }
    }, `Claims fetched successfully - ${claims.length} of ${total} total`);

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
    logger.error({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'list_claims_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch claims');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    });
  }
});

// Get claim by ID
router.get('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const claimId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    claimId, 
    userId, 
    organizationId,
    operation: 'get_claim_by_id',
    ip: req.ip
  }, 'Fetching claim by ID');

  try {
    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id }
    });

    if (!claim) {
      logger.warn({ 
        requestId, 
        claimId, 
        userId, 
        organizationId,
        operation: 'get_claim_not_found'
      }, 'Claim not found by ID');
      res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
      return;
    }

    logger.info({ 
      requestId, 
      claimId: claim.id, 
      userId, 
      organizationId,
      operation: 'get_claim_success',
      claim: {
        claimNumber: claim.claimNumber,
        status: claim.status,
        claimAmount: claim.claimAmount,
        approvedAmount: claim.approvedAmount,
        policyId: claim.policyId
      }
    }, 'Claim retrieved successfully');

    res.json({
      success: true,
      data: claim
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'get_claim_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch claim by ID');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim'
    });
  }
});

// Get claim status history
router.get('/:id/history', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const claimId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    claimId, 
    userId, 
    organizationId,
    operation: 'get_claim_history',
    ip: req.ip
  }, 'Fetching claim status history');

  try {
    const history = await prisma.claimStatusHistory.findMany({
      where: { claimId: req.params.id },
      orderBy: { changedAt: 'desc' }
    });

    logger.info({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'get_claim_history_success',
      historyCount: history.length,
      hasChanges: history.length > 0
    }, 'Claim history retrieved successfully');

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'get_claim_history_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch claim history');
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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { policyId, claimNumber, claimAmount, description } = req.body;
    const userId = (req as AuthRequest).user!.userId;
    const organizationId = (req as AuthRequest).user!.organizationId;
    
    logger.info({ 
      requestId, 
      userId, 
      organizationId, 
      policyId, 
      claimNumber, 
      claimAmount,
      operation: 'create_claim',
      claimData: {
        claimNumber,
        claimAmount,
        description: req.body.description?.substring(0, 100), // First 100 chars
        incidentDate: req.body.incidentDate
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    }, 'Creating new claim for policy');
    
    try {
      const { incidentDate } = req.body;

      const token = req.headers.authorization?.substring(7) || '';

      // Validate policy exists and is active
      logger.debug({ 
        requestId, 
        policyId,
        operation: 'validate_policy_for_claim', 
        claimNumber
      }, 'Validating policy status before claim creation');
      const policyValidation = await validatePolicy(policyId, token);
      
      if (!policyValidation.valid) {
        logger.warn({ 
          requestId, 
          userId, 
          organizationId,
          policyId, 
          claimNumber,
          operation: 'create_claim_invalid_policy',
          validationResult: 'policy_not_active_or_not_found'
        }, 'Claim creation rejected - policy validation failed');
        res.status(400).json({
          success: false,
          message: 'Policy not found or not active'
        });
        return;
      }

      // Verify policy belongs to same organization (multi-tenant security)
      if (policyValidation.policy.organizationId !== organizationId) {
        logger.error({ 
          requestId, 
          userId, 
          userOrgId: organizationId,
          policyOrgId: policyValidation.policy.organizationId, 
          policyId,
          claimNumber,
          operation: 'create_claim_security_violation',
          securityEvent: 'cross_organization_access_attempt',
          ip: req.ip
        }, 'SECURITY VIOLATION - Cross-organization claim creation attempt blocked');
        res.status(403).json({
          success: false,
          message: 'Policy belongs to a different organization'
        });
        return;
      }

      const claim = await prisma.claim.create({
        data: {
          userId,
          organizationId,
          policyId,
          claimNumber,
          incidentDate: new Date(incidentDate),
          description,
          claimAmount,
          status: 'SUBMITTED'
        }
      });

      logger.info({ 
        requestId, 
        claimId: claim.id, 
        userId, 
        organizationId,
        policyId, 
        claimNumber, 
        claimAmount,
        status: claim.status,
        createdAt: claim.createdAt,
        operation: 'create_claim_success',
        claim: {
          id: claim.id,
          claimNumber,
          status: 'SUBMITTED',
          amount: claimAmount,
          incidentDate: claim.incidentDate
        },
        policy: {
          id: policyId,
          type: policyValidation.policy.type,
          number: policyValidation.policy.policyNumber
        }
      }, 'Claim created and submitted successfully');

      res.status(201).json({
        success: true,
        data: claim
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        logger.warn({ 
          requestId, 
          userId, 
          organizationId,
          claimNumber,
          operation: 'create_claim_duplicate',
          errorCode: error.code
        }, 'Claim creation failed - duplicate claim number detected');
        res.status(400).json({
          success: false,
          message: 'Claim number already exists'
        });
        return;
      }
      logger.error({ 
        requestId, 
        userId, 
        organizationId,
        policyId,
        claimNumber,
        operation: 'create_claim_error',
        claimData: {
          claimNumber,
          claimAmount,
          policyId
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }, 'Claim creation failed unexpectedly');
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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const claimId = req.params.id;
    const { status, approvedAmount, denialReason } = req.body;
    const userId = (req as AuthRequest).user!.userId;
    
    logger.info({ 
      requestId, 
      claimId, 
      userId,
      operation: 'update_claim_status', 
      transition: {
        newStatus: status, 
        approvedAmount, 
        hasDenialReason: !!denialReason
      },
      ip: req.ip
    }, 'Updating claim status - workflow transition');
    
    try {
      // Business logic: validate status transitions
      const currentClaim = await prisma.claim.findUnique({
        where: { id: req.params.id }
      });

      if (!currentClaim) {
        logger.warn({ 
          requestId, 
          claimId, 
          userId,
          operation: 'update_claim_not_found'
        }, 'Claim status update failed - claim not found in database');
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
        logger.warn({ 
          requestId, 
          claimId, 
          userId,
          organizationId: currentClaim.organizationId,
          currentStatus: currentClaim.status, 
          requestedStatus: status,
          validTransitions: validTransitions[currentClaim.status],
          operation: 'update_claim_invalid_transition',
          workflow: 'claims_status_machine'
        }, 'Invalid claim status transition attempted - workflow violation');
        res.status(400).json({
          success: false,
          message: `Invalid status transition from ${currentClaim.status} to ${status}`
        });
        return;
      }

      // Require approval amount for APPROVED status
      if (status === 'APPROVED' && !approvedAmount) {
        logger.warn({ 
          requestId, 
          claimId, 
          userId,
          operation: 'update_claim_approval_missing_amount',
          claimAmount: currentClaim.claimAmount
        }, 'Claim approval rejected - approved amount is required');
        res.status(400).json({
          success: false,
          message: 'Approved amount required for APPROVED status'
        });
        return;
      }

      // Require denial reason for DENIED status
      if (status === 'DENIED' && !denialReason) {
        logger.warn({ 
          requestId, 
          claimId, 
          userId,
          operation: 'update_claim_denial_missing_reason'
        }, 'Claim denial rejected - denial reason is required');
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

      logger.info({ 
        requestId, 
        claimId, 
        userId,
        organizationId: currentClaim.organizationId,
        oldStatus: currentClaim.status, 
        newStatus: status,
        approvedAmount,
        claimAmount: currentClaim.claimAmount,
        operation: 'update_claim_success',
        statusHistory: {
          from: currentClaim.status,
          to: status,
          changedBy: userId,
          reason: denialReason || 'Status update'
        },
        business: {
          requested: currentClaim.claimAmount,
          approved: approvedAmount || null,
          approvalRate: approvedAmount ? ((approvedAmount / currentClaim.claimAmount) * 100).toFixed(2) + '%' : null
        }
      }, 'Claim status updated successfully');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        logger.warn({ \n          requestId, \n          claimId, \n          userId,\n          operation: 'update_claim_not_found_transaction',\n          errorCode: error.code\n        }, 'Claim status update failed - claim not found during transaction');
        res.status(404).json({
          success: false,
          message: 'Claim not found'
        });
        return;
      }
      logger.error({ 
        requestId, 
        claimId, 
        userId,
        operation: 'update_claim_error',
        attemptedStatus: status,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }, 'Claim status update failed unexpectedly');
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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const claimId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;
  const { approvedAmount, reason } = req.body;

  logger.info({ 
    requestId, 
    claimId, 
    userId, 
    organizationId,
    operation: 'approve_claim',
    approvedAmount,
    reason,
    ip: req.ip
  }, 'Approving claim');

  try {
    const currentClaim = await prisma.claim.findUnique({
      where: { id: req.params.id }
    });

    if (!currentClaim) {
      logger.warn({ 
        requestId, 
        claimId, 
        userId, 
        organizationId,
        operation: 'approve_claim_not_found'
      }, 'Claim approval failed - claim not found');
      res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
      return;
    }

    if (currentClaim.status !== 'UNDER_REVIEW') {
      logger.warn({ 
        requestId, 
        claimId, 
        userId, 
        organizationId,
        operation: 'approve_claim_invalid_status',
        currentStatus: currentClaim.status
      }, 'Claim approval failed - invalid status (must be UNDER_REVIEW)');
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

    const approvalRate = ((approvedAmount / currentClaim.claimAmount) * 100).toFixed(2);

    logger.info({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'approve_claim_success',
      workflow: {
        from: currentClaim.status,
        to: 'APPROVED',
        changedBy: userId,
        reason: reason || 'Claim approved'
      },
      amounts: {
        requested: currentClaim.claimAmount,
        approved: approvedAmount,
        approvalRate: approvalRate + '%'
      },
      claim: {
        claimNumber: currentClaim.claimNumber,
        policyId: currentClaim.policyId
      }
    }, `Claim approved - ${approvalRate}% of requested amount`);

    res.json({
      success: true,
      data: result,
      message: 'Claim approved successfully'
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'approve_claim_error',
      approvedAmount,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to approve claim');
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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const claimId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;
  const { reason } = req.body;

  logger.info({ 
    requestId, 
    claimId, 
    userId, 
    organizationId,
    operation: 'deny_claim',
    reason,
    ip: req.ip
  }, 'Denying claim');

  try {
    const currentClaim = await prisma.claim.findUnique({
      where: { id: req.params.id }
    });

    if (!currentClaim) {
      logger.warn({ 
        requestId, 
        claimId, 
        userId, 
        organizationId,
        operation: 'deny_claim_not_found'
      }, 'Claim denial failed - claim not found');
      res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
      return;
    }

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(currentClaim.status)) {
      logger.warn({ 
        requestId, 
        claimId, 
        userId, 
        organizationId,
        operation: 'deny_claim_invalid_status',
        currentStatus: currentClaim.status
      }, 'Claim denial failed - invalid status (must be SUBMITTED or UNDER_REVIEW)');
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

    logger.info({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'deny_claim_success',
      workflow: {
        from: currentClaim.status,
        to: 'DENIED',
        changedBy: userId,
        reason
      },
      claim: {
        claimNumber: currentClaim.claimNumber,
        policyId: currentClaim.policyId,
        claimAmount: currentClaim.claimAmount
      }
    }, 'Claim denied');

    res.json({
      success: true,
      data: result,
      message: 'Claim denied'
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'deny_claim_error',
      reason,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to deny claim');
    res.status(500).json({
      success: false,
      message: 'Failed to deny claim'
    });
  }
});

// Get my claims (user-scoped endpoint)
router.get('/my/claims', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    userId, 
    organizationId,
    operation: 'get_my_claims',
    filters: req.query,
    ip: req.ip
  }, 'Fetching user-scoped claims');

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
    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.claim.count({ where })
    ]);
    const queryDuration = Date.now() - startTime;

    logger.info({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'get_my_claims_success',
      results: {
        count: claims.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      },
      performance: { queryDuration }
    }, 'User claims fetched successfully');

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
    logger.error({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'get_my_claims_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch user claims');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your claims'
    });
  }
});

// Delete claim
router.delete('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const claimId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    claimId, 
    userId, 
    organizationId,
    operation: 'delete_claim',
    ip: req.ip
  }, 'Deleting claim');

  try {
    await prisma.claim.delete({
      where: { id: req.params.id }
    });

    logger.info({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'delete_claim_success'
    }, 'Claim deleted successfully');

    res.json({
      success: true,
      message: 'Claim deleted successfully'
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      logger.warn({ 
        requestId, 
        claimId, 
        userId, 
        organizationId,
        operation: 'delete_claim_not_found',
        errorCode: error.code
      }, 'Claim deletion failed - claim not found');
      res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
      return;
    }
    logger.error({ 
      requestId, 
      claimId, 
      userId, 
      organizationId,
      operation: 'delete_claim_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to delete claim');
    res.status(500).json({
      success: false,
      message: 'Failed to delete claim'
    });
  }
});

export default router;
