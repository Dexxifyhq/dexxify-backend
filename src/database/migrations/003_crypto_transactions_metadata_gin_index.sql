-- ============================================================
-- Migration 003: GIN index on crypto_transactions.metadata
--
-- Supports fast containment lookups (`metadata @> '{"key": "value"}'`),
-- e.g. OfframpService.findOne() resolving a CryptoTransaction by
-- metadata->>'swapRecordId' without a full table scan.
--
-- Note: CREATE INDEX (not CONCURRENTLY) briefly locks the table for
-- writes while it builds. Fine for a small/empty table; if this is run
-- against a table with meaningful production data, run the CONCURRENTLY
-- form manually instead, outside a transaction block:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crypto_transactions_metadata
--     ON crypto_transactions USING GIN (metadata);
-- ============================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_crypto_transactions_metadata
  ON crypto_transactions USING GIN (metadata);

COMMIT;