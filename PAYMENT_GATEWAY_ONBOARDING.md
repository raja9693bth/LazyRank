# Payment Gateway Onboarding Dossier & Compliance Pack
**Document Version:** 1.0 (Commercial Production)  
**Operating Entity:** Adabhra Group  
**Product / Platform:** LazyProof / LAZY  
**Official Domain:** [https://lazyproof.online](https://lazyproof.online)  

---

## 1. Operating Business & Entity Identification

| Field | Detail |
|---|---|
| **Legal Business Name** | **ADABHRA GROUP** |
| **Organisation Structure** | **Sole Proprietorship / Proprietary Enterprise** (Registered in India) |
| **Proprietor Name** | **Raja Babu** |
| **Product / Brand Name** | **LazyProof / LAZY** |
| **Official Website URL** | [https://lazyproof.online](https://lazyproof.online) |
| **Public Business Address** | Ward No. 13, Mahodipur, Majhaulia, West Champaran, Bihar - 845454, India |
| **Customer Support Email** | [support@lazyproof.online](mailto:support@lazyproof.online) |
| **Support Phone** | +91 95211 90205 ([tel:+919521190205](tel:+919521190205)) |
| **Operational Support Hours** | Monday to Saturday, 10:00 AM – 6:00 PM IST |
| **Industry / Merchant Category** | **Advertising / Digital Visibility / Web Portal** |

> **IMPORTANT LEGAL DECLARATION:**  
> ADABHRA GROUP is a sole proprietorship registered in India (Proprietor: Raja Babu). It is NOT a Private Limited company, LLP, corporation, holding company, or incorporated entity. No sensitive KYC documents (PAN, Aadhaar, bank credentials) are exposed publicly.

---

## 2. Truthful Product Description & Business Model

**Commercial Description:**  
LazyProof is a digital sponsored-profile showcase and public leaderboard.
Users purchase digital profile visibility.
Leaderboard position is determined deterministically by cumulative verified sponsorship amount.
There are no random outcomes, prizes, winnings, cash payouts, or financial returns.

In return for consideration, users receive:
1. Public digital showcase placement on the real-time leaderboard.
2. Verified profile badge and placement details.
3. Downloadable 9:16 high-resolution social story cards.
4. Optional public external social profile links (Instagram, LinkedIn, personal website) to drive visibility.

### Transparent Core Ranking Mechanic:
- Position #1 on the leaderboard is held by the participant with the highest cumulative verified sponsorship amount.
- Tie-breaking rule: In the event of identical verified amounts, earlier verification timestamp wins; followed by deterministic internal identifier.
- Rank displacement dynamic: Any participant can sponsor a higher amount and obtain a higher position. Sponsorship guarantees digital profile placement, not permanent rank tenure.

### Explicit Negative Disclaimers (Non-Gambling / Non-Prize Service):
- **No Betting Outcome:** No betting, wagering, or stake mechanics exist.
- **No Random / Chance-Based Outcome:** No lottery, raffle, sweepstakes, or randomized algorithms.
- **No Prize Money or Winnings:** No monetary winnings, jackpots, or prizes are distributed to any participant.
- **No Financial Returns:** Payments are consideration for digital visibility, not an investment, security, or redeemable asset.
- **No Cash Payouts:** No funds can be withdrawn, redeemed, or cashed out.

---

## 3. Public Mandatory Compliance Page URLs

All compliance pages are complete, live, mobile-responsive, and prominently linked in the website header and footer:

| Compliance Document | Live Canonical URL | Description |
|---|---|---|
| **Terms & Conditions** | [https://lazyproof.online/terms](https://lazyproof.online/terms) | Comprehensive governing contract, operator identity, ranking mechanics, displacement disclosure, content rules, and governing jurisdiction (West Champaran, Bihar). |
| **Privacy Policy** | [https://lazyproof.online/privacy](https://lazyproof.online/privacy) | Itemized data collection, zero storage of cards/UPI PINs, third-party payment processing, AI processing disclosure, and grievance contact. |
| **Refund & Cancellation** | [https://lazyproof.online/refund-cancellation](https://lazyproof.online/refund-cancellation) | Six distinct payment scenarios, 5–7 business days internal processing timeline, original payment method return, and rank reversal policy. |
| **Digital Delivery Policy** | [https://lazyproof.online/delivery](https://lazyproof.online/delivery) | Digital fulfillment lifecycle (5–30 seconds target), pending webhook state handling, access URL provision, zero physical shipping. |
| **Contact & Customer Support**| [https://lazyproof.online/contact](https://lazyproof.online/contact) | Verified business address, customer support email, phone, support hours, issue categories, and interactive support inquiry form. |
| **Platform Rules & About** | [https://lazyproof.online/about](https://lazyproof.online/about) & [/rules](https://lazyproof.online/rules) | Platform mechanics, ranking algorithm, tie-breaking rules, and non-gambling declarations. |

---

## 4. Technical Payment Architecture & Integration Flow

### Primary Payment Gateway Partner:
**Cashfree Payments India Pvt Ltd** (API Version `2026-01-01` / current supported Hosted Checkout)

### Checkout & Settlement Lifecycle:
```
1. Client Configuration:
   User chooses display name & sponsorship amount (₹1 – ₹10,00,000 INR)
   + Provides required 10-digit mobile number & optional email
   + Manually checks affirmative Terms, Privacy & Refund Policy checkbox (defaults unchecked)

2. Order Creation:
   Frontend POST /api/payment/create-order
   → Client generates stable idempotencyKey reused across retries
   → Server validates display name (1-30 chars, profanity filter), amount (whole integer), mobile number
   → Server checks idempotency key in PostgreSQL; if existing, returns existing session immediately
   → Server creates internal pending order in PostgreSQL (authoritative)
   → Server invokes Cashfree PG API (POST https://api.cashfree.com/pg/orders) with payment_session_id
   → Cashfree returns payment_session_id

3. Hosted Checkout:
   Frontend opens Cashfree Checkout Session using official Cashfree JS SDK
   → User completes payment via UPI, NetBanking, Debit/Credit Card
   → Browser returns to https://lazyproof.online/?order_id={orderId}&status=return

4. Authoritative Verification & Settlement:
   Cashfree dispatches official webhook to POST /api/payment/webhook
   → Server extracts raw body buffer and headers:
     - x-webhook-signature
     - x-webhook-timestamp
   → Server validates HMAC-SHA256 signature using CASHFREE_SECRET_KEY
   → Server matches order_id, verifies payment_amount === order.amount and currency === 'INR'
   → Database executes atomic transaction in PostgreSQL:
     - Inserts payment_transactions record
     - Updates payment_orders status to 'PAID'
     - Updates profile amount and recalculates ranks
   → Frontend polls GET /api/payment/status/:orderId
   → Frontend receives PAID status, displays Digital Receipt and updates public leaderboard
```

---

## 5. Webhook Security & Idempotency Guarantees

1. **Cryptographic Validation:** Webhook authenticity is verified strictly using Cashfree's official HMAC-SHA256 signature protocol and `CASHFREE_SECRET_KEY`. Unsigned or mismatched webhooks are rejected with HTTP 401.
2. **Replay & Idempotency Protection:** Webhooks require cryptographic HMAC-SHA256 signature verification, unique `cf_payment_id` registration in `payment_transactions`, and terminal-state idempotency so legitimate retries never create duplicate ledger settlements or duplicate rank boosts.
3. **Dedicated Refund Webhook Handling:** Cashfree refund notifications parse `data.refund` fields (`cf_refund_id`, `refund_amount`, `refund_status`). Only authoritatively confirmed `SUCCESS` refunds commit ledger debits.
4. **Out-of-Order Handling:** Status queries via `/api/payment/status/:orderId` ensure eventual consistency if frontend returns before webhook arrival.
5. **No Client Trust:** The frontend client NEVER decides payment success. Only authoritative provider settlement updates rank.

---

## 6. Refund, Reversal & Rank Debit Policy

- **Initiation:** Customer submits refund inquiry via [support@lazyproof.online](mailto:support@lazyproof.online) or [https://lazyproof.online/contact](https://lazyproof.online/contact).
- **Processing Time:** Validated refunds are processed internally within 5–7 business days (estimate) and credited back through the original payment method by the banking gateway.
- **Rank Debit Enforcement:** A refunded or reversed payment immediately ceases to count as verified sponsorship. The platform's `reverseRefund` engine deducts the confirmed refunded amount from the profile's verified cumulative total and recalculates the leaderboard positions atomically in PostgreSQL. Partial refunds only deduct confirmed partial amounts, and total refunds never exceed the original captured payment.

---

## 7. Merchant Business Category Guidance

When completing payment gateway onboarding forms, select the category that best matches your business as presented by Cashfree's application:
- **Recommended Category:** **Advertising Services / Digital Media / Internet Web Services / Digital Content Placement**
- **Do NOT manually claim an unsupported MCC:** Only select the specific category/MCC presented or confirmed by Cashfree's onboarding team.
- **Strictly Prohibited Categories:** Never select or misrepresent as Betting, Gambling, Lotteries, Gaming of Skill/Chance, Financial Investments, or Crowdfunding. LazyProof is strictly a digital profile placement and deterministic leaderboard showcase.

---

## 8. Current Gateway Review Status

| Checkpoint | Status | Notes |
|---|---|---|
| **Public Deployment & Domain** | **UNVERIFIED — PUBLIC DEPLOYMENT CHECK REQUIRED** | Domain currently parked on Hostinger DNS; web server DNS pointing required before final public audit |
| **HTTPS SSL/TLS** | **UNVERIFIED — PUBLIC DEPLOYMENT CHECK REQUIRED** | Requires live production host certificate validation |
| **All Compliance Pages** | **Source Complete & Ready** | Terms, Privacy, Refund, Delivery, Contact, Rules, About implemented in repository |
| **Operator Details** | **Consistent** | Adabhra Group (Sole Proprietorship) across all pages and schemas |
| **Pricing Transparency** | **Active** | Clear breakdown and affirmative terms & privacy checkbox before checkout |
| **Cashfree PG Integration** | **Engineered** | API v2026-01-01 client, HMAC verification, retry-safe idempotency, refund state machine |
| **Cashfree Sandbox E2E** | **UNVERIFIED — CASHFREE TEST CREDENTIALS REQUIRED** | Requires developer test credentials to perform end-to-end sandbox transaction |
| **Merchant Approval** | **Pending Review** | Ready for submission to Cashfree merchant onboarding review |
| **Live Payments** | **Safely Disabled** | `PAYMENT_MODE=disabled` until live credentials and merchant approval are granted |

---

## 9. Razorpay Status & Business Model Policy

- **Current Architecture:** Cashfree Payments India Pvt Ltd is the sole active payment provider.
- **No Active Razorpay Integration:** Razorpay settlement handling has been removed/disabled to prevent unverified payment routes.
- **Compliance Policy:** Razorpay terms list "Bidding/Auction houses" under restricted categories. While LazyProof operates a deterministic cumulative sponsorship ranking and not an auction, Razorpay requires explicit business-model pre-clearance before any future integration or application reliance.
- **Current Target:** Cashfree is the designated primary payment gateway partner.
