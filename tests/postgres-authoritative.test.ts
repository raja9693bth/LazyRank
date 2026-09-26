import assert from 'assert';
import { PostgresDatabase, getIstTodayWindow } from '../server/db/postgres.ts';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';
const isStrict = process.env.STRICT_PG_TEST === 'true' || process.env.CI === 'true';

async function runPostgresIntegrationTests() {
  console.log('\n========================================================');
  console.log('STARTING REAL POSTGRESQL INTEGRATION TEST SUITE');
  console.log('Database URL:', TEST_DB_URL.replace(/:[^:@]+@/, ':***@'));
  console.log('========================================================\n');

  // SAFETY GUARD: Refuse to run against production or non-test databases
  const lowerUrl = TEST_DB_URL.toLowerCase();
  if (
    lowerUrl.includes('neon.tech') ||
    lowerUrl.includes('neon.build') ||
    lowerUrl.includes('aws.neon') ||
    lowerUrl.includes('prod')
  ) {
    throw new Error('FATAL SECURITY VIOLATION: Refusing to run destructive PostgreSQL integration tests against production or Neon URL!');
  }

  try {
    const urlObj = new URL(TEST_DB_URL.startsWith('postgres') ? TEST_DB_URL : `postgresql://${TEST_DB_URL}`);
    const dbName = urlObj.pathname.replace(/^\//, '');
    if (!dbName.includes('test')) {
      throw new Error(`FATAL SAFETY VIOLATION: Target database "${dbName}" is not explicitly named as a test database (must contain "test").`);
    }
  } catch (err: any) {
    if (err.message.includes('FATAL SAFETY VIOLATION')) throw err;
  }

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
    if (isStrict) {
      throw new Error(`PostgreSQL integration test failed: could not connect to disposable test database at ${TEST_DB_URL}: ${err.message}`);
    }
    console.warn(`\n[PostgreSQL Integration] Unable to connect to PostgreSQL server: ${err.message}`);
    console.log('========================================================');
    console.log('REAL POSTGRES INTEGRATION:');
    console.log('UNVERIFIED — LOCAL POSTGRES ENVIRONMENT BLOCKED');
    console.log('========================================================\n');
    return;
  }

  if (!initOk) {
    if (isStrict) {
      throw new Error(`PostgreSQL integration test failed: schema initialization failed on ${TEST_DB_URL}`);
    }
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

  // Verify Migration 004 is applied and indexes exist
  console.log('\n--- 1B. Migration 004 & Index Verification ---');
  const mig004 = await pool.query("SELECT * FROM schema_migrations WHERE version = '004_today_leaderboard'");
  assert.strictEqual(mig004.rows.length, 1, 'Migration 004 must be recorded in schema_migrations');
  pass('Migration 004 verified in schema_migrations table');

  const idxRes = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'rank_ledger'
      AND indexname IN ('idx_rank_ledger_created_at', 'idx_rank_ledger_settled_credits')
  `);
  assert.strictEqual(idxRes.rows.length, 2, 'Migration 004 indexes must exist on rank_ledger');
  pass('Migration 004 performance indexes verified on rank_ledger');

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
    ownerToken: 'lazy_owner_token_vikram_001',
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
    currency: 'INR',
    status: 'PAID',
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
  const ownerToken = 'lazy_owner_token_vikram_001';
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
    currency: 'INR',
    status: 'PAID',
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

  // Create all orders first with ownerTokens
  for (const o of concurrentOrders) {
    await pg.createOrder({
      orderId: o.orderId,
      name: o.name,
      amount: o.amount,
      currency: 'INR',
      ownerToken: 'lazy_owner_' + o.orderId,
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
        currency: 'INR',
        status: 'PAID',
        paymentMethod: 'UPI',
        signatureVerified: true
      })
    )
  );

  assert.strictEqual(concurrentSettlements.every(s => s.success), true, 'All concurrent settlements must succeed');
  pass('5 concurrent payments settled cleanly without deadlocks or corruption');

  // 7. Deterministic All-Time Ranking Verification
  console.log('\n--- 7. Deterministic Ranking Rule ---');
  const leaderboardAll = await pg.getLeaderboard({ period: 'all', limit: 10 });
  assert.strictEqual(leaderboardAll.profiles.length, 6, 'Should have 6 profiles total (Vikram + 5 concurrent)');
  assert.strictEqual(leaderboardAll.period, 'all');
  assert.strictEqual(leaderboardAll.topAmount, 7000);
  assert.strictEqual(leaderboardAll.minAmountToBeatTop, 7001);

  // Verify amounts in strictly descending order
  for (let i = 0; i < leaderboardAll.profiles.length - 1; i++) {
    const current = leaderboardAll.profiles[i];
    const next = leaderboardAll.profiles[i + 1];
    assert.ok(
      current.amount >= next.amount,
      `Rank ${current.rank} (₹${current.amount}) must be >= Rank ${next.rank} (₹${next.amount})`
    );
    assert.strictEqual(current.rank, i + 1, `Rank index must be exactly sequential (${i + 1})`);
  }

  // Ananya paid 7000, must be #1 all-time
  assert.strictEqual(leaderboardAll.profiles[0].name, 'Ananya');
  assert.strictEqual(leaderboardAll.profiles[0].amount, 7000);
  assert.strictEqual(leaderboardAll.profiles[0].rank, 1);
  pass('Ananya (₹7,000) holds deterministic #1 rank');

  // 8. REAL TODAY LEADERBOARD & ACCUMULATION CONTRACT
  console.log('\n--- 8. Real Today Leaderboard Contract ---');
  const todayBoard = await pg.getLeaderboard({ period: 'today', limit: 10 });
  assert.strictEqual(todayBoard.period, 'today');
  assert.strictEqual(todayBoard.filter, 'verified');
  assert.strictEqual(todayBoard.rankingBasis, 'net_settled_credits_today_ist');
  assert.ok(todayBoard.periodStartUtc, 'periodStartUtc must be present');
  assert.ok(todayBoard.periodEndUtc, 'periodEndUtc must be present');
  assert.strictEqual(todayBoard.topAmount, 7000, 'topAmount MUST remain all-time top amount in Today query');
  assert.strictEqual(todayBoard.minAmountToBeatTop, 7001, 'minAmountToBeatTop MUST remain all-time min amount');

  // All 6 profiles were credited today
  assert.strictEqual(todayBoard.profiles.length, 6, 'All 6 profiles should have qualifying credits today');

  // Vikram paid two orders today: 2500 + 1500 = 4000
  const vikramToday = todayBoard.profiles.find(p => p.name === 'Vikram');
  assert.ok(vikramToday, 'Vikram must appear on Today leaderboard');
  assert.strictEqual(vikramToday.periodAmountINR, 4000, 'Vikram today net amount must aggregate multiple orders (2500 + 1500 = 4000)');
  assert.strictEqual(vikramToday.amount, 4000, 'Vikram all-time amount is preserved');
  pass('Today leaderboard correctly aggregated multiple orders for Vikram to ₹4,000');

  // Verify Today sequential ranks
  for (let i = 0; i < todayBoard.profiles.length; i++) {
    const prof = todayBoard.profiles[i];
    assert.strictEqual(prof.periodRank, i + 1, `periodRank must be sequential 1-indexed (${i + 1})`);
    assert.ok(prof.periodAmountINR! > 0, 'Today entries must have positive net amounts');
  }
  pass('Today leaderboard sequential ranks verified');

  // 9. Deterministic Ties on Today Leaderboard
  console.log('\n--- 9. Deterministic Ties on Today Leaderboard ---');
  // Create two profiles with identical amounts (₹2,222) at distinct timestamps
  const tieOrderA = 'order_tie_a';
  const tieOrderB = 'order_tie_b';

  await pg.createOrder({
    orderId: tieOrderA,
    name: 'TieFirst',
    amount: 2222,
    currency: 'INR',
    ownerToken: 'token_tie_a',
    provider: 'cashfree'
  });
  await pg.settlePaymentAtomic({
    orderId: tieOrderA,
    providerPaymentId: 'cf_tie_a',
    provider: 'cashfree',
    amount: 2222,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });

  // Small delay to ensure distinct credit timestamp
  await new Promise(r => setTimeout(r, 50));

  await pg.createOrder({
    orderId: tieOrderB,
    name: 'TieSecond',
    amount: 2222,
    currency: 'INR',
    ownerToken: 'token_tie_b',
    provider: 'cashfree'
  });
  await pg.settlePaymentAtomic({
    orderId: tieOrderB,
    providerPaymentId: 'cf_tie_b',
    provider: 'cashfree',
    amount: 2222,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });

  const tieCheckBoard = await pg.getLeaderboard({ period: 'today', limit: 20 });
  const idxA = tieCheckBoard.profiles.findIndex(p => p.name === 'TieFirst');
  const idxB = tieCheckBoard.profiles.findIndex(p => p.name === 'TieSecond');
  assert.ok(idxA !== -1 && idxB !== -1, 'Both tie profiles must exist');
  assert.ok(idxA < idxB, `TieFirst (earlier credit) must rank ahead of TieSecond (later credit)`);
  pass('Deterministic tie-breaker correctly prioritizes earlier qualifying settlement timestamp');

  // 10. IST Boundary Test: 18:29:59 UTC vs 18:30:00 UTC
  console.log('\n--- 10. IST Boundary Invariant (18:29:59 vs 18:30:00 UTC) ---');
  const { startTodayMs } = getIstTodayWindow();
  const boundaryYesterdayUtc = new Date(startTodayMs - 1000); // 1 sec before IST 00:00 (yesterday IST)
  const boundaryTodayUtc = new Date(startTodayMs + 1000);     // 1 sec after IST 00:00 (today IST)

  // Seed boundary profile 1 (yesterday)
  const profYesterdayId = 'prof_boundary_yesterday';
  await pool.query(`
    INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, first_verified_at, created_at, updated_at, owner_token_hash)
    VALUES ($1, $2, 'YesterdayProfile', 9999, 99, true, $3, $3, $3, 'hash_bound_yest')
  `, [profYesterdayId, 'u_yest', boundaryYesterdayUtc]);

  await pool.query(`
    INSERT INTO payment_orders (order_id, profile_id, name, amount, currency, status, created_at, updated_at)
    VALUES ('ord_bound_yest', $1, 'YesterdayProfile', 9999, 'INR', 'PAID', $2, $2)
  `, [profYesterdayId, boundaryYesterdayUtc]);

  await pool.query(`
    INSERT INTO rank_ledger (id, profile_id, order_id, type, amount, status, created_at)
    VALUES ('led_bound_yest', $1, 'ord_bound_yest', 'CREDIT', 9999, 'SETTLED', $2)
  `, [profYesterdayId, boundaryYesterdayUtc]);

  // Seed boundary profile 2 (today)
  const profTodayId = 'prof_boundary_today';
  await pool.query(`
    INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, first_verified_at, created_at, updated_at, owner_token_hash)
    VALUES ($1, $2, 'TodayBoundaryProfile', 8888, 99, true, $3, $3, $3, 'hash_bound_today')
  `, [profTodayId, 'u_today', boundaryTodayUtc]);

  await pool.query(`
    INSERT INTO payment_orders (order_id, profile_id, name, amount, currency, status, created_at, updated_at)
    VALUES ('ord_bound_today', $1, 'TodayBoundaryProfile', 8888, 'INR', 'PAID', $2, $2)
  `, [profTodayId, boundaryTodayUtc]);

  await pool.query(`
    INSERT INTO rank_ledger (id, profile_id, order_id, type, amount, status, created_at)
    VALUES ('led_bound_today', $1, 'ord_bound_today', 'CREDIT', 8888, 'SETTLED', $2)
  `, [profTodayId, boundaryTodayUtc]);

  // Query Today leaderboard: YesterdayProfile MUST NOT appear; TodayBoundaryProfile MUST appear
  const boundaryBoard = await pg.getLeaderboard({ period: 'today', limit: 20 });
  const hasYesterday = boundaryBoard.profiles.some(p => p.name === 'YesterdayProfile');
  const hasToday = boundaryBoard.profiles.some(p => p.name === 'TodayBoundaryProfile');
  assert.strictEqual(hasYesterday, false, 'Entry at 23:59:59 IST (18:29:59 UTC) must be excluded from Today');
  assert.strictEqual(hasToday, true, 'Entry at 00:00:01 IST (18:30:01 UTC) must be included in Today');
  pass('IST boundary strictly enforces [00:00 IST today, 00:00 IST tomorrow) cutoff');

  // Clean up boundary test entries
  await pool.query("DELETE FROM rank_ledger WHERE profile_id IN ($1, $2)", [profYesterdayId, profTodayId]);
  await pool.query("DELETE FROM payment_orders WHERE profile_id IN ($1, $2)", [profYesterdayId, profTodayId]);
  await pool.query("DELETE FROM profiles WHERE id IN ($1, $2)", [profYesterdayId, profTodayId]);

  // 11. Partial & Full Refund on Today Ranks
  console.log('\n--- 11. Partial Refund & Today Rank Recalculation ---');
  // Vikram currently has ₹4,000 from two orders (order1: 2500, order2: 1500)
  const pRefId1 = 'cf_ref_p_' + Date.now();
  await pg.reserveRefundAtomic(orderId2, 1500 * 100, 'mer_ref_partial_001', 'Customer requested partial refund');
  const partialRefundRes = await pg.reverseRefundAtomic({
    orderId: orderId2,
    merchantRefundId: 'mer_ref_partial_001',
    providerRefundId: pRefId1,
    amount: 1500,
    currency: 'INR',
    reason: 'Customer requested partial refund'
  });
  assert.strictEqual(partialRefundRes.success, true, 'Partial refund must succeed');

  const vikramAfterPartial = await pg.getLeaderboard({ period: 'today', limit: 10 });
  const vikramTodayAfter = vikramAfterPartial.profiles.find(p => p.name === 'Vikram');
  assert.strictEqual(vikramTodayAfter?.periodAmountINR, 2500, 'Vikram today amount must reduce from 4000 to 2500 after refund');
  pass('Partial refund properly debited from Today net sponsorship amount');

  // Full Refund on Order 1
  const pRefId2 = 'cf_ref_f_' + Date.now();
  await pg.reserveRefundAtomic(orderId1, 2500 * 100, 'mer_ref_full_001', 'Customer requested full refund');
  const fullRefundRes = await pg.reverseRefundAtomic({
    orderId: orderId1,
    merchantRefundId: 'mer_ref_full_001',
    providerRefundId: pRefId2,
    amount: 2500,
    currency: 'INR',
    reason: 'Customer requested full refund'
  });
  assert.strictEqual(fullRefundRes.success, true, 'Full refund must succeed');

  const vikramAfterFull = await pg.getLeaderboard({ period: 'today', limit: 10 });
  const vikramTodayFull = vikramAfterFull.profiles.find(p => p.name === 'Vikram');
  assert.strictEqual(vikramTodayFull, undefined, 'Vikram (net zero today) must be completely excluded from Today leaderboard');
  pass('Net-zero entry after full refund cleanly excluded from Today leaderboard');

  // 12. Pagination on Today Leaderboard
  console.log('\n--- 12. Pagination on Today Leaderboard ---');
  const page1 = await pg.getLeaderboard({ period: 'today', page: 1, pageSize: 2 });
  assert.strictEqual(page1.profiles.length, 2, 'Page 1 must return exactly 2 items');
  assert.strictEqual(page1.profiles[0].periodRank, 1);
  assert.strictEqual(page1.profiles[1].periodRank, 2);
  assert.strictEqual(page1.hasMore, true);
  assert.ok(page1.totalPages >= 2);

  const page2 = await pg.getLeaderboard({ period: 'today', page: 2, pageSize: 2 });
  assert.strictEqual(page2.profiles.length, 2, 'Page 2 must return exactly 2 items');
  assert.strictEqual(page2.profiles[0].periodRank, 3);
  assert.strictEqual(page2.profiles[1].periodRank, 4);
  pass('Today leaderboard pagination correctly preserves rank offsets and page boundaries');

  // 13. Global Activity Bounded Aggregation
  console.log('\n--- 13. Bounded IST Global Activity ---');
  const activity = await pg.getGlobalActivity();
  assert.strictEqual(typeof activity.claimsToday, 'number');
  assert.strictEqual(typeof activity.claimsTotal, 'number');
  assert.strictEqual(typeof activity.totalAmountToday, 'number');
  assert.strictEqual(activity.hourlyActivity.length, 24, 'Hourly activity must have 24 buckets');
  assert.strictEqual(activity.recentDays.length, 7, 'Recent days must have 7 buckets');
  assert.ok(activity.claimsToday >= 5, 'Claims today count reflects genuine settled credits');
  pass('Global activity correctly aggregates against exact IST boundaries');

  // 14. Server Restart Persistence
  console.log('\n--- 14. Server Restart Persistence ---');
  const restartedPg = new PostgresDatabase(TEST_DB_URL);
  await restartedPg.init();

  const restartedLeaderboard = await restartedPg.getLeaderboard({ period: 'today', limit: 10 });
  assert.ok(restartedLeaderboard.profiles.length >= 5, 'Profiles must persist across restart');
  assert.strictEqual(restartedLeaderboard.topAmount, 7000);
  assert.strictEqual(restartedLeaderboard.minAmountToBeatTop, 7001);
  pass('Today leaderboard ranks, amounts, and metadata completely persisted across restart');

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
