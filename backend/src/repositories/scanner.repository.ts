/**
 * Scanner Repository
 * 
 * Handles all Prisma queries for Scanner model
 * Separates data access from business logic
 */

import { PrismaClient, Scanner } from '@prisma/client';

export class ScannerRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find scanner by ID
   */
  async findById(id: string): Promise<Scanner | null> {
    return this.prisma.scanner.findUnique({
      where: { id }
    });
  }

  /**
   * Find scanner by agent ID
   */
  async findByAgentId(agentId: string): Promise<Scanner | null> {
    return this.prisma.scanner.findUnique({
      where: { agentId }
    });
  }

  /**
   * Find scanner by public key
   */
  async findByPubkey(pubkey: string): Promise<Scanner | null> {
    return this.prisma.scanner.findUnique({
      where: { pubkey }
    });
  }

  /**
   * Get all active scanners
   */
  async findAllActive(): Promise<Scanner[]> {
    return this.prisma.scanner.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Get all scanners (active and inactive)
   */
  async findAll(): Promise<Scanner[]> {
    return this.prisma.scanner.findMany({
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Create scanner
   */
  async create(data: {
    agentId: string;
    name: string;
    pubkey: string;
    privateKey: string;
    strategy: string;
    description: string;
  }): Promise<Scanner> {
    return this.prisma.scanner.create({
      data
    });
  }

  /**
   * Update scanner
   */
  async update(id: string, data: Partial<Scanner>): Promise<Scanner> {
    return this.prisma.scanner.update({
      where: { id },
      data
    });
  }

  /**
   * Toggle scanner active status
   */
  async toggleActive(id: string): Promise<Scanner> {
    const scanner = await this.findById(id);
    if (!scanner) {
      throw new Error(`Scanner ${id} not found`);
    }

    return this.prisma.scanner.update({
      where: { id },
      data: { active: !scanner.active }
    });
  }

  /**
   * Delete scanner
   */
  async delete(id: string): Promise<Scanner> {
    return this.prisma.scanner.delete({
      where: { id }
    });
  }
}
