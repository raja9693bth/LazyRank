# LazyProof Operations & Customer Data Flow Guide

**Audience:** Solo Founder / Sole Proprietor (ADABHRA GROUP, Raja Babu) & Support Engineers
**System Baseline:** LazyProof (LazyRank) Production Stack — Node.js/Express, React 19/TypeScript, Neon PostgreSQL, Cashfree Payment Gateway
**Date:** September 2026

---

## 1. Operating Identity & Core Architecture

LazyProof is a digital sponsored showcase operated by **ADABHRA GROUP**, a sole proprietorship registered in India:
- **Proprietor:** Raja Babu
- **Legal Entity:** ADABHRA GROUP (Sole Proprietorship)
- **Registered Address:** Ward No. 13, Mahodipur, Majhaulia, West Champaran, Bihar - 845454, India
- **Support Email:** support@lazyproof.online
- **Support Telephone:** +91 95211 90205
- **Website:** https://lazyproof.online

The system processes real Indian Rupee (INR) transactions via Cashfree and reflects verified placement on the public leaderboard. The system enforces strict separation of concerns across its persistence layers:

1. **Neon PostgreSQL:** The authoritative, system-of-record operational database for all orders, profiles, rank settlement ledger entries, refunds, and contact inquiries.
2. **Cashfree Merchant Dashboard:** The gateway settlement and banking rail record. Cashfree handles bank/UPI authorization, merchant payout cycles, and dispute lifecycles.
3. **Customer Browser Storage (`localStorage` / `sessionStorage`):** Client-side custody of raw cryptographic tokens formatted strictly as `lazy_` + 64 hexadecimal characters (`lazy_[0-9a-f]{64}`). Pending checkout credentials live in `sessionStorage` and successful owner tokens live in `localStorage.lazy_tokens` keyed by profile ID. The backend server **never** stores recoverable raw owner tokens—only one-way SHA-256 hashes (`owner_token_hash`).

---

## 2. Authoritative Field-Level Customer & Payment Data Map

*Extracted directly from `server/db/schema.sql`, `mapOrder()`, and `mapProfile()`.*

