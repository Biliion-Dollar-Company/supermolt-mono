/**
 * Position Tracker Service V2
 * Fixes race condition issues with out-of-order webhooks
 * 
 * Key improvements:
 * - Auto-creates missing positions when SELL arrives first
 * - Uses estimated entry price from current market price
 * - Logs data gaps for investigation
 * - Transaction-safe updates
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { getTokenPrice } from '../lib/birdeye';
import { getBscTokenPrice } from '../lib/bsc-prices';
import { getBaseTokenPrice } from '../lib/base-prices';

export interface PositionData {
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  quantity: number;
  entryPrice: number;
  currentValue: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  openedAt: Date;
  updatedAt: Date;
}

/**
 * Get token price routed by chain
 */
async function getPriceForPosition(
  tokenMint: string,
  chain: string,
): Promise<{ priceUsd: number } | null> {
  if (chain === 'BSC') {
    const price = await getBscTokenPrice(tokenMint);
    return price ? { priceUsd: price.priceUsd } : null;
  }
  if (chain === 'BASE') {
    const price = await getBaseTokenPrice(tokenMint);
    return price ? { priceUsd: price.priceUsd } : null;
  }
  // Solana via Birdeye
  return getTokenPrice(tokenMint);
}

export class PositionTrackerV2 {
  constructor(private db: PrismaClient) {}

  /**
   * Update position when agent BUYs a token
   */
  async onBuy(
    agentId: string,
    tokenMint: string,
    tokenSymbol: string,
    tokenName: string,
    quantity: number,
    pricePerToken: number,
    chain: string = 'SOLANA'
  ): Promise<void> {
    try {
      // Guard against invalid input
      if (quantity <= 0) {
        console.warn('⚠️ [POSITION] Ignoring buy with non-positive quantity:', { 
          agentId: agentId.slice(0, 8) + '...', 
          quantity 
        });
        return;
      }

      // Use $transaction to ensure atomicity
      await this.db.$transaction(async (tx) => {
        const existingPosition = await tx.agentPosition.findUnique({
          where: {
            agentId_tokenMint: {
              agentId,
              tokenMint,
            },
          },
        });

        if (existingPosition) {
          // Position exists - increase quantity (weighted average entry price)
          const currentQty = parseFloat(existingPosition.quantity.toString());
          const currentEntry = parseFloat(existingPosition.entryPrice.toString());

          const newQty = currentQty + quantity;
          const newEntryPrice = newQty > 0
            ? (currentEntry * currentQty + pricePerToken * quantity) / newQty
            : pricePerToken;

          await tx.agentPosition.update({
            where: {
              agentId_tokenMint: {
                agentId,
                tokenMint,
              },
            },
            data: {
              quantity: new Prisma.Decimal(newQty),
              entryPrice: new Prisma.Decimal(newEntryPrice),
              updatedAt: new Date(),
            },
          });

          console.log('✅ [POSITION] Increased position:', {
            agentId: agentId.slice(0, 8) + '...',
            token: tokenSymbol,
            oldQty: currentQty.toFixed(2),
            newQty: newQty.toFixed(2),
            newEntryPrice: newEntryPrice.toFixed(6),
          });
        } else {
          // New position - create it
          await tx.agentPosition.create({
            data: {
              agentId,
              tokenMint,
              tokenSymbol,
              tokenName,
              quantity: new Prisma.Decimal(quantity),
              entryPrice: new Prisma.Decimal(pricePerToken),
              chain,
            },
          });

          console.log('✅ [POSITION] Opened new position:', {
            agentId: agentId.slice(0, 8) + '...',
            token: tokenSymbol,
            quantity: quantity.toFixed(2),
            entryPrice: pricePerToken.toFixed(6),
          });
        }
      });
    } catch (error) {
      console.error('❌ [POSITION] Failed to update buy position:', error);
      throw error;
    }
  }

  /**
   * Update position when agent SELLs a token
   * 
   * FIX: If position doesn't exist, auto-create it with estimated entry price
   * This handles the race condition where SELL webhook arrives before BUY
   */
  async onSell(
    agentId: string,
    tokenMint: string,
    quantity: number,
    pricePerToken: number,
    chain: string = 'SOLANA'
  ): Promise<void> {
    try {
      // Guard against invalid input
      if (quantity <= 0) {
        console.warn('⚠️ [POSITION] Ignoring sell with non-positive quantity:', { 
          agentId: agentId.slice(0, 8) + '...', 
          quantity 
        });
        return;
      }

      // Use $transaction for atomicity
      await this.db.$transaction(async (tx) => {
        let existingPosition = await tx.agentPosition.findUnique({
          where: {
            agentId_tokenMint: {
              agentId,
              tokenMint,
            },
          },
        });

        // ── FIX: Auto-create missing position ────────────────────────────
        if (!existingPosition) {
          console.warn('⚠️ [POSITION] Sell without existing position (race condition or data gap):', {
            agentId: agentId.slice(0, 8) + '...',
            tokenMint: tokenMint.slice(0, 8) + '...',
            action: 'auto-creating position with estimated entry price',
          });

          // Fetch current market price to estimate entry
          const currentPrice = await getPriceForPosition(tokenMint, chain);
          const estimatedEntry = currentPrice?.priceUsd || pricePerToken || 0;

          // Assume they bought exactly what they're selling (conservative estimate)
          existingPosition = await tx.agentPosition.create({
            data: {
              agentId,
              tokenMint,
              tokenSymbol: 'UNKNOWN', // Will be updated by next BUY webhook
              tokenName: 'Unknown Token',
              quantity: new Prisma.Decimal(quantity), // Match sell quantity
              entryPrice: new Prisma.Decimal(estimatedEntry),
              chain,
              openedAt: new Date(Date.now() - 60000), // 1 minute ago (estimate)
            },
          });

          console.log('🔧 [POSITION] Auto-created missing position:', {
            agentId: agentId.slice(0, 8) + '...',
            tokenMint: tokenMint.slice(0, 8) + '...',
            estimatedEntry: estimatedEntry.toFixed(6),
            quantity: quantity.toFixed(2),
          });
        }

        // Now proceed with the sell
        const currentQty = parseFloat(existingPosition.quantity.toString());
        const newQty = currentQty - quantity;

        if (newQty <= 0) {
          // Position fully closed - delete it
          await tx.agentPosition.delete({
            where: {
              agentId_tokenMint: {
                agentId,
                tokenMint,
              },
            },
          });

          console.log('✅ [POSITION] Closed position:', {
            agentId: agentId.slice(0, 8) + '...',
            token: existingPosition.tokenSymbol,
            soldQty: quantity.toFixed(2),
            finalValue: (quantity * pricePerToken).toFixed(2),
          });
        } else {
          // Partial sell - reduce quantity
          await tx.agentPosition.update({
            where: {
              agentId_tokenMint: {
                agentId,
                tokenMint,
              },
            },
            data: {
              quantity: new Prisma.Decimal(newQty),
              updatedAt: new Date(),
            },
          });

          console.log('✅ [POSITION] Reduced position:', {
            agentId: agentId.slice(0, 8) + '...',
            token: existingPosition.tokenSymbol,
            oldQty: currentQty.toFixed(2),
            newQty: newQty.toFixed(2),
            remaining: `${((newQty / currentQty) * 100).toFixed(1)}%`,
          });
        }
      });
    } catch (error) {
      console.error('❌ [POSITION] Failed to update sell position:', error);
      throw error;
    }
  }

