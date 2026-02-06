import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import logger from '../utils/logger';

const router = Router();

// Get all organizations
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.info({ 
    requestId, 
    operation: 'list_organizations',
    ip: req.ip
  }, 'Fetching all organizations');

  try {
    const startTime = Date.now();
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { users: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    const queryDuration = Date.now() - startTime;

    logger.info({ 
      requestId, 
      operation: 'list_organizations_success',
      results: { count: organizations.length },
      performance: { queryDuration }
    }, `Fetched ${organizations.length} organization(s)`);

    res.json({ success: true, data: organizations });
  } catch (error) {
    logger.error({ 
      requestId, 
      operation: 'list_organizations_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch organizations');
    const message = error instanceof Error ? error.message : 'Failed to fetch organizations';
    res.status(500).json({ success: false, message });
  }
});

// Get organization by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const organizationId = req.params.id;

  logger.info({ 
    requestId, 
    organizationId,
    operation: 'get_organization_by_id',
    ip: req.ip
  }, 'Fetching organization by ID');

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { users: true }
        }
      }
    });

    if (!organization) {
      logger.warn({ 
        requestId, 
        organizationId,
        operation: 'get_organization_not_found'
      }, 'Organization not found');
      res.status(404).json({ success: false, message: 'Organization not found' });
      return;
    }

    logger.info({ 
      requestId, 
      organizationId,
      operation: 'get_organization_success',
      organization: {
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        userCount: organization._count.users
      }
    }, 'Organization fetched successfully');

    res.json({ success: true, data: organization });
  } catch (error) {
    logger.error({ 
      requestId, 
      organizationId,
      operation: 'get_organization_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch organization');
    const message = error instanceof Error ? error.message : 'Failed to fetch organization';
    res.status(500).json({ success: false, message });
  }
});

// Get organization by slug
router.get('/slug/:slug', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const slug = req.params.slug;

  logger.info({ 
    requestId, 
    slug,
    operation: 'get_organization_by_slug',
    ip: req.ip
  }, 'Fetching organization by slug');

  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { users: true }
        }
      }
    });

    if (!organization) {
      logger.warn({ 
        requestId, 
        slug,
        operation: 'get_organization_by_slug_not_found'
      }, 'Organization not found by slug');
      res.status(404).json({ success: false, message: 'Organization not found' });
      return;
    }

    logger.info({ 
      requestId, 
      slug,
      organizationId: organization.id,
      operation: 'get_organization_by_slug_success',
      organization: {
        name: organization.name,
        plan: organization.plan,
        userCount: organization._count.users
      }
    }, 'Organization fetched by slug successfully');

    res.json({ success: true, data: organization });
  } catch (error) {
    logger.error({ 
      requestId, 
      slug,
      operation: 'get_organization_by_slug_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch organization by slug');
    const message = error instanceof Error ? error.message : 'Failed to fetch organization';
    res.status(500).json({ success: false, message });
  }
});

// Update organization
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const organizationId = req.params.id;
  const { name, slug, plan } = req.body;

  logger.info({ 
    requestId, 
    organizationId,
    operation: 'update_organization',
    updates: { name, slug, plan },
    ip: req.ip
  }, 'Updating organization');

  try {
    // If slug is being updated, check if it's available
    if (slug) {
      const existing = await prisma.organization.findFirst({
        where: {
          slug,
          NOT: { id: req.params.id }
        }
      });
      
      if (existing) {
        logger.warn({ 
          requestId, 
          organizationId,
          slug,
          operation: 'update_organization_slug_conflict',
          conflictingOrgId: existing.id
        }, 'Organization slug already exists');
        res.status(400).json({ success: false, message: 'Organization slug already exists' });
        return;
      }
    }

    const organization = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(plan && { plan }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { users: true }
        }
      }
    });

    logger.info({ 
      requestId, 
      organizationId,
      operation: 'update_organization_success',
      organization: {
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        userCount: organization._count.users
      }
    }, 'Organization updated successfully');

    res.json({ success: true, data: organization });
  } catch (error) {
    logger.error({ 
      requestId, 
      organizationId,
      operation: 'update_organization_error',
      updates: { name, slug, plan },
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to update organization');
    const message = error instanceof Error ? error.message : 'Failed to update organization';
    res.status(400).json({ success: false, message });
  }
});

