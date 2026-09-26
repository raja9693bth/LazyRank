# LazyProof Operations & Customer Data Flow Guide

**Audience:** Solo Founder / Sole Proprietor (ADABHRA GROUP, Rajat Bhatt) & Support Engineers  
**System Baseline:** LazyProof (LazyRank) Production Stack — Node.js/Express, React/TypeScript, Neon PostgreSQL, Cashfree Payment Gateway  
**Date:** September 2026

---

## 1. System-of-Record Architecture & Data Mapping

LazyProof processes real Indian Rupee (INR) transactions via Cashfree and reflects verified placement on the public leaderboard. The system enforces strict separation of concerns across its persistence layers:

1. **Neon PostgreSQL:** The authoritative, system-of-record operational database for all orders, profiles, double-entry financial ledger entries, refunds, and support inquiries.
2. **Cashfree Merchant Dashboard:** The gateway settlement and banking rail record. Cashfree handles bank/UPI authorization, merchant payout cycles, and dispute lifecycles.
3. **Customer Browser Storage (`localStorage` / `sessionStorage`):** Client-side custody of raw cryptographic tokens (`lazy_owner_*`, `ord_acc_*`). The backend server **never** stores recoverable raw owner tokens—only one-way SHA-256 hashes (`owner_token_hash`).

---

## 2. Field-Level Customer & Payment Data Map

| Data Category | Table / Entity | Exact Schema Columns | Sensitivity & Access Control | Notes / Truthfulness Invariants |
| :--- | :--- | :--- | :--- | :--- |
| **Public Profile** | `profiles` | `id`, `name`, `amount`, `rank`, `is_verified`, `lazy_reason`, `instagram`, `linkedin`, `website`, `title`, `badge`, `roast`, `lazy_streak_days`, `votes_count`, `moderation_status`, `first_verified_at`, `created_at`, `updated_at` | **Public** (Exposed via `/api/leaderboard` and `/api/profile/:id`) | Displays public sponsorship amount and rank. `owner_token_hash` is strictly omitted from public DTOs. |
| **Customer Contact & Order Record** | `payment_orders` | `order_id`, `profile_id`, `name`, `email`, `phone`, `amount`, `currency`, `status`, `payment_mode`, `payment_ref`, `idempotency_key`, `terms_version`, `privacy_version`, `refund_policy_version`, `legal_consent_at`, `legal_consent_ip`, `created_at`, `updated_at` | **Confidential PII & Financial** (Admin/Support only) | Captures customer email and phone if provided during checkout. Records explicit legal consent timestamp and IP address. `status` transitions: `PENDING` → `PAID` → `REFUND_PENDING` → `PARTIALLY_REFUNDED` / `REFUNDED` / `FAILED`. |
| **Gateway Transaction Audits** | `payment_transactions` | `id`, `order_id`, `provider`, `provider_payment_id`, `amount`, `currency`, `payment_method`, `signature_verified`, `created_at` | **Internal Audit** (Admin/Support only) | Records each gateway transaction captured. `provider_payment_id` is Cashfree's reference ID (e.g. `cf_pay_*`). **Bank UTR is NOT stored here.** |
| **Double-Entry Financial Ledger** | `rank_ledger` | `id`, `profile_id`, `order_id`, `type`, `amount`, `currency`, `status`, `note`, `created_at` | **Authoritative Accounting** (Admin/Support only) | `type`: `CREDIT` (positive amount, sponsorship added) or `DEBIT_REFUND` / `DEBIT_CHARGEBACK` (negative amount, reversed upon refund). Ranks and Today leaderboard net values are derived strictly from settled ledger records. |
| **Refund State Machine** | `refund_reversals` | `id`, `order_id`, `merchant_refund_id`, `provider_refund_id`, `amount`, `currency`, `reason`, `status`, `created_at`, `updated_at` | **Internal Financial** (Admin/Support only) | Preflight reservations reserve refundable paise under `PENDING`. Upon gateway confirmation, status transitions to `SUCCESS` and atomically triggers `rank_ledger` debit and rank recalculation. |
| **Webhook Audit Inbox** | `payment_webhook_events` | `id`, `event_id`, `event_type`, `order_id`, `provider_payment_id`, `payload`, `processed_at` | **Internal Security Audit** (Admin only) | Raw JSON payload of HMAC-verified Cashfree webhooks. Idempotency enforced on `event_id`. Never forward raw payloads to external services. |
| **Customer Inquiries** | `contact_inquiries` | `id`, `name`, `email`, `subject`, `order_id`, `message`, `client_ip`, `status`, `created_at` | **Customer Support** | Stores support messages submitted via `/contact`. |
| **Content Abuse Reports** | `reports` | `id`, `profile_id`, `reason`, `details`, `client_ip`, `created_at` | **Moderation** | Submitted via profile flag dialogs for founder review. |
| **Notification Requests** | `notification_preferences` | `id`, `email`, `created_at` | **Marketing / Updates** | User opt-ins for ranking alerts. |
| **Profile Owner Authentication** | Client Browser `localStorage` (`lazy_owner_{profileId}`) / `profiles.owner_token_hash` | Client: raw 64-char hex token. Server: `owner_token_hash` (`TEXT NOT NULL`) | **Zero-Knowledge Credential** | **Server does NOT have the raw token.** If customer clears browser data, support cannot regenerate the raw token from an order ID alone. Manual support verification requires email/payment proof before an admin can reassign a new owner token hash. |

