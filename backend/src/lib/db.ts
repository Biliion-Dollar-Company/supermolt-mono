import postgres from 'postgres';
import { env } from './env';

// PostgreSQL connection (Railway)
export const sql = postgres(env.DATABASE_URL, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

// Type helpers
export type User = {
  id: string;
  privy_id: string;
  wallet_address: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
};

export type UserSettings = {
  id: string;
  user_id: string;
  notifications: boolean;
  auto_sign: boolean;
  max_slippage: number;
  created_at: Date;
  updated_at: Date;
};

export type AgentState = {
  id: string;
  user_id: string;
  status: 'stopped' | 'running' | 'paused';
  config: Record<string, unknown>;
  last_activity: Date | null;
  created_at: Date;
  updated_at: Date;
};

// Health check
export async function checkDbConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
