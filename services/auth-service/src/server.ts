import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import { setupSwagger } from './swagger';

dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Swagger UI
}));
app.use(cors());
app.use(express.json());

// Setup Swagger documentation
setupSwagger(app);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
