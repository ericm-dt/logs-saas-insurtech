import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendError, ApiError } from '../utils/response';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ApiError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  // Default to 500 server error
  sendError(res, 'Internal server error', 500);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, `Route ${req.originalUrl} not found`, 404);
};
