/**
 * Scanner Calls Service
 * 
 * Business logic for scanner token predictions and trades
 */

import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';
import { getTokenPrice } from '../../lib/birdeye'; // Uses existing lib for entryPrice (10 CU)
import type {
  SubmitCallDto,
  ScannerCallDto,
  CloseCallDto,
  ScannerCallsListDto,
  CallStatsDto
} from './dto/scanner-call.dto';

export class ScannerCallsService {
  private prisma: typeof db;

  constructor() {
    this.prisma = db;
  }

  // Inlined repository helpers
  private async findScannerByAgentId(agentId: string) {
    return this.prisma.scanner.findFirst({ where: { agentId } });
  }

  private async findActive() {
    return this.prisma.scannerEpoch.findFirst({ where: { status: 'ACTIVE' } });
  }

  private async getOrCreateRanking(scannerId: string, epochId: string) {
    const existing = await this.prisma.scannerRanking.findFirst({ where: { scannerId, epochId } });
    if (existing) return existing;
    return this.prisma.scannerRanking.create({
      data: { scannerId, epochId, rank: 0 },
    });
  }

  private async updateRankingById(id: string, data: Record<string, unknown>) {
    return this.prisma.scannerRanking.update({ where: { id }, data });
  }

  /**
   * Submit new scanner call
   */
  async submit(dto: SubmitCallDto): Promise<ScannerCallDto> {
    // Verify scanner exists
    const scanner = await this.findScannerByAgentId(dto.scannerId);
    if (!scanner) {
      throw new Error(`Scanner ${dto.scannerId} not found`);
    }

    // Get active epoch
    const activeEpoch = await this.findActive();
    if (!activeEpoch) {
      throw new Error('No active epoch');
    }

    // Fetch current price for entryPrice (critical for PnL calculation)
    let entryPrice: number | null = null;
    try {
      const priceData = await getTokenPrice(dto.tokenAddress);
      if (priceData && priceData.priceUsd > 0) {
        entryPrice = priceData.priceUsd;
      }
    } catch {
      console.warn(`[ScannerCalls] Failed to fetch entry price for ${dto.tokenAddress}`);
    }

    // Create call
    const call = await this.prisma.scannerCall.create({
      data: {
        scannerId: scanner.id, // Use database UUID, not agentId
        epochId: activeEpoch.id,
        tokenAddress: dto.tokenAddress,
        tokenSymbol: dto.tokenSymbol || null,
        tokenName: dto.tokenName || null,
        convictionScore: dto.convictionScore,
        reasoning: dto.reasoning,
        entryPrice,
        status: 'open',
        takeProfitPct: dto.takeProfitPct || null,
        stopLossPct: dto.stopLossPct || null
      }
    });

    // Get or create ranking for scanner in this epoch
    await this.getOrCreateRanking(scanner.id, activeEpoch.id);

    return this.mapCallToDto(call, scanner.name);
  }

