/**
 * Optimized Leaderboard Service
 * Single-query leaderboard calculation for <50ms performance
 */

import { PrismaClient } from '@prisma/client';

interface OptimizedAgentMetrics {
  agentId: string;
  agentName: string;
  scannerType: string;
  status: string;
  trades: number;
  winningTrades: number;
  totalPnl: number;
  winRate: number;
  avgPnl: number;
  rank?: number;
}

export class OptimizedLeaderboardService {
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  /**
   * Get leaderboard with a single optimized query
   * Target: <50ms execution time
   */
  async getOptimizedLeaderboard(): Promise<OptimizedAgentMetrics[]> {
    const startTime = Date.now();

    // Single aggregated query for all agent metrics
    const metrics = await this.db.$queryRaw<OptimizedAgentMetrics[]>`
      WITH agent_metrics AS (
        SELECT 
          s.id as "agentId",
          s.name as "agentName",
          s.type as "scannerType",
          s.status,
          COUNT(sc.id) as trades,
          COUNT(CASE WHEN sc."outcomeAmount" > sc."entryAmount" THEN 1 END) as "winningTrades",
          COALESCE(SUM(
            CASE 
              WHEN sc."outcomeAmount" IS NOT NULL AND sc."entryAmount" IS NOT NULL 
              THEN ((sc."outcomeAmount" - sc."entryAmount") / sc."entryAmount" * 100)
              ELSE 0 
            END
          ), 0) as "totalPnl",
          AVG(
            CASE 
              WHEN sc."outcomeAmount" IS NOT NULL AND sc."entryAmount" IS NOT NULL 
              THEN ((sc."outcomeAmount" - sc."entryAmount") / sc."entryAmount" * 100)
              ELSE 0 
            END
          ) as "avgPnl"
        FROM scanner s
        LEFT JOIN "ScannerCall" sc ON s.id = sc."scannerId" 
          AND sc."recommendation" IS NOT NULL
          AND sc."recommendation" != ''
        WHERE s.status = 'ACTIVE'
        GROUP BY s.id, s.name, s.type, s.status
      )
      SELECT 
        "agentId",
        "agentName",
        "scannerType",
        status,
        trades::INTEGER,
        "winningTrades"::INTEGER,
        "totalPnl"::DOUBLE PRECISION,
        CASE 
          WHEN trades > 0 THEN ("winningTrades"::DOUBLE PRECISION / trades::DOUBLE PRECISION)
          ELSE 0 
        END as "winRate",
        COALESCE("avgPnl", 0)::DOUBLE PRECISION as "avgPnl"
      FROM agent_metrics
      ORDER BY "totalPnl" DESC, "winRate" DESC, trades DESC
    `;

    const queryTime = Date.now() - startTime;
    console.log(`[OptimizedLeaderboard] Query executed in ${queryTime}ms`);

    // Assign ranks
    metrics.forEach((metric, index) => {
      metric.rank = index + 1;
    });

    return metrics;
  }

