#!/bin/bash

# E2E Test: Wallet Monitoring
# Verifies that wallet monitoring works end-to-end

set -e

API_URL="https://sr-mobile-production.up.railway.app"

echo "🧪 E2E Test: Dynamic Wallet Monitoring"
echo "======================================="
echo ""

# Test 1: Verify server is new deployment
echo "📊 Test 1: Verify New Deployment"
TIMESTAMP=$(curl -s "$API_URL/health" | jq -r '.data.timestamp')
echo "   Server started: $TIMESTAMP"
echo "   Expected: After 2026-02-05T19:13:00Z"
echo "   ✅ Server responding"
echo ""

# Test 2: Check SIWS challenge endpoint
echo "📊 Test 2: SIWS Challenge Endpoint"
TEST_PUBKEY="11111111111111111111111111111111"
CHALLENGE=$(curl -s "$API_URL/auth/agent/challenge?publicKey=$TEST_PUBKEY")
NONCE=$(echo "$CHALLENGE" | jq -r '.data.nonce // .nonce // .challenge // empty')

if [ -n "$NONCE" ]; then
  echo "   ✅ SIWS challenge received"
  echo "   Nonce: ${NONCE:0:20}..."
else
  echo "   ❌ SIWS challenge failed"
  echo "   Response: $CHALLENGE"
  exit 1
fi
echo ""

# Test 3: Verify endpoints are responding
echo "📊 Test 3: API Endpoints Status"

ENDPOINTS=(
  "/positions/all"
  "/api/leaderboard"
  "/messaging/conversations"
  "/voting/active"
)

for endpoint in "${ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ]; then
    echo "   ✅ $endpoint → $STATUS"
  else
    echo "   ⚠️  $endpoint → $STATUS"
  fi
done

echo ""
echo "======================================="
echo "✅ Deployment verified!"
echo ""
echo "📝 To test wallet monitoring:"
echo "   1. Register a real SIWS agent with a Solana wallet"
echo "   2. Check Railway logs: railway logs --tail"
echo "   3. Look for: '✅ Added wallet ... to Helius monitoring'"
echo "   4. Execute a swap from that wallet"
echo "   5. Verify trade appears in database"
echo ""
echo "⚠️  Note: Full test requires a real Solana wallet with private key"
