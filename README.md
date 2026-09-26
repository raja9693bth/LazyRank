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
- **Database:** PostgreSQL (Neon Serverless in production; local disposable PostgreSQL for integration testing)
- **Payment Gateway:** Cashfree Payment Gateway (fail-closed API v2026-01-01)
- **Deployment:** Railway container deployment with automated migrations and security headers

---

## 2. Key Platform Invariants

1. **Dynamic Ranking Engine:** Placements are ordered strictly by cumulative verified sponsorship amount (`amount DESC`), with deterministic tie-breaking based on the earlier first verified payment timestamp (`first_verified_at ASC NULLS LAST`), followed by stable profile ID (`id ASC`). Ranking is dynamic and subject to displacement when subsequent participants sponsor higher amounts.
2. **Dual-Period Leaderboards:** 
   - **All-Time:** Lifetime cumulative verified sponsorship totals.
   - **Today:** Daily window reset strictly at 00:00:00 Indian Standard Time (IST, UTC+05:30).
3. **Zero Raw Owner Token Storage:** Profile ownership credentials (`lazy_owner_*`) are generated client-side and stored in browser storage (`sessionStorage` during checkout, `localStorage.lazy_tokens` upon completion). The server stores only cryptographic one-way SHA-256 hashes (`owner_token_hash`).
4. **Rank Settlement Ledger:** `rank_ledger` records every verified credit and debit reversal. Profile verified amounts and Today rankings are derived directly from settled ledger entries.
5. **Fail-Closed Payments:** In `PAYMENT_MODE=disabled`, checkout remains unavailable. Live payments require valid Cashfree credentials and verified merchant tax configurations.

---

## 3. Local Development & Disposable Database Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ or a disposable local test database

### Installation
```bash
# Clone the repository
git clone https://github.com/adabhra/lazyrank.git
cd lazyrank

# Install dependencies
npm ci
```

### Environment Configuration
Copy `.env.example` to `.env` and configure your local settings:
```bash
cp .env.example .env
```

### Setting Up a Disposable Test Database (Local)
For running the comprehensive automated test suite locally, use a disposable database (never connect tests to production Neon):
```bash
# Example creating a disposable local database named lazyproof_test:
createdb -h localhost -p 5433 -U postgres lazyproof_test

# Run migrations against the disposable database:
$env:DATABASE_URL = "postgresql://postgres@localhost:5433/lazyproof_test"
$env:CI = "true"
$env:STRICT_PG_TEST = "true"
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

Database migrations are located in `server/db/migrations/` and applied automatically on server boot via `server/db/postgres.ts`:
- `001_initial_schema.sql`: Core tables (`profiles`, `payment_orders`, `payment_transactions`, `rank_ledger`, `claim_history`, `refund_reversals`, `reports`, `nominations`).
- `002_legal_identity_migration.sql`: Contact inquiries, idempotency constraints, and deterministic tie-breaking indexes.
- `003_today_leaderboard_indexes.sql`: Fast IST boundary aggregation indexes.
- `004_settled_credits_index.sql`: Partial index for rapid settled credit calculations.

---

## 5. Security & Operational Policies

The canonical underwriting, legal, and operational policies are hosted live on the website:
- **Terms of Service:** [/terms](https://lazyproof.online/terms)
- **Privacy Policy:** [/privacy](https://lazyproof.online/privacy)
- **Refund & Cancellation:** [/refund-cancellation](https://lazyproof.online/refund-cancellation)
- **Shipping & Delivery:** [/delivery](https://lazyproof.online/delivery)
- **Contact & Support:** [/contact](https://lazyproof.online/contact)
- **Official Rules:** [/rules](https://lazyproof.online/rules)
