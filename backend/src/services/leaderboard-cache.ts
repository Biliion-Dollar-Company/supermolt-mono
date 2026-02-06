/**
 * Leaderboard Caching Service
 * Optimizes leaderboard performance with Redis caching
 */

import { PrismaClient } from '@prisma/client';
import { redis, KEYS } from '../lib/redis';

// Cache configuration
const CACHE_TTL = 60; // 1 minute
const CACHE_KEY_PREFIX = 'leaderboard:';

// Memory cache fallback for non-Redis environments
const memoryCache = new Map<string, { data: any; expires: number }>();

interface CachedLeaderboard {
  data: any;
  timestamp: string;
  ttl: number;
}

interface LeaderboardCacheOptions {
  ttl?: number;
  warmOnStartup?: boolean;
}

export class LeaderboardCacheService {
  private db: PrismaClient;
  private ttl: number;

  constructor(db: PrismaClient, options: LeaderboardCacheOptions = {}) {
    this.db = db;
    this.ttl = options.ttl || CACHE_TTL;

    if (options.warmOnStartup) {
      this.warmCache().catch(console.error);
    }
  }

  /**
   * Get cached leaderboard or calculate fresh
   */
  async getCachedLeaderboard(
    key: string = 'main',
    calculator: () => Promise<any>
  ): Promise<any> {
    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
    
    // Try to get from cache
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[LeaderboardCache] Cache hit for ${key}`);
      return cached;
    }

    console.log(`[LeaderboardCache] Cache miss for ${key}, calculating...`);
    
    // Calculate fresh data
    const startTime = Date.now();
    const data = await calculator();
    const calculationTime = Date.now() - startTime;
    
    console.log(`[LeaderboardCache] Calculation took ${calculationTime}ms`);

    // Store in cache
    await this.setInCache(cacheKey, data);

    return data;
  }

  /**
   * Invalidate cache (e.g., after new trades)
   */
  async invalidate(key: string = 'main'): Promise<void> {
    const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
    
    if (redis) {
      await redis.del(cacheKey);
    } else {
      memoryCache.delete(cacheKey);
    }
    
    console.log(`[LeaderboardCache] Invalidated cache for ${key}`);
  }

  /**
   * Invalidate all leaderboard caches
   */
  async invalidateAll(): Promise<void> {
    if (redis) {
      const keys = await redis.keys(`${CACHE_KEY_PREFIX}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // Clear memory cache entries
      for (const key of memoryCache.keys()) {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          memoryCache.delete(key);
        }
      }
    }
    
    console.log('[LeaderboardCache] Invalidated all caches');
  }

  /**
   * Pre-warm cache on startup
   */
  async warmCache(): Promise<void> {
    console.log('[LeaderboardCache] Warming cache...');
    
    try {
      // Import the ranking service dynamically to avoid circular deps
      const { createLeaderboardService } = await import('./leaderboard-ranking');
      const rankingService = createLeaderboardService(this.db);
      
      // Pre-calculate main leaderboard
      const data = await rankingService.rankAllAgents();
      await this.setInCache(`${CACHE_KEY_PREFIX}main`, data);
      
      console.log('[LeaderboardCache] Cache warmed successfully');
    } catch (error) {
      console.error('[LeaderboardCache] Failed to warm cache:', error);
    }
  }

  /**
   * Get from Redis or memory cache
   */
  private async getFromCache(key: string): Promise<any | null> {
    if (redis) {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } else {
      const item = memoryCache.get(key);
      if (item && item.expires > Date.now()) {
        return item.data;
      }
      if (item) {
        memoryCache.delete(key);
      }
    }
    
    return null;
  }

  /**
   * Set in Redis or memory cache
   */
  private async setInCache(key: string, data: any): Promise<void> {
    const serialized = JSON.stringify(data);
    
    if (redis) {
      await redis.setex(key, this.ttl, serialized);
    } else {
      memoryCache.set(key, {
        data,
        expires: Date.now() + this.ttl * 1000,
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    type: 'redis' | 'memory';
    keys: string[];
    size: number;
  }> {
    if (redis) {
      const keys = await redis.keys(`${CACHE_KEY_PREFIX}*`);
      return {
        type: 'redis',
        keys,
        size: keys.length,
      };
    } else {
      const keys = Array.from(memoryCache.keys()).filter(k => 
        k.startsWith(CACHE_KEY_PREFIX)
      );
      return {
        type: 'memory',
        keys,
        size: keys.length,
      };
    }
  }
}

// Singleton instance
let cacheService: LeaderboardCacheService | null = null;

export function getLeaderboardCache(db: PrismaClient): LeaderboardCacheService {
  if (!cacheService) {
    cacheService = new LeaderboardCacheService(db, {
      ttl: CACHE_TTL,
      warmOnStartup: true,
    });
  }
  return cacheService;
}