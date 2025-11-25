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

export class ServiceError extends Error {
  constructor(
    public statusCode: number,
    public service: string,
    message: string
  ) {
    super(`[${service}] ${message}`);
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}
