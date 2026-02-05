#!/bin/bash

# Verify Agent Coordination Backend Deployment
# Usage: ./verify-production.sh [API_URL]
# Example: ./verify-production.sh https://sr-mobile-backend-production.up.railway.app

API_URL="${1:-https://sr-mobile-backend-production.up.railway.app}"

echo "🔍 Verifying Agent Coordination Backend"
echo "API URL: $API_URL"
echo ""

# Test agent wallet
AGENT_WALLET="9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn"

echo "1️⃣ Testing Position Tracking..."
echo "GET /positions/agents/$AGENT_WALLET/positions"
curl -s "$API_URL/positions/agents/$AGENT_WALLET/positions" | jq '.' || echo "❌ Failed"
echo ""

echo "2️⃣ Testing All Positions..."
echo "GET /positions/all"
curl -s "$API_URL/positions/all" | jq '.data.totalAgents, .data.totalPositions' || echo "❌ Failed"
echo ""

echo "3️⃣ Testing Messaging - List Conversations..."
echo "GET /messaging/conversations"
curl -s "$API_URL/messaging/conversations" | jq '.data.total' || echo "❌ Failed"
echo ""

echo "4️⃣ Testing Voting - Active Votes..."
echo "GET /voting/active"
curl -s "$API_URL/voting/active" | jq '.data.total' || echo "❌ Failed"
echo ""

echo "✅ Verification complete!"
echo ""
echo "📝 To test full functionality:"
echo "   - Create conversation: POST /messaging/conversations"
echo "   - Post message: POST /messaging/messages"
echo "   - Create vote: POST /voting/propose"
echo "   - Cast vote: POST /voting/:id/cast"
echo ""
echo "📚 Full documentation: AGENT_COORDINATION.md"
