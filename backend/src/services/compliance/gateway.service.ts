/**
 * Compliance Gateway Service — THE ORCHESTRATOR
 *
 * Single entry point for all compliance checks before treasury operations.
 * Coordinates KYC → AML → KYT → Travel Rule pipeline.
 * Every check is logged to the ComplianceAuditLog.
 */

import { db } from '../../lib/db';
import { kycService } from './kyc.service';
import { kytService, type KytScanResult } from './kyt.service';
import { amlService, type AmlScreeningResult } from './aml.service';
import { travelRuleService } from './travel-rule.service';
import type { ComplianceAction, RiskLevel } from '@prisma/client';

export interface GateTransferRequest {
  agentId: string;
  agentName?: string;
  walletAddress: string;
  chain: string;
  amount: number;
  txHash?: string;
  destinationChain?: string;
}

export interface GateTransferResult {
  action: ComplianceAction;
  reason: string;
  kycStatus: string | null;
  kytScore: number;
  kytRiskLevel: RiskLevel;
  amlResult: ComplianceAction;
  travelRuleMessageId: string | null;
  auditLogId: string;
}

export class ComplianceGatewayService {
  /**
   * Run the full compliance pipeline on a transfer.
   * Returns APPROVED, BLOCKED, or FLAGGED.
   */
  async gateTransfer(request: GateTransferRequest): Promise<GateTransferResult> {
    const { agentId, walletAddress, chain, amount } = request;

    // Step 1: KYC Check
    const kycValid = await kycService.isKycValid(agentId, 'agent');
    if (!kycValid) {
      const audit = await this.logAudit({
        action: 'distribution_gate',
        entityId: agentId,
        entityType: 'agent',
        result: 'BLOCKED',
        details: { reason: 'KYC_NOT_VERIFIED', walletAddress, chain, amount },
      });

      return {
        action: 'BLOCKED',
        reason: 'KYC_NOT_VERIFIED',
        kycStatus: 'NOT_VERIFIED',
        kytScore: 0,
        kytRiskLevel: 'LOW',
        amlResult: 'APPROVED',
        travelRuleMessageId: null,
        auditLogId: audit.id,
      };
    }

    // Step 2: AML Sanctions Screening
    const amlResult = await amlService.screenWallet(walletAddress, chain);
    if (amlResult.result === 'BLOCKED') {
      const audit = await this.logAudit({
        action: 'distribution_gate',
        entityId: agentId,
        entityType: 'agent',
        result: 'BLOCKED',
        riskLevel: 'CRITICAL',
        details: {
          reason: 'AML_SANCTIONED',
          walletAddress,
          chain,
          amount,
          amlScreeningId: amlResult.id,
          matchDetails: amlResult.matchDetails,
        },
      });

      return {
        action: 'BLOCKED',
        reason: 'AML_SANCTIONED',
        kycStatus: 'VERIFIED',
        kytScore: 0,
        kytRiskLevel: 'LOW',
        amlResult: 'BLOCKED',
        travelRuleMessageId: null,
        auditLogId: audit.id,
      };
    }

    // Step 3: KYT Transaction Monitoring
    const kytResult: KytScanResult = await kytService.scanTransaction({
      walletAddress,
      chain,
      amount,
      txHash: request.txHash,
    });

    // Step 4: Travel Rule — generate IVMS101 if amount >= $3k
    let travelRuleMessageId: string | null = null;
    if (travelRuleService.shouldApplyTravelRule(amount)) {
      travelRuleMessageId = await travelRuleService.createTravelRuleMessage({
        transferId: request.txHash ?? `pre-transfer-${agentId}-${Date.now()}`,
        sourceChain: chain,
        destinationChain: request.destinationChain ?? chain,
        amount,
        senderName: 'Supermolt Treasury',
        senderWallet: 'treasury', // Will be resolved at transfer time
        receiverName: request.agentName ?? agentId,
        receiverWallet: walletAddress,
      });
    }

    // Determine final action
    const action: ComplianceAction = kytResult.flagged ? 'FLAGGED' : 'APPROVED';
    const reason = kytResult.flagged
      ? `KYT_FLAGGED: ${kytResult.alerts.join('; ')}`
      : 'ALL_CHECKS_PASSED';

    // Log the complete result
    const audit = await this.logAudit({
      action: 'distribution_gate',
      entityId: agentId,
      entityType: 'agent',
      result: action,
      riskLevel: kytResult.riskLevel,
      details: {
        reason,
        walletAddress,
        chain,
        amount,
        kycValid: true,
        amlScreeningId: amlResult.id,
        amlResult: amlResult.result,
        kytScore: kytResult.riskScore,
        kytAlerts: kytResult.alerts,
        travelRuleMessageId,
        travelRuleApplied: travelRuleMessageId !== null,
      },
    });

    return {
      action,
      reason,
      kycStatus: 'VERIFIED',
      kytScore: kytResult.riskScore,
      kytRiskLevel: kytResult.riskLevel,
      amlResult: amlResult.result as ComplianceAction,
      travelRuleMessageId,
      auditLogId: audit.id,
    };
  }

  /**
   * Get compliance dashboard stats
   */
  async getDashboardStats() {
    const [
      totalKyc,
      verifiedKyc,
      pendingKyc,
      activeAlerts,
      totalScreenings,
      blockedScreenings,
      travelRuleMessages,
      recentAuditLogs,
    ] = await Promise.all([
      db.kycRecord.count(),
      db.kycRecord.count({ where: { status: 'VERIFIED' } }),
      db.kycRecord.count({ where: { status: 'PENDING' } }),
      db.kytAlert.count({ where: { resolved: false } }),
      db.amlScreening.count(),
      db.amlScreening.count({ where: { result: 'BLOCKED' } }),
      db.travelRuleMessage.count(),
      db.complianceAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      kyc: { total: totalKyc, verified: verifiedKyc, pending: pendingKyc },
      kyt: { activeAlerts },
      aml: { totalScreenings, blocked: blockedScreenings },
      travelRule: { totalMessages: travelRuleMessages },
      recentAuditLogs,
    };
  }

  async getAuditLog(options?: { limit?: number; offset?: number; action?: string }) {
    return db.complianceAuditLog.findMany({
      where: options?.action ? { action: options.action } : undefined,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  private async logAudit(entry: {
    action: string;
    entityId?: string;
    entityType?: string;
    result: ComplianceAction;
    riskLevel?: RiskLevel;
    details?: Record<string, unknown>;
  }) {
    return db.complianceAuditLog.create({
      data: {
        action: entry.action,
        entityId: entry.entityId ?? null,
        entityType: entry.entityType ?? null,
        result: entry.result,
        riskLevel: entry.riskLevel ?? null,
        details: (entry.details as any) ?? {},
        performedBy: 'system',
      },
    });
  }
}

export const complianceGateway = new ComplianceGatewayService();
