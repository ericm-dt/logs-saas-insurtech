import { Response } from 'express';
import { ApiResponse } from '../types/express.types';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const sendSuccess = <T>(res: Response, data: T, message?: string, statusCode = 200) => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: any[]
) => {
  const response: ApiResponse = {
    success: false,
    message,
    errors,
  };
  res.status(statusCode).json(response);
};
