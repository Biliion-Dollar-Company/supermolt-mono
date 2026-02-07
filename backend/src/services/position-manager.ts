/**
 * Position Manager - Track Agent Holdings & PnL
 * 
 * Manages agent portfolios:
 * - Tracks current holdings (token balances)
 * - Calculates real-time PnL
 * - Updates on trade execution
 * - Provides portfolio queries
 * 
 * Reference: DevPrint trading/position.rs
 */

import { PrismaClient } from '@prisma/client';
import type { BuyResult, SellResult } from './trading-executor';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface Position {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  quantity: number;
  entryPrice: number; // Average entry price in SOL
  currentPrice?: number; // Current price in SOL
  currentValue?: number; // Current value in SOL
  pnl?: number; // Profit/Loss in SOL
  pnlPercent?: number; // Profit/Loss percentage
}

export interface Portfolio {
  agentId: string;
  totalValue: number; // Total portfolio value in SOL
  totalCost: number; // Total cost basis in SOL
  totalPnl: number; // Total unrealized PnL in SOL
  totalPnlPercent: number; // Total PnL percentage
  positions: Position[];
  usdcVolume?: number; // Total USDC volume traded (optional)
}

export interface TradeMetrics {
  totalTrades: number;
  totalVolumeSol: number;
  totalFeesSol: number;
  avgFeePercent: number;
  buyCount: number;
  sellCount: number;
}

// ============================================================================
// Position Manager
// ============================================================================

export class PositionManager {
  
  /**
   * Record a BUY trade and update positions
   */
  async recordBuy(
    agentId: string,
    tokenMint: string,
    tokenSymbol: string,
    tokenName: string,
    buyResult: BuyResult
  ): Promise<void> {
    console.log(`📝 Recording BUY: ${agentId} → ${tokenSymbol}`);

    await prisma.$transaction(async (tx) => {
      // 1. Record trade in agent_trades
      await tx.agentTrade.create({
        data: {
          agentId,
          tokenMint,
          tokenSymbol,
          tokenName,
          action: 'BUY',
          tokenAmount: buyResult.tokensReceived,
          solAmount: buyResult.amountSol,
          signature: buyResult.signature,
          priorityFee: buyResult.priorityFeeLamports,
          swapFee: buyResult.swapFeeSol,
          totalFees: buyResult.totalFeesSol,
          executionMs: buyResult.executionMs,
          slippageBps: buyResult.slippageBps,
          priceImpactPct: buyResult.priceImpactPct,
          attempt: buyResult.attempt
        }
      });

      // 2. Update or create position in agent_positions
      const existingPosition = await tx.agentPosition.findUnique({
        where: {
          agentId_tokenMint: {
            agentId,
            tokenMint
          }
        }
      });

      if (existingPosition) {
        // Update existing position (average entry price)
        const oldQuantity = parseFloat(existingPosition.quantity.toString());
        const oldEntryPrice = parseFloat(existingPosition.entryPrice.toString());
        const oldCost = oldQuantity * oldEntryPrice;

        const newQuantity = oldQuantity + buyResult.tokensReceived;
        const newCost = oldCost + buyResult.amountSol;
        const newEntryPrice = newCost / newQuantity;

        await tx.agentPosition.update({
          where: {
            agentId_tokenMint: {
              agentId,
              tokenMint
            }
          },
          data: {
            quantity: newQuantity,
            entryPrice: newEntryPrice,
            updatedAt: new Date()
          }
        });

        console.log(`  ✅ Position updated: ${newQuantity.toLocaleString()} @ ${newEntryPrice.toFixed(8)} SOL`);
      } else {
        // Create new position
        const entryPrice = buyResult.amountSol / buyResult.tokensReceived;

        await tx.agentPosition.create({
          data: {
            agentId,
            tokenMint,
            tokenSymbol,
            tokenName,
            quantity: buyResult.tokensReceived,
            entryPrice
          }
        });

        console.log(`  ✅ Position created: ${buyResult.tokensReceived.toLocaleString()} @ ${entryPrice.toFixed(8)} SOL`);
      }
    });
  }