---

## 3. The Bank UTR (Unique Transaction Reference) Invariant

> **EXPLICIT AUDIT CONFIRMATION:**  
> The LazyProof PostgreSQL database schema **does not contain a dedicated column for bank UTRs**.
>
> - **What is stored:** `payment_orders.payment_ref` and `payment_transactions.provider_payment_id` store Cashfree's internal payment reference (e.g., `cf_pay_123456789`).
> - **Where bank UTRs live:** In UPI and Net Banking payments, the originating bank assigns a 12-digit UTR. Cashfree records this in its internal settlement ledger and exposes it in the Cashfree Merchant Dashboard under **Payments > Transaction Details**.
> - **Operational Guidance:** When resolving customer disputes or bank claims, the solo founder must look up the Cashfree `payment_id` in the Cashfree Merchant Dashboard to retrieve the corresponding bank UTR. Do not promise automated UTR export from LazyProof's API.

---

## 4. Solo-Founder Daily Operational Workflow

As a solo operator, your primary objective is operational simplicity, zero data leakage, and rigorous financial reconciliation.

```
+------------------------------------------------------------------------------------+
|                                DAILY OPERATING TRIAD                               |
|                                                                                    |
|  [Neon PostgreSQL]          [Cashfree Dashboard]          [Support Inbox]          |
|  Authoritative state,        Settlement reports,           support@lazyproof.online|
|  orders, ledger, profiles    UTR lookup, bank payouts      Customer assistance     |
+------------------------------------------------------------------------------------+
```

### Step 1: Morning & Evening Reconciliation (Neon vs. Cashfree)
1. **Log in to Neon Console** and run the settlement reconciliation query:
   ```sql
   -- Orders marked PAID in last 24 hours
   SELECT order_id, profile_id, name, amount, payment_ref, updated_at
   FROM payment_orders
   WHERE status = 'PAID' AND updated_at >= NOW() - INTERVAL '24 hours'
   ORDER BY updated_at DESC;
   ```
2. **Log in to Cashfree Merchant Dashboard (Live Mode):**
   - Navigate to **Payment Gateway > Orders**.
   - Compare total settled volume with Neon's `payment_orders` total.
   - Verify that all `PAID` orders have matching `SUCCESS` status in Cashfree.
   - Check **Settlements** to verify payout batches transferring to your designated business bank account.

