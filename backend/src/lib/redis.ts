import Redis from 'ioredis';
import { env } from './env';

// Redis key prefixes
export const KEYS = {
  session: (userId: string) => `session:${userId}`,
  agentState: (userId: string) => `agent:${userId}:state`,
  rateLimit: (ip: string) => `ratelimit:${ip}`,
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
