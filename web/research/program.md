# Research — Auto-Improve Program

## Overview

The research loop iteratively grinds down the Brier score for the Polymarket
betting strategy. Each round mutates strategy parameters, evaluates them
against historical data, and keeps improvements.

## Files

| File | Purpose |
|------|---------|
| `auto-improve.ts` | Standard 8-round baseline loop |
| `regime-aware-auto-improve.ts` | Regime-aware drop-in replacement (see below) |
| `iterate.ts` | Single round runner |
| `strategy.ts` | Auto-versioned strategy params |
| `data/last-regime.json` | Persisted regime from last run |

## Running

```bash
# Standard 8-round run
npm run research:auto

# Regime-aware run (reads BTC regime from CoinGecko)
npm run research:auto:regime
```

## Regime-Aware Iteration

The regime-aware loop adjusts aggression based on the current BTC market
regime, detected via CoinGecko's 24h price change:

- **Bull market** (`+3% 24h`): 10 rounds, Kelly ×1.2
  — More aggressive, extra optimisation attempts
- **Bear market** (`−3% 24h`): 6 rounds, Kelly ×0.8, early stop if Brier deteriorates
  — Conservative; halts if Brier score rises >0.02 vs round 1
- **Sideways** (default): 8 rounds (baseline), Kelly ×1.0

If regime detection fails (network error, API down), falls back to the
8-round / Kelly ×1.0 baseline automatically.

### Last regime

Read from `research/data/last-regime.json`:

```json
{
  "timestamp": "2026-03-11T09:00:00.000Z",
  "regime": "bull",
  "kellyMultiplier": 1.2,
  "roundsUsed": 10
}
```

## Architecture Notes

- **evaluate.ts is frozen** — strategy mutates, scorer never does
- **Checkpoints** — strategy is versioned; each mutation increments `version`
- **Graceful degradation** — regime detection failure → 8-round fallback
- **No real HTTP calls in tests** — `detectMarketRegime` is always mocked
