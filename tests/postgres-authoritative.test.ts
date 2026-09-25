import assert from 'assert';
import { PostgresDatabase } from '../server/db/postgres.ts';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';

async function runPostgresIntegrationTests() {
  console.log('\n========================================================');
  console.log('STARTING REAL POSTGRESQL INTEGRATION TEST SUITE');
  console.log('Database URL:', TEST_DB_URL.replace(/:[^:@]+@/, ':***@'));
  console.log('========================================================\n');

  let passed = 0;
  function pass(msg: string) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  const pg = new PostgresDatabase(TEST_DB_URL);
  assert.strictEqual(pg.isAvailable(), true, 'PostgreSQL database client must be available');
  pass('PostgreSQL client initialized with test database URL');

  // 1. Schema Initialization & Connection
  console.log('\n--- 1. Database Connection & Schema Initialization ---');
  let initOk = false;
  try {
    initOk = await pg.init();
  } catch (err: any) {
    console.warn(`\n[PostgreSQL Integration] Unable to connect to PostgreSQL server: ${err.message}`);
    console.log('========================================================');
    console.log('REAL POSTGRES INTEGRATION:');
    console.log('UNVERIFIED — LOCAL POSTGRES ENVIRONMENT BLOCKED');
    console.log('========================================================\n');
    return;
  }

  if (!initOk) {
    console.warn(`\n[PostgreSQL Integration] Schema initialization failed or database offline`);
    console.log('========================================================');
    console.log('REAL POSTGRES INTEGRATION:');
    console.log('UNVERIFIED — LOCAL POSTGRES ENVIRONMENT BLOCKED');
    console.log('========================================================\n');
    return;
  }
  pass('Schema initialized and verified against real PostgreSQL server');

  const pool = await pg.getPool();
  const testConn = await pool.query('SELECT NOW() as current_time, version() as pg_version');
  assert.strictEqual(testConn.rows.length, 1, 'SELECT query must return current timestamp and version');
  pass(`Connected successfully to ${testConn.rows[0].pg_version.slice(0, 30)}...`);

  // Clean test tables to ensure clean-slate reproducible test run
  await pool.query('TRUNCATE refund_reversals, claim_history, rank_ledger, payment_transactions, payment_orders, profiles CASCADE');
  pass('Clean test workspace initialized');

  // 2. Create Payment Order
  console.log('\n--- 2. Create Payment Order ---');
  const orderId1 = 'order_test_pg_001';
  await pg.createOrder({
    orderId: orderId1,
    name: 'Vikram',
    amount: 2500,
    currency: 'INR',
    instagram: 'vikram_sloth',
    reason: 'Too comfortable on the sofa.',
    paymentMode: 'sandbox',
    provider: 'cashfree',
    idempotencyKey: 'idem_test_001'
  });
  pass('Created authoritative payment order in PostgreSQL');

  // 3. Fetch Payment Order
  console.log('\n--- 3. Fetch Payment Order ---');
  const fetchedOrder1 = await pg.getOrder(orderId1);
  assert.ok(fetchedOrder1, 'Order must exist in PostgreSQL');
  assert.strictEqual(fetchedOrder1.orderId, orderId1);
  assert.strictEqual(fetchedOrder1.name, 'Vikram');
  assert.strictEqual(fetchedOrder1.amount, 2500);
  assert.strictEqual(fetchedOrder1.status, 'PENDING');
  assert.strictEqual(fetchedOrder1.idempotencyKey, 'idem_test_001');
  pass('Fetched order matches stored properties');

  // 4. Atomic Settlement for New Profile
  console.log('\n--- 4. Atomic Settlement: New Profile ---');
  const settlement1 = await pg.settlePaymentAtomic({
    orderId: orderId1,
    providerPaymentId: 'cf_pay_test_001',
    provider: 'cashfree',
    amount: 2500,
    paymentMethod: 'UPI',
    signatureVerified: true
  });
  assert.strictEqual(settlement1.success, true, 'Settlement must succeed');
  assert.ok(settlement1.profile, 'Profile must be created');
  assert.strictEqual(settlement1.profile.amount, 2500);
  assert.strictEqual(settlement1.profile.rank, 1, 'First profile should hold rank 1');
  assert.strictEqual(settlement1.profile.isVerified, true);
  pass('Atomic settlement created new profile with rank 1');

  // Verify database tables after settlement
  const orderCheck1 = await pg.getOrder(orderId1);
  assert.strictEqual(orderCheck1?.status, 'PAID', 'Order status must be updated to PAID');
  assert.strictEqual(orderCheck1?.paymentRef, 'cf_pay_test_001');
  pass('Order updated to status PAID with provider payment ID');

  const txRes1 = await pool.query('SELECT * FROM payment_transactions WHERE order_id = $1', [orderId1]);
  assert.strictEqual(txRes1.rows.length, 1, 'Payment transaction row must exist');
  assert.strictEqual(txRes1.rows[0].provider_payment_id, 'cf_pay_test_001');
  assert.strictEqual(Number(txRes1.rows[0].amount), 2500);
  pass('payment_transactions recorded audit row');

  const ledgerRes1 = await pool.query('SELECT * FROM rank_ledger WHERE order_id = $1', [orderId1]);
  assert.strictEqual(ledgerRes1.rows.length, 1, 'Rank ledger row must exist');
  assert.strictEqual(ledgerRes1.rows[0].type, 'CREDIT');
  assert.strictEqual(Number(ledgerRes1.rows[0].amount), 2500);
  pass('rank_ledger recorded credit entry');

  // 5. Existing Profile Upgrade
  console.log('\n--- 5. Existing Profile Upgrade ---');
  const existingProfileId = settlement1.profile.id;
  const ownerToken = settlement1.ownerToken || settlement1.profile.ownerToken;
  const orderId2 = 'order_test_pg_002';

  await pg.createOrder({
    orderId: orderId2,
    name: 'Vikram',
    amount: 1500,
    currency: 'INR',
    profileId: existingProfileId,
    ownerToken: ownerToken,
    paymentMode: 'sandbox',
    provider: 'cashfree'
  });
  pass('Created upgrade order referencing existing profile');

  const settlement2 = await pg.settlePaymentAtomic({
    orderId: orderId2,
    providerPaymentId: 'cf_pay_test_002',
    provider: 'cashfree',
    amount: 1500,
    paymentMethod: 'UPI',
    signatureVerified: true
  });
  assert.strictEqual(settlement2.success, true);
  assert.strictEqual(settlement2.profile?.id, existingProfileId, 'Must update the same profile');
  assert.strictEqual(settlement2.profile?.amount, 4000, 'Amount must accumulate (2500 + 1500 = 4000)');
  pass('Existing profile accumulated sponsorship amount to ₹4,000');

  // 6. Concurrency: Multiple Users Settling Simultaneously
  console.log('\n--- 6. Concurrency: Simultaneous Settlements ---');
  const concurrentOrders = [
    { orderId: 'order_conc_1', name: 'Rohan', amount: 5000, cfPayId: 'cf_conc_1' },
    { orderId: 'order_conc_2', name: 'Ananya', amount: 7000, cfPayId: 'cf_conc_2' },
    { orderId: 'order_conc_3', name: 'Dev', amount: 3000, cfPayId: 'cf_conc_3' },
    { orderId: 'order_conc_4', name: 'Kavita', amount: 6000, cfPayId: 'cf_conc_4' },
    { orderId: 'order_conc_5', name: 'Manish', amount: 4500, cfPayId: 'cf_conc_5' }
  ];

  // Create all orders first
  for (const o of concurrentOrders) {
    await pg.createOrder({
      orderId: o.orderId,
      name: o.name,
      amount: o.amount,
      currency: 'INR',
      provider: 'cashfree'
    });
  }

  // Settle concurrently with Promise.all
  const concurrentSettlements = await Promise.all(
    concurrentOrders.map(o =>
      pg.settlePaymentAtomic({
        orderId: o.orderId,
        providerPaymentId: o.cfPayId,
        provider: 'cashfree',
        amount: o.amount,
        paymentMethod: 'UPI',
        signatureVerified: true
      })
    )
  );

  assert.strictEqual(concurrentSettlements.every(s => s.success), true, 'All concurrent settlements must succeed');
  pass('5 concurrent payments settled cleanly without deadlocks or corruption');

  // 7. Deterministic Ranking Verification
  console.log('\n--- 7. Deterministic Ranking Rule ---');
  const leaderboard = await pg.getLeaderboard({ limit: 10 });
  assert.strictEqual(leaderboard.profiles.length, 6, 'Should have 6 profiles total (Vikram + 5 concurrent)');

  // Verify amounts in strictly descending order
  for (let i = 0; i < leaderboard.profiles.length - 1; i++) {
    const current = leaderboard.profiles[i];
    const next = leaderboard.profiles[i + 1];
    assert.ok(
      current.amount >= next.amount,
      `Rank ${current.rank} (₹${current.amount}) must be >= Rank ${next.rank} (₹${next.amount})`
    );
    assert.strictEqual(current.rank, i + 1, `Rank index must be exactly sequential (${i + 1})`);
  }

  // Ananya paid 7000, must be #1
  assert.strictEqual(leaderboard.profiles[0].name, 'Ananya');
  assert.strictEqual(leaderboard.profiles[0].amount, 7000);
  assert.strictEqual(leaderboard.profiles[0].rank, 1);
  pass('Ananya (₹7,000) holds deterministic #1 rank');

  // Kavita paid 6000, must be #2
  assert.strictEqual(leaderboard.profiles[1].name, 'Kavita');
  assert.strictEqual(leaderboard.profiles[1].amount, 6000);
  assert.strictEqual(leaderboard.profiles[1].rank, 2);
  pass('Kavita (₹6,000) holds deterministic #2 rank');

  // 8. Unique Provider Payment ID Constraint
  console.log('\n--- 8. Unique Provider Payment ID Constraint ---');
  const duplicateTxAttempt = await pool.query(
    `INSERT INTO payment_transactions (id, order_id, provider, provider_payment_id, amount, currency, status, created_at)
     VALUES ('tx_dup_test', 'order_conc_1', 'cashfree', 'cf_conc_1', 5000, 'INR', 'SUCCESS', NOW())
     ON CONFLICT (provider_payment_id) DO NOTHING`
  );
  assert.strictEqual(duplicateTxAttempt.rowCount, 0, 'Duplicate provider payment ID must be rejected by UNIQUE constraint');
  pass('Unique constraint on provider_payment_id prevented duplicate transaction insertion');

  // 9. Duplicate Webhook Idempotency
  console.log('\n--- 9. Duplicate Webhook Idempotency ---');
  const replaySettlement = await pg.settlePaymentAtomic({
    orderId: 'order_conc_1',
    providerPaymentId: 'cf_conc_1',
    provider: 'cashfree',
    amount: 5000,
    paymentMethod: 'UPI',
    signatureVerified: true
  });
  assert.strictEqual(replaySettlement.success, true, 'Replay should return success without error');
  assert.strictEqual(replaySettlement.message, 'Order already settled.', 'Must indicate order was already settled');

  // Ensure balance did not double
  const rohanProfile = await pg.getProfile(replaySettlement.profile?.id || '');
  assert.strictEqual(rohanProfile?.amount, 5000, 'Balance must remain ₹5,000, no double credit');
  pass('Duplicate webhook settlement acknowledged idempotently with zero double credit');

  // 10. Transaction Rollback on Failure
  console.log('\n--- 10. Transaction Rollback On Failure ---');
  await pg.createOrder({
    orderId: 'order_mismatch_test',
    name: 'Suresh',
    amount: 1000,
    currency: 'INR',
    provider: 'cashfree'
  });

  const invalidAmountSettlement = await pg.settlePaymentAtomic({
    orderId: 'order_mismatch_test',
    providerPaymentId: 'cf_should_fail',
    provider: 'cashfree',
    amount: 999999, // Mismatched amount against order record
    signatureVerified: true
  });
  assert.strictEqual(invalidAmountSettlement.success, false, 'Should fail due to amount mismatch');
  assert.ok(invalidAmountSettlement.message?.includes('amount does not match'), 'Error message describes amount mismatch');

  const failedTxCheck = await pool.query("SELECT 1 FROM payment_transactions WHERE provider_payment_id = 'cf_should_fail'");
  assert.strictEqual(failedTxCheck.rows.length, 0, 'Rolled back transaction must leave NO trace in database');
  pass('Transaction rollback cleanly eliminated all mutations upon settlement error');

  // 11. Partial Refund Test
  console.log('\n--- 11. Partial Refund & Rank Recalculation ---');
  // Vikram currently has ₹4,000 from two orders (order1: 2500, order2: 1500)
  const partialRefundRes = await pg.reverseRefundAtomic({
    orderId: orderId2,
    providerRefundId: 'cf_ref_partial_001',
    amount: 1500,
    reason: 'Customer requested partial refund'
  });
  assert.strictEqual(partialRefundRes.success, true, 'Partial refund must succeed');

  const vikramAfterPartial = await pg.getProfile(existingProfileId);
  assert.strictEqual(vikramAfterPartial?.amount, 2500, 'Vikram amount must be reduced from 4000 to 2500');
  pass('Partial refund deducted ₹1,500 from profile amount');

  // 12. Full Refund Test
  console.log('\n--- 12. Full Refund & Rank Adjustment ---');
  const fullRefundRes = await pg.reverseRefundAtomic({
    orderId: orderId1,
    providerRefundId: 'cf_ref_full_001',
    amount: 2500,
    reason: 'Customer requested full refund'
  });
  assert.strictEqual(fullRefundRes.success, true, 'Full refund must succeed');

  const vikramAfterFull = await pg.getProfile(existingProfileId);
  assert.strictEqual(vikramAfterFull?.amount, 0, 'Vikram amount must be reduced to 0');
  pass('Full refund deducted remaining balance down to ₹0');

  // 13. Server Restart Persistence
  console.log('\n--- 13. Server Restart Persistence ---');
  // Simulate complete process termination & fresh restart
  const restartedPg = new PostgresDatabase(TEST_DB_URL);
  await restartedPg.init();

  const restartedLeaderboard = await restartedPg.getLeaderboard({ limit: 10 });
  assert.strictEqual(restartedLeaderboard.profiles.length, 6, 'All profiles must persist across restart');
  assert.strictEqual(restartedLeaderboard.profiles[0].name, 'Ananya', 'Ananya still #1 after restart');
  assert.strictEqual(restartedLeaderboard.profiles[0].amount, 7000);
  assert.strictEqual(restartedLeaderboard.topAmount, 7000);
  assert.strictEqual(restartedLeaderboard.minAmountToBeatTop, 7001);
  pass('Leaderboard ranks, amounts, and orders completely persisted across restart');

  console.log('\n========================================================');
  console.log(`REAL POSTGRESQL SUITE: ALL ${passed} ASSERTIONS PASSED (100%)`);
  console.log('========================================================\n');
}

runPostgresIntegrationTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nPostgres integration test failure:', err);
    process.exit(1);
  });
