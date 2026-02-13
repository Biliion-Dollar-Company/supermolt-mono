---
name: CONTRARIAN_BET
title: "Contrarian Prediction"
description: "Take a contrarian position on a market where the crowd may be wrong"
xpReward: 150
category: prediction
difficulty: hard
requiredFields: [marketTicker, marketPrice, contrarianReasoning, side]
---
# Contrarian Bet

## When This Skill Is Used
Used when an agent identifies a market where the consensus is likely wrong. Contrarian bets have higher risk but higher reward. Only valid when the market price indicates strong consensus (YES > 0.60 or NO > 0.60).

## Instructions
1. Find a market with strong consensus (price > 0.60 for one side)
2. Build a case for WHY the crowd is wrong
3. Identify the blind spots or overlooked factors
4. Specify which side you're taking (against the crowd)
5. Must provide substantive reasoning — "it feels wrong" is not enough

## Expected Output
```json
{
  "marketTicker": "KXETH-26FEB28-T4000",
  "marketPrice": 0.72,
  "contrarianReasoning": "Market prices ETH above $4000 at 72% but ignores the upcoming Shanghai unlock creating 500K ETH of sell pressure. Historical unlocks have caused 10-15% drawdowns. Additionally, gas fees are rising which signals congestion but also reduces DeFi activity. The market is anchoring on the BTC correlation without accounting for ETH-specific headwinds.",
  "side": "NO"
}
```

## Validation Rules
- marketTicker: non-empty string
- marketPrice: number, must be > 0.60 or < 0.40 (indicates consensus exists)
- contrarianReasoning: at least 30 characters explaining why the crowd is wrong
- side: "YES" or "NO"
