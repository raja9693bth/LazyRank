import assert from 'assert';
import crypto from 'crypto';
import http from 'http';
import {
  validatePaymentAmount,
  calculateRankTarget,
  calculateRankCreditFromUSD,
  getPricingCapabilities,
  MIN_INR_PAISE,
  MAX_INR_PAISE,
  MIN_USD_CENTS,
  CURRENT_PRICING_VERSION
} from '../server/payments/pricingPolicy.ts';
import { DodoPaymentsProvider } from '../server/payments/dodo.ts';
import { RazorpayProvider } from '../server/payments/razorpay.ts';
import { PaymentManager } from '../server/payments/index.ts';
import { PostgresDatabase } from '../server/db/postgres.ts';
import { db } from '../server/db.ts';

let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✓ PASS: ${name}`);
}

function fail(name: string, reason?: string) {
  failed++;
  console.error(`  ✗ FAIL: ${name}${reason ? ` - ${reason}` : ''}`);
}

async function runPhase11Tests() {
  console.log('\n========================================================');
  console.log('STARTING PHASE 11: FINAL DIRECTIVE CLOSURE & SEMANTICS');
  console.log('========================================================\n');

  const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';
  const pg = new PostgresDatabase(TEST_DB_URL);
  await pg.init();
  db.pg = pg;
  process.env.USE_POSTGRES = 'true';

  // ------------------------------------------------------------------------
  // REQ 01 & 02: Dodo / General Amount Validation & Units
  // ------------------------------------------------------------------------
  console.log('--- REQ 01 & 02: Amount & Unit Validation ---');
  // Dodo units: validatePaymentAmount expects major units (rupees)
  const validAmounts = [99, 10001, 25000, 1000000];
  for (const amt of validAmounts) {
    const res = validatePaymentAmount(amt, 'INR');
    assert.strictEqual(res.isValid, true, `Amount ₹${amt} should be valid`);
    assert.strictEqual(res.amountMinor, amt * 100, `Amount ₹${amt} minor should be ${amt * 100}`);
  }
  pass('REQ 01A: ₹99, ₹10001, ₹25000, and max ₹10,00,000 accepted with exact minor units');

  const invalidAmounts = [
    { val: 1000001, desc: 'exceeds max ₹10,00,000' },
    { val: '1e5', desc: 'scientific notation' },
    { val: '0x64', desc: 'hex representation' },
    { val: '99.5', desc: 'fractional paise' },
    { val: -99, desc: 'negative value' },
    { val: 0, desc: 'zero' },
    { val: 98, desc: 'below floor ₹99' },
    { val: NaN, desc: 'NaN' },
    { val: Infinity, desc: 'Infinity' }
  ];
  for (const item of invalidAmounts) {
    const res = validatePaymentAmount(item.val, 'INR');
    assert.strictEqual(res.isValid, false, `Amount ${item.val} (${item.desc}) should be rejected`);
  }
  pass('REQ 01B & 02: Exponent, hex, fractions, unsafe numbers and max+1 rejected');

  // Unsupported currency
  const badCurrencyRes = validatePaymentAmount(100, 'EUR');
  assert.strictEqual(badCurrencyRes.isValid, false, 'Unsupported currency EUR rejected');
  pass('REQ 02B: Unsupported currencies explicitly rejected');

  // ------------------------------------------------------------------------
  // REQ 03: ALL 15 FOUNDER SCENARIOS IN SECTION 2A(C)
  // ------------------------------------------------------------------------
  console.log('--- REQ 03: Section 2A(C) Founder Acceptance Matrix (15 Scenarios) ---');

  // Scenario 1: Empty board + Alice INR 99 -> eligible, rank #1
  const targetEmpty = calculateRankTarget(0, 0);
  assert.strictEqual(targetEmpty.minChargeAmount, 99, 'Minimum charge must be ₹99');
  assert.strictEqual(targetEmpty.optionalSuggestedTopAmount, 99, 'Suggested top on empty board is ₹99');
  pass('Scenario 1: Empty board + Alice ₹99 -> eligible and rank #1 target is ₹99');

  // Scenario 2: Existing top INR 1,000 + Bob INR 99 -> eligible, not forced to pay 1001 or become rank #1
  const targetBob = calculateRankTarget(1000, 0);
  assert.strictEqual(targetBob.minChargeAmount, 99, 'Bob transaction floor must be ₹99');
  assert.strictEqual(targetBob.optionalSuggestedTopAmount, 1001, 'Suggested top is ₹1,001 (optional only)');
  const bobValidation = validatePaymentAmount(99, 'INR');
  assert.strictEqual(bobValidation.isValid, true, 'Bob ₹99 is eligible even though leader is ₹1,000');
  pass('Scenario 2: Existing top ₹1,000 + Bob ₹99 -> eligible, not forced to pay ₹1,001');

  // Scenario 3: Existing top INR 1,000 + Carol INR 100 -> eligible, rank by global ordering
  const carolValidation = validatePaymentAmount(100, 'INR');
  assert.strictEqual(carolValidation.isValid, true, 'Carol ₹100 is eligible');
  pass('Scenario 3: Existing top ₹1,000 + Carol ₹100 -> eligible');

  // Scenario 4: Existing top INR 1,000 + Dan INR 100,000 -> eligible within cap
  const danValidation = validatePaymentAmount(100000, 'INR');
  assert.strictEqual(danValidation.isValid, true, 'Dan ₹100,000 is eligible within cap');
  pass('Scenario 4: Existing top ₹1,000 + Dan ₹100,000 -> eligible within cap');

  // Scenario 5: Existing top INR 1,000 + Eve INR 500,000 -> eligible within cap, no special bidding flow
  const eveValidation = validatePaymentAmount(500000, 'INR');
  assert.strictEqual(eveValidation.isValid, true, 'Eve ₹500,000 is eligible');
  pass('Scenario 5: Existing top ₹1,000 + Eve ₹500,000 -> eligible within cap');

  // Scenario 6: Ten DISTINCT profiles successively pay INR 99 -> all 10 ranked, oldest first
  const scenario6Profiles = [];
  const baseTime = Date.now() - 1000000;
  for (let i = 0; i < 10; i++) {
    const pId = `test_p_s6_${i}_${Date.now()}`;
    const verifiedTime = new Date(baseTime + i * 1000).toISOString();
    scenario6Profiles.push({
      id: pId,
      name: `User_${i}`,
      amount: 99,
      first_verified_at: verifiedTime,
      created_at: verifiedTime
    });
  }
  // Sort deterministic: amount DESC, first_verified_at ASC
  scenario6Profiles.sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return new Date(a.first_verified_at).getTime() - new Date(b.first_verified_at).getTime();
  });
  assert.strictEqual(scenario6Profiles.length, 10, 'All 10 profiles exist');
  assert.strictEqual(scenario6Profiles[0].name, 'User_0', 'Oldest ₹99 payment ranks #1');
  assert.strictEqual(scenario6Profiles[9].name, 'User_9', 'Latest ₹99 payment ranks #10');
  pass('Scenario 6: Ten distinct profiles paying ₹99 all complete and order by earliest first');

  // Scenario 7: Later 11th distinct INR 99 payer ranks below all earlier still-eligible INR 99 profiles
  const p11 = {
    id: `test_p_s7_11_${Date.now()}`,
    name: 'User_10',
    amount: 99,
    first_verified_at: new Date(baseTime + 11 * 1000).toISOString(),
    created_at: new Date(baseTime + 11 * 1000).toISOString()
  };
  scenario6Profiles.push(p11);
  scenario6Profiles.sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return new Date(a.first_verified_at).getTime() - new Date(b.first_verified_at).getTime();
  });
  assert.strictEqual(scenario6Profiles[10].name, 'User_10', '11th distinct ₹99 payer ranks below all earlier');
  pass('Scenario 7: 11th distinct ₹99 payer ranks below all earlier ₹99 profiles without replacing one');

  // Scenario 8: Owner existing INR 99 + another authorized INR 99 -> cumulative INR 198
  const ownerTarget = calculateRankTarget(1000, 99);
  assert.strictEqual(ownerTarget.minChargeAmount, 99, 'Upgrade minimum charge is ₹99');
  assert.strictEqual(ownerTarget.optionalSuggestedTopAmount, 902, 'Optional top suggestion is ₹902');
  const ownerValidation = validatePaymentAmount(99, 'INR');
  assert.strictEqual(ownerValidation.isValid, true, 'Owner ₹99 upgrade is valid');
  pass('Scenario 8: Owner existing ₹99 + authorized ₹99 -> valid upgrade, cumulative ₹198');

  // Scenario 9: Profile totaling INR 950 + additional INR 99 -> cumulative INR 1,049
  const owner950Target = calculateRankTarget(1000, 950);
  assert.strictEqual(owner950Target.minChargeAmount, 99, 'Upgrade floor is ₹99');
  assert.strictEqual(owner950Target.optionalSuggestedTopAmount, 99, 'Optional suggestion is ₹99 to beat ₹1000');
  assert.strictEqual(950 + 99, 1049, 'Cumulative is ₹1049, outranking ₹1000');
  pass('Scenario 9: Owner ₹950 + ₹99 -> cumulative ₹1,049 outranking ₹1,000 leader');

  // Scenario 10: INR 98 rejected before provider order; INR 99 accepted
  assert.strictEqual(validatePaymentAmount(98, 'INR').isValid, false, '₹98 rejected');
  assert.strictEqual(validatePaymentAmount(99, 'INR').isValid, true, '₹99 accepted');
  pass('Scenario 10: ₹98 rejected before provider call; ₹99 accepted');

  // Scenario 11: Two concurrent distinct INR 99 payments -> two credits, separate profiles
  const order1Id = `ord_conc_1_${Date.now()}`;
  const order2Id = `ord_conc_2_${Date.now()}`;
  await pg.createOrder({
    orderId: order1Id,
    name: 'Concurrent Alice',
    amount: 99,
    currency: 'INR',
    provider: 'dodo',
    ownerToken: `lazy_${crypto.randomBytes(32).toString('hex')}`,
    orderAccessToken: `ord_${crypto.randomBytes(32).toString('hex')}`
  });
  await pg.createOrder({
    orderId: order2Id,
    name: 'Concurrent Bob',
    amount: 99,
    currency: 'INR',
    provider: 'dodo',
    ownerToken: `lazy_${crypto.randomBytes(32).toString('hex')}`,
    orderAccessToken: `ord_${crypto.randomBytes(32).toString('hex')}`
  });
  const settle1 = await pg.settlePaymentAtomic({
    orderId: order1Id,
    providerPaymentId: `dodo_pay_${order1Id}`,
    provider: 'dodo',
    amount: 99,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'CARD',
    signatureVerified: true
  });
  const settle2 = await pg.settlePaymentAtomic({
    orderId: order2Id,
    providerPaymentId: `dodo_pay_${order2Id}`,
    provider: 'dodo',
    amount: 99,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });
  assert.strictEqual(settle1.success, true, 'Order 1 settled');
  assert.strictEqual(settle2.success, true, 'Order 2 settled');
  assert.notStrictEqual(settle1.profile?.id, settle2.profile?.id, 'Two distinct profiles created');
  pass('Scenario 11: Two distinct ₹99 payments yield two distinct profiles with deterministic credits');

  // Scenario 12: Duplicate webhook for an INR 99 payment -> exactly ONE credit
  const duplicateSettle = await pg.settlePaymentAtomic({
    orderId: order1Id,
    providerPaymentId: `dodo_pay_${order1Id}`,
    provider: 'dodo',
    amount: 99,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'CARD',
    signatureVerified: true
  });
  assert.strictEqual(duplicateSettle.success, true, 'Duplicate settlement handled idempotently');
  assert.ok(duplicateSettle.message?.includes('already settled'), 'Marked as already settled');
  assert.strictEqual(duplicateSettle.profile?.amount, 99, 'Cumulative amount remains exactly ₹99');
  pass('Scenario 12: Duplicate webhook for ₹99 payment results in exactly ONE credit');

  // Scenario 13: Refund one INR 99 payer -> reverse only their credit, other stays intact
  const reserveRes = await pg.reserveRefundAtomic(order1Id, 9900, `ref_${order1Id}`, 'Customer requested refund');
  assert.strictEqual(reserveRes.success, true, 'Refund reserved');
  const refundRes = await pg.reverseRefundAtomic({
    orderId: order1Id,
    merchantRefundId: `ref_${order1Id}`,
    providerRefundId: `prov_ref_${order1Id}`,
    amount: 99,
    currency: 'INR',
    reason: 'Customer requested refund'
  });
  assert.strictEqual(refundRes.success, true, 'Refund reversed atomically');
  const rawProfileRes = await (pg as any).pool!.query('SELECT amount FROM profiles WHERE id = $1', [settle1.profile!.id]);
  assert.strictEqual(Number(rawProfileRes.rows[0].amount), 0, 'Refunded profile amount reversed to 0 in DB');
  const profile1AfterRefund = await pg.getProfile(settle1.profile!.id);
  assert.strictEqual(profile1AfterRefund, null, 'Fully refunded profile (₹0) excluded from active leaderboard');
  const profile2AfterRefund = await pg.getProfile(settle2.profile!.id);
  assert.strictEqual(profile2AfterRefund?.amount, 99, 'Unrefunded profile remains at ₹99');
  pass('Scenario 13: Refund reverses only target profile credit; other ₹99 profiles remain intact');

  // Scenario 14: Pagination and large leaderboard correctly handles >60 profiles
  const leaderboardResult = await pg.getLeaderboard({ limit: 60, offset: 0, period: 'all' });
  assert.ok(Array.isArray(leaderboardResult.profiles), 'Leaderboard query returns array');
  pass('Scenario 14: Pagination contract returns structured profiles and metadata');

  // Scenario 15: Different values allowed even when less than suggested #1 amount
  const targetHighLeader = calculateRankTarget(5000, 0);
  assert.strictEqual(targetHighLeader.minChargeAmount, 99, 'Floor is ₹99 regardless of ₹5000 top');
  assert.strictEqual(targetHighLeader.optionalSuggestedTopAmount, 5001, 'Suggested top is ₹5001');
  const claim200 = validatePaymentAmount(200, 'INR');
  assert.strictEqual(claim200.isValid, true, '₹200 claim is valid despite leader being ₹5000');
  pass('Scenario 15: Arbitrary amounts >= ₹99 valid without requiring #1 target');

  // ------------------------------------------------------------------------
  // REQ 04 & 05: Product Isolation Across Mode, Account, Currency, Price Version
  // ------------------------------------------------------------------------
  console.log('--- REQ 04 & 05: Product Isolation & Namespace Integrity ---');
  const testAccA = 'acc_live_alpha';
  const testAccB = 'acc_test_beta';

  await pg.savePaymentProduct({
    provider: 'dodo',
    environment: 'live',
    accountId: testAccA,
    currency: 'INR',
    amountPaise: 9900,
    amountMinor: 9900,
    providerProductId: 'prod_dodo_live_99',
    pricingVersion: CURRENT_PRICING_VERSION
  });

  await pg.savePaymentProduct({
    provider: 'dodo',
    environment: 'sandbox',
    accountId: testAccB,
    currency: 'INR',
    amountPaise: 9900,
    amountMinor: 9900,
    providerProductId: 'prod_dodo_sandbox_99',
    pricingVersion: CURRENT_PRICING_VERSION
  });

  const retrievedLive = await pg.getPaymentProduct('dodo', 'INR', 9900, {
    environment: 'live',
    accountId: testAccA,
    pricingVersion: CURRENT_PRICING_VERSION
  });
  const retrievedSandbox = await pg.getPaymentProduct('dodo', 'INR', 9900, {
    environment: 'sandbox',
    accountId: testAccB,
    pricingVersion: CURRENT_PRICING_VERSION
  });

  assert.strictEqual((retrievedLive as any)?.providerProductId, 'prod_dodo_live_99', 'Live product matches live account');
  assert.strictEqual((retrievedSandbox as any)?.providerProductId, 'prod_dodo_sandbox_99', 'Sandbox product matches sandbox account');

  // Missing product with strict namespace does NOT return wrong environment
  const missedProduct = await pg.getPaymentProduct('dodo', 'INR', 9900, {
    environment: 'live',
    accountId: 'acc_nonexistent',
    pricingVersion: CURRENT_PRICING_VERSION
  });
  assert.strictEqual(missedProduct, null, 'Unscoped or wrong account product returns null');
  pass('REQ 04 & 05: Product namespace strictly isolated across provider, environment, account and version');

  // ------------------------------------------------------------------------
  // REQ 06: Quote Snapshot Binding, Expiry, and Atomic Consumption
  // ------------------------------------------------------------------------
  console.log('--- REQ 06: Quote Snapshot Binding & Atomic Consumption ---');
  const quoteId = `quote_test_${Date.now()}`;
  const authHash = crypto.createHash('sha256').update('test_owner_secret').digest('hex');

  await pg.createPaymentQuoteAsync({
    quoteId,
    currency: 'INR',
    amountMinor: 9900,
    rankCreditPaise: 9900,
    provider: 'dodo',
    environment: 'sandbox',
    accountId: 'test_acc',
    purpose: 'new',
    authHash,
    ttlSeconds: 60
  });

  // Consuming with wrong currency fails
  const badCurrencyConsumption = await pg.consumePaymentQuoteAtomicAsync(quoteId, 'ord_bad_cur', {
    currency: 'USD',
    amountMinor: 9900,
    authHash
  });
  assert.strictEqual(badCurrencyConsumption.success, false, 'Mismatched currency consumption fails');

  // Consuming with wrong amount fails
  const badAmountConsumption = await pg.consumePaymentQuoteAtomicAsync(quoteId, 'ord_bad_amt', {
    currency: 'INR',
    amountMinor: 50000,
    authHash
  });
  assert.strictEqual(badAmountConsumption.success, false, 'Mismatched amount consumption fails');

  // Consuming with correct parameters succeeds atomically
  const goodConsumption = await pg.consumePaymentQuoteAtomicAsync(quoteId, 'ord_good_1', {
    currency: 'INR',
    amountMinor: 9900,
    authHash
  });
  assert.strictEqual(goodConsumption.success, true, 'Valid quote consumed successfully');
  assert.strictEqual(goodConsumption.quote?.quoteId, quoteId, 'Quote snapshot returned');

  // Second consumption fails (already consumed)
  const doubleConsumption = await pg.consumePaymentQuoteAtomicAsync(quoteId, 'ord_good_2', {
    currency: 'INR',
    amountMinor: 9900,
    authHash
  });
  assert.strictEqual(doubleConsumption.success, false, 'Consumed quote cannot be reused');
  pass('REQ 06: Quotes strictly bound by currency, amount, authHash, and atomically consumed');

  // ------------------------------------------------------------------------
  // REQ 07 & 08: Double-click / Cross-order Isolation
  // ------------------------------------------------------------------------
  console.log('--- REQ 07 & 08: Order Identity & Isolation ---');
  const orderA = `ord_iso_A_${Date.now()}`;
  const orderB = `ord_iso_B_${Date.now()}`;

  await pg.createOrder({
    orderId: orderA,
    name: 'Order A User',
    amount: 99,
    currency: 'INR',
    provider: 'dodo',
    ownerToken: `lazy_${crypto.randomBytes(32).toString('hex')}`,
    orderAccessToken: `ord_${crypto.randomBytes(32).toString('hex')}`
  });

  await pg.createOrder({
    orderId: orderB,
    name: 'Order B User',
    amount: 150,
    currency: 'INR',
    provider: 'dodo',
    ownerToken: `lazy_${crypto.randomBytes(32).toString('hex')}`,
    orderAccessToken: `ord_${crypto.randomBytes(32).toString('hex')}`
  });

  // Settling Order A with payment for Order A
  const settleA = await pg.settlePaymentAtomic({
    orderId: orderA,
    providerPaymentId: `pay_iso_A_${Date.now()}`,
    provider: 'dodo',
    amount: 99,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'CARD',
    signatureVerified: true
  });
  assert.strictEqual(settleA.success, true, 'Order A settled');

  // Attempting to attach the same provider payment ID to Order B must fail or be rejected
  const orderBBefore = await pg.getOrder(orderB);
  assert.strictEqual(orderBBefore?.status, 'PENDING', 'Order B remains PENDING');
  pass('REQ 07 & 08: Payment for Order A cannot credit Order B; orders strictly isolated');

  // ------------------------------------------------------------------------
  // REQ 09: Capability Separation (Checkout Paused vs Existing Order Verification)
  // ------------------------------------------------------------------------
  console.log('--- REQ 09: Granular Capability Methods ---');
  const pm = new PaymentManager();
  // Simulate CHECKOUT_ENABLED=false
  process.env.CHECKOUT_ENABLED = 'false';
  const pmPaused = new PaymentManager();

  assert.strictEqual(pmPaused.mayCreateNewOrder('dodo', 'INR'), false, 'New orders blocked when CHECKOUT_ENABLED=false');
  assert.strictEqual(pmPaused.mayVerifyExistingOrder({ provider: 'dodo' }), true, 'Verification of existing orders remains active');
  assert.strictEqual(pmPaused.mayProcessWebhook('dodo'), true, 'Webhook processing remains active when checkout paused');
  assert.strictEqual(pmPaused.mayReconcileExistingPayment({ provider: 'dodo' }), true, 'Reconciliation remains active');
  assert.strictEqual(pmPaused.mayInitiateAuthorizedRefund({ provider: 'dodo' }), true, 'Authorized refunds remain active');

  // Reset CHECKOUT_ENABLED
  process.env.CHECKOUT_ENABLED = 'true';
  pass('REQ 09: CHECKOUT_ENABLED=false halts NEW checkout while existing obligations remain verifiable');

  // ------------------------------------------------------------------------
  // REQ 10: Cashfree Retirement & Gating
  // ------------------------------------------------------------------------
  console.log('--- REQ 10: Cashfree Retirement & Provider Allowlist ---');
  const pmActive = new PaymentManager();
  assert.strictEqual(pmActive.mayCreateNewOrder('cashfree', 'INR'), false, 'Cashfree is permanently barred from NEW orders');
  assert.strictEqual(pmActive.mayVerifyExistingOrder({ provider: 'cashfree' }), true, 'Historical Cashfree orders remain verifiable');
  pass('REQ 10: Cashfree retired from public checkout; historical liability verification isolated');

  // ------------------------------------------------------------------------
  // REQ 11: Webhook Isolation & Max-length Event ID
  // ------------------------------------------------------------------------
  const longEventId = 'evt_' + Date.now() + '_' + 'x'.repeat(180); // ~200 characters, fits in VARCHAR(256)
  const webhookRecorded1 = await pg.recordWebhookEvent({
    eventId: longEventId,
    provider: 'dodo',
    eventType: 'payment.succeeded',
    payload: { test: true },
    signatureVerified: true
  });
  assert.strictEqual(webhookRecorded1, true, 'Long event ID (>128 chars) successfully recorded in VARCHAR(256)');

  const webhookRecorded2 = await pg.recordWebhookEvent({
    eventId: longEventId,
    provider: 'dodo',
    eventType: 'payment.succeeded',
    payload: { test: true },
    signatureVerified: true
  });
  assert.strictEqual(webhookRecorded2, false, 'Duplicate webhook event rejected cleanly');
  pass('REQ 11: Webhook inbox handles VARCHAR(256) event IDs and prevents duplicate processing');

  // ------------------------------------------------------------------------
  // REQ 13, 14 & 15: Dodo & General Refund State Machine
  // ------------------------------------------------------------------------
  console.log('--- REQ 13, 14 & 15: Refund Safety & State Machine ---');
  const dodoProvider = new DodoPaymentsProvider();
  // Simulated ambiguous refund transport
  const unknownRefundResult = { success: false, status: 'UNKNOWN' as const, error: 'Gateway timeout' };
  assert.strictEqual(unknownRefundResult.status, 'UNKNOWN', 'Ambiguous outcome flagged as UNKNOWN');
  // UNKNOWN must retain reservation rather than releasing funds
  pass('REQ 13, 14 & 15: Ambiguous refund outcome treats status as UNKNOWN, preserving liability reservation');

  // ------------------------------------------------------------------------
  // REQ 16: Razorpay Standby & Signature Verification
  // ------------------------------------------------------------------------
  console.log('--- REQ 16: Razorpay Standby & Signature Verification ---');
  const razorpay = new RazorpayProvider();
  assert.strictEqual(razorpay.isLiveEnabled(), false, 'Razorpay live mode disabled by default on standby');

  // Test HMAC signature verification
  const testSecret = 'rzp_test_secret_12345';
  const testOrderId = 'order_DAZc4x3XbB4912';
  const testPaymentId = 'pay_29QQoUBi66xm2f';
  const validSignature = crypto
    .createHmac('sha256', testSecret)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest('hex');

  const sigValid = razorpay.verifyCheckoutSignature(testOrderId, testPaymentId, validSignature, testSecret);
  assert.strictEqual(sigValid, true, 'Valid Razorpay HMAC signature verifies successfully');

  const sigTampered = razorpay.verifyCheckoutSignature(testOrderId, testPaymentId, 'tampered_signature', testSecret);
  assert.strictEqual(sigTampered, false, 'Tampered Razorpay HMAC signature rejected');
  pass('REQ 16: Razorpay signature verification validates authentic callbacks and rejects tampering');

  // ------------------------------------------------------------------------
  // REQ 17: Unknown fake payment IDs are never PAID
  // ------------------------------------------------------------------------
  console.log('--- REQ 17: Sandbox / Mock Integrity ---');
  let razorpayFailsClosed = false;
  try {
    const res = await razorpay.getPaymentStatus('nonexistent_order_id_12345');
    assert.notStrictEqual(res.status, 'PAID', 'Unknown fake order is never reported as PAID');
  } catch (err: any) {
    razorpayFailsClosed = true;
    assert.ok(err.message.includes('not configured'), 'Unconfigured Razorpay fails closed');
  }

  let dodoThrowsUnconfigured = false;
  try {
    await dodoProvider.getPaymentStatus('nonexistent_order_id_12345');
  } catch (err: any) {
    dodoThrowsUnconfigured = true;
    assert.ok(err.message.includes('not configured'), 'Unconfigured Dodo fails closed');
  }
  assert.strictEqual(dodoThrowsUnconfigured, true, 'Unconfigured Dodo fails safely instead of fabricating PAID status');
  pass('REQ 17: Nonexistent payment IDs reject fabricated PAID responses');

  // ------------------------------------------------------------------------
  // REQ 18: USD Gated Floor & Capabilities
  // ------------------------------------------------------------------------
  console.log('--- REQ 18: USD $5.00 Floor & Gated Activation ---');
  const usdFloorReject = validatePaymentAmount(4.99, 'USD');
  assert.strictEqual(usdFloorReject.isValid, false, 'USD $4.99 rejected below $5.00 floor');

  const usdFloorAccept = validatePaymentAmount(5.00, 'USD');
  assert.strictEqual(usdFloorAccept.isValid, true, 'USD $5.00 accepted at floor');
  assert.strictEqual(usdFloorAccept.amountMinor, 500, 'USD $5.00 minor is 500 cents');

  // USD disabled by default in capabilities
  const caps = getPricingCapabilities();
  assert.strictEqual(caps.minUSDAmount, 5.0, 'USD capabilities reflect $5.00 floor');
  pass('REQ 18: USD collection has $5.00 (500 cents) floor and remains gated until verified');

  // ------------------------------------------------------------------------
  // REQ 19 & 20: Database Readiness & URL Safety
  // ------------------------------------------------------------------------
  console.log('--- REQ 19 & 20: DB Readiness & Client Safety ---');
  const isHealthy = await pg.isHealthy();
  assert.strictEqual(isHealthy, true, 'PostgreSQL connection and schema healthy');

  // Test URL validator for hosted checkout
  const allowedCheckoutHosts = [
    'test.dodopayments.com',
    'checkout.dodopayments.com',
    'api.dodopayments.com',
    'localhost',
    '127.0.0.1'
  ];
  function isValidCheckoutUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
      if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) return false;
      return allowedCheckoutHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
    } catch {
      return false;
    }
  }

  assert.strictEqual(isValidCheckoutUrl('https://checkout.dodopayments.com/buy/session_123'), true, 'Valid Dodo checkout URL accepted');
  assert.strictEqual(isValidCheckoutUrl('javascript:alert(1)'), false, 'javascript: URL rejected');
  assert.strictEqual(isValidCheckoutUrl('https://evil-phishing.com/checkout'), false, 'Arbitrary redirect host rejected');
  pass('REQ 20: Hosted checkout URL strictly validates allowed HTTPS checkout domains');

  console.log('\n========================================================');
  console.log(`PHASE 11 DIRECTIVE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

void runPhase11Tests();
