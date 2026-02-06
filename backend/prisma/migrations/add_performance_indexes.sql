-- Performance optimization indexes for Trench platform
-- Created: Feb 5, 2026
-- Purpose: Reduce query time to <50ms for leaderboard and scanner operations

-- Index for scanner calls by scanner ID and recommendation status
CREATE INDEX IF NOT EXISTS idx_scanner_call_scanner_recommendation 
ON "ScannerCall" ("scannerId") 
WHERE "recommendation" IS NOT NULL AND "recommendation" != '';

-- Index for active scanners
CREATE INDEX IF NOT EXISTS idx_scanner_status_active 
ON "scanner" ("status") 
WHERE status = 'ACTIVE';

-- Composite index for scanner calls performance queries
CREATE INDEX IF NOT EXISTS idx_scanner_call_performance 
ON "ScannerCall" ("scannerId", "entryAmount", "outcomeAmount") 
WHERE "recommendation" IS NOT NULL;

-- Index for scanner calls by created date (for time-based queries)
CREATE INDEX IF NOT EXISTS idx_scanner_call_created 
ON "ScannerCall" ("createdAt" DESC);

-- Index for scanner epochs relationship
CREATE INDEX IF NOT EXISTS idx_scanner_epoch_scanner 
ON "ScannerEpoch" ("scannerId", "epochId");

-- Index for epochs by status
CREATE INDEX IF NOT EXISTS idx_epoch_status 
ON "Epoch" ("status") 
WHERE status IN ('ACTIVE', 'PENDING');

-- Analyze tables to update statistics
ANALYZE "scanner";
ANALYZE "ScannerCall";
ANALYZE "ScannerEpoch";
ANALYZE "Epoch";

-- Add comment to track optimization
COMMENT ON INDEX idx_scanner_call_scanner_recommendation IS 'Optimized for leaderboard queries filtering by recommendation';
COMMENT ON INDEX idx_scanner_call_performance IS 'Optimized for PnL calculations in leaderboard';