/**
 * Portfolio Exposure Aggregator
 *
 * Aggregates all open Polymarket positions into a unified exposure report,
 * grouping by category, detecting overweight allocations, and generating
 * rebalance actions when risk thresholds are breached.
 *
 * @module
 */

import type { TrackedPosition } from '../positions/paper-tracker.ts';

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------

/** An active (open) Polymarket position ready for exposure analysis */
export type ActivePosition = TrackedPosition & { status: 'open' };

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Per-position exposure detail */
export interface PositionExposure {
  marketId: string;
  question: string;
  side: 'YES' | 'NO';
  size: number;
  probability: number;
  expectedValue: number;
  category: string;
}

/** Exposure aggregated by category */
export interface CategoryExposure {
  category: string;
  totalAllocated: number;
  totalEV: number;
  positionCount: number;
  pctOfPortfolio: number;
  positions: PositionExposure[];
}

/** A recommended rebalance action for an oversized position */
export interface RebalanceAction {
  marketId: string;
  question: string;
  action: 'REDUCE' | 'CLOSE';
  reason: string;
  currentSize: number;
  suggestedSize: number;
}

/** Full portfolio exposure report */
export interface ExposureReport {
  totalAllocated: number;
  totalEV: number;
  categoryBreakdown: CategoryExposure[];
  maxCategoryExposure: number;
  overweightCategories: string[];
  rebalanceActions: RebalanceAction[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Category keyword mapping
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  crypto: ['bitcoin', 'ethereum', 'crypto', 'token', 'btc', 'eth', 'sol', 'defi', 'nft'],
  politics: ['election', 'president', 'congress', 'senate', 'trump', 'biden', 'vote', 'policy'],
  sports: ['nba', 'nfl', 'mlb', 'soccer', 'championship', 'super bowl', 'world cup', 'team'],
  macro: ['fed', 'inflation', 'gdp', 'recession', 'rate', 'dollar', 'economy'],
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Categorize a market question using keyword matching.
 *
 * Checks each category's keywords against the lowercased question using
 * word-boundary matching to avoid false positives (e.g. "nfl" inside
 * "inflation", "eth" inside "weather").
 *
 * Falls back to 'other' when no keywords match.
 *
 * @param question - The market question string
 * @returns Category name: 'crypto' | 'politics' | 'sports' | 'macro' | 'other'
 */
export function categorizeMarket(question: string): string {
  const lower = question.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(lower))) {
      return category;
    }
  }
  return 'other';
}

/**
 * Compute the expected value for a position.
 *
 * For YES positions: EV = size × probability
 * For NO positions: EV = size × (1 − probability)
 *
 * @param size        - Dollar amount allocated
 * @param probability - Market probability (0–1) of YES resolving
 * @param side        - Which side of the market ('YES' | 'NO')
 */
function computeEV(size: number, probability: number, side: 'YES' | 'NO'): number {
  const p = side === 'YES' ? probability : 1 - probability;
  return Math.round(size * p * 100) / 100;
}

/**
 * Aggregate open positions into a full exposure report.
 *
 * Rules:
 * - Categories with > 40 % of total allocation are flagged as overweight.
 * - Overweight positions receive a REDUCE action (suggestedSize = 0.6 × currentSize).
 * - Any single position > 25 % of total portfolio receives a CLOSE action.
 * - riskLevel: HIGH if any overweight category OR any single position > 25 %;
 *              MEDIUM if maxCategoryExposure > 25 %;
 *              LOW otherwise.
 *
 * @param positions - Array of open ActivePosition objects
 * @returns A fully computed ExposureReport
 */