  /**
   * Get current positions for an agent
   */
  async getAgentPositions(agentId: string): Promise<PositionData[]> {
    try {
      const positions = await this.db.agentPosition.findMany({
        where: { agentId },
        orderBy: { openedAt: 'desc' },
      });

      // Calculate current values and PnL
      const positionsWithPnl = await Promise.all(
        positions.map(async (pos) => {
          const currentPrice = await getPriceForPosition(pos.tokenMint, pos.chain);
          const quantity = parseFloat(pos.quantity.toString());
          const entryPrice = parseFloat(pos.entryPrice.toString());

          let currentValue = null;
          let pnl = null;
          let pnlPercent = null;

          if (currentPrice?.priceUsd) {
            currentValue = quantity * currentPrice.priceUsd;
            const costBasis = quantity * entryPrice;
            pnl = currentValue - costBasis;
            pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
          }

          return {
            agentId: pos.agentId,
            tokenMint: pos.tokenMint,
            tokenSymbol: pos.tokenSymbol,
            tokenName: pos.tokenName,
            quantity,
            entryPrice,
            currentValue,
            pnl,
            pnlPercent,
            openedAt: pos.openedAt,
            updatedAt: pos.updatedAt,
          };
        })
      );

      return positionsWithPnl;
    } catch (error) {
      console.error('❌ [POSITION] Failed to get agent positions:', error);
      throw error;
    }
  }

  /**
   * Get all agents' positions (for coordination)
   */
  async getAllPositions(): Promise<PositionData[]> {
    try {
      const positions = await this.db.agentPosition.findMany({
        orderBy: [
          { agentId: 'asc' },
          { openedAt: 'desc' },
        ],
      });

      const positionsWithPnl = await Promise.all(
        positions.map(async (pos) => {
          const currentPrice = await getPriceForPosition(pos.tokenMint, pos.chain);
          const quantity = parseFloat(pos.quantity.toString());
          const entryPrice = parseFloat(pos.entryPrice.toString());

          let currentValue = null;
          let pnl = null;
          let pnlPercent = null;

          if (currentPrice?.priceUsd) {
            currentValue = quantity * currentPrice.priceUsd;
            const costBasis = quantity * entryPrice;
            pnl = currentValue - costBasis;
            pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
          }

          return {
            agentId: pos.agentId,
            tokenMint: pos.tokenMint,
            tokenSymbol: pos.tokenSymbol,
            tokenName: pos.tokenName,
            quantity,
            entryPrice,
            currentValue,
            pnl,
            pnlPercent,
            openedAt: pos.openedAt,
            updatedAt: pos.updatedAt,
          };
        })
      );

      return positionsWithPnl;
    } catch (error) {
      console.error('❌ [POSITION] Failed to get all positions:', error);
      throw error;
    }
  }

  /**
   * Update all positions' current values (cron job)
   */
  async updateAllPositionValues(): Promise<void> {
    try {
      const positions = await this.db.agentPosition.findMany();

      for (const pos of positions) {
        const currentPrice = await getPriceForPosition(pos.tokenMint, pos.chain);

        if (currentPrice?.priceUsd) {
          const quantity = parseFloat(pos.quantity.toString());
          const entryPrice = parseFloat(pos.entryPrice.toString());
          const currentValue = quantity * currentPrice.priceUsd;
          const costBasis = quantity * entryPrice;
          const pnl = currentValue - costBasis;
          const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

          await this.db.agentPosition.update({
            where: { id: pos.id },
            data: {
              currentValue: new Prisma.Decimal(currentValue),
              pnl: new Prisma.Decimal(pnl),
              pnlPercent: new Prisma.Decimal(pnlPercent),
              updatedAt: new Date(),
            },
          });
        }
      }

      console.log('✅ [POSITION] Updated all position values');
    } catch (error) {
      console.error('❌ [POSITION] Failed to update position values:', error);
    }
  }
}
