/**
 * KYT (Know Your Transaction) Service
 *
 * Real-time transaction monitoring — scores every transfer for risk.
 * Detects large transactions, structuring patterns, and velocity anomalies.
 */

import { db } from '../../lib/db';
import type { RiskLevel } from '@prisma/client';

const LARGE_TX_THRESHOLD = 10_000; // $10k
const STRUCTURING_THRESHOLD = 3_000; // Travel Rule threshold
const VELOCITY_WINDOW_HOURS = 1;
const VELOCITY_MAX_TXS = 10;

interface TransactionScan {
  walletAddress: string;
  chain: string;
  amount: number;
  txHash?: string;
}

export interface KytScanResult {
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  alerts: string[];
  flagged: boolean;
}

export class KytService {
  /**
   * Score a transaction for risk. Creates KytAlert records for high-risk txs.
   */
  async scanTransaction(scan: TransactionScan): Promise<KytScanResult> {
    let riskScore = 0;
    const alerts: string[] = [];

    // Rule 1: Large transaction detection
    if (scan.amount >= LARGE_TX_THRESHOLD) {
      riskScore += 30;
      alerts.push(`Large transaction: $${scan.amount.toLocaleString()} exceeds $${LARGE_TX_THRESHOLD.toLocaleString()} threshold`);
    }

    // Rule 2: Velocity check — too many txs in a short window
    const velocityResult = await this.checkVelocity(scan.walletAddress, scan.chain, VELOCITY_WINDOW_HOURS);
    if (velocityResult.count >= VELOCITY_MAX_TXS) {
      riskScore += 20;
      alerts.push(`High velocity: ${velocityResult.count} transactions in ${VELOCITY_WINDOW_HOURS}h (max: ${VELOCITY_MAX_TXS})`);
    }

    // Rule 3: Structuring detection — amounts just under Travel Rule threshold
    const structuringResult = await this.detectStructuring(scan.walletAddress, scan.chain, scan.amount);
    if (structuringResult.detected) {
      riskScore += 40;
      alerts.push(`Structuring pattern: ${structuringResult.count} transactions near $${STRUCTURING_THRESHOLD} threshold`);
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);
    const riskLevel = this.scoreToLevel(riskScore);
    const flagged = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';

    // Persist alert if flagged
    if (flagged) {
      await db.kytAlert.create({
        data: {
          transactionHash: scan.txHash ?? null,
          walletAddress: scan.walletAddress,
          chain: scan.chain,
          alertType: this.determineAlertType(alerts),
          riskScore,
          riskLevel,
          amount: scan.amount,
          details: { alerts, scan: { amount: scan.amount, chain: scan.chain } },
        },
      });
    }

    return { riskScore, riskLevel, alerts, flagged };
  }

  async checkVelocity(walletAddress: string, chain: string, windowHours: number) {
    const since = new Date();
    since.setHours(since.getHours() - windowHours);

    const count = await db.kytAlert.count({
      where: {
        walletAddress,
        chain,
        createdAt: { gte: since },
      },
    });

    // Also check treasury allocations for recent distributions
    const allocationCount = await db.treasuryAllocation.count({
      where: {
        createdAt: { gte: since },
      },
    });

    return { count: count + allocationCount, windowHours };
  }

  async detectStructuring(walletAddress: string, chain: string, currentAmount: number) {
    // Check if current tx + recent txs show structuring pattern
    // (multiple txs just under $3k to avoid Travel Rule)
    const nearThreshold = currentAmount >= STRUCTURING_THRESHOLD * 0.8 && currentAmount < STRUCTURING_THRESHOLD;

    if (!nearThreshold) {
      return { detected: false, count: 0 };
    }

    // Count recent near-threshold transactions
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const recentAlerts = await db.kytAlert.count({
      where: {
        walletAddress,
        chain,
        alertType: 'structuring',
        createdAt: { gte: since },
      },
    });

    // 2+ near-threshold txs in 24h = structuring
    return {
      detected: recentAlerts >= 1,
      count: recentAlerts + 1,
    };
  }

  async getAlerts(options?: {
    resolved?: boolean;
    riskLevel?: RiskLevel;
    limit?: number;
    offset?: number;
  }) {
    return db.kytAlert.findMany({
      where: {
        ...(options?.resolved !== undefined ? { resolved: options.resolved } : {}),
        ...(options?.riskLevel ? { riskLevel: options.riskLevel } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  async resolveAlert(alertId: string, resolvedBy: string) {
    return db.kytAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedBy,
        resolvedAt: new Date(),
      },
    });
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score >= 70) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  private determineAlertType(alerts: string[]): string {
    const text = alerts.join(' ').toLowerCase();
    if (text.includes('structuring')) return 'structuring';
    if (text.includes('velocity')) return 'velocity';
    if (text.includes('large')) return 'large_tx';
    return 'suspicious';
  }
}

export const kytService = new KytService();
