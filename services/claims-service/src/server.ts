import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import claimRoutes from './routes/claim.routes';
import { setupSwagger } from './swagger';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Setup Swagger
setupSwagger(app);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, service: 'claims-service', status: 'healthy' });
});

// Routes
app.use('/api/claims', claimRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  }, 'Unhandled error');
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    swaggerUI: `/api-docs`
  }, 'Claims Service started');
});
