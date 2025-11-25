import swaggerJsdoc from 'swagger-jsdoc';
import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'InsureTech SaaS API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for InsureTech SaaS microservices platform',
      contact: {
        name: 'API Support',
        email: 'support@insuretech.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server (API Gateway)'
      },
      {
        url: 'http://localhost:3001',
        description: 'Auth Service (Direct)'
      },
      {
        url: 'http://localhost:3002',
        description: 'Customer Service (Direct)'
      },
      {
        url: 'http://localhost:3003',
        description: 'Policy Service (Direct)'
      },
      {
        url: 'http://localhost:3004',
        description: 'Claims Service (Direct)'
      },
      {
        url: 'http://localhost:3005',
        description: 'Quotes Service (Direct)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object'
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email'
            },
            firstName: {
              type: 'string'
            },
            lastName: {
              type: 'string'
            },
            role: {
              type: 'string',
              enum: ['ADMIN', 'AGENT', 'CUSTOMER']
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Customer: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email'
            },
            firstName: {
              type: 'string'
            },
            lastName: {
              type: 'string'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date'
            },
            phone: {
              type: 'string'
            },
            street: {
              type: 'string'
            },
            city: {
              type: 'string'
            },
            state: {
              type: 'string'
            },
            zipCode: {
              type: 'string'
            },
            country: {
              type: 'string'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Policy: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            customerId: {
              type: 'string',
              format: 'uuid'
            },
            policyNumber: {
              type: 'string'
            },
            type: {
              type: 'string',
              enum: ['AUTO', 'HOME', 'LIFE', 'HEALTH', 'BUSINESS']
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'CANCELLED', 'EXPIRED']
            },
            startDate: {
              type: 'string',
              format: 'date'
            },
            endDate: {
              type: 'string',
              format: 'date'
            },
            premium: {
              type: 'number',
              format: 'decimal'
            },
            coverageAmount: {
              type: 'number',
              format: 'decimal'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Claim: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            customerId: {
              type: 'string',
              format: 'uuid'
            },
            policyId: {
              type: 'string',
              format: 'uuid'
            },
            claimNumber: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'PAID']
            },
            claimDate: {
              type: 'string',
              format: 'date'
            },
            claimAmount: {
              type: 'number',
              format: 'decimal'
            },
            description: {
              type: 'string'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Quote: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            customerId: {
              type: 'string',
              format: 'uuid'
            },
            type: {
              type: 'string',
              enum: ['AUTO', 'HOME', 'LIFE', 'HEALTH', 'BUSINESS']
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED']
            },
            coverageAmount: {
              type: 'number',
              format: 'decimal'
            },
            premium: {
              type: 'number',
              format: 'decimal'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and registration endpoints'
      },
      {
        name: 'Customers',
        description: 'Customer management operations'
      },
      {
        name: 'Policies',
        description: 'Insurance policy management'
      },
      {
        name: 'Claims',
        description: 'Insurance claim processing'
      },
      {
        name: 'Quotes',
        description: 'Insurance quote generation and management'
      }
    ]
  },
  apis: ['./src/swagger/*.yaml']
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'InsureTech API Documentation'
  }));

  // Swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export default swaggerSpec;