| Data Category | Table / Entity | Authoritative Columns in PostgreSQL | Sensitivity & Access Control | Operational & Truthfulness Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Public Profile** | `profiles` | `id`, `user_id`, `name`, `amount`, `rank`, `instagram`, `linkedin`, `website`, `reason`, `title`, `badge`, `lazy_reason`, `roast`, `lazy_streak_days`, `is_verified`, `first_verified_at`, `owner_token_hash`, `moderation_status`, `votes_count`, `created_at`, `updated_at`, `rank_expires_at` | **Public** (Exposed via `/api/leaderboard` and `/api/profile/:id`) | Displays public sponsorship amount and rank. `owner_token_hash` is strictly omitted from public DTOs. Ranks are ordered by `amount DESC, first_verified_at ASC NULLS LAST, id ASC`. |
| **Customer Contact & Order Record** | `payment_orders` | `order_id`, `profile_id`, `owner_token_hash`, `order_access_token_hash`, `name`, `amount`, `currency`, `status`, `payment_mode`, `provider`, `provider_order_id`, `payment_session_id`, `idempotency_key`, `cf_payment_id`, `customer_email`, `customer_phone`, `quote_snapshot`, `consent_accepted`, `consent_timestamp`, `consent_version`, `instagram`, `linkedin`, `website`, `reason`, `lazy_reason`, `created_at`, `updated_at` | **Confidential PII & Financial** (Admin/Support only) | Captures optional `customer_email` and `customer_phone` if provided during checkout. Stores `cf_payment_id` from Cashfree. Records explicit legal consent via `consent_accepted`, `consent_timestamp`, and `consent_version`. Order status lifecycle: `CREATED` → `PENDING` → `PAID` → `REFUND_PENDING` → `PARTIALLY_REFUNDED` / `REFUNDED` / `FAILED`. |
| **Gateway Transaction Audits** | `payment_transactions` | `id`, `order_id`, `provider`, `provider_payment_id`, `amount`, `currency`, `status`, `payment_method`, `signature_verified`, `raw_payload`, `created_at` | **Internal Audit** (Admin/Support only) | Records each gateway transaction captured. `provider_payment_id` is Cashfree's payment ID (`cf_payment_id`). Payment method and provider data vary by transaction. |
| **Rank Settlement Ledger** | `rank_ledger` | `id`, `profile_id`, `order_id`, `type`, `amount`, `currency`, `status`, `note`, `created_at` | **Authoritative Settlement Ledger** (Admin only) | `rank_ledger` is a rank and settlement tracking ledger (not a general-ledger accounting system). `type`: `CREDIT` (positive amount, sponsorship added upon verified settlement) or `DEBIT_REFUND` / `DEBIT_CHARGEBACK` (stored with negative amounts, e.g. `-500.00`). Profile verified amounts and Today leaderboard values are derived from settled records. |
| **Refund State Machine** | `refund_reversals` | `id`, `order_id`, `merchant_refund_id`, `provider_refund_id`, `amount`, `currency`, `reason`, `status`, `created_at`, `updated_at` | **Internal Financial** (Admin only) | Preflight reservations reserve refundable paise under `PENDING`. Upon gateway confirmation, status transitions to `SUCCESS` and atomically triggers `rank_ledger` debit (negative amount) and rank recalculation. |
| **Webhook Audit Inbox** | `payment_webhook_events` | `id`, `event_id`, `event_type`, `order_id`, `provider_payment_id`, `payload`, `processed_at` | **Internal Security Audit** (Admin only) | Raw JSON payload of HMAC-verified Cashfree webhooks. Idempotency enforced on `event_id`. Never forward raw payloads to external services. |
| **Customer Inquiries** | `contact_inquiries` | `id`, `name`, `email`, `subject`, `order_id`, `message`, `client_ip`, `status`, `created_at` | **Customer Support** | Submitted via `/contact` or support desk. |
| **Content Abuse Reports** | `reports` | `id`, `target_id`, `target_type`, `reason`, `details`, `client_ip`, `status`, `created_at` | **Moderation** | Stores reports on targets (`profile`, `comment`, `nomination`). Accessible only to authenticated admin. |
| **Notification Preferences** | `notification_preferences` | `id`, `email`, `profile_id`, `notify_displaced`, `notify_daily_summary`, `created_at` | **Internal** | Stored preferences schema. Customer-facing email delivery is inactive/unprovisioned; customer subscribe endpoints return HTTP 503 unavailable. |
| **Founder Alert Outbox** | `operational_outbox` | `id`, `event_type`, `order_id`, `attempts`, `delivery_status`, `next_attempt_at`, `lease_expires_at`, `last_error`, `payload`, `created_at`, `sent_at` | **Internal Operations** (Admin only) | Asynchronous founder alert queue for verified payment claims. Statuses: `PENDING`, `PROCESSING`, `DELIVERED`, `FAILED`, `EXHAUSTED`, `SKIPPED_NO_CHANNELS`, `WAITING_CONFIG`. Code-native founder alerts are distinct from customer email delivery. When channels are unconfigured, events enter `SKIPPED_NO_CHANNELS` without blasting historical alerts. Alert payloads strictly contain zero customer PII (only order ID, profile ID, rank, amount, and timestamp). |
| **Outbox Channel Deliveries** | `outbox_channel_deliveries` | `id`, `outbox_id`, `channel`, `delivery_status`, `attempts`, `last_error`, `sent_at`, `created_at` | **Internal Operations** (Admin only) | Independent per-channel delivery tracking (`telegram`, `discord`). Success on one channel is durably preserved if another channel fails. |
| **Profile Owner Credential** | Browser `sessionStorage` & `localStorage.lazy_tokens` / Server `profiles.owner_token_hash` | Browser: raw token (`lazy_` + 64 hex characters). Server: SHA-256 hash | **Zero-Knowledge Credential** | Pending checkout credentials live in `sessionStorage`; completed claim tokens live in `localStorage.lazy_tokens` keyed by profile ID. The server only holds the SHA-256 hash. If customer clears browser data, the server cannot regenerate or recover the token. No automatic lost-token resets or email delivery exist. Manual support verification requires proof of payment. |
| **Operational Integrations** | None (No CRM / No Automated Tax Invoices) | N/A | **N/A** | There is NO automated CRM integration (e.g. n8n/Zapier) and NO automated tax invoice generator. Only digital payment fulfillment confirmation receipts are generated on request via `/api/payment/receipt/:orderId`. |

---

## 3. Transaction Reference & Bank UTR Truthfulness

Payment methods and gateway response formats vary across UPI, net banking, cards, and wallets.
- **Stored in PostgreSQL:** `payment_orders.cf_payment_id` and `payment_transactions.provider_payment_id` store Cashfree's unique reference.
- **Bank UTR:** A 12-digit Bank Unique Transaction Reference (UTR) or RRN is generated by the issuing bank for UPI/IMPS transactions. Cashfree displays this in the Cashfree Merchant Dashboard under **Payments > Transactions**. It is **not** guaranteed to exist for all payment methods (e.g. international cards or select wallets), and there is no dedicated UTR column in LazyProof's PostgreSQL schema.
- **Operational Rule:** When assisting customers with banking inquiries, look up the order using `order_id` or `cf_payment_id` in the Cashfree Dashboard to inspect bank-specific UTR/RRN details.

---

## 4. Fail-Closed Payment Mode & Tax Configuration

LazyProof implements strict fail-closed security for commercial transactions:

