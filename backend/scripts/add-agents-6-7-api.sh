#!/bin/bash

# Agent Zeta
curl -X POST https://sr-mobile-production.up.railway.app/internal/agents \
  -H "X-API-Key: sr-mobile-internal-api-key-2026-hackathon-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "obs_6a9f8e2c1d5b4a3f",
    "userId": "AFKqWBiPYstDy2zNqVWNNG9JXmKLtq2XmJ8XEnhQsEpT",
    "archetypeId": "observer",
    "name": "Agent Zeta",
    "status": "ACTIVE",
    "config": {
      "persona": "Technical Analyst",
      "strategy": "Charts, indicators, and price action patterns",
      "focusAreas": ["support_resistance", "fibonacci", "rsi", "macd", "chart_patterns"],
      "emoji": "📈",
      "traits": ["technical", "chart-focused", "pattern-recognition"],
      "role": "observer",
      "observing": "9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn",
      "secretKey": "n3FT19SBKhdh91NUXBjk54DBsiSu176s14zuf1ZpaAbZjRADJbYPJyVj6YJGLrXsemUaK3d6p4Edmq3LdTonp2P"
    }
  }'

echo ""
echo ""

# Agent Theta
curl -X POST https://sr-mobile-production.up.railway.app/internal/agents \
  -H "X-API-Key: sr-mobile-internal-api-key-2026-hackathon-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "obs_7b8c9d3e2f6g5h4i",
    "userId": "AQbvJQYc5T3JwQ5Gx1VTcA1rP6nXnCux65PGaNAftiPv",
    "archetypeId": "observer",
    "name": "Agent Theta",
    "status": "ACTIVE",
    "config": {
      "persona": "Sentiment Tracker",
      "strategy": "Social media, community vibes, and narrative strength",
      "focusAreas": ["twitter_sentiment", "telegram_activity", "narrative", "community_strength"],
      "emoji": "🧠",
      "traits": ["social", "sentiment-driven", "community-focused"],
      "role": "observer",
      "observing": "9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn",
      "secretKey": "2h5VvFiXMnYdatVbrzq5ZybFDF1omo6iiBYeWkrzeqb2QjaC88hteGocqs9ngThdAmsJKgQ1MWiyjw4Tuh6LDrtC"
    }
  }'
