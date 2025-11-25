import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json());

// Service proxy routes
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3002';
const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://localhost:3003';
const CLAIMS_SERVICE_URL = process.env.CLAIMS_SERVICE_URL || 'http://localhost:3004';
const QUOTES_SERVICE_URL = process.env.QUOTES_SERVICE_URL || 'http://localhost:3005';

// Proxy middleware configuration
const proxyOptions = {
  changeOrigin: true,
  pathRewrite: (path: string, req: any) => {
    // Remove /api/v1 prefix when forwarding to services
    return path.replace(/^\/api\/v1/, '/api');
  },
  onProxyReq: (proxyReq: any, req: any) => {
    // Forward auth headers
    if (req.headers.authorization) {
      proxyReq.setHeader('authorization', req.headers.authorization);
    }
  },
};

// Route to services
app.use('/api/v1/auth', createProxyMiddleware({ ...proxyOptions, target: AUTH_SERVICE_URL }));
app.use('/api/v1/customers', createProxyMiddleware({ ...proxyOptions, target: CUSTOMER_SERVICE_URL }));
app.use('/api/v1/policies', createProxyMiddleware({ ...proxyOptions, target: POLICY_SERVICE_URL }));
app.use('/api/v1/claims', createProxyMiddleware({ ...proxyOptions, target: CLAIMS_SERVICE_URL }));
app.use('/api/v1/quotes', createProxyMiddleware({ ...proxyOptions, target: QUOTES_SERVICE_URL }));

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'InsureTech SaaS API Gateway',
    version: '1.0.0',
    architecture: 'microservices',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      customers: '/api/v1/customers',
      policies: '/api/v1/policies',
      claims: '/api/v1/claims',
      quotes: '/api/v1/quotes',
    },
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Routing to services:`);
  console.log(`  - Auth: ${AUTH_SERVICE_URL}`);
  console.log(`  - Customers: ${CUSTOMER_SERVICE_URL}`);
  console.log(`  - Policies: ${POLICY_SERVICE_URL}`);
  console.log(`  - Claims: ${CLAIMS_SERVICE_URL}`);
  console.log(`  - Quotes: ${QUOTES_SERVICE_URL}`);
});