### `PAYMENT_MODE` Safety Invariants
1. `disabled`: Default safe state. Checkout is unavailable, and public `/api/payment/config` truthfully reflects disabled status.
2. `sandbox`: Test environment. The server **fails fast on startup** if `NODE_ENV=production` and `PAYMENT_MODE=sandbox` are combined.
3. `live`: Real monetary claims. Requires valid `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`. If keys are missing, the server automatically falls back to `disabled` mode.

### `MERCHANT_TAX_*` Review Behavior
- `MERCHANT_TAX_BASIS` and `MERCHANT_TAX_REVIEWED`: If unset, empty, or false, checkout safely fails closed with `"GST status being verified"`.
- Do not describe a fixed GST exemption or assume tax exemptions have been approved in code. Any tax status disclosure must be backed by contemporaneous offline documentation.

---

## 5. Parameterized Read-Only Reconciliation Queries

Run these parameterized, read-only SQL queries directly against the PostgreSQL database for reconciliation:

```sql
-- 1. Reconcile Settled Orders (Last 24 Hours in IST)
SELECT
  o.order_id,
  o.profile_id,
  o.name,
  o.amount,
  o.currency,
  o.status,
  o.cf_payment_id,
  o.created_at AT TIME ZONE 'Asia/Kolkata' AS created_at_ist
FROM payment_orders o
WHERE o.status = 'PAID'
  AND o.created_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
ORDER BY o.created_at DESC;

-- 2. Verify Rank Ledger Integrity Against Profile Verified Amounts
SELECT
  p.id AS profile_id,
  p.name,
  p.amount AS profile_amount,
  COALESCE(SUM(l.amount), 0) AS ledger_net
FROM profiles p
LEFT JOIN rank_ledger l ON p.id = l.profile_id AND l.status = 'SETTLED'
WHERE p.is_verified = true
GROUP BY p.id, p.name, p.amount
HAVING p.amount != COALESCE(SUM(l.amount), 0);
-- Expected result: 0 rows (ledger net must equal profile amount).

-- 3. Audit Refunds and Ledger Debits
SELECT
  r.order_id,
  r.merchant_refund_id,
  r.amount AS refund_amount,
  r.status AS refund_status,
  l.amount AS ledger_debit,
  r.created_at AT TIME ZONE 'Asia/Kolkata' AS refund_time_ist
FROM refund_reversals r
JOIN rank_ledger l ON r.order_id = l.order_id AND l.type IN ('DEBIT_REFUND', 'DEBIT_CHARGEBACK')
ORDER BY r.created_at DESC
LIMIT 50;

-- 4. Count Today's Settled Claims Using Exact IST Window
SELECT
  COUNT(DISTINCT l.order_id) AS settled_claims_today_ist,
  COALESCE(SUM(l.amount), 0) AS total_settled_inr_today_ist
FROM rank_ledger l
WHERE l.type = 'CREDIT'
  AND l.status = 'SETTLED'
  AND l.created_at >= ((NOW() AT TIME ZONE 'Asia/Kolkata')::date AT TIME ZONE 'Asia/Kolkata')
  AND l.created_at < (((NOW() AT TIME ZONE 'Asia/Kolkata')::date + 1) AT TIME ZONE 'Asia/Kolkata');
```

---

## 6. Solo-Founder Operational Workflows

### Daily Operational Triad
1. **PostgreSQL Database:** Verify order status, settled ledger totals, and contact inquiries.
2. **Cashfree Merchant Dashboard:** Reconcile payment batch settlements to the designated business bank account.
3. **Support Desk (`support@lazyproof.online`):** Address customer inquiries, duplicate debit claims, and moderation reports.

### Token Recovery Protocol
- The server stores only SHA-256 hashes (`owner_token_hash`).
- If a customer clears browser storage or loses their device:
  1. Verify customer identity via order ID and payment proof matching `payment_orders.customer_email` or `payment_orders.cf_payment_id`.
  2. Generate a fresh cryptographically random token following the strict format `lazy_` + 64 hexadecimal characters (`lazy_[0-9a-f]{64}`).
  3. Compute its SHA-256 hash and update `profiles.owner_token_hash`.
  4. Provide the new token securely to the verified customer.
  5. Never claim the previous token was recovered.

### Privacy & Data Protection Invariants
- **NEVER** expose customer email, phone, owner tokens, or hashes in public leaderboards, public API responses, or Telegram/Discord alert notifications. All founder alert outbox messages are strictly zero-PII.
- **NEVER** forward raw webhook JSON payloads to unauthenticated endpoints or third-party webhooks.
- Provide payment confirmation receipts upon request via `/api/payment/receipt/:orderId`. A payment confirmation receipt confirms commercial digital fulfillment; it is not a tax invoice under Section 31 of the CGST Act.
