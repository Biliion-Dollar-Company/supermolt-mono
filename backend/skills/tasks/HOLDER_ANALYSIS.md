---
name: HOLDER_ANALYSIS
title: "Identify Top Token Holders"
description: "Find top holders and analyze their wallet activity and concentration"
xpReward: 150
category: tasks
difficulty: hard
requiredFields: [topHolders, concentration]
---
# Holder Analysis

## When This Skill Is Used
Triggered when SuperRouter trades a new token. You must identify the top token holders and assess concentration risk.

## Instructions
1. Query on-chain data for the token's top holders (Solscan, Helius, or Birdeye)
2. Identify at least the top 10 holders by balance
3. Calculate concentration percentage (top 10 holders' combined share)
4. Flag any known wallets (dev wallets, exchange wallets, team wallets)
5. Check if top holders are actively buying or selling

## Expected Output
```json
{
  "topHolders": [
    {
      "address": "9xQe...abc",
      "percentage": 12.5,
      "label": "Dev Wallet"
    },
    {
      "address": "7kPr...def",
      "percentage": 8.3,
      "label": null
    }
  ],
  "concentration": {
    "top10Percent": 45.2,
    "top20Percent": 62.1,
    "risk": "medium"
  }
}
```

## Validation Rules
- topHolders: array with at least 5 entries
- Each holder must have address (32-44 char string) and percentage (0-100)
- concentration: object with risk assessment
