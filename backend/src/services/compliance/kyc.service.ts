/**
 * KYC (Know Your Customer) Service
 *
 * Verifies agent/user identity before allowing treasury operations.
 * Mock mode auto-approves with realistic delays for hackathon demo.
 */

import { db } from '../../lib/db';
import type { KycStatus, RiskLevel, Chain } from '@prisma/client';

const MOCK_MODE = process.env.COMPLIANCE_MOCK !== 'false'; // default: mock enabled
const KYC_EXPIRY_DAYS = 365;

export interface KycSubmission {
  entityId: string;
  entityType: 'agent' | 'user';
  walletAddress: string;
  chain?: Chain;
  metadata?: Record<string, unknown>;
}

export interface KycResult {
  id: string;
  entityId: string;
  status: KycStatus;
  riskLevel: RiskLevel;
  provider: string;
  providerRef: string | null;
  verifiedAt: Date | null;
  expiresAt: Date | null;
}

export class KycService {
  private mockMode: boolean;

  constructor(mockMode = MOCK_MODE) {
    this.mockMode = mockMode;
  }

  async submitKyc(submission: KycSubmission): Promise<KycResult> {
    const existing = await db.kycRecord.findUnique({
      where: {
        entityId_entityType: {
          entityId: submission.entityId,
          entityType: submission.entityType,
        },
      },
    });

    if (existing && existing.status === 'VERIFIED') {
      return this.toResult(existing);
    }

    // Upsert — allow re-submission for REJECTED/EXPIRED
    const record = await db.kycRecord.upsert({
      where: {
        entityId_entityType: {
          entityId: submission.entityId,
          entityType: submission.entityType,
        },
      },
      create: {
        entityId: submission.entityId,
        entityType: submission.entityType,
        walletAddress: submission.walletAddress,
        chain: submission.chain ?? 'SOLANA',
        status: 'PENDING',
        riskLevel: 'LOW',
        provider: this.mockMode ? 'mock' : 'sumsub',
        metadata: (submission.metadata as any) ?? {},
      },
      update: {
        walletAddress: submission.walletAddress,
        chain: submission.chain ?? 'SOLANA',
        status: 'PENDING',
        riskLevel: 'LOW',
        metadata: (submission.metadata as any) ?? {},
      },
    });

    // Mock mode: auto-verify after brief processing
    if (this.mockMode) {
      const verifiedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + KYC_EXPIRY_DAYS);

      const verified = await db.kycRecord.update({
        where: { id: record.id },
        data: {
          status: 'VERIFIED',
          riskLevel: 'LOW',
          verifiedAt,
          expiresAt,
          providerRef: `mock-${Date.now()}`,
        },
      });

      return this.toResult(verified);
    }

    return this.toResult(record);
  }

  async getKycStatus(entityId: string, entityType: string = 'agent'): Promise<KycResult | null> {
    const record = await db.kycRecord.findUnique({
      where: { entityId_entityType: { entityId, entityType } },
    });

    return record ? this.toResult(record) : null;
  }

  async isKycValid(entityId: string, entityType: string = 'agent'): Promise<boolean> {
    const record = await db.kycRecord.findUnique({
      where: { entityId_entityType: { entityId, entityType } },
    });

    if (!record) return false;
    if (record.status !== 'VERIFIED') return false;
    if (record.expiresAt && record.expiresAt < new Date()) return false;

    return true;
  }

  async verifyKyc(recordId: string): Promise<KycResult> {
    const verifiedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + KYC_EXPIRY_DAYS);

    const record = await db.kycRecord.update({
      where: { id: recordId },
      data: {
        status: 'VERIFIED',
        verifiedAt,
        expiresAt,
      },
    });

    return this.toResult(record);
  }

  async rejectKyc(recordId: string): Promise<KycResult> {
    const record = await db.kycRecord.update({
      where: { id: recordId },
      data: { status: 'REJECTED' },
    });

    return this.toResult(record);
  }

  async getAll(options?: { status?: KycStatus; limit?: number; offset?: number }) {
    return db.kycRecord.findMany({
      where: options?.status ? { status: options.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  private toResult(record: any): KycResult {
    return {
      id: record.id,
      entityId: record.entityId,
      status: record.status,
      riskLevel: record.riskLevel,
      provider: record.provider,
      providerRef: record.providerRef,
      verifiedAt: record.verifiedAt,
      expiresAt: record.expiresAt,
    };
  }
}

export const kycService = new KycService();
