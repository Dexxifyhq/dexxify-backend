# Dexxify Africa API

Crypto Infrastructure API for Africa, the single API that Nigerian developers use to add crypto wallets, Naira settlement, payouts and KYC to their products.

## Tech Stack

- **Framework:** NestJS
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Railway
- **Crypto Provider:** Breet
- **KYC/AML:** Kora

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your Supabase, Breet, Kora credentials
```

### 3. Run the database migration

Copy the contents of `src/database/migrations/001_initial_schema.sql` into your Supabase SQL Editor and execute it.

### 4. Start development server

```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000` and Swagger docs at `http://localhost:3000/docs`.

## Project Structure

```
src/
├── config/                  # Environment config (Supabase, Breet, Kora, etc.)
├── database/
│   ├── migrations/          # SQL schema
├── common/
│   ├── decorators/          # @GetDeveloper, @Public, @ApiKeyAuth
│   ├── filters/             # Global exception filter
│   ├── guards/              # API key guard
│   ├── interceptors/        # Response transform interceptor
│   └── utils/               # API key generation, hashing, pagination
└── modules/
    ├── auth/                # JWT login + registration
    ├── dashboard/           # API key management + usage stats (JWT-protected)
    ├── wallets/             # Wallet-as-a-Service via Breet
    ├── offramp/             # Crypto → NGN conversion
    ├── payouts/             # NGN bank payouts
    ├── kyc/                 # BVN, NIN, document, liveness via Kora
    ├── webhooks/            # Developer webhook management + incoming provider webhooks
    └── ledger/              # Immutable transaction ledger + settlement reports
```

## Authentication

The API uses two auth mechanisms:

| Mechanism | Used For                                        | Header                          |
| --------- | ----------------------------------------------- | ------------------------------- |
| API Key   | All `/v1/*` endpoints (developer API)           | `x-api-key: dex_live_...`       |
| JWT       | `/auth/*` and `/dashboard/*` (developer portal) | `Authorization: Bearer <token>` |

### Register and get API key

```bash
POST /auth/register
{
  "email": "dev@example.com",
  "password": "securepass123",
  "business_name": "My Fintech"
}
# Response includes your sandbox API key (shown once)
```

### Login

```bash
POST /auth/login
{
  "email": "dev@example.com",
  "password": "securepass123"
}
# Returns JWT access_token
```

## API Endpoints

### Wallets (WaaS)

| Method | Endpoint                       | Description         |
| ------ | ------------------------------ | ------------------- |
| POST   | `/v1/wallets`                  | Create wallet       |
| GET    | `/v1/wallets`                  | List wallets        |
| GET    | `/v1/wallets/:id`              | Get wallet details  |
| GET    | `/v1/wallets/:id/address`      | Get deposit address |
| GET    | `/v1/wallets/:id/transactions` | Wallet transactions |
| POST   | `/v1/wallets/transfer`         | Internal transfer   |

### Offramp (Crypto to NGN)

| Method | Endpoint             | Description                   |
| ------ | -------------------- | ----------------------------- |
| GET    | `/v1/rates/:pair`    | Get live rate (e.g. USDT_NGN) |
| POST   | `/v1/offramp`        | Execute conversion            |
| GET    | `/v1/offramp/:tx_id` | Get transaction status        |

### Payouts (NGN)

| Method | Endpoint              | Description          |
| ------ | --------------------- | -------------------- |
| POST   | `/v1/payouts`         | Single payout        |
| POST   | `/v1/payouts/batch`   | Batch payout         |
| POST   | `/v1/payouts/resolve` | Resolve account name |
| GET    | `/v1/payouts/:id`     | Get payout status    |

### KYC / Identity

| Method | Endpoint                  | Description           |
| ------ | ------------------------- | --------------------- |
| POST   | `/v1/kyc/bvn`             | Verify BVN            |
| POST   | `/v1/kyc/nin`             | Verify NIN            |
| POST   | `/v1/kyc/document`        | Document verification |
| POST   | `/v1/kyc/liveness`        | Liveness check        |
| GET    | `/v1/kyc/:user_id/status` | Get KYC status        |

### Webhooks

| Method | Endpoint           | Description          |
| ------ | ------------------ | -------------------- |
| POST   | `/v1/webhooks`     | Register webhook URL |
| GET    | `/v1/webhooks`     | List webhooks        |
| DELETE | `/v1/webhooks/:id` | Remove webhook       |

### Ledger and Reports

| Method | Endpoint                  | Description             |
| ------ | ------------------------- | ----------------------- |
| GET    | `/v1/transactions`        | List all transactions   |
| GET    | `/v1/transactions/:tx_id` | Transaction detail      |
| GET    | `/v1/balance`             | Aggregate balance       |
| GET    | `/v1/reports/settlement`  | Daily settlement report |

### Dashboard (JWT auth)

| Method | Endpoint                  | Description                   |
| ------ | ------------------------- | ----------------------------- |
| POST   | `/dashboard/api-keys`     | Create new API key            |
| GET    | `/dashboard/api-keys`     | List API keys                 |
| PATCH  | `/dashboard/api-keys/:id` | Update key label/IP whitelist |
| DELETE | `/dashboard/api-keys/:id` | Revoke API key                |
| GET    | `/dashboard/overview`     | Account stats                 |
| GET    | `/dashboard/usage`        | Usage analytics               |

## Webhook Events

| Event                      | Description                |
| -------------------------- | -------------------------- |
| `wallet.deposit.confirmed` | Crypto deposit received    |
| `offramp.completed`        | Conversion and payout done |
| `offramp.failed`           | Conversion failed          |
| `payout.success`           | NGN sent to bank           |
| `payout.failed`            | Payout rejected            |
| `kyc.approved`             | KYC passed                 |
| `kyc.failed`               | KYC failed                 |

All webhook payloads are signed with HMAC-SHA256 via the `X-Dexxify-Signature` header.

## Deploy to Railway

```bash
# Install Railway CLI
pnpm install -g @railway/cli

# Login and init
railway login
railway init

# Set environment variables (from .env.example)
railway variables set SUPABASE_URL=...
railway variables set SUPABASE_SERVICE_ROLE_KEY=...

# Deploy
railway up
```

## TODO — Implement Provider Integrations

All third-party calls are stubbed. Search `TODO` to find them:

- `wallets.service.ts` — Breet wallet creation and deposit address
- `offramp.service.ts` — Breet rate fetching and conversion execution
- `payouts.service.ts` — Paystack recipient, transfer, account resolve
- `kyc.service.ts` — Kora verification calls
- `webhooks.controller.ts` — Incoming webhook signature verification and event routing

## License

Confidential, Internal use only.
