#!/bin/bash
# Deploy Beta Agent's Reward System Implementation

set -e

echo "🚀 Deploying TradingAgent Reward System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Apply database migration
echo ""
echo "📊 Step 1: Applying database migration..."
bunx prisma db push
bunx prisma generate
echo "✅ Database migration complete"

# Step 2: Check treasury balance
echo ""
echo "💰 Step 2: Checking treasury balance..."
BALANCE=$(curl -s "https://api.devnet.solana.com" -X POST -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getTokenAccountsByOwner",
  "params": [
    "4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR",
    {"mint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"},
    {"encoding": "jsonParsed"}
  ]
}' | jq -r '.result.value[0].account.data.parsed.info.tokenAmount.uiAmount // "0"')

echo "Treasury Balance: ${BALANCE} USDC"

if (( $(echo "$BALANCE < 20" | bc -l) )); then
  echo "⚠️  Treasury needs funding!"
  echo "   Go to: https://faucet.circle.com/"
  echo "   Address: 4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR"
  echo "   Amount: 50 USDC"
  exit 1
fi

echo "✅ Treasury funded (${BALANCE} USDC)"

# Step 3: Commit and push
echo ""
echo "📦 Step 3: Committing and deploying..."
git add .
git commit -m "feat: TradingAgent reward distribution system

- Add tradingAgentId to TreasuryAllocation
- Add calculateAgentAllocations() - ranks agents by performance
- Add distributeAgentRewards() - sends USDC to TradingAgents
- Add /arena/epoch/rewards endpoint
- Add /internal/epoch/distribute endpoint
- Frontend: EpochRewardPanel component"

git push origin main

echo "✅ Pushed to Railway"
echo ""
echo "⏳ Waiting 60 seconds for Railway deployment..."
sleep 60

# Step 4: Health check
echo ""
echo "🏥 Step 4: Health check..."
STATUS=$(curl -s https://sr-mobile-production.up.railway.app/health | jq -r '.data.status // "error"')

if [ "$STATUS" != "ok" ]; then
  echo "❌ Backend not healthy: $STATUS"
  exit 1
fi

echo "✅ Backend healthy"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Set ADMIN_API_KEY on Railway:"
echo "     railway variables set ADMIN_API_KEY=\"trench-admin-api-key-2026-secure-hackathon\""
echo ""
echo "  2. Create test epoch (see EXECUTE_BETA_AGENT_WORK.md Step 5)"
echo ""
echo "  3. Preview allocations:"
echo "     curl https://sr-mobile-production.up.railway.app/arena/epoch/rewards | jq ."
echo ""
echo "  4. Execute distribution (see EXECUTE_BETA_AGENT_WORK.md Step 7)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
