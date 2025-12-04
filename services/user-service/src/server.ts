import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import organizationRoutes from './routes/organization.routes';
import { setupSwagger } from './swagger';
import logger from './utils/logger';

dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Swagger UI
}));
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Setup Swagger documentation
setupSwagger(app);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    swaggerUI: `/api-docs`
  }, 'User Service started');
});