export function aggregateExposure(positions: ActivePosition[]): ExposureReport {
  const openPositions = positions.filter((p) => p.status === 'open');

  // Handle empty / zero-total case
  const totalAllocated = openPositions.reduce((sum, p) => sum + p.size, 0);

  if (openPositions.length === 0 || totalAllocated === 0) {
    return {
      totalAllocated: 0,
      totalEV: 0,
      categoryBreakdown: [],
      maxCategoryExposure: 0,
      overweightCategories: [],
      rebalanceActions: [],
      riskLevel: 'LOW',
      generatedAt: new Date().toISOString(),
    };
  }

  // Build per-position exposure objects
  const positionExposures: PositionExposure[] = openPositions.map((p) => {
    const side = p.direction;
    const probability = p.predictedProb ?? p.entryPrice;
    const ev = computeEV(p.size, probability, side);
    return {
      marketId: p.id,
      question: p.market,
      side,
      size: p.size,
      probability,
      expectedValue: ev,
      category: categorizeMarket(p.market),
    };
  });

  // Group by category
  const categoryMap = new Map<string, PositionExposure[]>();
  for (const pe of positionExposures) {
    const group = categoryMap.get(pe.category) ?? [];
    group.push(pe);
    categoryMap.set(pe.category, group);
  }

  // Build category breakdown
  const categoryBreakdown: CategoryExposure[] = [];
  for (const [category, catPositions] of categoryMap.entries()) {
    const totalCatAllocated = catPositions.reduce((s, p) => s + p.size, 0);
    const totalCatEV = catPositions.reduce((s, p) => s + p.expectedValue, 0);
    categoryBreakdown.push({
      category,
      totalAllocated: Math.round(totalCatAllocated * 100) / 100,
      totalEV: Math.round(totalCatEV * 100) / 100,
      positionCount: catPositions.length,
      pctOfPortfolio: Math.round((totalCatAllocated / totalAllocated) * 10000) / 100,
      positions: catPositions,
    });
  }

  // Sort by allocation descending
  categoryBreakdown.sort((a, b) => b.totalAllocated - a.totalAllocated);

  const totalEV = Math.round(positionExposures.reduce((s, p) => s + p.expectedValue, 0) * 100) / 100;
  const maxCategoryExposure = categoryBreakdown.length > 0 ? categoryBreakdown[0].pctOfPortfolio : 0;

  // Overweight categories (> 40%)
  const overweightCategories = categoryBreakdown
    .filter((c) => c.pctOfPortfolio > 40)
    .map((c) => c.category);

  // Generate rebalance actions
  const rebalanceActions: RebalanceAction[] = [];
  const addedIds = new Set<string>();

  // CLOSE: single position > 25% of total portfolio
  for (const pe of positionExposures) {
    const pct = (pe.size / totalAllocated) * 100;
    if (pct > 25 && !addedIds.has(pe.marketId)) {
      rebalanceActions.push({
        marketId: pe.marketId,
        question: pe.question,
        action: 'CLOSE',
        reason: `Single position is ${pct.toFixed(1)}% of portfolio (threshold: 25%)`,
        currentSize: pe.size,
        suggestedSize: 0,
      });
      addedIds.add(pe.marketId);
    }
  }

  // REDUCE: positions in overweight categories (not already flagged for CLOSE)
  for (const category of overweightCategories) {
    const catEntry = categoryBreakdown.find((c) => c.category === category);
    if (!catEntry) continue;
    for (const pe of catEntry.positions) {
      if (!addedIds.has(pe.marketId)) {
        rebalanceActions.push({
          marketId: pe.marketId,
          question: pe.question,
          action: 'REDUCE',
          reason: `Category '${category}' is ${catEntry.pctOfPortfolio.toFixed(1)}% of portfolio (threshold: 40%)`,
          currentSize: pe.size,
          suggestedSize: Math.round(pe.size * 0.6 * 100) / 100,
        });
        addedIds.add(pe.marketId);
      }
    }
  }

  // Risk level
  const hasSingleOversize = positionExposures.some((pe) => (pe.size / totalAllocated) * 100 > 25);
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (overweightCategories.length > 0 || hasSingleOversize) {
    riskLevel = 'HIGH';
  } else if (maxCategoryExposure > 25) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    totalAllocated: Math.round(totalAllocated * 100) / 100,
    totalEV,
    categoryBreakdown,
    maxCategoryExposure,
    overweightCategories,
    rebalanceActions,
    riskLevel,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format an ExposureReport as a human-readable ASCII table.
 *
 * Includes category breakdown, risk level badge, overweight warnings,
 * and any rebalance actions.
 *
 * @param report - The exposure report to format
 * @returns Multi-line ASCII string
 */
export function formatExposureReport(report: ExposureReport): string {
  const lines: string[] = [];

  const hr = '─'.repeat(60);
  const push = (s = '') => lines.push(s);

  push(`╔${'═'.repeat(58)}╗`);
  push(`║  📊 PORTFOLIO EXPOSURE REPORT${' '.repeat(28)}║`);
  push(`╚${'═'.repeat(58)}╝`);
  push();

  // Summary
  push(`  Total Allocated : $${report.totalAllocated.toFixed(2)}`);
  push(`  Total EV        : $${report.totalEV.toFixed(2)}`);
  push(`  Risk Level      : ${riskBadge(report.riskLevel)}`);
  push(`  Generated At    : ${report.generatedAt}`);
  push();

  // Category breakdown table
  if (report.categoryBreakdown.length === 0) {
    push('  No open positions.');
  } else {
    push(hr);
    push('  CATEGORY BREAKDOWN');
    push(hr);
    const header = padRow(['Category', 'Allocated', 'EV', 'Positions', '% Portfolio']);
    push(`  ${header}`);
    push(`  ${'-'.repeat(56)}`);
    for (const c of report.categoryBreakdown) {
      const overweightFlag = report.overweightCategories.includes(c.category) ? ' ⚠' : '';
      const row = padRow([
        `${c.category}${overweightFlag}`,
        `$${c.totalAllocated.toFixed(2)}`,
        `$${c.totalEV.toFixed(2)}`,
        String(c.positionCount),
        `${c.pctOfPortfolio.toFixed(1)}%`,
      ]);
      push(`  ${row}`);
    }
    push();
  }

  // Overweight warnings
  if (report.overweightCategories.length > 0) {
    push(hr);
    push('  ⚠️  OVERWEIGHT CATEGORIES (> 40% of portfolio)');
    push(hr);
    for (const cat of report.overweightCategories) {
      push(`  • ${cat.toUpperCase()}`);
    }
    push();
  }

  // Max category exposure
  push(`  Max Category Exposure: ${report.maxCategoryExposure.toFixed(1)}%`);
  push();

  // Rebalance actions
  if (report.rebalanceActions.length > 0) {
    push(hr);
    push('  🔄 REBALANCE ACTIONS');
    push(hr);
    for (const action of report.rebalanceActions) {
      push(`  [${action.action}] ${action.question}`);
      push(`         Market ID : ${action.marketId}`);
      push(`         Current   : $${action.currentSize.toFixed(2)}`);
      push(`         Suggested : $${action.suggestedSize.toFixed(2)}`);
      push(`         Reason    : ${action.reason}`);
      push();
    }
  }

  push(hr);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function riskBadge(level: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (level) {
    case 'HIGH':   return '🔴 HIGH';
    case 'MEDIUM': return '🟡 MEDIUM';
    case 'LOW':    return '🟢 LOW';
  }
}

function padRow(cells: string[]): string {
  const widths = [12, 10, 10, 10, 12];
  return cells.map((c, i) => c.padEnd(widths[i] ?? 10)).join(' ');
}