// Delete organization
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const organizationId = req.params.id;

  logger.info({ 
    requestId, 
    organizationId,
    operation: 'delete_organization',
    ip: req.ip
  }, 'Attempting to delete organization');

  try {
    // Check if organization has users
    const userCount = await prisma.user.count({
      where: { organizationId: req.params.id }
    });

    if (userCount > 0) {
      logger.warn({ 
        requestId, 
        organizationId,
        operation: 'delete_organization_has_users',
        userCount
      }, `Cannot delete organization with ${userCount} user(s)`);
      res.status(400).json({ 
        success: false, 
        message: `Cannot delete organization with ${userCount} user(s). Remove users first.` 
      });
      return;
    }

    await prisma.organization.delete({
      where: { id: req.params.id },
    });

    logger.info({ 
      requestId, 
      organizationId,
      operation: 'delete_organization_success'
    }, 'Organization deleted successfully');

    res.json({ success: true, message: 'Organization deleted' });
  } catch (error) {
    logger.error({ 
      requestId, 
      organizationId,
      operation: 'delete_organization_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to delete organization');
    const message = error instanceof Error ? error.message : 'Failed to delete organization';
    res.status(400).json({ success: false, message });
  }
});

// Get users in an organization
router.get('/:id/users', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const organizationId = req.params.id;

  logger.info({ 
    requestId, 
    organizationId,
    operation: 'get_organization_users',
    ip: req.ip
  }, 'Fetching organization users');

  try {
    const startTime = Date.now();
    const users = await prisma.user.findMany({
      where: { organizationId: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        orgRole: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    const queryDuration = Date.now() - startTime;

    logger.info({ 
      requestId, 
      organizationId,
      operation: 'get_organization_users_success',
      results: { count: users.length },
      performance: { queryDuration }
    }, `Fetched ${users.length} user(s) for organization`);

    res.json({ success: true, data: users });
  } catch (error) {
    logger.error({ 
      requestId, 
      organizationId,
      operation: 'get_organization_users_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch organization users');
    const message = error instanceof Error ? error.message : 'Failed to fetch organization users';
    res.status(500).json({ success: false, message });
  }
});

// Get organization statistics
router.get('/:id/stats', async (req: Request, res: Response): Promise<void> => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const organizationId = req.params.id;

  logger.info({ 
    requestId, 
    organizationId,
    operation: 'get_organization_stats',
    ip: req.ip
  }, 'Fetching organization statistics');

  try {
    const startTime = Date.now();
    const [organization, usersByRole] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          createdAt: true,
          _count: {
            select: { users: true }
          }
        }
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: { organizationId: req.params.id },
        _count: { role: true }
      })
    ]);
    const queryDuration = Date.now() - startTime;

    if (!organization) {
      logger.warn({ 
        requestId, 
        organizationId,
        operation: 'get_organization_stats_not_found'
      }, 'Organization not found for stats');
      res.status(404).json({ success: false, message: 'Organization not found' });
      return;
    }

    const stats = {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        createdAt: organization.createdAt,
      },
      totalUsers: organization._count.users,
      usersByRole: usersByRole.reduce((acc: Record<string, number>, item: { role: string; _count: { role: number } }) => {
        acc[item.role] = item._count.role;
        return acc;
      }, {} as Record<string, number>)
    };

    logger.info({ 
      requestId, 
      organizationId,
      operation: 'get_organization_stats_success',
      stats: {
        totalUsers: stats.totalUsers,
        usersByRole: stats.usersByRole,
        plan: organization.plan
      },
      performance: { queryDuration }
    }, 'Organization statistics fetched successfully');

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ 
      requestId, 
      organizationId,
      operation: 'get_organization_stats_error',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, 'Failed to fetch organization stats');
    const message = error instanceof Error ? error.message : 'Failed to fetch organization stats';
    res.status(500).json({ success: false, message });
  }
});

export default router;
