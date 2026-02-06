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
  
  logger.info({ 
    requestId, 
    userId, 
    organizationId,
    operation: 'list_policies',
    filters: {
      status: req.query.status || 'all',
      type: req.query.type || 'all',
      queryUserId: req.query.userId,
      startDateFrom: req.query.startDateFrom,
      startDateTo: req.query.startDateTo,
      minPremium: req.query.minPremium,
      maxPremium: req.query.maxPremium,
      search: req.query.search
    },
    pagination: { page: req.query.page || '1', limit: req.query.limit || '50' },
    ip: req.ip,
    userAgent: req.get('user-agent')
  }, 'Fetching policies list for organization');
  
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

    logger.info({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'list_policies_success',
      results: {
        count: policies.length,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        hasMore: (pageNum * limitNum) < total
      },
      performance: {
        queryDuration,
        avgPerPolicy: policies.length > 0 ? (queryDuration / policies.length).toFixed(2) : 0
      },
      filters: {
        applied: Object.keys(where).length - 1, // -1 for organizationId
        types: where.type ? [where.type] : 'all',
        statuses: where.status ? [where.status] : 'all'
      }
    }, 'Policies fetched successfully for organization');

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
    logger.error({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'list_policies_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Error',
        stack: error instanceof Error ? error.stack : undefined
      },
      context: {
        filters: req.query,
        page: req.query.page || '1'
      }
    }, 'Failed to fetch policies for organization');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policies'
    });
  }
});

// Get policy by ID
router.get('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const policyId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    policyId, 
    userId, 
    organizationId,
    operation: 'get_policy_by_id',
    ip: req.ip
  }, 'Fetching policy by ID');

  try {
    const policy = await prisma.policy.findUnique({
      where: { id: req.params.id }
    });

    if (!policy) {
      logger.warn({ 
        requestId, 
        policyId, 
        userId, 
        organizationId,
        operation: 'get_policy_not_found'
      }, 'Policy not found by ID');
      res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
      return;
    }

    logger.info({ 
      requestId, 
      policyId: policy.id, 
      userId, 
      organizationId,
      operation: 'get_policy_success',
      policy: {
        policyNumber: policy.policyNumber,
        type: policy.type,
        status: policy.status,
        premium: policy.premium,
        coverageAmount: policy.coverageAmount
      }
    }, 'Policy retrieved successfully');

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      policyId, 
      userId, 
      organizationId,
      operation: 'get_policy_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch policy by ID');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy'
    });
  }
});

