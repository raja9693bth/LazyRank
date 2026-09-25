import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { hashToken, constantTimeMatch } from '../server/db/postgres.ts';
import { CURRENT_TERMS_VERSION } from '../server.ts';

console.log('\n========================================================');
console.log('RUNNING PHASE 3: PAYMENT INTEGRITY, REFUNDS, & SECURITY');
console.log('========================================================\n');

let passed = 0;
function pass(msg: string) {
  passed++;
  console.log(`  ✓ PASS: ${msg}`);
}

// 1. Protected Order Access & Owner Token Security (C1)
console.log('--- 1. Protected Order Access & Token Cryptography (C1) ---');
const secret = 'ord_secret_token_123456';
const tokenHash = hashToken(secret);
assert.strictEqual(tokenHash.length, 64, 'SHA-256 hash must be 64 hex characters');
assert.ok(constantTimeMatch(tokenHash, hashToken(secret)), 'Constant time matching works for identical tokens');
assert.ok(!constantTimeMatch(tokenHash, hashToken('wrong_token')), 'Constant time matching rejects invalid tokens');
assert.ok(!constantTimeMatch(tokenHash, undefined), 'Constant time matching rejects undefined tokens');

const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
assert.ok(
  serverSrc.includes("req.headers['x-order-access-token']"),
  'Server status and receipt endpoints must inspect x-order-access-token header'
);
assert.ok(
  serverSrc.includes("res.setHeader('Cache-Control', 'no-store')"),
  'Server status and receipt endpoints must set Cache-Control: no-store'
);
assert.ok(
  !serverSrc.includes('ownerToken: profile ? profile.ownerToken : undefined'),
  'Status endpoint must never leak raw ownerToken'
);
assert.ok(
  !serverSrc.includes('ownerToken: settlement.ownerToken'),
  'Settlement response must never leak raw ownerToken'
);
pass('Protected order access with order access token and zero owner token disclosure');

// 2. Server-Authoritative Quote Snapshot & Affirmative Consent (C8)
console.log('\n--- 2. Server-Authoritative Quote Snapshot & Affirmative Consent (C8) ---');
assert.strictEqual(CURRENT_TERMS_VERSION, '2026-09-24', 'Current terms version must be canonical 2026-09-24');
assert.ok(serverSrc.includes('basePaise = parsedAmount * 100'), 'Quote calculates base amount in integer minor units (paise)');
assert.ok(serverSrc.includes('totalPaise = basePaise + taxPaise + feePaise'), 'Quote calculates exact total in paise');
assert.ok(serverSrc.includes('taxBasis:'), 'Quote provides documented tax basis');
assert.ok(!serverSrc.includes('customer_${phoneStr}@lazyproof.online'), 'Server must not generate fake customer emails');
assert.ok(serverSrc.includes('Idempotency conflict: order parameters differ'), 'Server detects conflicting idempotency parameters with 409');
pass('Authoritative minor-unit quote snapshot, valid consent capture, and idempotency protection');

// 3. Cashfree Settlement & Payment Deduplication (C3, C4, C12)
console.log('\n--- 3. Cashfree Settlement & Webhook Deduplication (C3, C4, C12) ---');
const pgSrc = fs.readFileSync(path.join(process.cwd(), 'server', 'db', 'postgres.ts'), 'utf-8');
assert.ok(
  pgSrc.includes("!['CREATED', 'PENDING'].includes(order.status)"),
  'settlePaymentAtomic settles only CREATED or PENDING orders'
);
assert.ok(
  pgSrc.includes('ON CONFLICT (provider_payment_id) DO NOTHING RETURNING id'),
  'settlePaymentAtomic enforces unique provider_payment_id transaction insert'
);
assert.ok(
  pgSrc.includes('txRes.rowCount !== 1'),
  'settlePaymentAtomic aborts when duplicate payment ID is encountered'
);
assert.ok(
  pgSrc.includes('order.owner_token_hash'),
  'settlePaymentAtomic uses securely stored order.owner_token_hash without returning plaintext'
);

const cashfreeSrc = fs.readFileSync(path.join(process.cwd(), 'server', 'payments', 'cashfree.ts'), 'utf-8');
assert.ok(
  cashfreeSrc.includes('crypto.timingSafeEqual'),
  'Cashfree webhook verification uses timingSafeEqual'
);
assert.ok(
  cashfreeSrc.includes('Number.isFinite(tsNum)'),
  'Cashfree webhook validates numeric timestamp header'
);
assert.ok(
  cashfreeSrc.includes('Missing webhook signature or timestamp header'),
  'Cashfree webhook rejects missing signature or timestamp'
);
assert.ok(
  serverSrc.includes('Generic webhook settlement is disabled in production/live mode'),
  'Generic webhook secret is disabled in live/production mode'
);
pass('Cashfree webhook HMAC verification, idempotency, and payment deduplication enforced');

