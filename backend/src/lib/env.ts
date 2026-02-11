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
  DEVPRINT_WS_URL: z.string().default('wss://devprint-v2-production.up.railway.app'),
  INTERNAL_API_KEY: z.string().min(16).optional(), // DevPrint → SR-Mobile internal calls
  PONZINOMICS_API_KEY: z.string().optional(), // Ponzinomics token analytics
  HELIUS_API_KEY: z.string().optional(), // Helius WebSocket API key for real-time monitoring
  HELIUS_WEBHOOK_SECRET: z.string().optional(), // Helius webhook HMAC secret (must match dashboard config)
  BIRDEYE_API_KEY: z.string().optional(), // Birdeye token data
  // BSC Integration (all optional — Solana still works without them)
  BSC_RPC_URL: z.string().optional(),
  BSCSCAN_API_KEY: z.string().optional(),
  BSC_TREASURY_PRIVATE_KEY: z.string().optional(), // Signs Four.Meme auth + pays gas
  BSC_REWARD_TOKEN_ADDRESS: z.string().optional(),
  FOURMEME_API_URL: z.string().optional(), // defaults to https://four.meme/meme-api/v1
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
