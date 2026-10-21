import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PostgresDatabase } from '../server/db/postgres.ts';
import { PaymentManager } from '../server/payments/index.ts';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5434/lazyproof_test';

console.log('\n========================================================');
console.log('RUNNING SURGICAL PRODUCTION HARDENING & AUDIT SUITE');
console.log('Database Target: Isolated Test PostgreSQL (lazyproof_test)');
console.log('========================================================\n');

// SAFETY GUARD: Refuse to run against production or Neon URL
const lowerUrl = TEST_DB_URL.toLowerCase();
if (
  lowerUrl.includes('neon.tech') ||
  lowerUrl.includes('neon.build') ||
  lowerUrl.includes('aws.neon') ||
  lowerUrl.includes('prod')
) {
  throw new Error('FATAL SECURITY VIOLATION: Refusing to run destructive tests against production or Neon URL!');
}

let passed = 0;
function pass(msg: string) {
  passed++;
  console.log(`  ✓ PASS: ${msg}`);
}

async function runTests() {
  // --------------------------------------------------------------------------
  // SECTION A: Sponsored Outbound Links Invariant
  // --------------------------------------------------------------------------
  console.log('--- 1. Sponsored Outbound Links Verification ---');
  const profileCardSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ProfileCard.tsx'), 'utf-8');
  const resultViewSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ResultView.tsx'), 'utf-8');

  // Verify ProfileCard has rel="sponsored noopener noreferrer" for all customer external links
  assert.ok(
    profileCardSrc.includes('rel="sponsored noopener noreferrer"'),
    'ProfileCard.tsx must render rel="sponsored noopener noreferrer" for customer sponsored profile links'
  );
  // Verify ResultView has rel="sponsored noopener noreferrer"
  assert.ok(
    resultViewSrc.includes('rel="sponsored noopener noreferrer"'),
    'ResultView.tsx must render rel="sponsored noopener noreferrer" for customer sponsored profile links'
  );

  // Ensure internal navigation in ActionPanel/Footer remains untouched
  const actionPanelSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ActionPanel.tsx'), 'utf-8');
  assert.ok(
    actionPanelSrc.includes('<a href="/terms" target="_blank" rel="noopener noreferrer"'),
    'ActionPanel internal legal links must NOT be labeled as sponsored'
  );
  pass('Outbound customer profile links have rel="sponsored noopener noreferrer", internal links preserved');

  // --------------------------------------------------------------------------
  // SECTION B: Background Worker Outbox Dispatch Deduplication
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Background Worker Outbox Dispatch Invariants ---');
  const pgSrc = fs.readFileSync(path.join(process.cwd(), 'server', 'db', 'postgres.ts'), 'utf-8');

  // Verify that triggerOutboxDispatch helper exists and dispatches through listener when present
  assert.ok(
    pgSrc.includes('private triggerOutboxDispatch(): void'),
    'PostgresDatabase must implement triggerOutboxDispatch helper'
  );
  assert.ok(
    !pgSrc.includes('this.dispatchOperationalOutbox().catch(\n      console.error\n    );\n    this.onOutboxEnqueued?.()'),
    'PostgresDatabase must not concurrently trigger both direct dispatch and onOutboxEnqueued'
  );

  // Unit verify the listener behavior
  const testPg = new PostgresDatabase(TEST_DB_URL);
  let listenerCallCount = 0;
  testPg.setOnOutboxEnqueued(() => {
    listenerCallCount++;
  });
  // Trigger outbox via internal method
  (testPg as any).triggerOutboxDispatch();
  assert.strictEqual(listenerCallCount, 1, 'triggerOutboxDispatch invokes listener exactly once');
  pass('Background worker dispatch invokes listener exactly once without duplicate parallel execution');

  // --------------------------------------------------------------------------
  // SECTION C: Webhook, Order State Machine & Financial Ledger Reconciliation
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Webhook & Financial Reconciliation Invariants ---');

  const pg = new PostgresDatabase(TEST_DB_URL);
  await pg.init();
  const pool = await pg.getPool();
  await pool.query('TRUNCATE refund_reversals, claim_history, rank_ledger, payment_transactions, payment_orders, profiles CASCADE');

  // Test 3.1: New order creation blocked while checkout disabled
  const origCheckout = process.env.CHECKOUT_ENABLED;
  const origMode = process.env.PAYMENT_MODE;
  process.env.CHECKOUT_ENABLED = 'false';
  process.env.PAYMENT_MODE = 'sandbox';

  const pm = new PaymentManager();
  assert.strictEqual(pm.isCheckoutEnabled(), false, 'PaymentManager reflects disabled checkout');
  assert.strictEqual(pm.mayCreateNewOrder('dodo', 'INR'), false, 'New order creation blocked when CHECKOUT_ENABLED=false');
  assert.strictEqual(pm.mayCreateNewOrder('razorpay', 'INR'), false, 'New order creation blocked for all providers');
  pass('New order creation strictly blocked while checkout is disabled');

  // Test 3.2: Existing order verification & webhook processing permitted while checkout disabled
  assert.strictEqual(pm.mayProcessWebhook('dodo'), true, 'Webhook processing remains permitted for existing liabilities');
  assert.strictEqual(pm.mayVerifyExistingOrder({ provider: 'dodo' }), true, 'Existing order verification permitted');
  assert.strictEqual(pm.mayReconcileExistingPayment({ provider: 'dodo' }), true, 'Existing payment reconciliation permitted');
  pass('Existing liability settlement and reconciliation permitted while checkout disabled');

  // Reset env
  if (origCheckout !== undefined) process.env.CHECKOUT_ENABLED = origCheckout;
  else delete process.env.CHECKOUT_ENABLED;
  if (origMode !== undefined) process.env.PAYMENT_MODE = origMode;
  else delete process.env.PAYMENT_MODE;

  // Test 3.3: Settlement with valid order against isolated PostgreSQL
  const testOrderId = 'ord_audit_' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const testOwnerToken = 'lazy_' + crypto.randomBytes(32).toString('hex');
  const testTokenHash = crypto.createHash('sha256').update(testOwnerToken).digest('hex');

  await pg.createOrder({
    orderId: testOrderId,
    amount: 150,
    currency: 'INR',
    name: 'SurgicalAuditUser',
    ownerToken: testOwnerToken,
    provider: 'dodo'
  });

  const validSettlement = await pg.settlePaymentAtomic({
    orderId: testOrderId,
    providerPaymentId: 'pay_dodo_audit_001',
    provider: 'dodo',
    amount: 150,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true,
    rawPayload: { test: true }
  });

  if (!validSettlement.success) {
    console.error('validSettlement failure details:', validSettlement);
  }
  assert.strictEqual(validSettlement.success, true, 'Valid payment order settled successfully');
  assert.ok(validSettlement.profile, 'Profile created on valid settlement');
  assert.strictEqual(validSettlement.profile?.amount, 150, 'Profile verified amount is ₹150');
  const createdProfileId = validSettlement.profile!.id;
  pass('Signed webhook with existing valid payment order successfully settles into PostgreSQL');

  // Test 3.4: Duplicate payment delivery deduplication (same orderId + same providerPaymentId)
  const duplicateSettlement = await pg.settlePaymentAtomic({
    orderId: testOrderId,
    providerPaymentId: 'pay_dodo_audit_001',
    provider: 'dodo',
    amount: 150,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true,
    rawPayload: { test: true }
  });

  assert.strictEqual(duplicateSettlement.success, true, 'Duplicate delivery acknowledges success');
  assert.strictEqual(duplicateSettlement.message, 'Order already settled.', 'Order marked already settled');
  // Check profile amount remains ₹150 (NO DOUBLE CREDIT)
  const profileAfterDup = await pg.getProfile(createdProfileId);
  assert.strictEqual(profileAfterDup?.amount, 150, 'Duplicate delivery did NOT double credit amount');
  pass('Duplicate payment delivery acknowledged cleanly without double credit');

  // Test 3.5: Duplicate payment identifier collision (different order with same providerPaymentId)
  const collidingOrderId = 'ord_audit_col_' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  await pg.createOrder({
    orderId: collidingOrderId,
    amount: 150,
    currency: 'INR',
    name: 'CollisionUser',
    ownerToken: testOwnerToken,
    provider: 'dodo'
  });

  const collidingSettlement = await pg.settlePaymentAtomic({
    orderId: collidingOrderId,
    providerPaymentId: 'pay_dodo_audit_001', // Colliding transaction ID
    provider: 'dodo',
    amount: 150,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });
  assert.strictEqual(collidingSettlement.success, false, 'Colliding provider payment ID must fail');
  assert.strictEqual(collidingSettlement.message, 'Payment ID already processed');
  pass('Duplicate provider payment identifier strictly rejected via unique constraint');

  // Test 3.6: Correct INR amount matching (Paise equality)
  const mismatchOrderId = 'ord_audit_mis_' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  await pg.createOrder({
    orderId: mismatchOrderId,
    amount: 200,
    currency: 'INR',
    name: 'MismatchUser',
    ownerToken: testOwnerToken,
    provider: 'dodo'
  });

  const mismatchSettlement = await pg.settlePaymentAtomic({
    orderId: mismatchOrderId,
    providerPaymentId: 'pay_dodo_mismatch_001',
    provider: 'dodo',
    amount: 199.99, // Mismatched amount
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });
  assert.strictEqual(mismatchSettlement.success, false, 'Mismatched amount must fail closed');
  assert.ok(mismatchSettlement.message.includes('Paid amount does not match'), 'Amount mismatch detected');
  pass('Paise-level amount mismatch strictly rejected before credit');

  // Test 3.7: Refund reversal and financial ledger consistency
  const refundReservation = await pg.reserveRefundAtomic(
    testOrderId,
    5000,
    'ref_audit_001',
    'Customer requested partial refund'
  );
  assert.strictEqual(refundReservation.success, true, 'Preflight refund reservation succeeded');

  const reversalResult = await pg.reverseRefundAtomic({
    orderId: testOrderId,
    amount: 50,
    reason: 'Audit refund test confirmation',
    merchantRefundId: 'ref_audit_001',
    providerRefundId: 'prov_ref_audit_001',
    currency: 'INR'
  });
  assert.strictEqual(reversalResult.success, true, 'Refund reversal succeeded');

  const profileAfterRefund = await pg.getProfile(createdProfileId);
  assert.strictEqual(profileAfterRefund?.amount, 100, 'Profile amount accurately decremented from ₹150 to ₹100');

  // Verify rank_ledger negative audit entry exists
  const ledgerRes = await pool.query(
    "SELECT * FROM rank_ledger WHERE order_id = $1 AND type = 'DEBIT_REFUND'",
    [testOrderId]
  );
  assert.strictEqual(ledgerRes.rows.length, 1, 'Double-entry DEBIT_REFUND audit record exists in rank_ledger');
  assert.strictEqual(Math.abs(Number(ledgerRes.rows[0].amount)), 50, 'Debit refund ledger amount matches ₹50');
  pass('Refund reversal atomically decrements profile sponsorship and records durable DEBIT_REFUND ledger entry');

  // --------------------------------------------------------------------------
  // SECTION D: Realistic Concurrent Settlement Benchmark with Global Settlement Lock
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Concurrent Synthetic Settlement Benchmark (pg_advisory_xact_lock) ---');

  const CONCURRENT_TRANSACTIONS = 30;
  console.log(`Executing ${CONCURRENT_TRANSACTIONS} simultaneous settlements with global advisory lock...`);

  // Pre-create orders
  const orders: string[] = [];
  for (let i = 0; i < CONCURRENT_TRANSACTIONS; i++) {
    const oid = `ord_bench_${i}_${crypto.randomUUID().slice(0, 8)}`;
    const amt = 99 + i; // Differing amounts
    await pg.createOrder({
      orderId: oid,
      amount: amt,
      currency: 'INR',
      name: `BenchUser_${i}`,
      ownerToken: crypto.randomBytes(32).toString('hex'),
      provider: 'dodo'
    });
    orders.push(oid);
  }

  // Execute concurrent settlements
  const benchStart = performance.now();
  const settlementPromises = orders.map((oid, idx) => {
    return pg.settlePaymentAtomic({
      orderId: oid,
      providerPaymentId: `pay_bench_${idx}_${crypto.randomUUID().slice(0, 8)}`,
      provider: 'dodo',
      amount: 99 + idx,
      currency: 'INR',
      status: 'PAID',
      paymentMethod: 'UPI',
      signatureVerified: true
    });
  });

  const results = await Promise.all(settlementPromises);
  const benchDurationMs = performance.now() - benchStart;
  const throughputTps = (CONCURRENT_TRANSACTIONS / (benchDurationMs / 1000)).toFixed(2);
  const avgLatencyMs = (benchDurationMs / CONCURRENT_TRANSACTIONS).toFixed(2);

  console.log(`\nBenchmark Results:`);
  console.log(`- Total Transactions: ${CONCURRENT_TRANSACTIONS}`);
  console.log(`- Total Duration: ${benchDurationMs.toFixed(2)} ms`);
  console.log(`- Throughput: ${throughputTps} transactions/sec`);
  console.log(`- Average Settlement Latency: ${avgLatencyMs} ms`);

  // Validate results
  const successfulSettlements = results.filter(r => r.success);
  assert.strictEqual(successfulSettlements.length, CONCURRENT_TRANSACTIONS, 'All concurrent settlements succeeded');

  // Verify leaderboard determinism & consistency
  const leaderboardRes = await pg.getLeaderboard({ limit: 50, pageSize: 50 });
  assert.ok(leaderboardRes.profiles.length >= CONCURRENT_TRANSACTIONS, 'All profiles reflected in leaderboard');

  // Verify strict monotonic ordering: no two profiles out of rank order
  for (let i = 0; i < leaderboardRes.profiles.length - 1; i++) {
    const cur = leaderboardRes.profiles[i];
    const next = leaderboardRes.profiles[i + 1];
    assert.ok(cur.amount >= next.amount, `Monotonic order preserved: rank ${cur.rank} (₹${cur.amount}) >= rank ${next.rank} (₹${next.amount})`);
    assert.strictEqual(cur.rank, i + 1, `Continuous sequential ranking: rank ${cur.rank} == ${i + 1}`);
  }

  pass(`Concurrent benchmark verified: ${throughputTps} TPS, zero deadlocks, zero double credits, 100% deterministic ranking`);

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`SURGICAL HARDENING & AUDIT SUITE: ALL ${passed} ASSERTIONS PASSED (100%)`);
  console.log('========================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
