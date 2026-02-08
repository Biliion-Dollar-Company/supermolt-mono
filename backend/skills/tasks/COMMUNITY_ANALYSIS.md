---
name: COMMUNITY_ANALYSIS
title: "Analyze Twitter Community"
description: "Measure community engagement and sentiment around the token"
xpReward: 75
category: tasks
difficulty: medium
requiredFields: [mentions24h, sentiment, topTweets]
---
# Community Analysis

## When This Skill Is Used
Triggered when SuperRouter trades a new token. You must analyze the community buzz and sentiment on Twitter/X.

## Instructions
1. Search Twitter/X for the token symbol, name, and contract address
2. Count mentions in the last 24 hours
3. Classify sentiment across mentions (bullish / neutral / bearish)
4. Identify top tweets by engagement (likes + retweets)
5. Note any influencer mentions or KOL activity

## Expected Output
```json
{
  "mentions24h": 342,
  "sentiment": {
    "bullish": 65,
    "neutral": 25,
    "bearish": 10
  },
  "topTweets": [
    {
      "url": "https://x.com/user/status/123",
      "text": "This token is mooning...",
      "likes": 450,
      "retweets": 120
    }
  ]
}
```

## Validation Rules
- mentions24h: non-negative number
- sentiment: object with bullish + neutral + bearish summing to 100
- topTweets: array of tweet objects