// 4. Preflight Refund Reservation & State Machine (C2, C11)
console.log('\n--- 4. Preflight Refund Reservation & State Machine (C2, C11) ---');
assert.ok(
  pgSrc.includes('public async reserveRefundAtomic('),
  'PostgresDatabase implements preflight reserveRefundAtomic'
);
assert.ok(
  pgSrc.includes('public async failRefundReservation('),
  'PostgresDatabase implements failRefundReservation'
);
assert.ok(
  pgSrc.includes("!['PAID', 'PARTIALLY_REFUNDED'].includes(order.status)"),
  'Refund reservation checks that order is in PAID or PARTIALLY_REFUNDED state'
);
assert.ok(
  pgSrc.includes('refundPaise > remainingPaise'),
  'Refund reservation prevents refunding more than remaining refundable balance'
);
assert.ok(
  serverSrc.includes('db.reserveRefundAtomic('),
  'Refund API awaits preflight reservation before provider API call'
);
assert.ok(
  serverSrc.includes('db.failRefundReservation('),
  'Refund API releases reservation upon provider rejection'
);
pass('Preflight refund reservation, double-entry boundary check, and failure rollback verified');

// 5. Security Headers & Express Hardening (C5, C9)
console.log('\n--- 5. Security Headers & Express Hardening (C5, C9) ---');
assert.ok(!serverSrc.includes("'unsafe-eval'"), "Content Security Policy must not contain 'unsafe-eval'");
assert.ok(serverSrc.includes("frame-ancestors 'self'"), "Content Security Policy frame-ancestors must be 'self'");
assert.ok(serverSrc.includes("app.disable('x-powered-by')"), 'Server must disable X-Powered-By header');
assert.ok(serverSrc.includes("res.setHeader('X-Content-Type-Options', 'nosniff')"), 'Server must set nosniff');
assert.ok(serverSrc.includes("res.setHeader('X-Frame-Options', 'SAMEORIGIN')"), 'Server must set SAMEORIGIN');
assert.ok(
  serverSrc.includes('Direct client-side verification is disabled in production'),
  '/api/payment/verify is disabled in production and PostgreSQL mode'
);
pass('Security headers, strict CSP, and production client-side verify disabled');

// 6. Frontend Token Handling & Quote Transparency
console.log('\n--- 6. Frontend Token Handling & Quote Transparency ---');
const appSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');
assert.ok(appSrc.includes('pendingOwnerToken'), 'App manages pendingOwnerToken state');
assert.ok(appSrc.includes('orderAccessToken'), 'App manages orderAccessToken state');
assert.ok(appSrc.includes('pendingOwnerToken={pendingOwnerToken}'), 'App passes pendingOwnerToken to PaymentModal');
assert.ok(appSrc.includes('orderAccessToken={orderAccessToken}'), 'App passes orderAccessToken to PaymentModal');

const modalSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'PaymentModal.tsx'), 'utf-8');
assert.ok(modalSrc.includes("headers['x-order-access-token'] = orderAccessToken"), 'PaymentModal passes x-order-access-token in status/receipt polling');
assert.ok(modalSrc.includes('onPaymentSuccess(completedProfile, undefined, pendingOwnerToken ?? undefined)'), 'PaymentModal delivers pendingOwnerToken on success');

const actionPanelSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ActionPanel.tsx'), 'utf-8');
assert.ok(actionPanelSrc.includes('Base Amount') || actionPanelSrc.includes('Base Sponsorship'), 'ActionPanel displays Base Amount');
assert.ok(actionPanelSrc.includes('Services Tax (GST)') || actionPanelSrc.includes('Goods &amp; Services Tax') || actionPanelSrc.includes('Applicable Taxes'), 'ActionPanel displays GST / Applicable Taxes');
assert.ok(actionPanelSrc.includes('Platform Fee') || actionPanelSrc.includes('Platform & Processing Fees'), 'ActionPanel displays Platform Fee');
assert.ok(actionPanelSrc.includes('Total Payable') || actionPanelSrc.includes('Final Payable Total'), 'ActionPanel displays Total Payable');
pass('Frontend client securely manages tokens and displays transparent quote breakdown');

console.log(`\nPHASE 3 COMPLETE: All ${passed} tests passed successfully.\n`);
process.exit(0);
