# LazyProof (LazyRank)

**LazyProof** is a high-transparency digital sponsored profile placement platform and public leaderboard showcase. Participants sponsor verified placement in Indian Rupees (INR) to playfully demonstrate and celebrate their laziness.

- **Website:** [https://lazyproof.online](https://lazyproof.online)
- **Legal Operating Entity:** ADABHRA GROUP (Sole Proprietorship)
- **Proprietor:** Raja Babu
- **Registered Address:** Ward No. 13, Mahodipur, Majhaulia, West Champaran, Bihar - 845454, India
- **Support Email:** support@lazyproof.online
- **Support Telephone:** +91 95211 90205

---

## 1. Architecture Overview

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express, TypeScript (transpiled with esbuild), Native PostgreSQL Client (`pg`)
- **Database:** PostgreSQL (Neon Serverless in production; isolated local disposable PostgreSQL for integration testing)
- **Payment Gateway:** Cashfree Payment Gateway (fail-closed API v2026-01-01)
- **Deployment:** Railway container deployment with automated migrations and security headers

---

## 2. Key Platform Invariants

1. **Dynamic Ranking Engine:** Placements are ordered strictly by cumulative verified sponsorship amount (`amount DESC`), with deterministic tie-breaking based on the earlier first verified payment timestamp (`first_verified_at ASC NULLS LAST`), followed by stable profile ID (`id ASC`). Ranking is dynamic and subject to displacement when subsequent participants sponsor higher amounts.
2. **Dual-Period Leaderboards:** 
   - **All-Time:** Lifetime cumulative verified sponsorship totals.
   - **Today:** Daily window reset strictly at 00:00:00 Indian Standard Time (IST, UTC+05:30).
3. **Zero Raw Owner Token Storage:** Profile ownership credentials follow the strict format `lazy_` + 64 hexadecimal characters (`lazy_[0-9a-f]{64}`). Tokens are generated client-side and stored only in browser storage (`sessionStorage` during checkout, `localStorage.lazy_tokens` upon completion). The server stores only cryptographic one-way SHA-256 hashes (`owner_token_hash`).
4. **Rank Settlement Ledger:** `rank_ledger` records every verified credit and debit reversal. Profile verified amounts and Today rankings are derived directly from settled ledger entries.
5. **Fail-Closed Payments:** In `PAYMENT_MODE=disabled`, checkout remains unavailable. Live payments require valid Cashfree credentials and verified merchant tax configurations.

---

## 3. Local Development & Disposable Database Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ on local development machine

### Installation

```bash
# Clone the repository
git clone https://github.com/raja9693bth/LazyRank.git
cd LazyRank

# Install dependencies
npm ci
```

### Environment Configuration

```bash
# Bash:
cp .env.example .env
```

```powershell
# PowerShell:
Copy-Item .env.example .env
```

### Setting Up a Disposable Test Database (Local Only)

> **CRITICAL SAFETY RULE:** Never run automated tests or test mutations against production Neon. Always use an isolated, local disposable PostgreSQL instance.

#### Bash Example:
```bash
# 1. Create a local disposable database on port 5433 (or standard 5432):
createdb -h 127.0.0.1 -p 5433 -U postgres lazyproof_test

# 2. Export environment variables for test execution:
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/lazyproof_test"
export CI="true"
export STRICT_PG_TEST="true"

# 3. Run all tests:
npm test
```

#### PowerShell Example:
```powershell
# 1. Create a local disposable database on port 5433 (or standard 5432):
createdb -h 127.0.0.1 -p 5433 -U postgres lazyproof_test

# 2. Set environment variables for test execution:
$env:DATABASE_URL = "postgresql://postgres@127.0.0.1:5433/lazyproof_test"
$env:CI = "true"
$env:STRICT_PG_TEST = "true"

# 3. Run all tests:
npm test
```

### Running Scripts

```bash
# Start local development server (frontend + API)
npm run dev

# Typecheck and lint codebase
npm run lint

# Run master test suite (all integration and contract tests)
npm test

# Build production bundle
npm run build
```

---

## 4. Migrations & Schema

The base schema is defined in `server/db/schema.sql`. Additive migrations are located in `server/db/migrations/` and applied automatically on server startup via `server/db/postgres.ts`:
- `server/db/schema.sql`: Fresh baseline authoritative schema containing all core tables (`profiles`, `payment_orders`, `payment_transactions`, `rank_ledger`, `claim_history`, `refund_reversals`, `reports`, `nominations`, `notification_preferences`, `contact_inquiries`, `operational_outbox`, `outbox_channel_deliveries`, `api_rate_limits`).
- `002_remediation.sql`: Owner token hashing, check constraints, refund reservations, and transaction isolation.
- `003_final_polish.sql`: Deterministic tie-breaking indexes, audit logging, and payment verification hardening.
- `004_today_leaderboard.sql`: IST boundary indexes for high-performance daily window leaderboard aggregations.
- `005_operational_workflows.sql`: Operational outbox table, outbox indexes, and failure tracking.
- `006_outbox_delivery.sql`: Durable per-channel delivery tracking (`outbox_channel_deliveries`) and configuration status guards (`SKIPPED_NO_CHANNELS`, `WAITING_CONFIG`).
- `007_reconciliation_retries.sql`: Additive reconciliation retry tracking (`reconciliation_attempts`, `next_reconcile_at`, `reconciliation_error`) and partial indexes to `payment_orders` and `refund_reversals` for fair, bounded recovery without 24h starvation.

---

## 5. Security & Operational Policies

The canonical underwriting, legal, and operational policies are hosted live on the website:
- **Pricing & Placement Policy:** [/pricing](https://lazyproof.online/pricing)
- **About LazyProof:** [/about](https://lazyproof.online/about)
- **Official Rules:** [/rules](https://lazyproof.online/rules)
- **Terms of Service:** [/terms](https://lazyproof.online/terms)
- **Privacy Policy:** [/privacy](https://lazyproof.online/privacy)
- **Refund & Cancellation:** [/refund-cancellation](https://lazyproof.online/refund-cancellation)
- **Shipping & Delivery:** [/delivery](https://lazyproof.online/delivery)
- **Contact & Support:** [/contact](https://lazyproof.online/contact)

### Merchant Underwriting & Commercial Notice
Live payments operate in `PAYMENT_MODE=disabled` pending formal banking aggregator underwriting and merchant account activation. Any sample invoice requested by payment aggregators (e.g., Razorpay or Cashfree) must be prepared from genuine business and tax facts by the founder or registered accountant. Never generate or issue synthetic or fake GST invoices.
