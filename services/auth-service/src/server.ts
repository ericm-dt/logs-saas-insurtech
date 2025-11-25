import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';

dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
