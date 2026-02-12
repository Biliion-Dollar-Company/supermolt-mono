import { PrismaClient } from '@prisma/client';

export class DistributedLockService {
  private db: PrismaClient;
  private ownerId: string;

  constructor(db: PrismaClient, ownerId: string) {
    this.db = db;
    this.ownerId = ownerId;
  }

  async tryAcquire(jobKey: string, ttlMs: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlMs);
    const owner = this.ownerId;

    const rows = await this.db.$queryRaw<Array<{ jobKey: string }>>`
      INSERT INTO "job_execution_locks" ("jobKey", "owner", "expiresAt", "acquiredAt", "updatedAt")
      VALUES (${jobKey}, ${owner}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT ("jobKey")
      DO UPDATE SET
        "owner" = EXCLUDED."owner",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = NOW()
      WHERE
        "job_execution_locks"."expiresAt" < NOW()
        OR "job_execution_locks"."owner" = EXCLUDED."owner"
      RETURNING "jobKey"
    `;

    return rows.length > 0;
  }

  async release(jobKey: string): Promise<void> {
    await this.db.$executeRaw`
      DELETE FROM "job_execution_locks"
      WHERE "jobKey" = ${jobKey} AND "owner" = ${this.ownerId}
    `;
  }
}

export function getReplicaId() {
  return (
    process.env.REPLICA_ID
    || process.env.RAILWAY_REPLICA_ID
    || process.env.HOSTNAME
    || `pid-${process.pid}`
  );
}
