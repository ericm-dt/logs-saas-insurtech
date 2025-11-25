import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import customerRoutes from './routes/customer.routes';
import { authMiddleware } from './middleware/auth.middleware';

dotenv.config();

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Auth middleware for all routes except health
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') {
    return next();
  }
  return authMiddleware(req, res, next);
});

app.use('/api/customers', customerRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'customer-service' });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Customer Service running on port ${PORT}`);
});
