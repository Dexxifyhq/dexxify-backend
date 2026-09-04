-- ============================================================
-- Migration 004: Enforce one webhook endpoint per business per mode
--
-- The webhooks module is now a single configurable endpoint per
-- (business, mode) — one URL, one enable/disable toggle, one signing
-- secret — matching the dashboard UI, rather than a list of endpoints.
-- This adds the constraint at the DB level to match.
--
-- If this fails with a uniqueness violation, there are pre-existing
-- duplicate (business_id, mode) rows to resolve first — e.g. keep the
-- most recently created row per pair and delete the rest.
-- ============================================================

BEGIN;

ALTER TABLE webhook_endpoints
  ADD CONSTRAINT uq_webhook_endpoints_business_mode UNIQUE (business_id, mode);

COMMIT;
