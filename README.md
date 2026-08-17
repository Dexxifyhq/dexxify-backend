# Dexxify API

Crypto Infrastructure API for Africa — the single API Nigerian developers use to add crypto wallets, Naira settlement, payouts, and KYC/KYB to their products.

## Tech Stack

- **Framework:** NestJS
- **Database:** Supabase (PostgreSQL), accessed via TypeORM
- **Hosting:** Railway
- **Crypto Provider:** Coincircuit
- **KYC/AML:** Kora

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your database, Coincircuit, and Kora credentials
```

### 3. Run the database migrations

In order, paste the contents of each file in `src/database/migrations/` into your Supabase SQL Editor and execute it:

1. `001_initial_schema.sql`
2. `002_coincircuit_migration.sql`
3. `003_crypto_transactions_metadata_gin_index.sql`

### 4. Start development server

```bash
pnpm start:dev
```

The API listens on `http://localhost:4000` (or `$PORT`) under the `/api/v1` prefix, with Swagger docs at `http://localhost:4000/api`.

## Project Structure

```
src/
├── config/                  # Environment config (database, Coincircuit, Kora, etc.)
├── database/
│   ├── entities/             # TypeORM entities
│   └── migrations/           # Numbered SQL migrations (applied manually via Supabase SQL Editor)
├── common/
│   ├── constants/             # Shared constants (fees, etc.)
│   ├── decorators/            # @GetBusinessId, @GetMode, @DualAuth, @Public, ...
│   ├── filters/                # Global exception filter
│   ├── guards/                 # API key / JWT guards
│   ├── interceptors/           # Response transform interceptor
│   └── utils/                  # Pagination, webhook signing, misc helpers
└── modules/
    ├── auth/                # Register/login, OTP verification, JWT session, live/test mode
    ├── businesses/           # Business (merchant) account management
    ├── teams/                # Team member invites and role-based access per business
    ├── developers/           # Developer profile management
    ├── dashboard/            # API keys + analytics for the developer portal (JWT-protected)
    ├── wallets/              # Deposit accounts (crypto addresses + NGN virtual accounts), withdrawals
    ├── customers/             # End-customer records per business
    ├── payment-sessions/      # Programmatic crypto checkout sessions
    ├── payment-pages/        # Hosted/public payment links
    ├── invoices/              # Crypto-payable invoices
    ├── offramp/               # Crypto → NGN conversion + auto payout
    ├── swaps/                 # Crypto/fiat swap quotations and execution
    ├── payouts/                # NGN bank payouts (single, batch, account resolve)
    ├── refunds/                # Refunds on payment sessions
    ├── kyc/                    # BVN, NIN, vNIN, CAC verification via Kora
    ├── ledger/                 # Transaction ledger, balances, settlement reports
    ├── admin/                  # Platform-level balance and fee withdrawal
    ├── webhooks/                # Developer webhook management + incoming Coincircuit webhooks
    ├── mail/                    # Transactional email (Brevo API)
    └── misc/                    # Banks, supported assets, crypto prices, rate calculator
```

## Authentication

The API uses two auth mechanisms, and most `/api/v1/*` business endpoints accept **either** (`@DualAuth()`):

| Mechanism | Used for                                        | Header                           |
| --------- | ------------------------------------------------ | -------------------------------- |
| API Key   | Server-to-server integration (`/api/v1/*`)        | `x-api-key: dex_live_...`        |
| JWT       | Developer portal / dashboard, browser sessions    | `Authorization: Bearer <token>` (also set as an http-only cookie) |

### Auth flow

```bash
# 1. Register (creates a developer account, sends an email OTP)
POST /api/v1/auth/register
{ "email": "dev@example.com", "password": "securepass123" }

# 2. Verify the OTP sent to that email
POST /api/v1/auth/verify-otp
{ "email": "dev@example.com", "otp": "123456" }

# 3. Log in — issues a JWT and sets a refresh-token cookie
POST /api/v1/auth/login
{ "email": "dev@example.com", "password": "securepass123" }

# 4. Create a business (if you don't have one yet)
POST /api/v1/businesses
{ "name": "My Fintech" }

# 5. Select the active business — required if the developer owns more than one
POST /api/v1/auth/select-business
{ "business_id": "..." }
```

