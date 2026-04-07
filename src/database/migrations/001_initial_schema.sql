-- ============================================================
-- DEXXIFY AFRICA — Full Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────

CREATE TYPE developer_status AS ENUM ('active', 'suspended', 'pending');
CREATE TYPE subscription_plan AS ENUM ('starter', 'growth', 'scale', 'enterprise');
CREATE TYPE wallet_asset AS ENUM ('BTC', 'USDT', 'ETH', 'USDC');
CREATE TYPE wallet_status AS ENUM ('active', 'frozen', 'closed');
CREATE TYPE tx_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE tx_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'onramp', 'offramp', 'payout', 'fee');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE kyc_type AS ENUM ('bvn', 'nin', 'document', 'liveness');
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'failed', 'expired');
CREATE TYPE webhook_event_status AS ENUM ('pending', 'delivered', 'failed');

-- ── DEVELOPERS (your B2B customers) ─────────────────────────

CREATE TABLE developers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    status developer_status DEFAULT 'pending',
    plan subscription_plan DEFAULT 'starter',
    api_call_count INTEGER DEFAULT 0,
    monthly_api_limit INTEGER DEFAULT 500,
    metadata JSONB DEFAULT '{}',
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_developers_email ON developers(email);
CREATE INDEX idx_developers_status ON developers(status);

-- ── API KEYS ────────────────────────────────────────────────

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,  -- e.g. "dex_live_abc" for display
    label VARCHAR(100) DEFAULT 'Default',
    environment VARCHAR(10) DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'live')),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    ip_whitelist TEXT[],  -- optional IP restrictions
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_developer ON api_keys(developer_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- ── OTP CODES ───────────────────────────────────────────────

CREATE TYPE otp_type AS ENUM ('email_verification', 'password_reset');

CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    type otp_type NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_developer ON otp_codes(developer_id);
CREATE INDEX idx_otp_lookup ON otp_codes(developer_id, type, is_used, expires_at);

-- ── WALLETS ─────────────────────────────────────────────────

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    external_user_id VARCHAR(255) NOT NULL,  -- developer's own user ID
    asset wallet_asset NOT NULL,
    balance DECIMAL(28, 8) DEFAULT 0,
    locked_balance DECIMAL(28, 8) DEFAULT 0,  -- funds in pending txns
    deposit_address VARCHAR(255),
    status wallet_status DEFAULT 'active',
    breet_wallet_id VARCHAR(255),  -- reference to Breet
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(developer_id, external_user_id, asset)
);

CREATE INDEX idx_wallets_developer ON wallets(developer_id);
CREATE INDEX idx_wallets_ext_user ON wallets(external_user_id);
CREATE INDEX idx_wallets_breet ON wallets(breet_wallet_id);

-- ── OFFRAMP TRANSACTIONS (Crypto → NGN) ────────────────────

CREATE TABLE offramp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    crypto_asset wallet_asset NOT NULL,
    crypto_amount DECIMAL(28, 8) NOT NULL,
    exchange_rate DECIMAL(18, 4) NOT NULL,
    ngn_amount DECIMAL(18, 2) NOT NULL,
    fee_crypto DECIMAL(28, 8) DEFAULT 0,
    fee_ngn DECIMAL(18, 2) DEFAULT 0,
    destination_bank_code VARCHAR(10),
    destination_account_number VARCHAR(20),
    destination_account_name VARCHAR(255),
    status tx_status DEFAULT 'pending',
    breet_reference VARCHAR(255),
    paystack_reference VARCHAR(255),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offramp_developer ON offramp_transactions(developer_id);
CREATE INDEX idx_offramp_wallet ON offramp_transactions(wallet_id);
CREATE INDEX idx_offramp_status ON offramp_transactions(status);

-- ── ONRAMP TRANSACTIONS (NGN → Crypto) ─────────────────────

CREATE TABLE onramp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    crypto_asset wallet_asset NOT NULL,
    ngn_amount DECIMAL(18, 2) NOT NULL,
    exchange_rate DECIMAL(18, 4) NOT NULL,
    crypto_amount DECIMAL(28, 8) NOT NULL,
    fee_ngn DECIMAL(18, 2) DEFAULT 0,
    fee_crypto DECIMAL(28, 8) DEFAULT 0,
    payment_reference VARCHAR(255),
    status tx_status DEFAULT 'pending',
    breet_reference VARCHAR(255),
    paystack_reference VARCHAR(255),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_onramp_developer ON onramp_transactions(developer_id);
