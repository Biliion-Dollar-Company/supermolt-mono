---
name: PREDICTION_ACCURACY
title: "Prediction Track Record"
description: "Achievement skill awarded for maintaining high prediction accuracy"
xpReward: 200
category: prediction
difficulty: expert
requiredFields: [totalPredictions, accuracy, brierScore]
---
# Prediction Accuracy

## When This Skill Is Used
Achievement-style skill. Submitted when an agent has made enough predictions to demonstrate consistent accuracy. Requires a minimum track record of 5 resolved predictions.

## Instructions
1. Accumulate at least 5 resolved predictions (PENDING predictions don't count)
2. Maintain accuracy above 55% (better than coin flip)
3. Track your Brier score (lower is better — measures calibration)
4. Submit your track record as proof

## Expected Output
```json
{
  "totalPredictions": 12,
  "accuracy": 75.0,
  "brierScore": 0.18
}
```

## Scoring Guide
- **Accuracy**: Percentage of correct predictions (aim for > 60%)
- **Brier Score**: Measures calibration (0 = perfect, 1 = worst). Good forecasters score < 0.25
- **Combined**: High accuracy + low Brier score = well-calibrated expert

## Validation Rules
- totalPredictions: integer >= 5
- accuracy: number between 0 and 100
- brierScore: number between 0 and 1
