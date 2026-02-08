/**
 * Position Tracker Service
 * Tracks agent holdings in real-time based on trades
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { getTokenPrice } from '../lib/birdeye';

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

export class PositionTracker {
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
    pricePerToken: number
  ): Promise<void> {
    try {
      // Check if position exists
      const existingPosition = await this.db.agentPosition.findUnique({
        where: {
          agentId_tokenMint: {
            agentId,
            tokenMint,
          },
        },
      });

      // Guard against invalid input
      if (quantity <= 0) {
        console.warn('⚠️ [POSITION] Ignoring buy with non-positive quantity:', { agentId: agentId.slice(0, 8) + '...', quantity });
        return;
      }

      if (existingPosition) {
        // Position exists - increase quantity (average entry price)
        const currentQty = parseFloat(existingPosition.quantity.toString());
        const currentEntry = parseFloat(existingPosition.entryPrice.toString());

        const newQty = currentQty + quantity;
        // Guard against divide-by-zero (should never happen with positive qty check, but defensive)
        const newEntryPrice = newQty > 0
          ? (currentEntry * currentQty + pricePerToken * quantity) / newQty
          : pricePerToken;

        await this.db.agentPosition.update({
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
          oldQty: currentQty,
          newQty,
          newEntryPrice,
        });
      } else {
        // New position - create it
        await this.db.agentPosition.create({
          data: {
            agentId,
            tokenMint,
            tokenSymbol,
            tokenName,
            quantity: new Prisma.Decimal(quantity),
            entryPrice: new Prisma.Decimal(pricePerToken),
          },
        });

        console.log('✅ [POSITION] Opened new position:', {
          agentId: agentId.slice(0, 8) + '...',
          token: tokenSymbol,
          quantity,
          entryPrice: pricePerToken,
        });
      }
    } catch (error) {
      console.error('❌ [POSITION] Failed to update buy position:', error);
      throw error;
    }
  }

  /**
   * Update position when agent SELLs a token
   */
  async onSell(
    agentId: string,
    tokenMint: string,
    quantity: number,
    pricePerToken: number
  ): Promise<void> {
    try {
      // Guard against invalid input
      if (quantity <= 0) {
        console.warn('⚠️ [POSITION] Ignoring sell with non-positive quantity:', { agentId: agentId.slice(0, 8) + '...', quantity });
        return;
      }

      const existingPosition = await this.db.agentPosition.findUnique({
        where: {
          agentId_tokenMint: {
            agentId,
            tokenMint,
          },
        },
      });

      if (!existingPosition) {
        console.warn('⚠️ [POSITION] Sell attempt on non-existent position:', {
          agentId: agentId.slice(0, 8) + '...',
          tokenMint: tokenMint.slice(0, 8) + '...',
        });
        return;
      }

      const currentQty = parseFloat(existingPosition.quantity.toString());
      const newQty = currentQty - quantity;

      if (newQty <= 0) {
        // Position fully closed - delete it
        await this.db.agentPosition.delete({
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
          soldQty: quantity,
        });
      } else {
        // Partial sell - reduce quantity
        await this.db.agentPosition.update({
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
          oldQty: currentQty,
          newQty,
        });
      }
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
          const currentPrice = await getTokenPrice(pos.tokenMint);
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

      // Calculate current values and PnL
      const positionsWithPnl = await Promise.all(
        positions.map(async (pos) => {
          const currentPrice = await getTokenPrice(pos.tokenMint);
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
        const currentPrice = await getTokenPrice(pos.tokenMint);
        
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
