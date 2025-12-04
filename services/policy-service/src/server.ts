import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import policyRoutes from './routes/policy.routes';
import { setupSwagger } from './swagger';
import logger, { pinoLogger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger: pinoLogger }));

// Setup Swagger
setupSwagger(app);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, service: 'policy-service', status: 'healthy' });
});

// Routes
app.use('/api/policies', policyRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  logger.info('Policy Service started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    swaggerUI: `/api-docs`
  });
});
