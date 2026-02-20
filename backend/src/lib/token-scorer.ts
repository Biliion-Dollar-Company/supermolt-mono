/**
 * Token Scorer
 * 
 * Scores tokens based on agent archetype preferences.
 * Each agent type looks for different signals in token metrics.
 */

export interface TokenData {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  priceChange24h?: number;
  priceChange1h?: number;
  holder?: number;
  ageMinutes?: number;
  socialVolume?: number;
  twitterMentions?: number;
}

export interface ScoringResult {
  score: number;
  confidence: number;
  reasoning: string;
  shouldTrade: boolean;
}

/**
 * Score a token for a specific agent archetype
 */
export function scoreTokenForAgent(
  token: TokenData,
  archetypeId: string
): ScoringResult {
  // Default response
  const defaultResult: ScoringResult = {
    score: 0,
    confidence: 0,
    reasoning: 'No matching criteria',
    shouldTrade: false,
  };

  // Ensure we have minimum required data
  if (!token.priceUsd || token.priceUsd <= 0) {
    return {
      ...defaultResult,
      reasoning: 'Invalid price data',
    };
  }

  // Route to archetype-specific scorer
  switch (archetypeId) {
    case 'liquidity_sniper':
    case 'liquidity-focused':
      return scoreLiquiditySniper(token);
    
    case 'narrative_researcher':
    case 'narrative-focused':
      return scoreNarrativeTrader(token);
    
    case 'degen_hunter':
    case 'high-risk-degen':
      return scoreDegenHunter(token);
    
    case 'smart_money':
    case 'conservative':
      return scoreSmartMoney(token);
    
    case 'whale_tracker':
    case 'whale-tracker':
      return scoreWhaleTracker(token);
    
    case 'sentiment_analyst':
    case 'contrarian':
      return scoreSentimentAnalyst(token);
    
    case 'swing-trader':
      return scoreSwingTrader(token);
    
    case 'long-term-holder':
      return scoreDiamondHands(token);
    
    case 'quant-trader':
      return scoreQuantTrader(token);
    
    case 'early-stage':
      return scoreEarlyStage(token);
    
    case 'pump-specialist':
      return scorePumpSpecialist(token);
    
    case 'scalper':
      return scoreScalper(token);
    
    default:
      // Generic conservative scorer for unknown archetypes
      return scoreGeneric(token);
  }
}

// ─── Archetype-Specific Scorers ────────────────────────────

/**
 * Liquidity Sniper: Hunts liquidity events and new pools
 */
