-- ============================================================
-- Migration 002: Breet → CoincircuitMCP column renames
--
-- Run this BEFORE restarting the application.
-- TypeORM synchronize (dev) or a separate TypeORM migration (prod)
-- will handle:
--   • Adding payment_sessions.provider_session_reference
--   • Adding customer_wallets.provider_recipient_id
--   • Creating the crypto_transactions table
-- ============================================================

BEGIN;

-- ── 1. banks: rename breet_bank_id → provider_recipient_id ──

ALTER TABLE banks
  RENAME COLUMN breet_bank_id TO provider_recipient_id;


-- ── 2. payouts: rename Breet reference columns ───────────────

ALTER TABLE payouts
  RENAME COLUMN breet_reference TO provider_reference;

ALTER TABLE payouts
  RENAME COLUMN breet_transfer_id TO provider_payout_id;


-- ── 3. offramp_transactions: rename breet_reference ─────────

ALTER TABLE offramp_transactions
  RENAME COLUMN breet_reference TO provider_reference;


-- ── 4. customer_wallets: make columns nullable + rename ───────

-- Drop NOT NULL constraints before the app can insert rows with nulls
ALTER TABLE customer_wallets
  ALTER COLUMN bank_id DROP NOT NULL;

ALTER TABLE customer_wallets
  ALTER COLUMN account_number DROP NOT NULL;

ALTER TABLE customer_wallets
  RENAME COLUMN breet_wallet_id TO provider_wallet_id;

ALTER TABLE customer_wallets
  ALTER COLUMN provider_wallet_id DROP NOT NULL;


-- ── 5. crypto_transactions: data migration from old tables ────
-- Both tables are empty in current DB so these are no-ops,
-- but are kept here for completeness and to run on any
-- environment that does have data before deploying.

-- (Requires crypto_transactions table to exist first — TypeORM
-- sync creates it on app restart. Run this block AFTER restart
-- if you have data to migrate.)

-- INSERT INTO crypto_transactions (
--   id, developer_id, direction,
--   crypto_asset, crypto_amount, wallet_address, tx_hash,
--   fiat_amount, fiat_currency, exchange_rate, fee,
--   status, reference, metadata, completed_at, created_at, updated_at
-- )
-- SELECT
--   id,
--   developer_id,
--   'inbound'::crypto_tx_direction,
--   crypto_asset::TEXT::crypto_transactions_crypto_asset_enum,
--   crypto_amount,
--   wallet_address,
--   tx_hash,
--   usd_amount,
--   'NGN',
--   exchange_rate,
--   (usd_amount * fee_percentage / 100),
--   CASE status::TEXT WHEN 'rejected' THEN 'failed' ELSE status::TEXT END::crypto_transactions_status_enum,
--   reference,
--   metadata,
--   completed_at,
--   created_at,
--   updated_at
-- FROM onramp_transactions
-- ON CONFLICT (id) DO NOTHING;

-- INSERT INTO crypto_transactions (
--   id, developer_id, direction,
--   fiat_amount, fiat_currency, fee,
--   status, provider_reference, description,
--   metadata, completed_at, created_at, updated_at
-- )
-- SELECT
--   id,
--   developer_id,
--   'outbound'::crypto_tx_direction,
--   amount,
--   COALESCE(currency, 'NGN'),
--   fee,
--   CASE status::TEXT WHEN 'rejected' THEN 'failed' ELSE status::TEXT END::crypto_transactions_status_enum,
--   provider_reference,
--   description,
--   metadata,
--   completed_at,
--   created_at,
--   updated_at
-- FROM offramp_transactions
-- ON CONFLICT (id) DO NOTHING;


-- ── 6. Drop old tables (after verifying data migration above) ─
-- DROP TABLE IF EXISTS onramp_transactions;
-- DROP TABLE IF EXISTS offramp_transactions;

COMMIT;