Every business account has a **live** and **test** mode (`POST /api/v1/auth/mode` to switch), so integrations can be built and tested safely before going live — mirrors the pattern used by Stripe/Paystack-style APIs.

## API Reference (by module)

This lists route prefixes and what each module owns — for full request/response shapes, use the Swagger UI at `/api`, which is generated directly from the code and won't drift out of date the way a hand-maintained table here would.

| Module | Base path | Covers |
| --- | --- | --- |
| Auth | `/api/v1/auth` | Register, OTP verification, login/logout, refresh, business selection, live/test mode |
| Businesses | `/api/v1/businesses` | Create/list businesses, update profile, settlement + notification settings |
| Teams | `/api/v1/teams` | Invite/manage team members and roles |
| Developers | `/api/v1/developers` | Developer profile, password change |
| Dashboard | `/api/v1/dashboard` | API key management, revenue/asset/activity analytics |
| Wallets | `/api/v1/wallets` | Create deposit accounts, get deposit addresses/details, withdrawal addresses, stablecoin & local-currency withdrawals |
| Customers | `/api/v1/customers` | CRUD for end-customers, get a customer's deposit account |
| Payment Sessions | `/api/v1/payment-sessions` | Create/track checkout sessions, generate deposit addresses, price estimates |
| Payment Pages | `/api/v1/payment-pages` (+ public `/api/v1/p/:slug`) | Hosted payment links, public checkout |
| Invoices | `/api/v1/invoices` | Create/send/cancel/void invoices, public pay-by-number flow |
| Offramp | `/api/v1/offramp` | Convert crypto to NGN and auto-payout to a linked bank account |
| Swaps | `/api/v1/swaps` | Rate estimates, quotations, execution, swap history |
| Payouts | `/api/v1/payouts` | Single/batch NGN payouts, account resolution |
| Refunds | `/api/v1/refunds` | Refund estimates and execution on a payment session |
| KYC | `/api/v1/kyc` | BVN, NIN, vNIN, CAC verification and status |
| Ledger | `/api/v1` (`/transactions`, `/balance`, `/reports/settlement`) | Transaction history, balances, settlement reports |
| Admin | `/api/v1/admin/platform` | Platform balance and fee withdrawal (internal) |
| Webhooks | `/api/v1/webhooks` (+ `/api/v1/webhooks/incoming/coincircuit`) | Register/list/remove developer webhook endpoints; incoming Coincircuit event handler |
| Misc | `/api/v1/misc` | Bank list, saved banks, account verification, supported assets, crypto prices, rate calculator |

## Webhooks

Two distinct directions:

**Incoming** — Coincircuit calls `POST /api/v1/webhooks/incoming/coincircuit` for events like `payment.completed`, `transaction.confirmed`, `swap.completed`, `payout.success`, `deposit.completed`, etc. This is what drives status updates across payment sessions, wallets, swaps, and payouts internally.

**Outgoing** — developers register their own endpoint via `POST /api/v1/webhooks`, subscribing to one or more of:

| Event | Description |
| --- | --- |
| `wallet.deposit.confirmed` | Crypto deposit received |
| `offramp.completed` | Conversion and payout done |
| `offramp.failed` | Conversion failed |
| `payout.success` | NGN sent to bank |
| `payout.failed` | Payout rejected |
| `kyc.approved` | KYC passed |
| `kyc.failed` | KYC failed |

Outgoing payloads are signed with HMAC-SHA256 (`X-Dexxify-Signature` header, verify against your endpoint's registered secret) and retried on delivery failure.

## Deploy to Railway

```bash
railway login
railway init

# Set the variables listed in .env.example (database connection, Coincircuit, Kora, JWT secrets, etc.)
railway variables set DATABASE_POOLER=...
railway variables set COINCIRCUIT_API_KEY=...

railway up
```

## License

Confidential, internal use only.
