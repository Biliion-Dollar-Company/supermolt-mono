-- SR-Mobile Initial Schema (Railway PostgreSQL)
-- Run this in your Railway PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  privy_id VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(64),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_privy_id ON users(privy_id);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notifications BOOLEAN DEFAULT true,
  auto_sign BOOLEAN DEFAULT false,
  max_slippage DECIMAL(5,2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- ============================================
-- AGENT STATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'stopped' CHECK (status IN ('stopped', 'running', 'paused')),
  config JSONB DEFAULT '{
    "riskLevel": "medium",
    "maxPositionSize": 10,
    "stopLoss": 10,
    "takeProfit": 50,
    "allowedTokens": [],
    "tradingHours": {
      "enabled": false,
      "start": "09:00",
      "end": "17:00"
    }
  }'::jsonb,
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_states_user_id ON agent_states(user_id);
CREATE INDEX idx_agent_states_status ON agent_states(status);

-- ============================================
-- TRADE HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS trade_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_address VARCHAR(64) NOT NULL,
  token_symbol VARCHAR(20),
  action VARCHAR(10) NOT NULL CHECK (action IN ('buy', 'sell')),
  amount DECIMAL(20,9) NOT NULL,
  price_sol DECIMAL(20,9),
  tx_signature VARCHAR(128),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trade_history_user_id ON trade_history(user_id);
CREATE INDEX idx_trade_history_created_at ON trade_history(created_at DESC);

-- ============================================
-- AUTO-UPDATE TIMESTAMP FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agent_states_updated_at
  BEFORE UPDATE ON agent_states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