function scoreLiquiditySniper(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Must have liquidity data
  if (!token.liquidity) {
    return {
      score: 0,
      confidence: 0,
      reasoning: 'No liquidity data',
      shouldTrade: false,
    };
  }

  // High liquidity (>$100k) = strong signal
  if (token.liquidity > 100000) {
    score += 40;
    reasons.push(`High liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  } else if (token.liquidity > 50000) {
    score += 25;
    reasons.push(`Good liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  } else {
    reasons.push(`Low liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  // Recent token (< 30 min) = bonus
  if (token.ageMinutes && token.ageMinutes < 30) {
    score += 25;
    reasons.push(`Fresh token: ${token.ageMinutes}min old`);
  }

  // Volume/Liquidity ratio (high = strong interest)
  if (token.volume24h && token.liquidity) {
    const volLiqRatio = token.volume24h / token.liquidity;
    if (volLiqRatio > 2) {
      score += 20;
      reasons.push(`Strong vol/liq ratio: ${volLiqRatio.toFixed(1)}x`);
    }
  }

  // Price momentum
  if (token.priceChange1h && token.priceChange1h > 10) {
    score += 15;
    reasons.push(`Price momentum: +${token.priceChange1h.toFixed(1)}% (1h)`);
  }

  const shouldTrade = score >= 70 && token.liquidity > 50000;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Narrative Trader: Follows social sentiment and cultural trends
 */
function scoreNarrativeTrader(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Social volume is king
  if (token.socialVolume && token.socialVolume > 500) {
    score += 40;
    reasons.push(`High social volume: ${token.socialVolume}`);
  } else if (token.socialVolume && token.socialVolume > 200) {
    score += 20;
    reasons.push(`Moderate social volume: ${token.socialVolume}`);
  }

  // Twitter mentions
  if (token.twitterMentions && token.twitterMentions > 300) {
    score += 30;
    reasons.push(`Strong Twitter buzz: ${token.twitterMentions} mentions`);
  }

  // Price trend (narrative needs momentum)
  if (token.priceChange24h && token.priceChange24h > 20) {
    score += 20;
    reasons.push(`Strong 24h trend: +${token.priceChange24h.toFixed(1)}%`);
  }

  // Market cap (narrative needs scale)
  if (token.marketCap && token.marketCap > 1000000) {
    score += 10;
    reasons.push(`Decent market cap: $${(token.marketCap / 1000000).toFixed(1)}M`);
  }

  // If no social data, can't trade
  if (!token.socialVolume && !token.twitterMentions) {
    reasons.push('No social data available');
  }

  const shouldTrade = score >= 65 && (token.socialVolume || 0) > 200;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Degen Hunter: High risk, high reward, momentum plays
 */
function scoreDegenHunter(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Massive price pump = DEGEN SIGNAL
  if (token.priceChange1h && token.priceChange1h > 50) {
    score += 50;
    reasons.push(`PUMPING: +${token.priceChange1h.toFixed(0)}% (1h)`);
  } else if (token.priceChange1h && token.priceChange1h > 20) {
    score += 30;
    reasons.push(`Strong pump: +${token.priceChange1h.toFixed(0)}% (1h)`);
  }

  // Volume spike
  if (token.volume24h && token.liquidity) {
    const volLiqRatio = token.volume24h / token.liquidity;
    if (volLiqRatio > 5) {
      score += 30;
      reasons.push(`INSANE volume: ${volLiqRatio.toFixed(1)}x liquidity`);
    }
  }

  // Early token = degen play
  if (token.ageMinutes && token.ageMinutes < 60) {
    score += 20;
    reasons.push(`Early: ${token.ageMinutes}min old`);
  }

  const shouldTrade = score >= 60; // Degenerates have lower threshold
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'Weak signals',
    shouldTrade,
  };
}

/**
 * Smart Money: Conservative, risk-managed entries
 */
function scoreSmartMoney(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Must have high liquidity for safety
  if (!token.liquidity || token.liquidity < 100000) {
    return {
      score: 0,
      confidence: 0,
      reasoning: 'Liquidity too low (risk management)',
      shouldTrade: false,
    };
  }

  score += 30;
  reasons.push(`Safe liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);

  // Market cap matters (no microcaps)
  if (token.marketCap && token.marketCap > 5000000) {
    score += 25;
    reasons.push(`Established cap: $${(token.marketCap / 1000000).toFixed(1)}M`);
  } else if (token.marketCap && token.marketCap > 1000000) {
    score += 10;
    reasons.push(`Moderate cap: $${(token.marketCap / 1000000).toFixed(1)}M`);
  }

  // Steady growth over pumps
  if (token.priceChange24h && token.priceChange24h > 10 && token.priceChange24h < 50) {
    score += 25;
    reasons.push(`Steady growth: +${token.priceChange24h.toFixed(1)}% (24h)`);
  } else if (token.priceChange24h && token.priceChange24h > 50) {
    score -= 10;
    reasons.push(`Overheated: +${token.priceChange24h.toFixed(1)}% (parabolic)`);
  }

  // Volume/liquidity health check
  if (token.volume24h && token.liquidity) {
    const volLiqRatio = token.volume24h / token.liquidity;
    if (volLiqRatio >= 0.5 && volLiqRatio <= 3) {
      score += 20;
      reasons.push(`Healthy vol/liq: ${volLiqRatio.toFixed(1)}x`);
    } else if (volLiqRatio > 5) {
      score -= 10;
      reasons.push(`Vol/liq too high: ${volLiqRatio.toFixed(1)}x (risky)`);
    }
  }

  const shouldTrade = score >= 75; // High bar for conservative traders
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Whale Tracker: Follows smart money moves
 */
function scoreWhaleTracker(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Look for whale indicators (high liquidity + volume)
  if (token.liquidity && token.liquidity > 200000) {
    score += 35;
    reasons.push(`Whale-size liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  // Large market cap = institutional interest
  if (token.marketCap && token.marketCap > 10000000) {
    score += 30;
    reasons.push(`Whale cap: $${(token.marketCap / 1000000).toFixed(1)}M`);
  }

  // Recent price action (whales move markets)
  if (token.priceChange1h && Math.abs(token.priceChange1h) > 15) {
    score += 20;
    reasons.push(`Whale movement detected: ${token.priceChange1h > 0 ? '+' : ''}${token.priceChange1h.toFixed(1)}%`);
  }

  // High holder count = distribution
  if (token.holder && token.holder > 1000) {
    score += 15;
    reasons.push(`${token.holder} holders (distributed)`);
  }

  const shouldTrade = score >= 70;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'Insufficient whale signals',
    shouldTrade,
  };
}

/**
 * Sentiment Analyst / Contrarian: Fades hype, buys fear
 */
function scoreSentimentAnalyst(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Contrarian = buy dips, fade pumps
  if (token.priceChange24h && token.priceChange24h < -10 && token.priceChange24h > -40) {
    score += 40;
    reasons.push(`Fear opportunity: ${token.priceChange24h.toFixed(1)}% (24h)`);
  } else if (token.priceChange24h && token.priceChange24h > 100) {
    score += 35;
    reasons.push(`Euphoria fade signal: +${token.priceChange24h.toFixed(1)}% (overheated)`);
  }

  // Moderate liquidity (not too safe, not too risky)
  if (token.liquidity && token.liquidity > 50000 && token.liquidity < 200000) {
    score += 20;
    reasons.push(`Mid liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  // Social volume (high = fade, low = accumulate)
  if (token.socialVolume && token.socialVolume < 100) {
    score += 20;
    reasons.push(`Low social (accumulation zone)`);
  } else if (token.socialVolume && token.socialVolume > 1000) {
    score += 20;
    reasons.push(`High social (fade signal)`);
  }

  const shouldTrade = score >= 65;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'Neutral sentiment',
    shouldTrade,
  };
}

/**
 * Swing Trader: Medium-term plays, technical setups
 */
function scoreSwingTrader(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Steady uptrend (not parabolic)
  if (token.priceChange24h && token.priceChange24h > 15 && token.priceChange24h < 60) {
    score += 35;
    reasons.push(`Swing setup: +${token.priceChange24h.toFixed(1)}% (24h)`);
  }

  // Good liquidity for swing entries/exits
  if (token.liquidity && token.liquidity > 75000) {
    score += 25;
    reasons.push(`Swing liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  // Market cap stability
  if (token.marketCap && token.marketCap > 2000000) {
    score += 20;
    reasons.push(`Swing cap: $${(token.marketCap / 1000000).toFixed(1)}M`);
  }

  // Volume confirmation
  if (token.volume24h && token.liquidity) {
    const volLiqRatio = token.volume24h / token.liquidity;
    if (volLiqRatio > 1 && volLiqRatio < 4) {
      score += 20;
      reasons.push(`Swing volume: ${volLiqRatio.toFixed(1)}x`);
    }
  }

  const shouldTrade = score >= 70;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Diamond Hands: Long-term conviction plays
 */
function scoreDiamondHands(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // High market cap = established project
  if (token.marketCap && token.marketCap > 10000000) {
    score += 40;
    reasons.push(`Conviction cap: $${(token.marketCap / 1000000).toFixed(1)}M`);
  }

  // Deep liquidity for long holds
  if (token.liquidity && token.liquidity > 150000) {
    score += 30;
    reasons.push(`Diamond liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  // Large holder base = community
  if (token.holder && token.holder > 2000) {
    score += 20;
    reasons.push(`${token.holder} diamond holders`);
  }

  // Moderate growth (building conviction)
  if (token.priceChange24h && token.priceChange24h > 5 && token.priceChange24h < 30) {
    score += 10;
    reasons.push(`Building: +${token.priceChange24h.toFixed(1)}%`);
  }

  const shouldTrade = score >= 75;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Quant Trader: Pure numbers, probabilities, ratios
 */
function scoreQuantTrader(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Calculate Sharpe-like metric (simplified)
  if (token.priceChange24h && token.volume24h && token.liquidity) {
    const returnPct = token.priceChange24h / 100;
    const volLiqRatio = token.volume24h / token.liquidity;
    
    // Reward high return/volume with good liquidity
    if (Math.abs(returnPct) > 0.1 && volLiqRatio > 1) {
      score += 40;
      reasons.push(`Quant signal: ${returnPct.toFixed(2)} return, ${volLiqRatio.toFixed(1)}x vol/liq`);
    }
  }

  // Liquidity threshold
  if (token.liquidity && token.liquidity > 100000) {
    score += 30;
    reasons.push(`Liq: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  // Market cap efficiency
  if (token.marketCap && token.liquidity) {
    const capLiqRatio = token.marketCap / token.liquidity;
    if (capLiqRatio > 5 && capLiqRatio < 20) {
      score += 20;
      reasons.push(`Cap/liq efficiency: ${capLiqRatio.toFixed(1)}x`);
    }
  }

  // Volume consistency
  if (token.volume24h && token.volume24h > 100000) {
    score += 10;
    reasons.push(`Vol: $${(token.volume24h / 1000).toFixed(0)}k`);
  }

  const shouldTrade = score >= 70;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Early Stage: Hunts new tokens and migrations
 */
function scoreEarlyStage(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Age is everything
  if (token.ageMinutes && token.ageMinutes < 30) {
    score += 50;
    reasons.push(`FRESH: ${token.ageMinutes}min old`);
  } else if (token.ageMinutes && token.ageMinutes < 120) {
    score += 30;
    reasons.push(`Early: ${token.ageMinutes}min old`);
  } else {
    reasons.push('Too old for early-stage');
  }

  // Initial liquidity
  if (token.liquidity && token.liquidity > 30000) {
    score += 25;
    reasons.push(`Initial liq: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  // Early momentum
  if (token.priceChange1h && token.priceChange1h > 20) {
    score += 25;
    reasons.push(`Early pump: +${token.priceChange1h.toFixed(0)}%`);
  }

  const shouldTrade = score >= 60 && (token.ageMinutes || 999) < 120;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Pump Specialist: Volume spikes and momentum
 */
function scorePumpSpecialist(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Volume spike is THE signal
  if (token.volume24h && token.liquidity) {
    const volLiqRatio = token.volume24h / token.liquidity;
    if (volLiqRatio > 8) {
      score += 50;
      reasons.push(`PUMP: ${volLiqRatio.toFixed(1)}x vol/liq`);
    } else if (volLiqRatio > 4) {
      score += 30;
      reasons.push(`Strong volume: ${volLiqRatio.toFixed(1)}x`);
    }
  }

  // Price momentum
  if (token.priceChange1h && token.priceChange1h > 30) {
    score += 30;
    reasons.push(`Pumping: +${token.priceChange1h.toFixed(0)}% (1h)`);
  }

  // Liquidity for exits
  if (token.liquidity && token.liquidity > 50000) {
    score += 20;
    reasons.push(`Exit liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  const shouldTrade = score >= 65;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Scalper: Fast in/out, small edges
 */
function scoreScalper(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Deep liquidity for fast entries/exits
  if (token.liquidity && token.liquidity > 150000) {
    score += 40;
    reasons.push(`Scalp liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  } else if (token.liquidity && token.liquidity > 75000) {
    score += 20;
    reasons.push(`Moderate liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  // Small price moves (2-5%)
  if (token.priceChange1h && Math.abs(token.priceChange1h) > 2 && Math.abs(token.priceChange1h) < 8) {
    score += 30;
    reasons.push(`Scalp range: ${token.priceChange1h > 0 ? '+' : ''}${token.priceChange1h.toFixed(1)}%`);
  }

  // High volume
  if (token.volume24h && token.volume24h > 200000) {
    score += 20;
    reasons.push(`Scalp volume: $${(token.volume24h / 1000).toFixed(0)}k`);
  }

  // Tight spreads (estimated by volume/liquidity)
  if (token.volume24h && token.liquidity) {
    const volLiqRatio = token.volume24h / token.liquidity;
    if (volLiqRatio > 2) {
      score += 10;
      reasons.push(`Tight spreads (${volLiqRatio.toFixed(1)}x vol)`);
    }
  }

  const shouldTrade = score >= 70;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.join(', '),
    shouldTrade,
  };
}

/**
 * Generic scorer for unknown archetypes (conservative default)
 */
function scoreGeneric(token: TokenData): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Basic safety checks
  if (token.liquidity && token.liquidity > 100000) {
    score += 30;
    reasons.push(`Safe liquidity: $${(token.liquidity / 1000).toFixed(0)}k`);
  }

  if (token.marketCap && token.marketCap > 1000000) {
    score += 20;
    reasons.push(`Market cap: $${(token.marketCap / 1000000).toFixed(1)}M`);
  }

  if (token.priceChange24h && token.priceChange24h > 10 && token.priceChange24h < 50) {
    score += 20;
    reasons.push(`Moderate growth: +${token.priceChange24h.toFixed(1)}%`);
  }

  const shouldTrade = score >= 60;
  const confidence = Math.min(score, 100);

  return {
    score,
    confidence,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'Generic scoring',
    shouldTrade,
  };
}
