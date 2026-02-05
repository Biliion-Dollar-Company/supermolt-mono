import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.string().default('development'),
  PRIVY_APP_ID: z.string(),
  PRIVY_APP_SECRET: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  DATABASE_URL: z.string(), // Railway PostgreSQL
  REDIS_URL: z.string().optional(),
  DEVPRINT_URL: z.string().url().optional(),
  DEVPRINT_WS_URL: z.string().optional(),
  INTERNAL_API_KEY: z.string().min(16).optional(), // DevPrint → SR-Mobile internal calls
  PONZINOMICS_API_KEY: z.string().optional(), // Ponzinomics token analytics
  HELIUS_API_KEY: z.string().optional(), // Helius WebSocket API key for real-time monitoring
  HELIUS_WEBHOOK_SECRET: z.string().optional(), // Helius webhook HMAC secret (must match dashboard config)
  BIRDEYE_API_KEY: z.string().optional(), // Birdeye token data
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
