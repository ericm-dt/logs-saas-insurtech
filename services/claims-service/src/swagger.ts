import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as yaml from 'yamljs';
import * as path from 'path';
import * as fs from 'fs';

// Load YAML file
const yamlPath = path.join(__dirname, 'swagger', 'claims.yaml');
let pathsFromYaml: any = {};

try {
  if (fs.existsSync(yamlPath)) {
    const yamlContent = yaml.load(yamlPath);
    pathsFromYaml = yamlContent.paths || {};
  }
} catch (error) {
  console.error('Error loading swagger YAML:', error);
}

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Claims Service API',
    version: '1.0.0',
    description: 'Insurance claims processing endpoints',
  },
  servers: [
    {
      url: 'http://localhost:3004',
      description: 'Claims Service',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Unauthorized' },
              },
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Validation failed' },
                errors: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Not found' },
              },
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Forbidden' },
              },
            },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message',
          },
        },
      },
      Claim: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          userId: {
            type: 'string',
            format: 'uuid',
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
          },
          policyId: {
            type: 'string',
            format: 'uuid',
          },
          claimNumber: {
            type: 'string',
          },
          status: {
            type: 'string',
            enum: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'PAID'],
          },
          claimDate: {
            type: 'string',
            format: 'date',
          },
          claimAmount: {
            type: 'number',
            format: 'decimal',
          },
          description: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Claims',
      description: 'Insurance claim processing',
    },
  ],
  paths: pathsFromYaml,
};

export function setupSwagger(app: Application): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Claims Service API',
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };
