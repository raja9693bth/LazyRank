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
| **Pricing Policy** | [https://lazyproof.online/pricing](https://lazyproof.online/pricing) | Authoritative pricing rules (₹1 base minimum, dynamic #1 spot calculation), live position displacement, final INR quotes, and checkout status. |
| **Contact & Customer Support**| [https://lazyproof.online/contact](https://lazyproof.online/contact) | Verified business address, customer support email, phone, support hours, issue categories, and interactive support inquiry form. |
| **Platform Rules & About** | [https://lazyproof.online/about](https://lazyproof.online/about) & [/rules](https://lazyproof.online/rules) | Platform mechanics, ranking algorithm, tie-breaking rules, and non-gambling declarations. |

---

## 4. Technical Payment Architecture & Integration Flow

### Primary Intended / Integrated Payment Provider:
**Cashfree Payments India Pvt Ltd — Merchant Review Pending** (API Version `2026-01-01` / current supported Hosted Checkout)

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

### Dispute & Chargeback Reconciliation SOP:
Because Cashfree's current core Payment Gateway APIs provide settlement telemetry but require merchant dashboard handling for formal bank chargeback representations, the following founder review SOP is enforced:
1. **Dispute Notification:** Inquiries or chargeback notices received via Cashfree merchant dashboard or banking channels trigger documented founder review against fulfillment telemetry (`payment_orders`, `payment_transactions`, server fulfillment logs).
2. **No Unverified Debits:** Unverified client claims, emails, or unauthenticated webhooks NEVER trigger automated ledger adjustments or profile debits.
3. **Confirmed Settlement Adjustment:** Only upon official, final bank dispute settlement upheld by Cashfree (with official dispute reference ID and proof of debit in merchant settlement records) does an administrator execute the narrow, authenticated adjustment path (`POST /api/payment/chargeback` requiring `x-admin-key`).
4. **Idempotency & Audit Isolation:** Each chargeback adjustment records a `DEBIT_CHARGEBACK` in `rank_ledger` tied uniquely to `disputeId`, ensuring no duplicate debit, keeping dispute IDs strictly isolated from merchant refund IDs, and deterministically updating profile amount and active ranks.

---

## 7. Merchant Business Category Guidance

When completing payment gateway onboarding forms, select the category that best matches your business as presented by Cashfree's application:
- **Recommended Category:** **Advertising Services / Digital Media / Internet Web Services / Digital Content Placement**
- **Do NOT manually claim an unsupported MCC:** Only select the specific category/MCC presented or confirmed by Cashfree's onboarding team.
- **Strictly Prohibited Categories:** Never select or misrepresent as Betting, Gambling, Lotteries, Gaming of Skill/Chance, Financial Investments, or Crowdfunding. LazyProof is strictly a digital profile placement and deterministic leaderboard showcase.

---

## 8. Current Gateway Review Status Matrix (Dated: 27 September 2026)

| Gateway / Area | Technical Integration Status | Underwriting / Account Review Status | Operational Requirement / Next Action |
|---|---|---|---|
| **Cashfree Payments** | **ACTIVE IN CODE** (API v2026-01-01, HMAC-SHA256, atomic refund state machine, idempotent ledger) | **STATUS UNPROVEN FROM PROFILE SCREENSHOT**; merchant legal-name needs checking; earlier application under XAIVON requires resolution | Founder must verify legal entity in Cashfree dashboard; contact Cashfree merchant support to update legal name to ADABHRA GROUP or follow re-onboarding advice. Verify customer-support email is set to `support@lazyproof.online`. |
| **Razorpay** | **NOT IMPLEMENTED IN CODE** (Provider code removed/disabled to prevent unverified execution) | **WEBSITE URL APPROVED; APPLICATION UNDER REVIEW** (Per supplied merchant dashboard screenshot) | Prospective gateway only. Cannot process transactions without code integration. Underwriting decision remains external. |
| **PhonePe** | **NOT IMPLEMENTED IN CODE** | **PROSPECTIVE ONLY** | No merchant contract or API integration exists. |
| **Live Checkout** | **SAFELY DISABLED** (`PAYMENT_MODE=disabled`) | **LOCKED PENDING FOUNDER VERIFICATION** | Will remain disabled until: 1) Cashfree merchant approval granted; 2) Live API credentials issued; 3) Accounting/tax sign-off; 4) Sandbox E2E tests verified. |
| **Public Support Mailbox** | **CONFIGURED AS `support@lazyproof.online`** | **PENDING FOUNDER SEND/RECEIVE TEST** | Must verify inbound/outbound delivery using the founder verification protocol below. |

### Technical Verification Checkpoints:

| Checkpoint | Status | Notes |
|---|---|---|
| **Public Deployment & Domain** | **VERIFIED LIVE (September 2026)** | `https://lazyproof.online` is active, serving production web assets and valid canonical links |
| **HTTPS SSL/TLS** | **VERIFIED ACTIVE (September 2026)** | Valid TLS certificate active on `https://lazyproof.online` with HSTS enforcement |
| **All Compliance Pages** | **Source Complete & Ready** | Terms, Privacy, Refund, Delivery, Contact, Rules, About implemented in repository |
| **Operator Details** | **Consistent** | Adabhra Group (Sole Proprietorship, Proprietor: Raja Babu) across all pages and schemas |
| **Pricing Transparency** | **Active** | Clear breakdown and affirmative terms & privacy checkbox before checkout |
| **Cashfree PG Integration** | **Engineered** | API v2026-01-01 client, HMAC verification, retry-safe idempotency, refund state machine |
| **Cashfree Sandbox E2E** | **UNVERIFIED — CASHFREE TEST CREDENTIALS REQUIRED** | Requires developer test credentials to perform end-to-end sandbox transaction |
| **Merchant Approval** | **Pending Review** | Ready for submission to Cashfree merchant onboarding review |
| **Live Payments** | **Safely Disabled** | `PAYMENT_MODE=disabled` until live credentials and merchant approval are granted |

---

## 9. Sole Proprietorship Legal Structure & XAIVON Resolution SOP

### Legal Entity Clarification:
- **ADABHRA GROUP** is a **Sole Proprietorship** registered in Bihar, India (Proprietor: Raja Babu).
- It is **NOT** a separate incorporated company, Private Limited entity, LLP, or holding conglomerate.
- In Indian commercial law, a sole proprietorship is legally coterminous with its proprietor for tax and banking purposes.

### Cashfree Merchant Profile & XAIVON Resolution:
- If an earlier merchant account or onboarding draft with Cashfree was submitted under the trade name **XAIVON**, changing text in the website repository or frontend **CANNOT** alter the legal entity records in Cashfree's core banking systems.
- **Action Required by Founder:**
  1. Log into the Cashfree Merchant Dashboard (`https://merchant.cashfree.com/`).
  2. Inspect the **Account Settings > Business Profile > Legal Entity Name**.
  3. If the profile states **XAIVON**, open a formal support ticket with Cashfree Merchant Support:
     > *"We need to update our Merchant Legal Name to ADABHRA GROUP (Sole Proprietorship, Proprietor: Raja Babu) to match our Udyam Registration Certificate and official domain https://lazyproof.online. Please advise whether an official trade name amendment is supported or if a fresh onboarding profile for ADABHRA GROUP should be created."*
  4. Obtain written confirmation from Cashfree merchant onboarding before submitting final bank verification.

---

## 10. Customer Support Mailbox Verification Protocol

### Current Published Email:
`support@lazyproof.online` is the sole authoritative support address published across:
- Website header and footer
- Terms of Service (`/terms`)
- Privacy Policy (`/privacy`)
- Refund & Cancellation Policy (`/refund-cancellation`)
- Digital Delivery Policy (`/delivery`)
- Pricing Policy (`/pricing`)
- Contact page (`/contact`) and Schema.org structured data

### Primary Support vs. Business Registration Correspondence Email:
- **Primary Customer Support:** `support@lazyproof.online` is the primary public customer support channel published across the website header, footer, checkout dialogues, and customer receipts.
- **Business Registration Correspondence:** As intentionally approved by the founder, `raja969384bth@gmail.com` (`BUSINESS_REGISTRATION_EMAIL`) is published exclusively on the `/contact` page under Enterprise Identification for formal business-registration, tax, and KYC correspondence matching official Udyam filings. It is intentionally kept isolated to the Contact/business-identity card and is NOT added to website footers, client receipt emails, or marketing flows.
- **Data Protection Invariant:** Passwords, OTPs, PAN, Aadhaar, private bank accounts, or sensitive KYC documentation must NEVER be published publicly or committed to Git.

### Mandatory Send-and-Receive Test for Founder:
1. **Send Test:** From an external personal email address (e.g. your personal Gmail), compose a message to `support@lazyproof.online` with Subject: `[TEST] Verification of inbound support desk`.
2. **Receive Check:** Verify that the message arrives in your domain webmail or designated forwarding mailbox.
3. **Reply Test:** Send a reply back from `support@lazyproof.online` to the external email to confirm outbound SPF/DKIM delivery.
4. **Resolution:**
   - If both tests succeed: Retain `support@lazyproof.online` across all touchpoints and enter this exact address into the Cashfree Merchant Dashboard customer support settings.
   - If delivery fails (e.g. bounce or unconfigured MX): Treat gateway support verification as **BLOCKED** until DNS MX records are correctly configured by the domain registrar. Do not invent an unverified alternate address.

---

## 11. Udyam Business Activity Classification Review

The founder's Udyam Registration Certificate lists specific National Industry Classification (NIC) codes:
- **Founder Verification Action:** Truthfully review all registered activities against the actual service provided by LazyProof (digital sponsored profile visibility, public leaderboard showcase, and humor cards).
- **Computer Games Publishing Note:** If the Udyam certificate contains activity entries such as *"Publishing of computer games"* (NIC 58201 / 5820) or computer software publishing, the founder must review whether this truthfully reflects past software development or whether an activity update on the official Udyam portal (`udyamregistration.gov.in`) is appropriate to explicitly add internet advertising/portal publishing.
- **No False MCC Selection:** Under no circumstances should the business model be misclassified or camouflaged under an unrelated Merchant Category Code (MCC) to bypass underwriting. The service is strictly a digital sponsored showcase.

---

## 12. Private Founder Checklist: Second Business Proof Preparation

Payment gateway underwriting for sole proprietorships often requests **two distinct business proofs** bearing the proprietor's name and business trade name.

To prevent underwriting delays if requested by Cashfree or Razorpay, the founder should privately gather the following (do **NOT** commit these documents to Git or upload them publicly):

- [ ] **Primary Proof:** Udyam Registration Certificate (ADABHRA GROUP, West Champaran, Bihar).
- [ ] **Secondary Business Proof Options** (prepare at least one genuine document):
  - [ ] **Option A: Current Bank Account Statement / Welcome Letter** in the name of *ADABHRA GROUP* (showing account number, IFSC, address, and recent transactions).
  - [ ] **Option B: GST Registration Certificate (Form GST REG-06)**, if registered for GST.
  - [ ] **Option C: Shop & Commercial Establishment Certificate** issued by the Bihar State Municipal/Labor Authority.
  - [ ] **Option D: Trade License / Municipal Permit** issued by local panchayat/municipal body for Adabhra Group.
  - [ ] **Option E: Utility Bill** (Electricity, broadband/landline bill) at the business premises in the name of the proprietor or firm, dated within the last 60 days.
- [ ] **Proprietor Identity Proof:** PAN card of Proprietor (Raja Babu) and Aadhaar card (masked).
- [ ] **Cancelled Cheque** or Bank Passbook showing Proprietor Name and Account Number matching settlement details.

---

## 13. Policy & Consumer Transparency Disclaimers

