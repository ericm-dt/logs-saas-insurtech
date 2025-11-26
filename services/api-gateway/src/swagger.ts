import { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import axios from 'axios';

// Service URLs
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://localhost:3003';
const CLAIMS_SERVICE_URL = process.env.CLAIMS_SERVICE_URL || 'http://localhost:3004';
const QUOTES_SERVICE_URL = process.env.QUOTES_SERVICE_URL || 'http://localhost:3005';

// Fetch and aggregate OpenAPI specs from all services
async function aggregateSpecs() {
  try {
    const [userSpec, policySpec, claimsSpec, quotesSpec] = await Promise.all([
      axios.get(`${USER_SERVICE_URL}/api-docs.json`).then(r => r.data).catch(() => null),
      axios.get(`${POLICY_SERVICE_URL}/api-docs.json`).then(r => r.data).catch(() => null),
      axios.get(`${CLAIMS_SERVICE_URL}/api-docs.json`).then(r => r.data).catch(() => null),
      axios.get(`${QUOTES_SERVICE_URL}/api-docs.json`).then(r => r.data).catch(() => null),
    ]);

    const aggregatedSpec: any = {
      openapi: '3.0.0',
      info: {
        title: 'InsureTech SaaS API',
        version: '1.0.0',
        description: 'Unified API documentation for all microservices',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'API Gateway',
        },
      ],
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {},
      },
      tags: [],
    };

    // Merge specs from all services
    const specs = [userSpec, policySpec, claimsSpec, quotesSpec].filter(Boolean);
    
    for (const spec of specs) {
      if (spec.paths) {
        // Rewrite paths to include /api/v1 prefix for gateway
        Object.keys(spec.paths).forEach(path => {
          const gatewayPath = path.replace('/api/', '/api/v1/');
          aggregatedSpec.paths[gatewayPath] = spec.paths[path];
        });
      }
      
      if (spec.components?.schemas) {
        Object.assign(aggregatedSpec.components.schemas, spec.components.schemas);
      }
      
      if (spec.tags) {
        aggregatedSpec.tags.push(...spec.tags);
      }
    }

    return aggregatedSpec;
  } catch (error) {
    console.error('Error aggregating specs:', error);
    return {
      openapi: '3.0.0',
      info: {
        title: 'InsureTech SaaS API',
        version: '1.0.0',
        description: 'Unable to load service documentation',
      },
      paths: {},
    };
  }
}

export function setupSwagger(app: Application): void {
  // Swagger JSON - dynamically aggregate from services
  app.get('/api-docs.json', async (req, res) => {
    try {
      const spec = await aggregateSpecs();
      res.setHeader('Content-Type', 'application/json');
      res.json(spec);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate API documentation' });
    }
  });

  // Swagger UI
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', async (req, res) => {
    try {
      const spec = await aggregateSpecs();
      const html = swaggerUi.generateHTML(spec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'InsureTech API Documentation',
      });
      res.send(html);
    } catch (error) {
      res.status(500).send('Failed to load API documentation');
    }
  });
}