  /**
   * Record a SELL trade and update positions
   */
  async recordSell(
    agentId: string,
    tokenMint: string,
    tokenSymbol: string,
    tokenName: string,
    sellResult: SellResult
  ): Promise<void> {
    console.log(`📝 Recording SELL: ${agentId} → ${tokenSymbol}`);

    await prisma.$transaction(async (tx) => {
      // 1. Record trade
      await tx.agentTrade.create({
        data: {
          agentId,
          tokenMint,
          tokenSymbol,
          tokenName,
          action: 'SELL',
          tokenAmount: sellResult.tokensSold,
          solAmount: sellResult.solReceived,
          signature: sellResult.signature,
          priorityFee: sellResult.priorityFeeLamports,
          swapFee: sellResult.swapFeeSol,
          totalFees: sellResult.totalFeesSol,
          executionMs: sellResult.executionMs,
          slippageBps: sellResult.slippageBps,
          priceImpactPct: sellResult.priceImpactPct,
          attempt: sellResult.attempt
        }
      });

      // 2. Update position (reduce quantity)
      const position = await tx.agentPosition.findUnique({
        where: {
          agentId_tokenMint: {
            agentId,
            tokenMint
          }
        }
      });

      if (!position) {
        throw new Error(`Position not found for agent ${agentId} and token ${tokenMint}`);
      }

      const currentQuantity = parseFloat(position.quantity.toString());
      const newQuantity = currentQuantity - sellResult.tokensSold;

      if (newQuantity < 0.000001) {
        // Position fully closed - delete it
        await tx.agentPosition.delete({
          where: {
            agentId_tokenMint: {
              agentId,
              tokenMint
            }
          }
        });

        console.log(`  ✅ Position closed`);
      } else {
        // Partial sell - update quantity
        await tx.agentPosition.update({
          where: {
            agentId_tokenMint: {
              agentId,
              tokenMint
            }
          },
          data: {
            quantity: newQuantity,
            updatedAt: new Date()
          }
        });

        console.log(`  ✅ Position updated: ${newQuantity.toLocaleString()} remaining`);
      }
    });
  }

  /**
   * Get agent's portfolio with PnL calculated
   * 
   * @param agentId - Agent ID
   * @param priceGetter - Function to get current token prices (SOL-denominated)
   */
  async getPortfolio(
    agentId: string,
    priceGetter: (tokenMint: string) => Promise<number | null>
  ): Promise<Portfolio> {
    console.log(`📊 Fetching portfolio: ${agentId}`);

    // Get all positions
    const positionsDb = await prisma.agentPosition.findMany({
      where: { agentId }
    });

    // Calculate PnL for each position
    const positions: Position[] = [];
    let totalValue = 0;
    let totalCost = 0;

    for (const pos of positionsDb) {
      const quantity = parseFloat(pos.quantity.toString());
      const entryPrice = parseFloat(pos.entryPrice.toString());
      const cost = quantity * entryPrice;

      // Get current price
      const currentPrice = await priceGetter(pos.tokenMint);

      let currentValue: number | undefined;
      let pnl: number | undefined;
      let pnlPercent: number | undefined;

      if (currentPrice !== null) {
        currentValue = quantity * currentPrice;
        pnl = currentValue - cost;
        pnlPercent = (pnl / cost) * 100;

        totalValue += currentValue;
      }

      totalCost += cost;

      positions.push({
        tokenMint: pos.tokenMint,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        quantity,
        entryPrice,
        currentPrice: currentPrice ?? undefined,
        currentValue,
        pnl,
        pnlPercent
      });
    }

    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return {
      agentId,
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent,
      positions
    };
  }

  /**
   * Get agent's trade metrics
   */
  async getTradeMetrics(agentId: string): Promise<TradeMetrics> {
    const trades = await prisma.agentTrade.findMany({
      where: { agentId }
    });

    const totalVolumeSol = trades.reduce((sum, t) => sum + parseFloat(t.solAmount.toString()), 0);
    const totalFeesSol = trades.reduce((sum, t) => sum + parseFloat(t.totalFees?.toString() ?? '0'), 0);
    const avgFeePercent = totalVolumeSol > 0 ? (totalFeesSol / totalVolumeSol) * 100 : 0;

    const buyCount = trades.filter(t => t.action === 'BUY').length;
    const sellCount = trades.filter(t => t.action === 'SELL').length;

    return {
      totalTrades: trades.length,
      totalVolumeSol,
      totalFeesSol,
      avgFeePercent,
      buyCount,
      sellCount
    };
  }

  /**
   * Get agent's trade history
   */
  async getTradeHistory(agentId: string, limit = 50) {
    return prisma.agentTrade.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Calculate USDC volume for an agent
   * 
   * @param agentId - Agent ID
   * @param priceGetterUSD - Function to get token prices in USD
   */
  async calculateUSDCVolume(
    agentId: string,
    priceGetterUSD: (tokenMint: string, timestamp: Date) => Promise<number | null>
  ): Promise<number> {
    const trades = await prisma.agentTrade.findMany({
      where: { agentId }
    });

    let totalVolumeUSD = 0;

    for (const trade of trades) {
      const priceUSD = await priceGetterUSD(trade.tokenMint, trade.createdAt);
      if (priceUSD !== null) {
        const tokenAmount = parseFloat(trade.tokenAmount.toString());
        const volumeUSD = tokenAmount * priceUSD;
        totalVolumeUSD += volumeUSD;
      }
    }

    return totalVolumeUSD;
  }

  /**
   * Get all agent positions (for SuperRouter visibility)
   */
  async getAllPositions() {
    return prisma.agentPosition.findMany({
      orderBy: [
        { agentId: 'asc' },
        { updatedAt: 'desc' }
      ]
    });
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createPositionManager(): PositionManager {
  return new PositionManager();
}
