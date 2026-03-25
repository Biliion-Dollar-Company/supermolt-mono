/**
 * Travel Rule Service
 *
 * Generates IVMS101-compliant messages for cross-chain USDC transfers
 * above the $3,000 threshold. Required by FATF Travel Rule for VASPs.
 */

import { db } from '../../lib/db';

const TRAVEL_RULE_THRESHOLD_USD = 3_000;
const INSTITUTION_NAME = 'Supermolt Treasury';
const INSTITUTION_LEI = 'MOCK-LEI-SUPERMOLT-001'; // Mock LEI for hackathon

export interface TransferDetails {
  transferId: string;
  sourceChain: string;
  destinationChain: string;
  amount: number;
  currency?: string;
  senderName: string;
  senderWallet: string;
  senderInstitution?: string;
  receiverName: string;
  receiverWallet: string;
  receiverInstitution?: string;
}

export interface Ivms101Message {
  version: string;
  originator: {
    originatorPersons: Array<{
      naturalPerson: {
        name: Array<{ nameIdentifier: Array<{ primaryIdentifier: string; nameIdentifierType: string }> }>;
      };
    }>;
    accountNumber: string[];
    originatorInstitution?: {
      legalPersonName: string;
      legalEntityIdentifier?: string;
    };
  };
  beneficiary: {
    beneficiaryPersons: Array<{
      naturalPerson: {
        name: Array<{ nameIdentifier: Array<{ primaryIdentifier: string; nameIdentifierType: string }> }>;
      };
    }>;
    accountNumber: string[];
    beneficiaryInstitution?: {
      legalPersonName: string;
      legalEntityIdentifier?: string;
    };
  };
  transferDetails: {
    amount: string;
    currency: string;
    dateTime: string;
    sourceChain: string;
    destinationChain: string;
  };
}

export class TravelRuleService {
  shouldApplyTravelRule(amount: number, currency: string = 'USDC'): boolean {
    // Travel Rule applies to transfers >= $3,000 USD equivalent
    // For USDC (1:1 USD peg), direct comparison
    if (currency === 'USDC' || currency === 'USD') {
      return amount >= TRAVEL_RULE_THRESHOLD_USD;
    }
    // For other currencies, would need price oracle — default to applying
    return true;
  }

  generateIvms101Message(transfer: TransferDetails): Ivms101Message {
    return {
      version: '1.0.0',
      originator: {
        originatorPersons: [
          {
            naturalPerson: {
              name: [
                {
                  nameIdentifier: [
                    {
                      primaryIdentifier: transfer.senderName,
                      nameIdentifierType: 'LEGL', // Legal name
                    },
                  ],
                },
              ],
            },
          },
        ],
        accountNumber: [transfer.senderWallet],
        originatorInstitution: {
          legalPersonName: transfer.senderInstitution ?? INSTITUTION_NAME,
          legalEntityIdentifier: INSTITUTION_LEI,
        },
      },
      beneficiary: {
        beneficiaryPersons: [
          {
            naturalPerson: {
              name: [
                {
                  nameIdentifier: [
                    {
                      primaryIdentifier: transfer.receiverName,
                      nameIdentifierType: 'LEGL',
                    },
                  ],
                },
              ],
            },
          },
        ],
        accountNumber: [transfer.receiverWallet],
        beneficiaryInstitution: transfer.receiverInstitution
          ? { legalPersonName: transfer.receiverInstitution }
          : undefined,
      },
      transferDetails: {
        amount: transfer.amount.toFixed(6),
        currency: transfer.currency ?? 'USDC',
        dateTime: new Date().toISOString(),
        sourceChain: transfer.sourceChain,
        destinationChain: transfer.destinationChain,
      },
    };
  }

  async createTravelRuleMessage(transfer: TransferDetails): Promise<string> {
    const ivms101Payload = this.generateIvms101Message(transfer);

    const record = await db.travelRuleMessage.create({
      data: {
        transferId: transfer.transferId,
        sourceChain: transfer.sourceChain,
        destinationChain: transfer.destinationChain,
        amount: transfer.amount,
        currency: transfer.currency ?? 'USDC',
        senderName: transfer.senderName,
        senderWallet: transfer.senderWallet,
        senderInstitution: transfer.senderInstitution ?? INSTITUTION_NAME,
        receiverName: transfer.receiverName,
        receiverWallet: transfer.receiverWallet,
        receiverInstitution: transfer.receiverInstitution,
        ivms101Payload: ivms101Payload as any,
        status: 'generated',
      },
    });

    return record.id;
  }

  async getMessagesForTransfer(transferId: string) {
    return db.travelRuleMessage.findMany({
      where: { transferId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllMessages(options?: { limit?: number; offset?: number }) {
    return db.travelRuleMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  async getMessageCount() {
    return db.travelRuleMessage.count();
  }
}

export const travelRuleService = new TravelRuleService();