CREATE INDEX idx_onramp_wallet ON onramp_transactions(wallet_id);
CREATE INDEX idx_onramp_status ON onramp_transactions(status);

-- ── PAYOUTS (NGN bank payouts) ──────────────────────────────

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id),
    amount DECIMAL(18, 2) NOT NULL,
    fee DECIMAL(18, 2) DEFAULT 0,
    bank_code VARCHAR(10) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(255),
    narration VARCHAR(255),
    status payout_status DEFAULT 'pending',
    batch_id UUID,  -- for batch payouts
    paystack_reference VARCHAR(255),
    paystack_transfer_code VARCHAR(255),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payouts_developer ON payouts(developer_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_batch ON payouts(batch_id);

-- ── KYC VERIFICATIONS ───────────────────────────────────────

CREATE TABLE kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id),
    external_user_id VARCHAR(255) NOT NULL,
    type kyc_type NOT NULL,
    status kyc_status DEFAULT 'pending',
    id_number VARCHAR(50),  -- BVN or NIN number (encrypted at app level)
    document_url TEXT,
    selfie_url TEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    provider_reference VARCHAR(255),  -- SmileID job ID
    provider_response JSONB DEFAULT '{}',
    confidence_score DECIMAL(5, 2),
    failure_reason TEXT,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kyc_developer ON kyc_verifications(developer_id);
CREATE INDEX idx_kyc_ext_user ON kyc_verifications(external_user_id);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);

-- ── WEBHOOK ENDPOINTS ───────────────────────────────────────

CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    secret VARCHAR(255) NOT NULL,  -- HMAC signing secret
    events TEXT[] NOT NULL DEFAULT '{}',  -- subscribed event types
    is_active BOOLEAN DEFAULT true,
    description VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_developer ON webhook_endpoints(developer_id);

-- ── WEBHOOK EVENTS LOG ──────────────────────────────────────

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    developer_id UUID NOT NULL REFERENCES developers(id),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status webhook_event_status DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    response_status INTEGER,
    response_body TEXT,
    next_retry_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wh_events_endpoint ON webhook_events(webhook_endpoint_id);
CREATE INDEX idx_wh_events_status ON webhook_events(status);
CREATE INDEX idx_wh_events_next_retry ON webhook_events(next_retry_at) WHERE status = 'pending';

-- ── LEDGER (immutable transaction log) ──────────────────────

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    developer_id UUID NOT NULL REFERENCES developers(id),
    tx_type tx_type NOT NULL,
    reference_type VARCHAR(50) NOT NULL,  -- 'offramp', 'payout', 'wallet_transfer', etc.
    reference_id UUID NOT NULL,  -- ID of the related entity
    debit DECIMAL(28, 8) DEFAULT 0,
    credit DECIMAL(28, 8) DEFAULT 0,
    currency VARCHAR(10) NOT NULL,  -- 'NGN', 'USDT', 'BTC', etc.
    balance_after DECIMAL(28, 8),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ledger_developer ON ledger_entries(developer_id);
CREATE INDEX idx_ledger_ref ON ledger_entries(reference_type, reference_id);
CREATE INDEX idx_ledger_type ON ledger_entries(tx_type);
CREATE INDEX idx_ledger_currency ON ledger_entries(currency);
CREATE INDEX idx_ledger_created ON ledger_entries(created_at);

-- ── UPDATED_AT TRIGGER ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all mutable tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON developers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON offramp_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON onramp_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
-- Supabase RLS — only service role key bypasses; API handles auth

ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE offramp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onramp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (our API server uses service role key)
CREATE POLICY "Service role full access" ON developers FOR ALL USING (true);
CREATE POLICY "Service role full access" ON otp_codes FOR ALL USING (true);
CREATE POLICY "Service role full access" ON api_keys FOR ALL USING (true);
CREATE POLICY "Service role full access" ON wallets FOR ALL USING (true);
CREATE POLICY "Service role full access" ON offramp_transactions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON onramp_transactions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON payouts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON kyc_verifications FOR ALL USING (true);
CREATE POLICY "Service role full access" ON webhook_endpoints FOR ALL USING (true);
CREATE POLICY "Service role full access" ON webhook_events FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ledger_entries FOR ALL USING (true);