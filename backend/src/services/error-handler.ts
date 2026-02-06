/**
 * Error Handling Service
 * Centralized error logging and monitoring
 */

import { Context } from 'hono';

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  DATABASE = 'DATABASE',
  EXTERNAL_API = 'EXTERNAL_API',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
}

export interface ErrorDetails {
  code: string;
  message: string;
  category: ErrorCategory;
  statusCode: number;
  details?: any;
  stack?: string;
  context?: Record<string, any>;
}

export class AppError extends Error {
  public code: string;
  public category: ErrorCategory;
  public statusCode: number;
  public details?: any;
  public context?: Record<string, any>;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'AppError';
    this.code = details.code;
    this.category = details.category;
    this.statusCode = details.statusCode;
    this.details = details.details;
    this.context = details.context;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        category: this.category,
        details: this.details,
      },
    };
  }
}

/**
 * Common error factories
 */
export const Errors = {
  validation: (message: string, details?: any) => new AppError({
    code: 'INVALID_INPUT',
    message,
    category: ErrorCategory.VALIDATION,
    statusCode: 400,
    details,
  }),

  notFound: (resource: string) => new AppError({
    code: 'NOT_FOUND',
    message: `${resource} not found`,
    category: ErrorCategory.NOT_FOUND,
    statusCode: 404,
  }),

  unauthorized: (message = 'Unauthorized') => new AppError({
    code: 'UNAUTHORIZED',
    message,
    category: ErrorCategory.AUTHENTICATION,
    statusCode: 401,
  }),

  forbidden: (message = 'Forbidden') => new AppError({
    code: 'FORBIDDEN',
    message,
    category: ErrorCategory.AUTHORIZATION,
    statusCode: 403,
  }),

  rateLimit: (retryAfter?: number) => new AppError({
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    category: ErrorCategory.RATE_LIMIT,
    statusCode: 429,
    details: { retryAfter },
  }),

  database: (operation: string, error: any) => new AppError({
    code: 'DATABASE_ERROR',
    message: `Database ${operation} failed`,
    category: ErrorCategory.DATABASE,
    statusCode: 500,
    details: error,
  }),

  external: (service: string, error: any) => new AppError({
    code: 'EXTERNAL_SERVICE_ERROR',
    message: `${service} service error`,
    category: ErrorCategory.EXTERNAL_API,
    statusCode: 502,
    details: error,
  }),

  server: (message = 'Internal server error', error?: any) => new AppError({
    code: 'SERVER_ERROR',
    message,
    category: ErrorCategory.SERVER_ERROR,
    statusCode: 500,
    details: error,
  }),
};

/**
 * Error logging service
 */
export class ErrorLogger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  log(error: Error | AppError, context?: Context) {
    const timestamp = new Date().toISOString();
    const isAppError = error instanceof AppError;
    
    const errorLog = {
      timestamp,
      level: 'error',
      category: isAppError ? error.category : ErrorCategory.SERVER_ERROR,
      code: isAppError ? error.code : 'UNKNOWN_ERROR',
      message: error.message,
      statusCode: isAppError ? error.statusCode : 500,
      details: isAppError ? error.details : undefined,
      context: {
        ...(isAppError ? error.context : {}),
        ...(context && {
          method: context.req.method,
          url: context.req.url,
          userAgent: context.req.header('user-agent'),
          ip: context.req.header('x-forwarded-for') || context.req.header('x-real-ip'),
        }),
      },
      stack: this.isDevelopment ? error.stack : undefined,
    };

    // In production, send to monitoring service (Sentry, etc.)
    if (!this.isDevelopment) {
      // TODO: Send to Sentry or similar service
    }

    // Log to console
    console.error(JSON.stringify(errorLog, null, 2));
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'performance',
      operation,
      duration,
      metadata,
    };

    console.log(JSON.stringify(log));
  }
}

// Singleton instance
const errorLogger = new ErrorLogger();

/**
 * Global error handler middleware
 */
export function errorHandler(err: Error, c: Context) {
  // Log the error
  errorLogger.log(err, c);

  // Send appropriate response
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        ...err.toJSON(),
      },
      err.statusCode
    );
  }

  // Generic error response for unknown errors
  const isDevelopment = process.env.NODE_ENV !== 'production';
  return c.json(
    {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: isDevelopment ? err.message : 'Internal server error',
        stack: isDevelopment ? err.stack : undefined,
      },
    },
    500
  );
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  handler: (c: Context) => Promise<any>
) {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      throw error; // Will be caught by global error handler
    }
  };
}

/**
 * Performance tracking wrapper
 */
export function trackPerformance(operation: string) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const startTime = Date.now();
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        errorLogger.logPerformance(operation, duration, {
          method: propertyName,
          class: target.constructor.name,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        errorLogger.logPerformance(operation, duration, {
          method: propertyName,
          class: target.constructor.name,
          error: true,
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}

export { errorLogger };