// Get policy status history
router.get('/:id/history', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const policyId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    policyId, 
    userId, 
    organizationId,
    operation: 'get_policy_history',
    ip: req.ip
  }, 'Fetching policy status history');

  try {
    const history = await prisma.policyStatusHistory.findMany({
      where: { policyId: req.params.id },
      orderBy: { changedAt: 'desc' }
    });

    logger.info({ 
      requestId, 
      policyId, 
      userId, 
      organizationId,
      operation: 'get_policy_history_success',
      historyCount: history.length,
      hasChanges: history.length > 0
    }, 'Policy history retrieved successfully');

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      policyId, 
      userId, 
      organizationId,
      operation: 'get_policy_history_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch policy history');
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
    
    logger.info({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'create_policy',
      policyData: {
        policyNumber, 
        type, 
        premium, 
        coverageAmount,
        status: req.body.status || 'PENDING',
        startDate: req.body.startDate,
        endDate: req.body.endDate
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    }, 'Creating new policy for organization');
    
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

      logger.info({ 
        requestId, 
        policyId: policy.id, 
        userId, 
        organizationId,
        operation: 'create_policy_success',
        policy: {
          id: policy.id,
          policyNumber, 
          type, 
          status: policy.status,
          premium,
          coverageAmount,
          startDate: policy.startDate,
          endDate: policy.endDate,
          createdAt: policy.createdAt
        },
        business: {
          policyValue: coverageAmount,
          annualPremium: premium,
          coverageRatio: (coverageAmount / premium).toFixed(2)
        }
      }, 'Policy created successfully for organization');

      res.status(201).json({
        success: true,
        data: policy
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        logger.warn({ 
          requestId, 
          userId, 
          organizationId,
          operation: 'create_policy_duplicate',
          policyNumber,
          attemptedType: type,
          errorCode: error.code
        }, 'Policy creation failed - duplicate policy number detected');
        res.status(400).json({
          success: false,
          message: 'Policy number already exists'
        });
        return;
      }
      logger.error({ 
        requestId, 
        userId, 
        organizationId,
        operation: 'create_policy_error',
        policyData: {
          policyNumber,
          type,
          premium,
          coverageAmount
        },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }, 'Policy creation failed unexpectedly');
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
    
    logger.info({ 
      requestId, 
      policyId, 
      userId, 
      organizationId,
      operation: 'update_policy',
      updates: { 
        status, 
        premium, 
        coverageAmount, 
        endDate: endDate ? new Date(endDate) : undefined,
        statusChangeReason
      },
      flags: {
        statusChanging: !!status,
        premiumChanging: premium !== undefined,
        coverageChanging: coverageAmount !== undefined,
        hasReason: !!statusChangeReason
      },
      ip: req.ip
    }, 'Updating policy for organization');
    
    try {
      // Get current policy for status history
      const currentPolicy = await prisma.policy.findUnique({
        where: { id: req.params.id }
      });

      if (!currentPolicy) {
        logger.warn({ 
          requestId, 
          policyId, 
          userId, 
          organizationId,
          operation: 'update_policy_not_found',
          attemptedUpdates: { status, premium, coverageAmount }
        }, 'Policy update failed - policy not found in organization');
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
          
          logger.info({ 
            requestId, 
            policyId, 
            userId,
            organizationId: currentPolicy.organizationId,
            operation: 'policy_status_transition',
            transition: {
              from: currentPolicy.status, 
              to: status,
              reason: statusChangeReason,
              changedBy: userId
            },
            policyDetails: {
              policyNumber: currentPolicy.policyNumber,
              type: currentPolicy.type,
              premium: currentPolicy.premium,
              coverageAmount: currentPolicy.coverageAmount
            }
          }, 'Policy status changed successfully');
        }

        return updatedPolicy;
      });

      logger.info({ 
        requestId, 
        policyId, 
        userId, 
        organizationId,
        operation: 'update_policy_success',
        changes: {
          statusChanged: status && status !== currentPolicy.status,
          newStatus: status,
          premiumChanged: premium !== undefined,
          coverageChanged: coverageAmount !== undefined,
          endDateChanged: endDate !== undefined
        },
        policySnapshot: {
          policyNumber: currentPolicy.policyNumber,
          type: currentPolicy.type,
          currentStatus: result.status
        }
      }, 'Policy updated successfully');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        logger.warn({ 
          requestId, 
          policyId, 
          userId,
          organizationId,
          operation: 'update_policy_not_found_transaction',
          errorCode: error.code
        }, 'Policy update failed - policy not found during transaction');
        res.status(404).json({
          success: false,
          message: 'Policy not found'
        });
        return;
      }
      logger.error({ 
        requestId, 
        policyId, 
        userId,
        organizationId,
        operation: 'update_policy_error',
        attemptedChanges: { status, premium, coverageAmount, endDate: !!endDate },
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Error',
          code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
          stack: error instanceof Error ? error.stack : undefined
        }
      }, 'Policy update failed unexpectedly');
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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const policyId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;
  const { incidentDate, description, claimAmount } = req.body;

  logger.info({ 
    requestId, 
    policyId, 
    userId, 
    organizationId,
    operation: 'file_claim_from_policy',
    claimAmount,
    incidentDate,
    ip: req.ip
  }, 'Filing claim from policy endpoint');

  try {
    const policy = await prisma.policy.findUnique({
      where: { id: req.params.id }
    });

    if (!policy) {
      logger.warn({ 
        requestId, 
        policyId, 
        userId, 
        organizationId,
        operation: 'file_claim_policy_not_found'
      }, 'Cannot file claim - policy not found');
      res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
      return;
    }

    if (policy.status !== 'ACTIVE') {
      logger.warn({ 
        requestId, 
        policyId, 
        userId, 
        organizationId,
        policyStatus: policy.status,
        operation: 'file_claim_policy_inactive'
      }, 'Cannot file claim - policy is not active');
      res.status(400).json({
        success: false,
        message: 'Claims can only be filed on ACTIVE policies'
      });
      return;
    }

    // Call claims service to create claim
    const CLAIMS_SERVICE_URL = process.env.CLAIMS_SERVICE_URL || 'http://localhost:3004';
    const token = req.headers.authorization?.substring(7) || '';
    const claimNumber = `CLM-${Date.now()}`;

    logger.info({ 
      requestId, 
      policyId, 
      claimNumber,
      serviceUrl: CLAIMS_SERVICE_URL,
      operation: 'file_claim_calling_claims_service'
    }, 'Calling claims service to create claim');

    try {
      const startTime = Date.now();
      const claimResponse = await axios.post(
        `${CLAIMS_SERVICE_URL}/api/claims`,
        {
          userId: policy.userId,
          policyId: policy.id,
          claimNumber,
          incidentDate,
          description,
          claimAmount
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const duration = Date.now() - startTime;

      logger.info({ 
        requestId, 
        policyId, 
        claimId: claimResponse.data.data?.id,
        claimNumber,
        userId, 
        organizationId,
        operation: 'file_claim_success',
        claimAmount,
        performance: {
          claimsServiceDuration: duration
        }
      }, 'Claim filed successfully from policy');

      res.status(201).json({
        success: true,
        data: claimResponse.data.data,
        message: 'Claim filed successfully'
      });
    } catch (claimError) {
      logger.error({ 
        requestId, 
        policyId, 
        claimNumber,
        serviceUrl: CLAIMS_SERVICE_URL,
        operation: 'file_claim_service_error',
        error: {
          message: claimError instanceof Error ? claimError.message : 'Unknown error',
          isAxiosError: (claimError as any).isAxiosError,
          responseStatus: (claimError as any).response?.status
        }
      }, 'Claims service call failed');
      res.status(500).json({
        success: false,
        message: 'Failed to create claim'
      });
    }
  } catch (error) {
    logger.error({ 
      requestId, 
      policyId, 
      userId, 
      organizationId,
      operation: 'file_claim_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to file claim from policy');
    res.status(500).json({
      success: false,
      message: 'Failed to file claim'
    });
  }
});

// Get my policies (user-scoped endpoint)
router.get('/my/policies', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    userId, 
    organizationId,
    operation: 'get_my_policies',
    filters: req.query,
    ip: req.ip
  }, 'Fetching user-scoped policies');

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

    logger.info({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'get_my_policies_success',
      results: {
        count: policies.length,
        total,
        page: pageNum,
        limit: limitNum
      },
      performance: {
        queryDuration
      }
    }, 'User policies fetched successfully');

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
    logger.error({ 
      requestId, 
      userId, 
      organizationId,
      operation: 'get_my_policies_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch user policies');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your policies'
    });
  }
});

// Delete policy
router.delete('/:id', authenticate, param('id').isUUID(), async (req: AuthRequest, res): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const policyId = req.params.id;
  const userId = (req as AuthRequest).user!.userId;
  const organizationId = (req as AuthRequest).user!.organizationId;

  logger.info({ 
    requestId, 
    policyId, 
    userId, 
    organizationId,
    operation: 'delete_policy',
    ip: req.ip
  }, 'Deleting policy');

  try {
    await prisma.policy.delete({
      where: { id: req.params.id }
    });

    logger.info({ 
      requestId, 
      policyId, 
      userId, 
      organizationId,
      operation: 'delete_policy_success'
    }, 'Policy deleted successfully');

    res.json({
      success: true,
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      logger.warn({ 
        requestId, 
        policyId, 
        userId, 
        organizationId,
        operation: 'delete_policy_not_found',
        errorCode: error.code
      }, 'Policy deletion failed - policy not found');
      res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
      return;
    }
    logger.error({ 
      requestId, 
      policyId, 
      userId, 
      organizationId,
      operation: 'delete_policy_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to delete policy');
    res.status(500).json({
      success: false,
      message: 'Failed to delete policy'
    });
  }
});

export default router;
