import Redis from 'ioredis';
import { env } from './env';

// Redis key prefixes
export const KEYS = {
  session: (userId: string) => `session:${userId}`,
  agentState: (userId: string) => `agent:${userId}:state`,
  rateLimit: (ip: string) => `ratelimit:${ip}`,
  cache: (key: string) => `cache:${key}`,
};

// In-memory fallback for development
const memoryStore = new Map<string, { value: string; expires: number }>();

// Create Redis client only if URL is provided
export const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

// Session management with fallback
export async function setSession(userId: string, token: string, expiresIn: number): Promise<void> {
  if (redis) {
    await redis.setex(KEYS.session(userId), expiresIn, token);
  } else {
    memoryStore.set(KEYS.session(userId), {
      value: token,
      expires: Date.now() + expiresIn * 1000,
    });
  }
}

export async function getSession(userId: string): Promise<string | null> {
  if (redis) {
    return redis.get(KEYS.session(userId));
  }
  const item = memoryStore.get(KEYS.session(userId));
  if (!item) return null;
  if (item.expires < Date.now()) {
    memoryStore.delete(KEYS.session(userId));
    return null;
  }
  return item.value;
}

export async function deleteSession(userId: string): Promise<void> {
  if (redis) {
    await redis.del(KEYS.session(userId));
  } else {
    memoryStore.delete(KEYS.session(userId));
  }
}

// ── Cache stats (for /health/cache diagnostic) ─────────────

export const cacheStats = {
  hits: 0,
  misses: 0,
  backend: redis ? 'redis' as const : 'memory' as const,
  /** Per-key last-hit timestamps for TTL visibility */
  keys: new Map<string, { lastHit: number; lastMiss: number; ttl: number }>(),
};

// ── Generic cache helper ────────────────────────────────────

/**
 * Cache-aside helper. Returns cached value if fresh, otherwise calls fetcher,
 * caches the result, and returns it. Works with Redis or in-memory fallback.
 */
export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cacheKey = KEYS.cache(key);
  const start = Date.now();
  const backend = redis ? 'redis' : 'memory';

  const keyStats = cacheStats.keys.get(key) || { lastHit: 0, lastMiss: 0, ttl: ttlSeconds };
  keyStats.ttl = ttlSeconds;

  // Try cache first
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      cacheStats.hits++;
      keyStats.lastHit = Date.now();
      cacheStats.keys.set(key, keyStats);
      console.log(`[cache] HIT  ${key} (${backend}, ${Date.now() - start}ms)`);
      return JSON.parse(cached) as T;
    }
  } else {
    const item = memoryStore.get(cacheKey);
    if (item && item.expires > Date.now()) {
      cacheStats.hits++;
      keyStats.lastHit = Date.now();
      cacheStats.keys.set(key, keyStats);
      console.log(`[cache] HIT  ${key} (${backend}, ${Date.now() - start}ms)`);
      return JSON.parse(item.value) as T;
    }
    if (item) memoryStore.delete(cacheKey);
  }

  // Cache miss — call fetcher
  cacheStats.misses++;
  keyStats.lastMiss = Date.now();
  cacheStats.keys.set(key, keyStats);

  const result = await fetcher();
  const fetchMs = Date.now() - start;
  const serialized = JSON.stringify(result);

  if (redis) {
    await redis.setex(cacheKey, ttlSeconds, serialized);
  } else {
    memoryStore.set(cacheKey, {
      value: serialized,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  console.log(`[cache] MISS ${key} (${backend}, fetched in ${fetchMs}ms, ttl=${ttlSeconds}s)`);
  return result;
}
