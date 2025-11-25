import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: config.cors.allowedOrigins,
        credentials: true,
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use(limiter);

    // Request logging
    this.app.use(
      morgan('combined', {
        stream: {
          write: (message: string) => logger.info(message.trim()),
        },
      })
    );

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/v1', routes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'InsureTech SaaS API',
        version: '1.0.0',
        endpoints: {
          health: '/api/v1/health',
          auth: '/api/v1/auth',
          policies: '/api/v1/policies',
          claims: '/api/v1/claims',
          customers: '/api/v1/customers',
          quotes: '/api/v1/quotes',
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public listen(): void {
    this.app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API Documentation: http://localhost:${config.port}/`);
    });
  }
}

export default App;
