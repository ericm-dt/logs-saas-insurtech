import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import quoteRoutes from './routes/quote.routes';
import { setupSwagger } from './swagger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Setup Swagger
setupSwagger(app);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, service: 'quotes-service', status: 'healthy' });
});

// Routes
app.use('/api/quotes', quoteRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Quotes service running on port ${PORT}`);
});
