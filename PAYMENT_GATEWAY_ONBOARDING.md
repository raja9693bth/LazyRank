# Payment Gateway Onboarding Dossier & Compliance Pack
**Document Version:** 1.0 (Commercial Production)  
**Operating Entity:** Adabhra Group  
**Product / Platform:** LazyProof / LAZY  
**Official Domain:** [https://lazyproof.online](https://lazyproof.online)  

---

## 1. Operating Business & Entity Identification

| Field | Detail |
|---|---|
| **Legal Business Name** | **Adabhra Group** |
| **Organisation Structure** | **Sole Proprietorship / Proprietary Enterprise** (Registered in India) |
| **Product / Brand Name** | **LazyProof / LAZY** |
| **Official Website URL** | [https://lazyproof.online](https://lazyproof.online) |
| **Public Business Address** | Bettiah, West Champaran, Bihar, India - 845438 |
| **Customer Support Email** | [support@lazyproof.online](mailto:support@lazyproof.online) |
| **Support Hotline Phone** | +91 96938 41189 |
| **Operational Support Hours** | Monday to Saturday, 10:00 AM – 6:00 PM IST |
| **Industry / Merchant Category** | **Advertising / Digital Services / Web Portal / Online Media** |

> **IMPORTANT LEGAL DECLARATION:**  
> Adabhra Group is a sole proprietorship registered in India. It is NOT a Private Limited company, LLP, corporation, holding company, or incorporated entity. No sensitive KYC documents (PAN, Aadhaar, bank credentials) are exposed publicly.

---

## 2. Truthful Product Description & Business Model

**Commercial Description:**  
LazyProof is a digital sponsored-profile showcase and public leaderboard. Users purchase digital profile visibility and prominence. Leaderboard position is determined deterministically by cumulative verified sponsorship amount. In return for consideration, users receive:
1. Public digital showcase placement on the real-time leaderboard.
2. Verified profile badge.
3. Downloadable 9:16 high-resolution social story cards.
4. Optional public external social profile links (Instagram, LinkedIn, personal website) to drive visibility.

### Transparent Core Ranking Mechanic:
- Position #1 on the leaderboard is held by the participant with the highest cumulative verified sponsorship amount.
- Tie-breaking rule: In the event of identical verified amounts, earlier verification timestamp wins.
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
| **Contact & Customer Support**| [https://lazyproof.online/contact](https://lazyproof.online/contact) | Verified business address, monitored email, phone, support hours, issue categories, and interactive support inquiry form. |
| **Platform Rules & About** | [https://lazyproof.online/about](https://lazyproof.online/about) & [/rules](https://lazyproof.online/rules) | Platform mechanics, ranking algorithm, tie-breaking rules, and non-gambling declarations. |

---

## 4. Technical Payment Architecture & Integration Flow

### Primary Payment Gateway Partner:
**Cashfree Payments India Pvt Ltd** (API Version `2023-08-01`)

### Checkout & Settlement Lifecycle:
```
1. Client Configuration:
   User chooses display name & sponsorship amount (₹1 – ₹10,00,000 INR)
   + Reviews itemized breakdown (Service description, amount, tax consideration)
   + Checks mandatory Terms & Refund Policy agreement checkbox

2. Order Creation:
   Frontend POST /api/payment/create-order
   → Server validates display name (1-30 chars, profanity filter), amount (whole integer)
   → Server creates internal pending order in PostgreSQL / local database
   → Server invokes Cashfree PG API (POST https://api.cashfree.com/pg/orders)
   → Cashfree returns payment_session_id & checkoutUrl

3. Hosted Checkout:
   Frontend opens Cashfree Checkout Session
   → User completes payment via UPI, NetBanking, Debit/Credit Card
   → Browser returns to https://lazyproof.online/?order_id={orderId}&status=return

4. Authoritative Verification & Settlement:
   Cashfree dispatches official webhook to POST /api/payment/webhook
   → Server extracts raw body buffer and headers:
     - x-webhook-signature
     - x-webhook-timestamp
   → Server validates HMAC-SHA256 signature: Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
   → Server verifies timestamp freshness (within 10-minute window) to prevent replay attacks
   → Server matches order_id, verifies payment_amount === order.amount and currency === 'INR'
   → Database executes atomic transaction:
     - Inserts payment_transactions record
     - Updates payment_orders status to 'completed'
     - Updates profile amount and recalculates ranks
   → Frontend polls GET /api/payment/status/:orderId
   → Frontend receives completed status, displays Digital Receipt and updates public leaderboard
```

---

## 5. Webhook Security & Idempotency Guarantees

1. **Cryptographic Validation:** Webhook authenticity is verified strictly using Cashfree's official HMAC-SHA256 signature protocol. Unsigned or mismatched webhooks are rejected with HTTP 401.
2. **Replay Protection:** Webhooks with timestamps older than 10 minutes are rejected.
3. **Idempotency:** When duplicate webhooks or retries arrive for an already completed order ID, the server acknowledges with HTTP 200 without creating duplicate financial ledger entries, duplicate profile records, or duplicate analytics revenue.
4. **Out-of-Order Handling:** Status queries via `/api/payment/status/:orderId` ensure eventual consistency if frontend returns before webhook arrival.
5. **No Client Trust:** The frontend client NEVER decides payment success. Only authoritative provider settlement updates rank.

---

## 6. Refund, Reversal & Rank Debit Policy

- **Initiation:** Customer submits refund inquiry via [support@lazyproof.online](mailto:support@lazyproof.online) or [https://lazyproof.online/contact](https://lazyproof.online/contact).
- **Processing Time:** Validated refunds are processed internally within 5–7 business days and credited back through the original payment method by the banking gateway.
- **Rank Debit Enforcement:** A refunded or reversed payment immediately ceases to count as verified sponsorship. The platform's `reverseRefund` engine deducts the refunded amount from the profile's verified cumulative total and recalculates the leaderboard positions atomically.

---

## 7. Merchant Category Code (MCC) Recommendation

When completing payment gateway application forms, the following truthful categories should be selected:
- **MCC 7399 / 7311:** Advertising Services / Digital Media / Internet Web Services
- **MCC 5818 / 5734:** Digital Goods / Electronic Services
- **Strictly Avoid:** Betting, Gambling, Lotteries, Gaming of Skill/Chance, Financial Investments, or Crowdfunding.

---

## 8. Current Gateway Review Status

| Checkpoint | Status | Notes |
|---|---|---|
| **Domain & DNS** | **Active & Configured** | `https://lazyproof.online` serving application |
| **HTTPS SSL/TLS** | **Active** | Valid certificate |
| **All Compliance Pages** | **Live & Linked** | Terms, Privacy, Refund, Delivery, Contact, Rules, About |
| **Operator Details** | **Consistent** | Adabhra Group (Sole Proprietorship) across all pages |
| **Pricing Transparency** | **Active** | Clear breakdown and terms checkbox before payment |
| **Simulated Payment UI** | **Eradicated** | Zero fake QR, zero manual UTR submission |
| **Review Mode** | **Active** | Truthful onboarding notice displayed while review is pending |
| **Cashfree PG Integration** | **Engineered** | API v2023-08-01 client, HMAC verification, status polling |
| **Merchant Approval** | **Pending Review** | Awaiting Cashfree merchant underwriting approval |
| **Live Payments** | **Safely Disabled** | `PAYMENT_MODE=disabled` until live credentials are provisioned |