  /**
   * Close call (mark as win/loss)
   */
  async close(callId: string, dto: CloseCallDto): Promise<ScannerCallDto> {
    const call = await this.prisma.scannerCall.findUnique({
      where: { id: callId },
      include: { scanner: true }
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    if (call.status !== 'open') {
      throw new Error(`Call is already closed (${call.status})`);
    }

    // Calculate PnL
    const entryPrice = call.entryPrice ? parseFloat(call.entryPrice.toString()) : dto.exitPrice;
    const pnlPercent = ((dto.exitPrice - entryPrice) / entryPrice) * 100;

    // Update call
    const updatedCall = await this.prisma.scannerCall.update({
      where: { id: callId },
      data: {
        exitPrice: dto.exitPrice,
        entryPrice: entryPrice,
        pnlPercent,
        status: dto.status,
        closedAt: new Date()
      }
    });

    // Update scanner ranking
    await this.updateRankingForCall(call.scannerId, call.epochId, dto.status === 'win');

    return this.mapCallToDto(updatedCall, call.scanner.name);
  }

  /**
   * Get scanner calls
   */
  async getScannerCalls(scannerId: string, limit = 50): Promise<ScannerCallsListDto> {
    const scanner = await this.findScannerByAgentId(scannerId);
    if (!scanner) {
      throw new Error(`Scanner ${scannerId} not found`);
    }

    const calls = await this.prisma.scannerCall.findMany({
      where: { scannerId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const openCalls = calls.filter(c => c.status === 'open').length;
    const closedCalls = calls.filter(c => c.status !== 'open').length;

    return {
      scannerId,
      scannerName: scanner.name,
      calls: calls.map(c => this.mapCallToDto(c, scanner.name)),
      total: calls.length,
      openCalls,
      closedCalls
    };
  }

  /**
   * Get call by ID
   */
  async getById(callId: string): Promise<ScannerCallDto> {
    const call = await this.prisma.scannerCall.findUnique({
      where: { id: callId },
      include: { scanner: true }
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    return this.mapCallToDto(call, call.scanner.name);
  }

  /**
   * Get call statistics for scanner
   */
  async getStats(scannerId: string): Promise<CallStatsDto> {
    const calls = await this.prisma.scannerCall.findMany({
      where: { scannerId }
    });

    const open = calls.filter(c => c.status === 'open').length;
    const wins = calls.filter(c => c.status === 'win').length;
    const losses = calls.filter(c => c.status === 'loss').length;
    const expired = calls.filter(c => c.status === 'expired').length;
    const closed = wins + losses + expired;
    const winRate = closed > 0 ? (wins / closed) * 100 : 0;
    
    const avgPnl = calls
      .filter(c => c.pnlPercent !== null)
      .reduce((sum, c) => sum + parseFloat(c.pnlPercent!.toString()), 0) / closed || 0;

    return {
      total: calls.length,
      open,
      wins,
      losses,
      expired,
      winRate: Math.round(winRate * 100) / 100,
      avgPnl: Math.round(avgPnl * 100) / 100
    };
  }

  /**
   * Update ranking after call closes
   */
  private async updateRankingForCall(
    scannerId: string,
    epochId: string,
    isWin: boolean
  ): Promise<void> {
    const ranking = await this.getOrCreateRanking(scannerId, epochId);

    const newTotalCalls = ranking.totalCalls + 1;
    const newWins = ranking.winningCalls + (isWin ? 1 : 0);
    const newLosses = ranking.losingCalls + (isWin ? 0 : 1);
    const newWinRate = (newWins / newTotalCalls) * 100;

    // Simple performance score (can be enhanced later)
    const performanceScore = newWinRate;

    await this.updateRankingById(ranking.id, {
      totalCalls: newTotalCalls,
      winningCalls: newWins,
      losingCalls: newLosses,
      winRate: new Prisma.Decimal(newWinRate),
      performanceScore: new Prisma.Decimal(performanceScore)
    });
  }

  /**
   * Map Prisma model to DTO
   */
  private mapCallToDto(call: any, scannerName: string): ScannerCallDto {
    return {
      id: call.id,
      scannerId: call.scannerId,
      scannerName,
      epochId: call.epochId,
      tokenAddress: call.tokenAddress,
      tokenSymbol: call.tokenSymbol,
      tokenName: call.tokenName,
      convictionScore: parseFloat(call.convictionScore.toString()),
      reasoning: call.reasoning,
      entryPrice: call.entryPrice ? parseFloat(call.entryPrice.toString()) : null,
      exitPrice: call.exitPrice ? parseFloat(call.exitPrice.toString()) : null,
      currentPrice: call.currentPrice ? parseFloat(call.currentPrice.toString()) : null,
      pnlPercent: call.pnlPercent ? parseFloat(call.pnlPercent.toString()) : null,
      pnlUsd: call.pnlUsd ? parseFloat(call.pnlUsd.toString()) : null,
      status: call.status,
      takeProfitPct: call.takeProfitPct ? parseFloat(call.takeProfitPct.toString()) : null,
      stopLossPct: call.stopLossPct ? parseFloat(call.stopLossPct.toString()) : null,
      expiresAt: call.expiresAt?.toISOString() || null,
      createdAt: call.createdAt.toISOString(),
      closedAt: call.closedAt?.toISOString() || null
    };
  }
}
