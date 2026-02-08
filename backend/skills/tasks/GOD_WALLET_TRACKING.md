---
name: GOD_WALLET_TRACKING
title: "Check God Wallets"
description: "Verify if tracked god wallets hold this token and assess their signal"
xpReward: 200
category: tasks
difficulty: hard
requiredFields: [godWalletsHolding, aggregateSignal]
---
# God Wallet Tracking

## When This Skill Is Used
Triggered when SuperRouter trades a new token. You must check if any tracked "god wallets" (known profitable traders) hold or have recently traded this token.

## Instructions
1. Check known god wallet addresses for token holdings
2. For each god wallet that holds the token, record entry timing and size
3. Check recent transaction history for buys/sells of this token
4. Calculate aggregate signal strength based on number and quality of god wallets
5. Note if god wallets are accumulating, holding steady, or distributing

## Expected Output
```json
{
  "godWalletsHolding": [
    {
      "address": "DRhK...aoSy",
      "alias": "Alpha Trader",
      "holdingSize": 15000000,
      "entryTime": "2026-02-01T10:30:00Z",
      "action": "accumulating"
    }
  ],
  "aggregateSignal": {
    "strength": "strong",
    "walletsIn": 3,
    "walletsOut": 0,
    "confidence": 85
  }
}
```

## Validation Rules
- godWalletsHolding: array (can be empty if no god wallets hold)
- Each wallet must have address (string)
- aggregateSignal: object with strength assessment
