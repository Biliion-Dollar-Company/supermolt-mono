#!/bin/bash

# Deployment Verification Script
# Run this after deploying to Railway to verify everything works

DOMAIN="${1:-http://localhost:3001}"

echo "🔍 Verifying Sortino Leaderboard Deployment"
echo "   Domain: $DOMAIN"
echo ""

# Test root endpoint
echo "1️⃣ Testing root endpoint..."
curl -s "$DOMAIN/" | grep -q "SR-Mobile API" && echo "   ✅ Root endpoint OK" || echo "   ❌ Root endpoint failed"

# Test leaderboard endpoint
echo "2️⃣ Testing /feed/leaderboard..."
RESPONSE=$(curl -s "$DOMAIN/feed/leaderboard")
echo "$RESPONSE" | grep -q "success" && echo "   ✅ Leaderboard endpoint OK" || echo "   ❌ Leaderboard failed"
echo "$RESPONSE" | grep -q "sortinoRatio" && echo "   ✅ Sortino data present" || echo "   ⚠️  No Sortino data yet"

# Test agent stats endpoint (if agentId provided)
if [ ! -z "$2" ]; then
  echo "3️⃣ Testing /feed/agents/$2/stats..."
  AGENT_RESPONSE=$(curl -s "$DOMAIN/feed/agents/$2/stats")
  echo "$AGENT_RESPONSE" | grep -q "success" && echo "   ✅ Agent stats endpoint OK" || echo "   ❌ Agent stats failed"
fi

echo ""
echo "📊 Sample Response:"
echo "$RESPONSE" | head -20

echo ""
echo "✅ Verification complete!"
