CREATE TABLE IF NOT EXISTS "job_execution_locks" (
  "jobKey" TEXT PRIMARY KEY,
  "owner" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "job_execution_locks_expiresAt_idx"
  ON "job_execution_locks"("expiresAt");