### Step 2: Processing Customer Support & Token Recovery
1. **Lost Owner Token Requests:**
   - If a customer contacts `support@lazyproof.online` stating they lost access to edit their profile (e.g. switched phones or cleared browser cache):
   - **Verification:** Require proof of payment matching `payment_orders.email` or `payment_orders.payment_ref`.
   - **Resolution:** An admin script generates a new cryptographically random token (`lazy_owner_<hex>`), calculates its SHA-256 hash, updates `profiles.owner_token_hash`, and securely emails the one-time link or raw token to the verified email address.
   - **Never** claim the token was "recovered" from the database; it was reset.

### Step 3: Handling Refunds & Chargebacks
1. **Refund Initiation:**
   - Always initiate refunds through the authoritative admin endpoint or Cashfree dashboard.
   - When a refund succeeds in Cashfree, the webhook triggers `reverseRefundAtomic`, which:
     1. Transitions `refund_reversals` to `SUCCESS`.
     2. Updates `payment_orders.status` to `PARTIALLY_REFUNDED` or `REFUNDED`.
     3. Inserts a `DEBIT_REFUND` into `rank_ledger`.
     4. Recalculates the profile's verified `amount` and ranks atomically.
2. **Manual Reconciliation Check:**
   ```sql
   -- Check that rank_ledger net matches profile amount
   SELECT p.id, p.name, p.amount as profile_amount,
          COALESCE(SUM(l.amount), 0) as ledger_net
   FROM profiles p
   LEFT JOIN rank_ledger l ON p.id = l.profile_id AND l.status = 'SETTLED'
   GROUP BY p.id, p.name, p.amount
   HAVING p.amount != COALESCE(SUM(l.amount), 0);
   -- Should ALWAYS return 0 rows.
   ```

---

## 5. Security, Receipts vs. Invoices, & Third-Party Integrations

### Payment Receipt vs. GST Tax Invoice
- **Current Tax Status:** `taxReady = false` (Adabhra Group / Rajat Bhatt operates within GST exemption thresholds for unregistered service providers).
- **Customer Deliverable:** LazyProof provides a **Payment Confirmation Receipt** via `/api/payment/receipt/:orderId`.
- **Truthful Invariant:** The receipt explicitly states:
  > *"Adabhra Group operates under statutory registration and threshold limits. This document serves as a digital transaction receipt and payment confirmation, not a Tax Invoice under Section 31 of the CGST Act."*
- **Constraint:** Never promise or generate a GST invoice with fake GSTIN or CGST/SGST breakdowns.

### Future Integrations (Outbox Pattern & Safe CRM Sync)
If automating receipts, support alerts, or CRM tracking (e.g. via Resend, Google Sheets, or n8n):

1. **Transactional Email (Receipts/Alerts):**
   - **Rule:** Never trigger emails from an unverified inbound webhook or pending order.
   - **Pattern:** Use a transactional outbox table (e.g. `operational_outbox`) written inside the same PostgreSQL transaction as `settlePaymentAtomic`. A separate worker polls the outbox and invokes Resend/Postmark with exponential backoff and deduplication based on `order_id`.

2. **Spreadsheet / CRM Projections:**
   - **Approved Fields ONLY:** `order_id`, `profile_name`, `amount_inr`, `status`, `created_at_ist`.
   - **PROHIBITED EXPOSURES:**
     - ❌ **NEVER** export raw owner tokens (they do not exist on server).
     - ❌ **NEVER** export owner token hashes or order access tokens.
     - ❌ **NEVER** send full raw webhook JSON payloads to public Google Sheets, Airtable, Telegram bots, or Zapier webhooks.
     - ❌ **NEVER** expose customer phone numbers unless strictly necessary for SMS transactional receipts with customer consent.
   - **Access Control:** Restrict spreadsheet access to the founder's Google Workspace account with 2-Factor Authentication enabled.