  /**
   * Get single agent metrics optimized
   */
  async getAgentMetrics(agentId: string): Promise<OptimizedAgentMetrics | null> {
    const metrics = await this.db.$queryRaw<OptimizedAgentMetrics[]>`
      WITH agent_metrics AS (
        SELECT 
          s.id as "agentId",
          s.name as "agentName",
          s.type as "scannerType",
          s.status,
          COUNT(sc.id) as trades,
          COUNT(CASE WHEN sc."outcomeAmount" > sc."entryAmount" THEN 1 END) as "winningTrades",
          COALESCE(SUM(
            CASE 
              WHEN sc."outcomeAmount" IS NOT NULL AND sc."entryAmount" IS NOT NULL 
              THEN ((sc."outcomeAmount" - sc."entryAmount") / sc."entryAmount" * 100)
              ELSE 0 
            END
          ), 0) as "totalPnl",
          AVG(
            CASE 
              WHEN sc."outcomeAmount" IS NOT NULL AND sc."entryAmount" IS NOT NULL 
              THEN ((sc."outcomeAmount" - sc."entryAmount") / sc."entryAmount" * 100)
              ELSE 0 
            END
          ) as "avgPnl"
        FROM scanner s
        LEFT JOIN "ScannerCall" sc ON s.id = sc."scannerId"
          AND sc."recommendation" IS NOT NULL
          AND sc."recommendation" != ''
        WHERE s.id = ${agentId}::uuid
        GROUP BY s.id, s.name, s.type, s.status
      )
      SELECT 
        "agentId",
        "agentName",
        "scannerType",
        status,
        trades::INTEGER,
        "winningTrades"::INTEGER,
        "totalPnl"::DOUBLE PRECISION,
        CASE 
          WHEN trades > 0 THEN ("winningTrades"::DOUBLE PRECISION / trades::DOUBLE PRECISION)
          ELSE 0 
        END as "winRate",
        COALESCE("avgPnl", 0)::DOUBLE PRECISION as "avgPnl"
      FROM agent_metrics
    `;

    return metrics[0] || null;
  }

  /**
   * Format metrics for API response
   */
  formatMetrics(metrics: OptimizedAgentMetrics) {
    return {
      rank: metrics.rank || 0,
      agentId: metrics.agentId,
      name: metrics.agentName,
      type: metrics.scannerType,
      status: metrics.status,
      stats: {
        totalTrades: metrics.trades,
        winningTrades: metrics.winningTrades,
        winRate: `${(metrics.winRate * 100).toFixed(1)}%`,
        totalPnL: `${metrics.totalPnl.toFixed(2)}%`,
        avgPnL: `${metrics.avgPnl.toFixed(2)}%`,
      },
    };
  }

  /**
   * Get leaderboard with pagination
   */
  async getLeaderboardPaginated(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    
    const [metrics, total] = await Promise.all([
      this.db.$queryRaw<OptimizedAgentMetrics[]>`
        WITH agent_metrics AS (
          SELECT 
            s.id as "agentId",
            s.name as "agentName",
            s.type as "scannerType",
            s.status,
            COUNT(sc.id) as trades,
            COUNT(CASE WHEN sc."outcomeAmount" > sc."entryAmount" THEN 1 END) as "winningTrades",
            COALESCE(SUM(
              CASE 
                WHEN sc."outcomeAmount" IS NOT NULL AND sc."entryAmount" IS NOT NULL 
                THEN ((sc."outcomeAmount" - sc."entryAmount") / sc."entryAmount" * 100)
                ELSE 0 
              END
            ), 0) as "totalPnl"
          FROM scanner s
          LEFT JOIN "ScannerCall" sc ON s.id = sc."scannerId"
            AND sc."recommendation" IS NOT NULL
            AND sc."recommendation" != ''
          WHERE s.status = 'ACTIVE'
          GROUP BY s.id, s.name, s.type, s.status
        )
        SELECT 
          "agentId",
          "agentName",
          "scannerType",
          status,
          trades::INTEGER,
          "winningTrades"::INTEGER,
          "totalPnl"::DOUBLE PRECISION,
          CASE 
            WHEN trades > 0 THEN ("winningTrades"::DOUBLE PRECISION / trades::DOUBLE PRECISION)
            ELSE 0 
          END as "winRate"
        FROM agent_metrics
        ORDER BY "totalPnl" DESC, "winRate" DESC
        LIMIT ${limit}::INTEGER
        OFFSET ${offset}::INTEGER
      `,
      this.db.scanner.count({ where: { status: 'ACTIVE' } }),
    ]);

    // Assign ranks considering pagination
    metrics.forEach((metric, index) => {
      metric.rank = offset + index + 1;
    });

    return {
      data: metrics.map(m => this.formatMetrics(m)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

// Create singleton instance
export function createOptimizedLeaderboard(db: PrismaClient) {
  return new OptimizedLeaderboardService(db);
}