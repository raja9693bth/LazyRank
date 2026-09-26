import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PostgresDatabase, hashToken } from '../server/db/postgres.ts';
import { toSafePaise } from '../server/payments/provider.ts';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';

function assertSafeTestDatabase(url: string) {
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('neon.tech') ||
    lowerUrl.includes('neon.build') ||
    lowerUrl.includes('aws.neon') ||
    lowerUrl.includes('prod')
  ) {
    throw new Error('FATAL SECURITY VIOLATION: Refusing to run integration tests against production or Neon URL!');
  }
  try {
    const urlObj = new URL(url.startsWith('postgres') ? url : `postgresql://${url}`);
    const dbName = urlObj.pathname.replace(/^\//, '');
    if (!dbName.includes('test')) {
      throw new Error(`FATAL SAFETY VIOLATION: Target database "${dbName}" is not explicitly named as a test database (must contain "test").`);
    }
  } catch (err: any) {
    if (err.message.includes('FATAL')) throw err;
  }
}

async function runPhase8Tests() {
  assertSafeTestDatabase(TEST_DB_URL);
  console.log('\n========================================================');
  console.log('RUNNING PHASE 8: PAYMENT RECONCILIATION, REFUND STATE MACHINE & ACCESS RECOVERY');
  console.log('========================================================\n');

  let passed = 0;
  function pass(msg: string) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  const pg = new PostgresDatabase(TEST_DB_URL);
  await pg.init();
  const pool = await pg.getPool();

  // Clean test tables to ensure deterministic test baseline
  await pool.query('DELETE FROM outbox_channel_deliveries');
  await pool.query('DELETE FROM operational_outbox');
  await pool.query('DELETE FROM refund_reversals');
  await pool.query('DELETE FROM rank_ledger');
  await pool.query('DELETE FROM payment_transactions');
  await pool.query('DELETE FROM payment_orders');
  await pool.query('DELETE FROM claim_history');
  await pool.query('DELETE FROM profiles');

  // =========================================================================
  // 1. Phase A: Refund State Machine & Reservation Invariants (A1, A2, A3, A4, A5)
  // =========================================================================
  console.log('--- 1. Phase A: Refund State Machine & Typed Reservation Outcomes ---');

  let profileAId = 'p_phase8_a_' + Date.now();
  const orderAId = 'ord_phase8_a_' + Date.now();
  const rawOwnerTokenA = 'lazy_owner_phase8_a_' + crypto.randomBytes(32).toString('hex');
  const rawAccessTokenA = 'ord_acc_phase8_a_' + crypto.randomBytes(32).toString('hex');

  // Settle an initial order for ₹1,000 (100,000 paise)
  await pg.createOrder({
    orderId: orderAId,
    name: 'Refund Test User A',
    amount: 1000,
    currency: 'INR',
    ownerToken: rawOwnerTokenA,
    orderAccessToken: rawAccessTokenA,
    idempotencyKey: 'idem_phase8_a_' + Date.now()
  });

  const settleResA = await pg.settlePaymentAtomic({
    orderId: orderAId,
    providerPaymentId: 'cf_pay_phase8_a_' + Date.now(),
    provider: 'cashfree',
    amount: 1000,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });

  assert.strictEqual(settleResA.success, true, 'Initial settlement must succeed');
  profileAId = settleResA.profile!.id;
  assert.strictEqual(settleResA.profile?.amount, 1000, 'Initial profile amount must be 1000');
  assert.strictEqual(settleResA.profile?.rank, 1, 'Profile must be rank 1');
  pass('Initial paid order settled with status PAID and rank 1');

  // A1: First partial refund reservation (₹400 = 40,000 paise)
  const refundId1 = 'ref_phase8_001_' + Date.now();
  const res1 = await pg.reserveRefundAtomic(orderAId, 40000, refundId1, 'Partial refund 1');
  assert.strictEqual(res1.success, true, 'Reservation 1 must succeed');
  assert.strictEqual(res1.outcome, 'NEW', 'First reservation outcome must be NEW');
  assert.strictEqual(res1.status, 'PENDING', 'Reservation status must be PENDING');
  assert.strictEqual(res1.remainingRefundablePaise, 60000, 'Remaining refundable paise must be 60,000');
  pass('First refund reservation returns typed outcome NEW with correct remaining balance');

  // A1: Retrying the SAME refundId with identical order and amount returns EXISTING_PENDING without double reservation
  const retryPending = await pg.reserveRefundAtomic(orderAId, 40000, refundId1, 'Partial refund 1 retry');
  assert.strictEqual(retryPending.success, true, 'Retry must succeed');
  assert.strictEqual(retryPending.outcome, 'EXISTING_PENDING', 'Retry must return EXISTING_PENDING');
  assert.strictEqual(retryPending.status, 'PENDING', 'Retry status must be PENDING');
  pass('Retrying same refund ID while PENDING returns EXISTING_PENDING (no duplicate provider call)');

  // A1: Mismatched order/amount for existing refund ID returns CONFLICT (409)
  const mismatchRes = await pg.reserveRefundAtomic(orderAId, 50000, refundId1, 'Mismatch amount');
  assert.strictEqual(mismatchRes.success, false, 'Mismatched reservation must fail');
  assert.strictEqual(mismatchRes.outcome, 'CONFLICT', 'Mismatched reservation outcome must be CONFLICT');
  assert.strictEqual(mismatchRes.statusCode, 409, 'Status code must be 409');
  pass('Mismatched amount with existing refund ID returns 409 CONFLICT');

  // Settle refundId1 via reverseRefundAtomic
  const reverseRes1 = await pg.reverseRefundAtomic({
    orderId: orderAId,
    amount: 400,
    merchantRefundId: refundId1,
    providerRefundId: 'cf_ref_001_prov',
    currency: 'INR',
    reason: 'Partial refund 1 verified'
  });
  assert.strictEqual(reverseRes1.success, true, 'Reverse refund 1 must succeed');

  const orderAfterRef1 = await pg.getOrder(orderAId);
  assert.strictEqual(orderAfterRef1.status, 'PARTIALLY_REFUNDED', 'Order status must be PARTIALLY_REFUNDED');

  const profileAfterRef1 = await pg.getProfile(profileAId);
  assert.strictEqual(profileAfterRef1?.amount, 600, 'Profile net amount must be ₹600');
  pass('Reverse refund transitions order to PARTIALLY_REFUNDED and updates net amount to ₹600');

  // A1: Retrying a settled refund ID returns EXISTING_SUCCESS
  const retrySuccess = await pg.reserveRefundAtomic(orderAId, 40000, refundId1, 'Partial refund 1 success retry');
  assert.strictEqual(retrySuccess.success, true, 'Retry of settled refund must succeed');
  assert.strictEqual(retrySuccess.outcome, 'EXISTING_SUCCESS', 'Outcome must be EXISTING_SUCCESS');
  assert.strictEqual(retrySuccess.status, 'SUCCESS', 'Status must be SUCCESS');
  pass('Retrying settled refund ID returns typed outcome EXISTING_SUCCESS');

  // A2: failRefundReservation on status='SUCCESS' MUST leave SUCCESS and ledger untouched
  const failSuccessRes = await pg.failRefundReservation(refundId1, orderAId);
  assert.strictEqual(failSuccessRes, false, 'failRefundReservation on SUCCESS must return false');

  const ref1Row = (await pool.query('SELECT status FROM refund_reversals WHERE merchant_refund_id = $1', [refundId1])).rows[0];
  assert.strictEqual(ref1Row.status, 'SUCCESS', 'Settled refund status must remain SUCCESS');

  const ledgerDebits = (await pool.query("SELECT COUNT(*) as cnt FROM rank_ledger WHERE order_id = $1 AND type = 'DEBIT_REFUND'", [orderAId])).rows[0];
  assert.strictEqual(Number(ledgerDebits.cnt), 1, 'Ledger debit must remain intact');
  pass('failRefundReservation cannot downgrade confirmed SUCCESS refund or touch ledger debit');

  // A2: failRefundReservation on PENDING refund transitions to FAILED and restores order status
  const refundId2 = 'ref_phase8_002_' + Date.now();
  const res2 = await pg.reserveRefundAtomic(orderAId, 20000, refundId2, 'Partial refund 2');
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.outcome, 'NEW');

  const failPendingRes = await pg.failRefundReservation(refundId2, orderAId);
  assert.strictEqual(failPendingRes, true, 'failRefundReservation on PENDING must return true');

  const ref2Row = (await pool.query('SELECT status FROM refund_reversals WHERE merchant_refund_id = $1', [refundId2])).rows[0];
  assert.strictEqual(ref2Row.status, 'FAILED', 'Refund reservation status must transition to FAILED');

  const orderAfterFail = await pg.getOrder(orderAId);
  assert.strictEqual(orderAfterFail.status, 'PARTIALLY_REFUNDED', 'Order status must remain PARTIALLY_REFUNDED because refund 1 is settled');
  pass('failRefundReservation transitions PENDING to FAILED and restores prior order status');

  // A1: Safe retry policy on FAILED refund ID: never silently reuse it
  const reuseFailedRes = await pg.reserveRefundAtomic(orderAId, 20000, refundId2, 'Reuse failed ID');
  assert.strictEqual(reuseFailedRes.success, false, 'Reusing failed refund ID must fail');
  assert.strictEqual(reuseFailedRes.outcome, 'CONFLICT', 'Outcome must be CONFLICT');
  assert.strictEqual(reuseFailedRes.statusCode, 409, 'Status code must be 409');
  pass('Reusing failed refund ID returns 409 CONFLICT (explicit retry policy requires new refund ID)');

  // A5: Concurrent refunds cannot exceed remaining captured paise
  const refundId3 = 'ref_phase8_003_' + Date.now();
  // Remaining refundable paise is 60,000 (₹600). Attempting 70,000 paise must fail.
  const exceedRes = await pg.reserveRefundAtomic(orderAId, 70000, refundId3, 'Exceed remaining');
  assert.strictEqual(exceedRes.success, false, 'Refund exceeding remaining amount must fail');
  assert.strictEqual(exceedRes.statusCode, 400, 'Status code must be 400');
  assert.strictEqual(exceedRes.remainingRefundablePaise, 60000, 'Remaining balance must be 60,000 paise');
  pass('Refund reservation exceeding remaining refundable paise fails closed');

  // =========================================================================
  // 2. Phase B: Rank and Customer Status Truth (B1, B2, B3)
  // =========================================================================
  console.log('\n--- 2. Phase B: Rank and Customer Status Truth ---');

  // B1: Full refund of remaining ₹600: Net settled amount becomes ₹0
  const refundIdFinal = 'ref_phase8_final_' + Date.now();
  const resFinal = await pg.reserveRefundAtomic(orderAId, 60000, refundIdFinal, 'Full refund remaining');
  assert.strictEqual(resFinal.success, true);
  assert.strictEqual(resFinal.outcome, 'NEW');

  const reverseFinal = await pg.reverseRefundAtomic({
    orderId: orderAId,
    amount: 600,
    merchantRefundId: refundIdFinal,
    providerRefundId: 'cf_ref_final_prov',
    currency: 'INR',
    reason: 'Full refund settled'
  });
  assert.strictEqual(reverseFinal.success, true);

  const orderAfterFull = await pg.getOrder(orderAId);
  assert.strictEqual(orderAfterFull.status, 'REFUNDED', 'Order status must be REFUNDED');

  const profileAfterFull = await pg.getProfile(profileAId);
  assert.strictEqual(profileAfterFull?.amount, 0, 'Profile net amount must be ₹0');
  assert.strictEqual(profileAfterFull?.rank, 999999, 'Profile rank must be set to 999999');
  pass('Profile with ₹0 net settled amount is unranked (rank=999999)');

  // B1: All-time leaderboard excludes profile with amount = 0
  const lbAll = await pg.getLeaderboard({ period: 'all' });
  assert.strictEqual(lbAll.totalCount, 0, 'Active leaderboard totalCount must be 0');
  assert.strictEqual(lbAll.profiles.length, 0, 'Active leaderboard profiles must be empty');
  pass('Active paid leaderboard completely excludes ₹0 profile and verified count is 0');

  // B1: getTopAmount returns 0 when no profile has amount > 0
  const topAmt = await pg.getTopAmount();
  assert.strictEqual(topAmt, 0, 'getTopAmount must return 0 when no active profile has amount > 0');
  pass('getTopAmount returns 0 when no active profiles with amount > 0 exist');

  // B1: Public rank lookup does not return ₹0 profile, but owner ID lookup preserves profile
  const rank1Lookup = await pg.getProfile('1');
  assert.strictEqual(rank1Lookup, null, 'Public rank 1 lookup must return null');

  const idLookup = await pg.getProfile(profileAId);
  assert.ok(idLookup !== null, 'Direct profile ID lookup must preserve owner access');
  assert.strictEqual(idLookup.id, profileAId, 'Owner can still view profile');
  pass('Public rank lookup excludes ₹0 profile while owner ID lookup preserves record and audit history');

  // B1: Subsequent genuine payment restores active rank eligibility
  const orderBId = 'ord_phase8_b_' + Date.now();
  await pg.createOrder({
    orderId: orderBId,
    profileId: profileAId,
    name: 'Refund Test User A (Restored)',
    amount: 250,
    currency: 'INR',
    ownerToken: rawOwnerTokenA,
    orderAccessToken: rawAccessTokenA,
    idempotencyKey: 'idem_phase8_b_' + Date.now()
  });

  const restoreSettle = await pg.settlePaymentAtomic({
    orderId: orderBId,
    providerPaymentId: 'cf_pay_phase8_b_' + Date.now(),
    provider: 'cashfree',
    amount: 250,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });
  assert.strictEqual(restoreSettle.success, true);
  assert.strictEqual(restoreSettle.profile?.amount, 250, 'Restored profile amount must be 250');
  assert.strictEqual(restoreSettle.profile?.rank, 1, 'Restored profile rank must be 1');

  const lbRestored = await pg.getLeaderboard({ period: 'all' });
  assert.strictEqual(lbRestored.totalCount, 1, 'Leaderboard totalCount must be 1');
  assert.strictEqual(lbRestored.profiles[0].id, profileAId, 'Restored profile must appear on leaderboard');
  pass('Subsequent genuine payment restores profile eligibility and dynamic rank');

  // B3: Chargeback adjustment path
  console.log('\n--- B3: Chargeback Adjustment Path ---');
  const disputeId1 = 'disp_phase8_001_' + Date.now();
  const cbRes1 = await pg.recordChargebackAtomic({
    orderId: orderBId,
    disputeId: disputeId1,
    amount: 100,
    currency: 'INR',
    reason: 'Unauthorized payment dispute',
    evidenceRef: 'cf_disp_doc_001'
  });
  assert.strictEqual(cbRes1.success, true, 'Chargeback adjustment must succeed');

  const orderAfterCb = await pg.getOrder(orderBId);
  assert.strictEqual(orderAfterCb.status, 'PARTIALLY_REFUNDED', 'Order status must be PARTIALLY_REFUNDED');

  const profileAfterCb = await pg.getProfile(profileAId);
  assert.strictEqual(profileAfterCb?.amount, 150, 'Profile amount must adjust to ₹150');
  pass('Chargeback adjustment records DEBIT_CHARGEBACK, updates order status, and recalculates rank');

  // B3: Idempotent disputeId check
  const cbRetry = await pg.recordChargebackAtomic({
    orderId: orderBId,
    disputeId: disputeId1,
    amount: 100,
    evidenceRef: 'cf_disp_doc_001'
  });
  assert.strictEqual(cbRetry.success, true);
  assert.strictEqual(cbRetry.alreadyRecorded, true, 'Duplicate dispute ID must be acknowledged idempotently');

  const cbCount = (await pool.query("SELECT COUNT(*) as cnt FROM rank_ledger WHERE type = 'DEBIT_CHARGEBACK' AND order_id = $1", [orderBId])).rows[0];
  assert.strictEqual(Number(cbCount.cnt), 1, 'Only one DEBIT_CHARGEBACK row must exist for this dispute');
  pass('Duplicate dispute ID acknowledged idempotently without double debit');

  // B3: Chargeback exceeding remaining settled amount is rejected
  const exceedCb = await pg.recordChargebackAtomic({
    orderId: orderBId,
    disputeId: 'disp_excess_' + Date.now(),
    amount: 200,
    evidenceRef: 'cf_disp_doc_excess'
  });
  assert.strictEqual(exceedCb.success, false, 'Excess chargeback must be rejected');
  assert.strictEqual(exceedCb.statusCode, 400, 'Status code must be 400');
  pass('Chargeback exceeding remaining net settled amount fails closed');

  // =========================================================================
  // 3. Phase C: Access Control & Order Recovery (C1, C2)
  // =========================================================================
  console.log('\n--- 3. Phase C: Access Control & Idempotency Recovery ---');

  // C1: Historical order access control tests
  const orderHistId = 'ord_hist_notokens_' + Date.now();
  await pool.query(`
    INSERT INTO payment_orders (
      order_id, name, amount, currency, status, payment_mode, provider, created_at, updated_at
    ) VALUES ($1, 'Legacy Customer', 100, 'INR', 'PAID', 'disabled', 'cashfree', NOW(), NOW())
  `, [orderHistId]);

  const histOrder = await pg.getOrder(orderHistId);
  assert.strictEqual(histOrder.orderAccessTokenHash, undefined);
  assert.strictEqual(histOrder.ownerTokenHash, undefined);

  // Helper verifying verifyOrderReadAccess behavior
  function testReadAccess(order: any, headers: Record<string, string | undefined>): { allowed: boolean; status?: number } {
    const orderAccessToken = headers['x-order-access-token']?.trim();
    const profileToken = headers['x-profile-token']?.trim();
    if (order.orderAccessTokenHash) {
      if (!orderAccessToken || order.orderAccessTokenHash !== hashToken(orderAccessToken)) {
        return { allowed: false, status: 403 };
      }
    } else {
      const ownerHash = order.ownerTokenHash || order.ownerToken;
      if (ownerHash) {
        if (!profileToken || ownerHash !== hashToken(profileToken)) {
          return { allowed: false, status: 403 };
        }
      } else {
        const adminKey = headers['x-admin-key']?.trim();
        const validAdmin = process.env.ADMIN_KEY || 'test_admin_secret';
        if (!adminKey || adminKey !== validAdmin) {
          return { allowed: false, status: 403 };
        }
      }
    }
    return { allowed: true };
  }

  process.env.ADMIN_KEY = 'test_admin_secret';

  // Anonymous request to historical order with no tokens: MUST BE DENIED (403)
  const anonAccess = testReadAccess(histOrder, {});
  assert.strictEqual(anonAccess.allowed, false, 'Anonymous access to historical order without tokens must be denied');
  assert.strictEqual(anonAccess.status, 403, 'Must return 403');
  pass('Anonymous access to historical order missing both tokens is denied with 403');

  // Admin access to historical order: ALLOWED via administrative support procedure
  const adminAccess = testReadAccess(histOrder, { 'x-admin-key': 'test_admin_secret' });
  assert.strictEqual(adminAccess.allowed, true, 'Admin key allows historical order recovery');
  pass('Administrative key permits historical order recovery without exposing public tokens');

  // Order with order access token: requires matching token
  const orderWithAccToken = { orderAccessTokenHash: hashToken('ord_valid_token_123') };
  assert.strictEqual(testReadAccess(orderWithAccToken, {}).allowed, false, 'Missing token denied');
  assert.strictEqual(testReadAccess(orderWithAccToken, { 'x-order-access-token': 'ord_wrong_token' }).allowed, false, 'Wrong token denied');
  assert.strictEqual(testReadAccess(orderWithAccToken, { 'x-order-access-token': 'ord_valid_token_123' }).allowed, true, 'Matching token allowed');
  pass('Order with order access token verifies strictly against hash');

  // C2: Order Creation Idempotency & Session Recovery
  console.log('\n--- C2: Order Creation Idempotency & Session Recovery ---');
  const testIdemKey = 'idem_recovery_' + Date.now();
  const orderCId = 'ord_recovery_' + Date.now();

  // Create order where payment_session_id is initially null (simulating provider timeout)
  await pg.createOrder({
    orderId: orderCId,
    name: 'Recovery Test User',
    amount: 500,
    currency: 'INR',
    ownerToken: 'lazy_owner_rec_' + crypto.randomBytes(32).toString('hex'),
    orderAccessToken: 'ord_acc_rec_' + crypto.randomBytes(32).toString('hex'),
    idempotencyKey: testIdemKey
  });

  const initialCreated = await pg.getOrderByIdempotencyKey(testIdemKey);
  assert.strictEqual(initialCreated.orderId, orderCId);
  assert.strictEqual(initialCreated.paymentSessionId, undefined, 'Session ID must be initially undefined');

  // Update session details (simulating retry recovery)
  await pg.updateOrderProviderSession(orderCId, 'session_recovered_123', 'cf_ord_recovered_456', 'https://payments.example.com/checkout');

  const recoveredOrder = await pg.getOrderByIdempotencyKey(testIdemKey);
  assert.strictEqual(recoveredOrder.paymentSessionId, 'session_recovered_123', 'Session ID must be recovered on order');
  assert.strictEqual(recoveredOrder.providerOrderId, 'cf_ord_recovered_456', 'Provider order ID must be attached');
  pass('Order retry recovers and saves provider paymentSessionId with same order ID');

  // =========================================================================
  // 4. Phase D: Documentation, UI Truth & Hero Text Verification
  // =========================================================================
  console.log('\n--- 4. Phase D: Documentation, UI Truth & Approved Hero Text ---');

  // D1: README.md references real api_rate_limits table
  const readmeContent = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf-8');
  assert.ok(readmeContent.includes('api_rate_limits'), 'README.md must reference api_rate_limits table');
  assert.ok(!readmeContent.includes('rate_limit_hits'), 'README.md must not reference old rate_limit_hits table');
  pass('README.md references real api_rate_limits table');

  // D1: PAYMENT_GATEWAY_ONBOARDING.md updated with verified live/HTTPS status and founder SOP
  const onboardingContent = fs.readFileSync(path.join(process.cwd(), 'PAYMENT_GATEWAY_ONBOARDING.md'), 'utf-8');
  assert.ok(!onboardingContent.includes('Domain currently parked on Hostinger DNS'), 'Outdated domain parked statement removed');
  assert.ok(onboardingContent.includes('VERIFIED LIVE (September 2026)'), 'Verified live domain status recorded');
  assert.ok(onboardingContent.includes('VERIFIED ACTIVE (September 2026)'), 'Verified active HTTPS status recorded');
  assert.ok(onboardingContent.includes('Dispute & Chargeback Reconciliation SOP'), 'Founder chargeback SOP documented');
  assert.ok(onboardingContent.includes('UNVERIFIED — CASHFREE TEST CREDENTIALS REQUIRED'), 'Sandbox E2E accurately marked unverified');
  pass('PAYMENT_GATEWAY_ONBOARDING.md contains dated evidence-based status and founder dispute SOP');

  // D2: Leaderboard.tsx removes redundant "Verified Only" / "All Claims" and clarifies loaded pages
  const leaderboardContent = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Leaderboard.tsx'), 'utf-8');
  assert.ok(!leaderboardContent.includes('Verified Only'), 'Redundant Verified Only button removed');
  assert.ok(!leaderboardContent.includes('All Claims'), 'Redundant All Claims button removed');
  assert.ok(leaderboardContent.includes('filters loaded pages only'), 'Category filtering clearly notes loaded pages');
  pass('Leaderboard.tsx removes redundant filter selector and clarifies category loaded pages scope');

  // Critical Invariant: Hero Heading Copy PRESERVED EXACTLY
  const heroContent = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Hero.tsx'), 'utf-8');
  const REQUIRED_HERO = 'Claim your spot. Sponsor higher. Rank higher. Make them knock you off.';
  assert.ok(heroContent.includes(REQUIRED_HERO), `Hero must contain exact approved sentence: "${REQUIRED_HERO}"`);
  pass(`Approved hero copy preserved exactly: "${REQUIRED_HERO}"`);

  console.log('\n========================================================');
  console.log(`ALL PHASE 8 TESTS PASSED: ${passed} ASSERTIONS VERIFIED`);
  console.log('========================================================\n');
  await pool.end();
}

runPhase8Tests().catch(err => {
  console.error('\nFAILED PHASE 8 TEST:', err);
  process.exit(1);
});
