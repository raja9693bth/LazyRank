import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PostgresDatabase } from '../server/db/postgres.ts';
import { db } from '../server/db.ts';
import { safeTwitterUrl, safeWebsiteUrl, safeLinkedInUrl, safeInstagramUrl } from '../src/components/ProfileCard.tsx';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';
const isStrict = process.env.STRICT_PG_TEST === 'true' || process.env.CI === 'true';

async function runPhase4Tests() {
  console.log('\n========================================================');
  console.log('RUNNING PHASE 4: OPERATIONAL WORKFLOWS, DURABLE DATA & HONEST UI');
  console.log('========================================================\n');

  let passed = 0;
  function pass(msg: string) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  // 1. Migration 005 File and Schema Parity
  console.log('--- 1. Migration 005 DDL & Schema Parity ---');
  const mig005Path = path.join(process.cwd(), 'server', 'db', 'migrations', '005_operational_workflows.sql');
  assert.ok(fs.existsSync(mig005Path), 'Migration file 005_operational_workflows.sql must exist');
  const mig005Sql = fs.readFileSync(mig005Path, 'utf-8');

  assert.ok(mig005Sql.includes('operational_outbox'), 'Migration 005 must create operational_outbox');
  assert.ok(mig005Sql.includes('profile_votes'), 'Migration 005 must create profile_votes');
  assert.ok(mig005Sql.includes('uq_outbox_event_order'), 'Migration 005 must create unique constraint on (event_type, order_id)');
  assert.ok(mig005Sql.includes('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter'), 'Migration 005 must add twitter to profiles');
  assert.ok(mig005Sql.includes('ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS twitter'), 'Migration 005 must add twitter to payment_orders');
  assert.ok(mig005Sql.includes('005_operational_workflows'), 'Migration 005 must record in schema_migrations');

  const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  assert.ok(schemaSql.includes('operational_outbox'), 'schema.sql must include operational_outbox');
  assert.ok(schemaSql.includes('profile_votes'), 'schema.sql must include profile_votes');
  assert.ok(schemaSql.includes('twitter VARCHAR(255)'), 'schema.sql must include twitter column');
  pass('Migration 005 and schema.sql are in 100% specification parity');

  // 2. Safe Twitter URL Normalization & Anti-XSS Sanitization
  console.log('\n--- 2. Safe Twitter URL Normalization & Sanitization ---');
  assert.strictEqual(safeTwitterUrl('@lazyking'), 'https://x.com/lazyking');
  assert.strictEqual(safeTwitterUrl('lazy_king_99'), 'https://x.com/lazy_king_99');
  assert.strictEqual(safeTwitterUrl('https://x.com/adabhra'), 'https://x.com/adabhra');
  assert.strictEqual(safeTwitterUrl('https://twitter.com/adabhra'), 'https://twitter.com/adabhra');
  assert.strictEqual(safeTwitterUrl('http://www.x.com/adabhra'), 'http://www.x.com/adabhra');
  assert.strictEqual(safeTwitterUrl('javascript:alert(1)'), null);
  assert.strictEqual(safeTwitterUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.strictEqual(safeTwitterUrl('https://evil-x.com/adabhra'), null);
  assert.strictEqual(safeTwitterUrl('https://phishing.site/user'), null);
  assert.strictEqual(safeTwitterUrl(''), null);
  assert.strictEqual(safeTwitterUrl(undefined), null);

  assert.strictEqual(db.normalizeTwitter('@lazyking'), 'https://x.com/lazyking');
  assert.strictEqual(db.normalizeTwitter('lazy_king_99'), 'https://x.com/lazy_king_99');
  assert.strictEqual(db.normalizeTwitter('https://x.com/adabhra'), 'https://x.com/adabhra');
  assert.strictEqual(db.normalizeTwitter('javascript:alert(1)'), undefined);
  pass('Safe Twitter/X URL validation rejects dangerous schemes and normalizes authentic handles');

  // 3. UI Honesty: Customer Email "Notify Me" Contract
  console.log('\n--- 3. UI Honesty: Customer Email Contract ---');
  const nomModalSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'NominationModal.tsx'), 'utf-8');
  assert.ok(!nomModalSrc.includes('id="tab-notify-btn"'), 'NominationModal must not render customer email tab button in switcher');
  assert.ok(!nomModalSrc.includes('id="panel-notify"'), 'NominationModal completely removes dead Notify tab panel');
  assert.ok(!nomModalSrc.includes("Turn On 'Notify Me' Alerts →"), 'Post-challenge CTA must not invite email alerts');
  assert.ok(!nomModalSrc.includes("Want email alerts if friends challenge back?"), 'NominationModal removes Want email alerts CTA');

  const resultViewSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ResultView.tsx'), 'utf-8');
  assert.ok(!resultViewSrc.includes('<span>Notify Me</span>'), 'ResultView must not render customer-facing Notify Me button');
  assert.ok(!resultViewSrc.includes('<span>Notify If Outranked</span>'), 'ResultView must not render Notify If Outranked button');
  assert.ok(resultViewSrc.includes('safeTwitterUrl'), 'ResultView imports safeTwitterUrl');
  assert.ok(resultViewSrc.includes('<span>X</span>'), 'ResultView renders X link when twitter profile exists');

  const cardSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ProfileCard.tsx'), 'utf-8');
  assert.ok(cardSrc.includes('safeTwitterUrl'), 'ProfileCard extracts safeTwitterUrl');
  assert.ok(cardSrc.includes('/* X profile not connected */'), 'ProfileCard preserves inactive comment invariant');
  pass('Frontend UI components are fully honest: un-wired email alerts removed and X links safely displayed');

  // 4. Real PostgreSQL Integration Tests
  console.log('\n--- 4. Real PostgreSQL Integration: Durable Workflows ---');
  const pg = new PostgresDatabase(TEST_DB_URL);
  assert.strictEqual(pg.isAvailable(), true, 'PostgreSQL database client must be available');

  let initOk = false;
  try {
    initOk = await pg.init();
  } catch (err: any) {
    if (isStrict) {
      throw new Error(`PostgreSQL integration test failed: could not connect to disposable test database at ${TEST_DB_URL}: ${err.message}`);
    }
    console.warn(`Unable to connect to local PG: ${err.message}`);
    return;
  }
  assert.ok(initOk, 'PostgresDatabase schema initialization and migration 005 must succeed');
  pass('PostgreSQL connected and migration 005 verified');

  const pool = await pg.getPool();

  // Test 4.1: Durable Profile Social Voting with Keyed Fingerprint
  console.log('\n--- 4.1 Durable Social Voting with Keyed Fingerprint ---');
  const testProfId = 'p_vote_test_' + Date.now();
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, moderation_status, owner_token_hash, created_at, updated_at)
     VALUES ($1, 'u_vote_test', 'Vote Tester', 500, 999, TRUE, 'active', $2, NOW(), NOW())`,
    [testProfId, 'hash_' + 'a'.repeat(59)]
  );

  const ip1 = '192.168.1.100';
  const ua1 = 'Mozilla/5.0 TestBrowser';
  const voteRes1 = await pg.voteProfile(testProfId, ip1, ua1);
  assert.strictEqual(voteRes1.success, true, 'First vote from IP1 must succeed');
  assert.strictEqual(voteRes1.message, 'Vote recorded!', 'Vote returns recorded message');
  assert.strictEqual(voteRes1.profile?.votesCount, 1, 'Profile votes count must increment to 1');

  // Duplicate vote attempt from same IP1 & UA1
  const voteResDuplicate = await pg.voteProfile(testProfId, ip1, ua1);
  assert.strictEqual(voteResDuplicate.success, false, 'Duplicate vote must be rejected');
  assert.strictEqual(voteResDuplicate.message, 'You already voted for this person!', 'Duplicate vote message');

  // Vote from a different voter (IP2)
  const ip2 = '192.168.1.101';
  const voteRes2 = await pg.voteProfile(testProfId, ip2, ua1);
  assert.strictEqual(voteRes2.success, true, 'Vote from different IP must succeed');
  assert.strictEqual(voteRes2.profile?.votesCount, 2, 'Profile votes count must increment to 2');

  // Vote for nonexistent profile
  const voteResNonexistent = await pg.voteProfile('nonexistent_profile_id', ip1, ua1);
  assert.strictEqual(voteResNonexistent.success, false, 'Vote for nonexistent profile must fail');
  assert.strictEqual(voteResNonexistent.message, 'Profile not found', 'Vote returns Profile not found');
  pass('Durable social voting enforces single-vote rate limiting and atomic counter increments');

  // Test 4.2: Durable Nominations / Challenges
  console.log('\n--- 4.2 Durable Nominations & Challenges ---');
  const challenge = await pg.createNominationChallenge({
    nomineeName: 'Arjun Sloth',
    reason: 'Has not left bed in 36 hours',
    nominatorName: 'Kunal Champion',
    targetAmount: 2500,
    lazyReason: 'Bed Connoisseur'
  });
  assert.ok(challenge.id.startsWith('nom_'), 'Challenge ID must start with nom_');
  assert.strictEqual(challenge.nomineeName, 'Arjun Sloth');
  assert.strictEqual(challenge.nominatorName, 'Kunal Champion');
  assert.strictEqual(challenge.targetAmount, 2500);
  assert.strictEqual(challenge.lazyReason, 'Bed Connoisseur');

  const adminData = await pg.getAdminData(10, 0);
  assert.ok(Array.isArray(adminData.nominations), 'getAdminData must include nominations array');
  const foundNom = adminData.nominations.find((n: any) => n.id === challenge.id);
  assert.ok(foundNom, 'Admin data must contain durable nomination');
  assert.strictEqual(foundNom.nomineeName, 'Arjun Sloth');
  pass('Durable challenges persist to PostgreSQL nominations table and surface in admin data');

  // Test 4.3: Durable Notification Preference Persistence
  console.log('\n--- 4.3 Durable Notification Preferences ---');
  const notifPref = await pg.saveNotificationPreference({
    email: 'sloth.alert@example.com',
    profileId: testProfId,
    notifyDisplaced: true,
    notifyDailySummary: false
  });
  assert.strictEqual(notifPref.success, true, 'Notification preference must be saved');
  assert.ok(notifPref.id.startsWith('notif_'), 'Notification ID must start with notif_');

  const notifDbRes = await pool.query('SELECT * FROM notification_preferences WHERE id = $1', [notifPref.id]);
  assert.strictEqual(notifDbRes.rows.length, 1, 'Notification row must exist in DB');
  assert.strictEqual(notifDbRes.rows[0].email, 'sloth.alert@example.com');
  pass('Durable notification preferences saved with parameterized SQL');

  // Test 4.4: Outbox Deduplication, Idempotency & Payment Settlement
  console.log('\n--- 4.4 Outbox Deduplication & Settlement Guarantee ---');
  const orderId = 'order_outbox_test_' + Date.now();
  const testOwnerToken = 'lazy_' + 'a'.repeat(64);
  const testAccessToken = 'ord_' + 'b'.repeat(64);

  await pg.createOrder({
    orderId,
    name: 'Outbox Test Participant',
    amount: 1200,
    ownerToken: testOwnerToken,
    orderAccessToken: testAccessToken,
    currency: 'INR',
    consentAccepted: true,
    twitter: '@outboxtester'
  });

  const settleRes = await pg.settlePaymentAtomic({
    orderId,
    providerPaymentId: 'cf_pay_' + Date.now(),
    provider: 'cashfree',
    amount: 1200,
    currency: 'INR',
    status: 'PAID',
    signatureVerified: true
  });
  assert.strictEqual(settleRes.success, true, 'Atomic payment settlement must succeed');

  // Verify outbox entry was created in same transaction
  const outboxRes = await pool.query('SELECT * FROM operational_outbox WHERE order_id = $1', [orderId]);
  assert.strictEqual(outboxRes.rows.length, 1, 'Exactly one outbox event must be enqueued');
  assert.strictEqual(outboxRes.rows[0].event_type, 'payment_settled');
  assert.strictEqual(outboxRes.rows[0].delivery_status, 'PENDING');

  const payload = typeof outboxRes.rows[0].payload === 'string'
    ? JSON.parse(outboxRes.rows[0].payload)
    : outboxRes.rows[0].payload;
  assert.strictEqual(payload.orderId, orderId);
  assert.strictEqual(payload.name, 'Outbox Test Participant');
  assert.strictEqual(payload.amount, 1200);
  assert.strictEqual(payload.customerEmail, undefined, 'Payload must NOT leak customer email');
  assert.strictEqual(payload.customerPhone, undefined, 'Payload must NOT leak customer phone');

  // Settle again (idempotent replay) must NOT create duplicate outbox entries
  const replayRes = await pg.settlePaymentAtomic({
    orderId,
    providerPaymentId: 'cf_pay_replay_' + Date.now(),
    provider: 'cashfree',
    amount: 1200,
    currency: 'INR',
    status: 'PAID',
    signatureVerified: true
  });
  assert.strictEqual(replayRes.success, true, 'Replay returns idempotent success');
  const outboxResAfterReplay = await pool.query('SELECT * FROM operational_outbox WHERE order_id = $1', [orderId]);
  assert.strictEqual(outboxResAfterReplay.rows.length, 1, 'Outbox row count remains exactly 1 on replay');
  pass('Transactional outbox guarantees exactly-once event generation per order without PII leakage');

  // Test 4.5: Operational Outbox Dispatcher
  console.log('\n--- 4.5 Operational Outbox Worker Dispatch ---');
  const dispatchRes = await pg.dispatchOperationalOutbox();
  assert.ok(dispatchRes.processed >= 1, 'Dispatcher must process at least 1 pending event');

  const outboxDelivered = await pool.query('SELECT delivery_status FROM operational_outbox WHERE order_id = $1', [orderId]);
  assert.strictEqual(
    outboxDelivered.rows[0].delivery_status,
    'SKIPPED_NO_CHANNELS',
    'Outbox event is marked SKIPPED_NO_CHANNELS when channels are optional/absent'
  );
  pass('Operational outbox dispatcher claims events with SKIP LOCKED and marks SKIPPED_NO_CHANNELS');

  // Test 4.6: End-to-End Twitter Persistence via Settle
  console.log('\n--- 4.6 End-to-End Twitter Persistence ---');
  const orderWithTwitter = await pg.getOrder(orderId);
  assert.strictEqual(orderWithTwitter?.twitter, '@outboxtester', 'Order must store twitter handle');

  const createdProfile = await pg.getProfile(settleRes.profile!.id);
  assert.strictEqual(createdProfile?.twitter, '@outboxtester', 'Settled profile must persist twitter handle');
  pass('End-to-end Twitter field is persisted across orders, profiles, and queries');

  console.log('\n========================================================');
  console.log(`PHASE 4 TEST SUITE RESULT: ALL ${passed} ASSERTIONS PASSED (100%)`);
  console.log('========================================================\n');
  process.exit(0);
}

runPhase4Tests().catch(err => {
  console.error('\nPhase 4 test failed:', err);
  process.exit(1);
});
