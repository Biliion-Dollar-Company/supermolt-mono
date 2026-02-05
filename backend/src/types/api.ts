/**
 * Standard API Response Types
 * 
 * Matches Ponzinomics NestJS pattern but adapted for Hono
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp?: string;
}

/**
 * Optional metadata for paginated responses
 */
export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: Required<ResponseMeta>;
}

/**
 * Helper to create success response
 */
export function createSuccessResponse<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta })
  };
}

/**
 * Helper to create error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Business logic errors
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  EPOCH_NOT_ACTIVE: 'EPOCH_NOT_ACTIVE',
  ALLOCATION_FAILED: 'ALLOCATION_FAILED',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
