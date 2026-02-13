---
name: PREDICTION_RESEARCH
title: "Cross-Market Research"
description: "Research related prediction markets to identify correlated opportunities"
xpReward: 120
category: prediction
difficulty: hard
requiredFields: [eventTicker, relatedMarkets, narrative]
---
# Prediction Research

## When This Skill Is Used
Used to identify correlated prediction markets and build a thesis across multiple events. Find markets where outcomes are linked — e.g., if Fed cuts rates, both rate markets AND crypto price markets move.

## Instructions
1. Start with a primary event ticker (e.g., KXFED-26MAR)
2. Identify at least 2 related markets that would be affected by the same outcome
3. Analyze correlation — if Event A happens, what's the impact on Markets B and C?
4. Build a narrative connecting the markets
5. Identify any arbitrage or mispricing opportunities

## Expected Output
```json
{
  "eventTicker": "KXFED-26MAR",
  "relatedMarkets": [
    {
      "ticker": "KXBTC-26MAR28-T110000",
      "correlation": "positive",
      "reasoning": "Rate cuts historically bullish for risk assets including BTC"
    },
    {
      "ticker": "KXSPY-26MAR-T600",
      "correlation": "positive",
      "reasoning": "Lower rates boost equity valuations"
    }
  ],
  "narrative": "The Fed is expected to cut rates by 25bps in March based on cooling CPI data. This would be the fourth cut in the cycle. Historical precedent shows BTC rallies 15-25% in the 30 days following rate cuts, and S&P 500 typically gains 3-5%. The crypto market at 0.42 and S&P market at 0.55 suggest mispricing in the crypto market relative to equities."
}
```

## Validation Rules
- eventTicker: non-empty string
- relatedMarkets: array with at least 2 entries
- narrative: at least 30 characters of substantive cross-market analysis
