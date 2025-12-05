import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { setupSwagger } from './swagger';
import logger from './utils/logger';

dotenv.config();

const app: Application = express();

// Security middleware (with CSP disabled for Swagger UI)
app.use(helmet({
  contentSecurityPolicy: false
}));
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
app.use(pinoHttp({ 
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
    if (res.statusCode >= 500 || err) return 'error';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    const contentLength = res.getHeader('content-length') || 0;
    return `${req.method} ${req.url} ${res.statusCode} - ${contentLength} bytes`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - Error: ${err.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'duration'
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.socket?.remoteAddress
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["x-auth-token"]',
      'res.headers["set-cookie"]'
    ],
    censor: '[REDACTED]'
  }
}));

// Body parsing - only for non-proxied routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1/')) {
    // Skip body parsing for proxied routes - let the backend service handle it
    return next();
  }
  express.json()(req, res, next);
});

// Setup Swagger documentation
setupSwagger(app);

// Service proxy routes
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const POLICY_SERVICE_URL = process.env.POLICY_SERVICE_URL || 'http://localhost:3003';
const CLAIMS_SERVICE_URL = process.env.CLAIMS_SERVICE_URL || 'http://localhost:3004';
const QUOTES_SERVICE_URL = process.env.QUOTES_SERVICE_URL || 'http://localhost:3005';

// Proxy middleware configuration
const proxyOptions = {
  changeOrigin: true,
  timeout: parseInt(process.env.PROXY_TIMEOUT || '5000', 10), // 5 second timeout
  proxyTimeout: parseInt(process.env.PROXY_TIMEOUT || '5000', 10),
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
  onError: (err: any, req: any, res: any) => {
    logger.error({ 
      error: err.message, 
      code: err.code, 
      path: req.path,
      method: req.method,
      target: req.headers.host
    }, 'Proxy error');
    res.status(err.code === 'ECONNREFUSED' ? 503 : 504).json({
      success: false,
      message: err.code === 'ECONNREFUSED' 
        ? 'Service unavailable' 
        : 'Gateway timeout - service did not respond in time',
      error: err.message
    });
  },
};

// Route to services
app.use('/api/v1/auth', createProxyMiddleware({ ...proxyOptions, target: USER_SERVICE_URL }));
app.use('/api/v1/users', createProxyMiddleware({ ...proxyOptions, target: USER_SERVICE_URL }));
app.use('/api/v1/organizations', createProxyMiddleware({ ...proxyOptions, target: USER_SERVICE_URL }));
app.use('/api/v1/policies', createProxyMiddleware({ ...proxyOptions, target: POLICY_SERVICE_URL }));
app.use('/api/v1/claims', createProxyMiddleware({ ...proxyOptions, target: CLAIMS_SERVICE_URL }));
app.use('/api/v1/quotes', createProxyMiddleware({ ...proxyOptions, target: QUOTES_SERVICE_URL }));

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'DynaClaimz SaaS API Gateway',
    version: '1.0.0',
    architecture: 'microservices',
    documentation: '/api-docs',
    endpoints: {
      health: '/health',
      docs: '/api-docs',
      docsJson: '/api-docs.json',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      organizations: '/api/v1/organizations',
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
  logger.info({
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    swaggerUI: `/api-docs`,
    services: {
      user: USER_SERVICE_URL,
      policies: POLICY_SERVICE_URL,
      claims: CLAIMS_SERVICE_URL,
      quotes: QUOTES_SERVICE_URL
    }
  }, 'API Gateway started');
});
