/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse using token bucket algorithm
 */

import { Context, Next } from 'hono';
import { redis } from '../lib/redis';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string; // Custom error message
  keyGenerator?: (c: Context) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  standardHeaders?: boolean; // Return rate limit info in headers
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  max: number;
  refillRate: number;
}

// In-memory storage for development
const memoryBuckets = new Map<string, TokenBucket>();

/**
 * Token Bucket implementation for rate limiting
 */
class RateLimiter {
  private options: Required<RateLimitOptions>;
  
  constructor(options: RateLimitOptions) {
    this.options = {
      message: 'Too many requests, please try again later',
      keyGenerator: (c) => c.req.header('x-forwarded-for') || 
                          c.req.header('x-real-ip') || 
                          'anonymous',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      standardHeaders: true,
      ...options,
    };
  }

  async middleware(c: Context, next: Next) {
    const key = `ratelimit:${this.options.keyGenerator(c)}`;
    
    // Get current bucket state
    const bucket = await this.getBucket(key);
    
    // Refill tokens based on time passed
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed * bucket.refillRate);
    
    bucket.tokens = Math.min(bucket.max, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Check if request can proceed
    if (bucket.tokens < 1) {
      // Set rate limit headers
      if (this.options.standardHeaders) {
        c.header('X-RateLimit-Limit', String(this.options.max));
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', String(Math.ceil((now + this.options.windowMs) / 1000)));
        c.header('Retry-After', String(Math.ceil(this.options.windowMs / 1000)));
      }
      
      return c.json(
        {
          success: false,
          error: this.options.message,
          retryAfter: Math.ceil(this.options.windowMs / 1000),
        },
        429
      );
    }
    
    // Consume a token
    bucket.tokens -= 1;
    
    // Save bucket state
    await this.setBucket(key, bucket);
    
    // Set rate limit headers
    if (this.options.standardHeaders) {
      c.header('X-RateLimit-Limit', String(this.options.max));
      c.header('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)));
      c.header('X-RateLimit-Reset', String(Math.ceil((now + this.options.windowMs) / 1000)));
    }
    
    // Continue to next middleware
    await next();
    
    // Optionally refund token based on response
    if (c.res.status >= 400 && this.options.skipFailedRequests) {
      bucket.tokens = Math.min(bucket.max, bucket.tokens + 1);
      await this.setBucket(key, bucket);
    }
  }

  private async getBucket(key: string): Promise<TokenBucket> {
    if (redis) {
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data);
      }
    } else {
      const bucket = memoryBuckets.get(key);
      if (bucket) {
        return bucket;
      }
    }
    
    // Create new bucket
    return {
      tokens: this.options.max,
      lastRefill: Date.now(),
      max: this.options.max,
      refillRate: this.options.max / this.options.windowMs,
    };
  }

  private async setBucket(key: string, bucket: TokenBucket): Promise<void> {
    const ttl = Math.ceil(this.options.windowMs / 1000);
    
    if (redis) {
      await redis.setex(key, ttl, JSON.stringify(bucket));
    } else {
      memoryBuckets.set(key, bucket);
      
      // Clean up old buckets periodically
      if (memoryBuckets.size > 10000) {
        const cutoff = Date.now() - this.options.windowMs;
        for (const [k, b] of memoryBuckets.entries()) {
          if (b.lastRefill < cutoff) {
            memoryBuckets.delete(k);
          }
        }
      }
    }
  }
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(options: RateLimitOptions) {
  const limiter = new RateLimiter(options);
  return (c: Context, next: Next) => limiter.middleware(c, next);
}

/**
 * Preset rate limiters for common use cases
 */
export const rateLimiters = {
  // General API limit: 60 requests per minute
  general: createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
  }),
  
  // Strict limit for expensive operations: 10 per minute
  strict: createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'This endpoint has strict rate limits. Please wait before trying again.',
  }),
  
  // Relaxed limit for read operations: 120 per minute
  relaxed: createRateLimiter({
    windowMs: 60 * 1000,
    max: 120,
  }),
  
  // Auth endpoints: 5 attempts per 15 minutes
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts. Please try again later.',
    skipSuccessfulRequests: true,
  }),
  
  // Submission endpoints: 30 per minute
  submission: createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Submission rate limit exceeded. Please slow down.',
  }),
};

/**
 * Rate limit by API key instead of IP
 */
export function createApiKeyRateLimiter(options: RateLimitOptions) {
  return createRateLimiter({
    ...options,
    keyGenerator: (c) => {
      const apiKey = c.req.header('x-api-key');
      if (!apiKey) {
        // Fall back to IP-based limiting
        return c.req.header('x-forwarded-for') || 'anonymous';
      }
      return `apikey:${apiKey}`;
    },
  });
}