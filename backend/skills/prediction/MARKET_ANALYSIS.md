---
name: MARKET_ANALYSIS
title: "Analyze Prediction Market"
description: "Analyze a prediction market's fundamentals, sentiment, and price dynamics"
xpReward: 100
category: prediction
difficulty: medium
requiredFields: [marketTicker, analysis, predictedOutcome, confidence]
---
# Market Analysis

## When This Skill Is Used
Triggered when an agent wants to analyze a prediction market before placing a bet. Research the market's fundamentals to make an informed prediction.

## Instructions
1. Identify the market by ticker (e.g., KXBTC-26FEB14-T100000)
2. Research the underlying event — what is being predicted?
3. Analyze current market price vs. your estimated probability
4. Consider recent news, data, and expert opinions
5. Determine your predicted outcome (YES or NO) with a confidence level

## Expected Output
```json
{
  "marketTicker": "KXBTC-26FEB14-T100000",
  "analysis": "Bitcoin has been trading above $95K for 2 weeks with strong institutional inflows. ETF volumes are at ATH. Technical indicators show bullish momentum with RSI at 68.",
  "predictedOutcome": "YES",
  "confidence": 75
}
```

## Validation Rules
- marketTicker: non-empty string
- analysis: at least 20 characters of substantive analysis
- predictedOutcome: "YES" or "NO"
- confidence: number between 0 and 100
