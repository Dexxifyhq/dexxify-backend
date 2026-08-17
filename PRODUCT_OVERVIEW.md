# Dexxify — Product Overview

*For the frontend team: source material for landing page copy and marketing pages. Everything below reflects what the API actually does today — treat it as ground truth over anything from an older deck or README. Pricing, testimonials, and specific numbers (uptime %, customer counts, etc.) aren't included since they're not something the backend can confirm — get those from the founders before publishing.*

## One-liner

**Dexxify is the single API African developers use to add crypto payments, Naira settlement, payouts, and identity verification (KYC/KYB) to their products.**

## Elevator pitch

Dexxify is crypto infrastructure-as-a-service for Africa. Instead of a business integrating a crypto payment processor, a Naira payout rail, a currency swap engine, and a KYC provider separately, they integrate Dexxify once and get all of it behind a single API and dashboard — accept crypto payments from customers, hold and manage crypto/Naira balances, convert between them, pay out to Nigerian bank accounts, and verify who they're dealing with (BVN, NIN, CAC).

It's built API-first for developers (REST API + webhooks + full Swagger docs), with a companion dashboard for the non-technical side of running a business on it.

## Who it's for

Nigerian/African fintechs, marketplaces, SaaS products, and merchants who want to:
- Accept crypto payments from customers (checkout, invoices, payment links)
- Give customers or their own platform crypto wallets without building wallet infra themselves
- Convert crypto to Naira and settle to a bank account
- Pay out to Nigerian bank accounts programmatically
- Verify identities (individuals via BVN/NIN, businesses via CAC) before onboarding them

## Core products

### 1. Payments & Checkout
- **Payment Sessions** — programmatic crypto checkout: create a session, get a deposit address, customer pays, webhook confirms.
- **Payment Pages** — shareable, hosted payment links (no code required) for one-off or recurring collection.
- **Invoices** — create and send crypto-payable invoices with due dates; auto-marked paid when the linked payment session completes; supports cancel/void.
- Live status tracking through the full lifecycle: pending → partial/underpaid → completed → expired.

### 2. Wallets & Deposits (Onramp)
- Programmatic deposit accounts per customer — static crypto deposit addresses across multiple chains, plus NGN virtual bank accounts for direct Naira deposits.
- Real-time deposit tracking (processing → completed) with automatic ledger crediting.

### 3. Off-ramp & Payouts
- **Off-ramp** — convert crypto to Naira automatically (quote → swap → payout to a linked bank recipient), with live settlement webhooks confirming each step.
- **Payouts** — direct Naira bank payouts (withdrawals) to verified recipients, with full status tracking (pending → success/failed).

### 4. Swaps
- Currency/asset conversion (e.g. USDT → NGN) via live rate estimates and locked quotations, independent of the off-ramp flow — useful for treasury/rebalancing use cases.

### 5. Identity Verification (KYC/KYB)
- Individual verification: **BVN**, **NIN**, and **virtual NIN (vNIN)**.
- Business verification: **CAC** lookup.
- Status and audit trail per verification, queryable by reference.

### 6. Ledger & Reporting
- A full transaction ledger tracking every credit/debit across currencies (NGN, USD, USDT, USDC), with running balances and daily settlement reports.
- Dashboard analytics for volume, transaction status breakdowns, and revenue.

### 7. Teams & Access Control
- Multi-user business accounts — invite teammates with role-based access, so it's not a single-login product.

### 8. Developer Platform
- REST API with full **Swagger/OpenAPI docs**.
- **API key** authentication for integration endpoints, **JWT** auth for the dashboard/portal side.
- **Live and Test modes** on every business account (build and test safely before going live — same pattern developers expect from Stripe-style APIs).
- **Webhooks**, both incoming (from the crypto/payment provider, so Dexxify can react to on-chain and payout events) and outgoing (so merchants get notified of events in their own systems).

## Supported assets & networks

**Assets:** BTC, ETH, USDT, USDC, SOL, BNB, TRX, TON

**Networks:** Bitcoin, Ethereum, Binance Smart Chain, Solana, Tron, Base, Arbitrum, TON

## Supported currencies (settlement/ledger)

NGN (Naira), USD, USDT, USDC

## Positioning notes for landing page copy

A few honest angles the copy can lean on, all grounded in the above:
- **"One API instead of five vendors."** The core pitch is consolidation — payments, wallets, off-ramp, payouts, and KYC are usually separate integrations; Dexxify is one.
- **Built for Africa, Naira-native.** Naira settlement and Nigerian identity verification (BVN/NIN/CAC) aren't bolted on — they're first-class, not a generic global product retrofitted for the region.
- **Developer-first, but not developer-only.** Full API + webhooks for engineering teams, and a dashboard + hosted payment pages for the non-technical side of the business (finance, ops).
- **Live/Test separation** signals a maturity level developers actually look for when picking a payments provider — it's safe to integrate and test without touching real funds.

## Brand basics

- **Name:** Dexxify
- **API title:** Dexxify API
- **Tagline:** Crypto Infrastructure API for Africa (Wallets, Payouts, Offramp, Onramp, KYC, KYB)
- **Website:** https://www.dexxify.com
- **Contact:** dexxifyhq@gmail.com