- **Non-Gambling Disclaimers Retained:** Clear, prominent non-gambling and non-prize disclaimers are preserved across all pages. These disclaimers protect consumers by explicitly stating that payments generally represent non-refundable consideration for digital placement services once delivered (except for stated technical/reversal exceptions or where required by law) and offer no winnings or financial returns. They must **never** be removed to game automated keyword filters.
- **Truthful Delivery Guarantees:** Service delivery is strictly digital and occurs automatically via database settlement. No physical goods or delivery timeframes are promised.
- **Tax Policy Notice:** Pricing is stated transparently in INR; tax liability, place of supply, and GST thresholds must be confirmed with a chartered accountant before enabling live mode.

---

## 14. Tax & Accounting Handoff Policy (Fail-Closed Architecture)

The codebase implements a strict fail-closed configuration guardrail for merchant tax compliance:
- **Environment Flags:** `MERCHANT_TAX_BASIS` and `MERCHANT_TAX_REVIEWED`.
- If either variable is missing, empty, or false, checkout remains disabled and reports `"GST status being verified — checkout unavailable"`.
- **Operating Rules for Founder & Accountant:**
  1. **Real Turnover Verification:** GST and tax treatment must reflect current real aggregate business turnover, inter-state vs. intra-state place-of-supply facts, and formal professional review by a practicing Chartered Accountant.
  2. **Code Does Not Determine Liability:** Application code, environment variables, or platform defaults do NOT determine legal GST liability or statutory exemptions.
  3. **No Unsubstantiated Threshold Claims:** Do NOT claim or document "turnover is below mandatory GST threshold" merely because the enterprise is newly launched or pre-revenue. Such a determination must be grounded in actual accounting ledgers and legal advice.
  4. **Invoice Integrity:** Do NOT issue a GST tax invoice or collect GST unless the enterprise possesses a valid, active GSTIN registration. If unregistered, provide customer transaction receipts/proof of purchase without tax collection.
  5. **Data Protection Invariant:** No PAN, Aadhaar, bank credentials, private accounting ledger entries, or tax filings may ever be committed to the public or private Git repository.

---

## 15. Razorpay Business Model Underwriting SOP (Non-Auction / Non-Bidding Clarification)

### Context & Policy Background:
Razorpay's standard Terms of Service include "Bidding/auction houses" among restricted or prohibited merchant categories. While LazyProof operates as digital sponsored-profile visibility with deterministic leaderboard rankings based on cumulative verified sponsorship, the higher-sponsorship / higher-position mechanic may require manual underwriting clarification during onboarding review.

### Mandatory Compliance Rules:
1. **Never Disguise Mechanics:** Do NOT remove truthful ranking mechanics, displacement explanations, or pricing formulas to hide how the platform operates.
2. **Never Rename Payments Deceptively:** Do NOT mischaracterize sponsorship consideration as "donations", "consulting fees", "software licenses", or unrelated services.
3. **No False MCC Selection:** Do NOT attempt to classify under an unrelated Merchant Category Code to evade automated keyword filters.
4. **Never Claim Pre-Approval:** Do NOT claim Razorpay has approved the platform until written underwriting sign-off is formally issued.
5. **Preserve Non-Gambling Disclaimers:** Clear explanations that the platform offers no prize, no lottery, no random outcome, and no monetary returns must be preserved in full.

### Founder Standard Operating Procedure (SOP) for Clarification:
If Razorpay underwriting raises questions regarding bidding or auction classification, provide the following transparent, truthful explanation:
> *"Customers purchase digital sponsored-profile visibility on our web showcase. Public placement on the leaderboard is determined deterministically by cumulative verified sponsorship amount (in INR). There is no auctioned asset, no auction close, no bidding dynamic for asset ownership, no random outcome, no prize, no winnings, no payout, and no financial return of any kind. Consideration is solely for digital profile visibility and generated digital assets."*

**Recommendation:** Request written eligibility confirmation / pre-clearance from Razorpay's underwriting or risk team prior to any production integration or deployment. Razorpay gateway underwriting remains an external third-party determination.
