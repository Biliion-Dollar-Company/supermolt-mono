/**
 * AML (Anti-Money Laundering) Service
 *
 * Sanctions/PEP screening for wallet addresses.
 * Mock mode uses a hardcoded sanctions list for demo.
 * Production: plug in Chainalysis, Elliptic, or TRM Labs.
 */

import { db } from '../../lib/db';
import type { ComplianceAction, RiskLevel } from '@prisma/client';

const MOCK_MODE = process.env.COMPLIANCE_MOCK !== 'false';

// Mock sanctions list — well-known burn/exploit addresses for demo
const MOCK_SANCTIONS_EVM = new Set([
  '0x000000000000000000000000000000000000dead',
  '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', // demo sanctioned
  '0x1234567890abcdef1234567890abcdef12345678',
  '0xbad0000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000666',
]);

const MOCK_SANCTIONS_SOLANA = new Set([
  '1111111111111111111111111111111111111dead',
  'BADwALLET111111111111111111111111111111111',
  'SanctionedAddr111111111111111111111111111',
]);

const MOCK_PEP_NAMES = new Set([
  'test_pep_entity',
  'sanctioned_org',
  'blocked_entity',
]);

export interface AmlScreeningResult {
  id: string;
  walletAddress: string;
  chain: string;
  screeningType: string;
  riskLevel: RiskLevel;
  result: ComplianceAction;
  matchDetails: Record<string, unknown>;
}

export class AmlService {
  private mockMode: boolean;

  constructor(mockMode = MOCK_MODE) {
    this.mockMode = mockMode;
  }

  async screenWallet(walletAddress: string, chain: string): Promise<AmlScreeningResult> {
    const sanctionsResult = this.checkSanctions(walletAddress, chain);

    const record = await db.amlScreening.create({
      data: {
        walletAddress,
        chain,
        screeningType: 'sanctions',
        riskLevel: sanctionsResult.matched ? 'CRITICAL' : 'LOW',
        result: sanctionsResult.matched ? 'BLOCKED' : 'APPROVED',
        matchDetails: sanctionsResult.details as any,
        provider: this.mockMode ? 'mock' : 'chainalysis',
      },
    });

    return {
      id: record.id,
      walletAddress: record.walletAddress,
      chain: record.chain,
      screeningType: record.screeningType,
      riskLevel: record.riskLevel as RiskLevel,
      result: record.result as ComplianceAction,
      matchDetails: record.matchDetails as Record<string, unknown>,
    };
  }

  checkSanctions(walletAddress: string, chain: string): { matched: boolean; details: Record<string, unknown> } {
    const normalized = walletAddress.toLowerCase();

    if (chain === 'solana') {
      const matched = MOCK_SANCTIONS_SOLANA.has(walletAddress);
      return {
        matched,
        details: matched
          ? { listName: 'OFAC SDN', matchScore: 1.0, entity: walletAddress, source: 'mock' }
          : { listName: 'OFAC SDN', matchScore: 0.0, source: 'mock' },
      };
    }

    // EVM chains
    const matched = MOCK_SANCTIONS_EVM.has(normalized);
    return {
      matched,
      details: matched
        ? { listName: 'OFAC SDN', matchScore: 1.0, entity: normalized, source: 'mock' }
        : { listName: 'OFAC SDN', matchScore: 0.0, source: 'mock' },
    };
  }

  checkPep(entityName: string): { matched: boolean; details: Record<string, unknown> } {
    const matched = MOCK_PEP_NAMES.has(entityName.toLowerCase());
    return {
      matched,
      details: matched
        ? { listName: 'PEP Database', matchScore: 0.95, entity: entityName, source: 'mock' }
        : { listName: 'PEP Database', matchScore: 0.0, source: 'mock' },
    };
  }

  async getRiskAssessment(walletAddress: string) {
    const screenings = await db.amlScreening.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
    });

    const hasBlock = screenings.some((s) => s.result === 'BLOCKED');
    const highestRisk = screenings.reduce<RiskLevel>((max, s) => {
      const order: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
      return order[s.riskLevel] > order[max] ? (s.riskLevel as RiskLevel) : max;
    }, 'LOW');

    return {
      walletAddress,
      totalScreenings: screenings.length,
      blocked: hasBlock,
      highestRisk,
      screenings: screenings.slice(0, 10),
    };
  }

  async getScreenings(options?: { limit?: number; offset?: number }) {
    return db.amlScreening.findMany({
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }
}

export const amlService = new AmlService();
