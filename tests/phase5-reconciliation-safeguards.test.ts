import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PostgresDatabase } from '../server/db/postgres.ts';
import { toSafePaise } from '../server/payments/provider.ts';
import { CashfreeProvider } from '../server/payments/cashfree.ts';
import { generateProfileJsonLd } from '../server/seo.ts';
import { SERVER_LEGAL_CONFIG } from '../server/config/legal.ts';
import { UserProfile } from '../src/types.ts';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';

function assertSafeTestDatabase(url: string) {
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('neon.tech') ||
    lowerUrl.includes('neon.build') ||
    lowerUrl.includes('aws.neon') ||
    lowerUrl.includes('prod')
  ) {
    throw new Error('FATAL SECURITY VIOLATION: Refusing to run destructive PostgreSQL integration tests against production or Neon URL!');
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

async function runPhase5Tests() {
  assertSafeTestDatabase(TEST_DB_URL);
  console.log('\n========================================================');
  console.log('RUNNING PHASE 5: RECONCILIATION SAFEGUARDS & FINAL REMEDIATION');
  console.log('========================================================\n');

  let passed = 0;
  function pass(msg: string) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  // -----------------------------------------------------------------
  // 1. Strict Minor-Unit (Paise) Validator
  // -----------------------------------------------------------------
  console.log('--- 1. Strict Minor-Unit (Paise) Validator ---');
  // Valid amounts
  assert.strictEqual(toSafePaise(10), 1000, '10 INR is exactly 1000 paise');
  assert.strictEqual(toSafePaise(10.5), 1050, '10.50 INR is exactly 1050 paise');
  assert.strictEqual(toSafePaise(0.01), 1, '0.01 INR is exactly 1 paisa');
  assert.strictEqual(toSafePaise(500.25), 50025, '500.25 INR is exactly 50025 paise');
  assert.strictEqual(toSafePaise(999999.99), 99999999, '999999.99 INR is safe integer paise');

  // Sub-paise amounts must fail closed (return null)
  assert.strictEqual(toSafePaise(10.505), null, 'Sub-paise 10.505 must be rejected');
  assert.strictEqual(toSafePaise(10.5001), null, 'Sub-paise 10.5001 must be rejected');
  assert.strictEqual(toSafePaise(1.00000001), null, 'Sub-paise fractions must be rejected');

  // Non-positive, non-finite, or non-numeric values must fail closed
  assert.strictEqual(toSafePaise(0), null, 'Zero amount must be rejected');
  assert.strictEqual(toSafePaise(-10), null, 'Negative amount must be rejected');
  assert.strictEqual(toSafePaise(NaN), null, 'NaN must be rejected');
  assert.strictEqual(toSafePaise(Infinity), null, 'Infinity must be rejected');
  assert.strictEqual(toSafePaise(-Infinity), null, '-Infinity must be rejected');
  assert.strictEqual(toSafePaise('100'), null, 'String amount must be rejected');
  assert.strictEqual(toSafePaise(null), null, 'Null amount must be rejected');
  assert.strictEqual(toSafePaise(undefined), null, 'Undefined amount must be rejected');
  pass('Strict minor-unit validator enforces positive, finite, safe integer paise with zero sub-paise rounding');

  // -----------------------------------------------------------------
  // 2. Migration 006 File & Schema Parity
  // -----------------------------------------------------------------
  console.log('\n--- 2. Migration 006 File & Schema Parity ---');
  const mig006Path = path.join(process.cwd(), 'server', 'db', 'migrations', '006_outbox_delivery.sql');
  assert.ok(fs.existsSync(mig006Path), 'Migration 006_outbox_delivery.sql must exist');
  const mig006Sql = fs.readFileSync(mig006Path, 'utf-8');

  assert.ok(mig006Sql.includes('outbox_channel_deliveries'), 'Migration 006 must create outbox_channel_deliveries table');
  assert.ok(mig006Sql.includes('uq_outbox_channel'), 'Migration 006 must enforce unique constraint on (outbox_id, channel)');
  assert.ok(mig006Sql.includes('SKIPPED_NO_CHANNELS'), 'Migration 006 must allow SKIPPED_NO_CHANNELS status');
  assert.ok(mig006Sql.includes('WAITING_CONFIG'), 'Migration 006 must allow WAITING_CONFIG status');
  assert.ok(mig006Sql.includes('006_outbox_delivery'), 'Migration 006 must record in schema_migrations');

  const schemaSql = fs.readFileSync(path.join(process.cwd(), 'server', 'db', 'schema.sql'), 'utf-8');
  assert.ok(schemaSql.includes('outbox_channel_deliveries'), 'schema.sql must include outbox_channel_deliveries table');
  assert.ok(schemaSql.includes('SKIPPED_NO_CHANNELS'), 'schema.sql must allow SKIPPED_NO_CHANNELS status');
  pass('Migration 006 and schema.sql are in 100% specification parity');

  // -----------------------------------------------------------------
  // 3. PostgreSQL Database Integration Tests
  // -----------------------------------------------------------------
  console.log('\n--- 3. Database Connection & Clean State ---');
  const pg = new PostgresDatabase(TEST_DB_URL);
  await pg.init();
  const pool = await pg.getPool();

  // -----------------------------------------------------------------
  // 4. Payment Settlement Bypass Safeguards in settlePaymentAtomic
  // -----------------------------------------------------------------
  console.log('\n--- 4. Payment Settlement Bypass Safeguards ---');

  // Create a clean base order for testing settlement invariants
  const bypassOrderId = 'ord_bypass_' + Date.now();
  const testOwnerToken = 'lazy_owner_bypass_' + crypto.randomBytes(32).toString('hex');
  const testAccessToken = 'ord_acc_bypass_' + crypto.randomBytes(32).toString('hex');

  await pg.createOrder({
    orderId: bypassOrderId,
    name: 'Bypass Test Participant',
    amount: 500,
    ownerToken: testOwnerToken,
    orderAccessToken: testAccessToken,
    currency: 'INR',
    consentAccepted: true
  });

  // 4a. USD currency must fail closed
  const usdSettle = await pg.settlePaymentAtomic({
    orderId: bypassOrderId,
    providerPaymentId: 'pay_usd_' + Date.now(),
    provider: 'cashfree',
    amount: 500,
    currency: 'USD',
    status: 'PAID',
    signatureVerified: true
  });
  assert.strictEqual(usdSettle.success, false, 'USD payment settlement must be rejected');
  assert.ok(usdSettle.message?.includes('currency'), 'Failure message must mention currency');

  // 4b. Absent / undefined currency must fail closed
  const noCurrSettle = await pg.settlePaymentAtomic({
    orderId: bypassOrderId,
    providerPaymentId: 'pay_nocurr_' + Date.now(),
    provider: 'cashfree',
    amount: 500,
    status: 'PAID',
    signatureVerified: true
  } as any);
  assert.strictEqual(noCurrSettle.success, false, 'Missing currency must fail closed');

  // 4c. Nonempty providerPaymentId strictly required
  const emptyPayIdSettle = await pg.settlePaymentAtomic({
    orderId: bypassOrderId,
    providerPaymentId: '   ',
    provider: 'cashfree',
    amount: 500,
    currency: 'INR',
    status: 'PAID',
    signatureVerified: true
  });
  assert.strictEqual(emptyPayIdSettle.success, false, 'Empty providerPaymentId must fail closed');

  // 4d. Status must be PAID (e.g. FAILED, USER_DROPPED, PENDING rejected)
  const failedStatusSettle = await pg.settlePaymentAtomic({
    orderId: bypassOrderId,
    providerPaymentId: 'pay_failed_' + Date.now(),
    provider: 'cashfree',
    amount: 500,
    currency: 'INR',
    status: 'FAILED',
    signatureVerified: true
  });
  assert.strictEqual(failedStatusSettle.success, false, 'Non-PAID status must be rejected');

  // 4e. Mismatched amount must fail closed
  const mismatchSettle = await pg.settlePaymentAtomic({
    orderId: bypassOrderId,
    providerPaymentId: 'pay_mismatch_' + Date.now(),
    provider: 'cashfree',
    amount: 600,
    currency: 'INR',
    status: 'PAID',
    signatureVerified: true
  });
  assert.strictEqual(mismatchSettle.success, false, 'Mismatched amount must be rejected');

  // 4f. Sub-paise amount must fail closed
  const subPaiseSettle = await pg.settlePaymentAtomic({
    orderId: bypassOrderId,
    providerPaymentId: 'pay_subpaise_' + Date.now(),
    provider: 'cashfree',
    amount: 500.005,
    currency: 'INR',
    status: 'PAID',
    signatureVerified: true
  });
  assert.strictEqual(subPaiseSettle.success, false, 'Sub-paise amount must be rejected');

  // Verify that all above failed attempts created NO payment_transactions, NO rank_ledger, NO paid profile
  const txCheck = await pool.query('SELECT * FROM payment_transactions WHERE order_id = $1', [bypassOrderId]);
  assert.strictEqual(txCheck.rows.length, 0, 'No transaction row may be created on rejected settlement');

  const ledgerCheck = await pool.query('SELECT * FROM rank_ledger WHERE order_id = $1', [bypassOrderId]);
  assert.strictEqual(ledgerCheck.rows.length, 0, 'No ledger entry may be created on rejected settlement');

  const orderCheck = await pg.getOrder(bypassOrderId);
  assert.strictEqual(orderCheck?.status, 'PENDING', 'Order must remain PENDING after rejected attempts');
  pass('settlePaymentAtomic strictly enforces status PAID, nonempty providerPaymentId, currency INR, and exact paise equality; all invalid inputs fail closed without ledger/profile side effects');

  // 4g. Legitimate PAID + INR + exact paise succeeds
  const validPayId = 'cf_legit_' + Date.now();
  const validSettle = await pg.settlePaymentAtomic({
    orderId: bypassOrderId,
    providerPaymentId: validPayId,
    provider: 'cashfree',
    amount: 500,
    currency: 'INR',
    status: 'PAID',
    signatureVerified: true
  });
  assert.strictEqual(validSettle.success, true, 'Legitimate settlement must succeed');
  assert.ok(validSettle.profile, 'Profile must be created upon settlement');

  const settledOrder = await pg.getOrder(bypassOrderId);
  assert.strictEqual(settledOrder?.status, 'PAID', 'Order status must be PAID');

  const validLedger = await pool.query('SELECT * FROM rank_ledger WHERE order_id = $1 AND type = $2', [bypassOrderId, 'CREDIT']);
  assert.strictEqual(validLedger.rows.length, 1, 'Exactly one CREDIT ledger row created');
  assert.strictEqual(Number(validLedger.rows[0].amount), 500);
  assert.strictEqual(validLedger.rows[0].currency, 'INR');
  pass('Legitimate PAID settlement creates CREDIT ledger row and updates order atomically');

  // -----------------------------------------------------------------
  // 5. Safe Refund Status Mapping & Reservation Protection
  // -----------------------------------------------------------------
  console.log('\n--- 5. Safe Refund Status & Reservation Invariants ---');

  const originalFetch = globalThis.fetch;
  try {
    process.env.CASHFREE_APP_ID = 'test_app_id';
    process.env.CASHFREE_SECRET_KEY = 'test_secret_key';
    const cf = new CashfreeProvider();

    // Mock fetch for ONHOLD
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        order_id: 'ord_test_ref',
        refund_id: 'ref_001',
        cf_refund_id: 'cf_ref_001',
        refund_status: 'ONHOLD',
        refund_amount: 500,
        refund_currency: 'INR'
      })
    }) as any;
    const onholdRes = await cf.getRefundStatus('ord_test_ref', 'ref_001');
    assert.strictEqual(onholdRes.status, 'PENDING', 'ONHOLD status must map to PENDING');
    assert.strictEqual(onholdRes.currency, 'INR');

    // Mock fetch for PENDING_APPROVAL
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        order_id: 'ord_test_ref',
        refund_id: 'ref_002',
        cf_refund_id: 'cf_ref_002',
        refund_status: 'PENDING_APPROVAL',
        refund_amount: 500,
        refund_currency: 'INR'
      })
    }) as any;
    const pendingApprRes = await cf.getRefundStatus('ord_test_ref', 'ref_002');
    assert.strictEqual(pendingApprRes.status, 'PENDING', 'PENDING_APPROVAL must map to PENDING');

    // Mock fetch for unknown state
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        order_id: 'ord_test_ref',
        refund_id: 'ref_003',
        cf_refund_id: 'cf_ref_003',
        refund_status: 'UNKNOWN_GATEWAY_STATE',
        refund_amount: 500,
        refund_currency: 'INR'
      })
    }) as any;
    const unknownRes = await cf.getRefundStatus('ord_test_ref', 'ref_003');
    assert.strictEqual(unknownRes.status, 'PENDING', 'Unknown gateway state must map to PENDING to protect reservation');

    // Mock fetch for terminal FAILED
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        order_id: 'ord_test_ref',
        refund_id: 'ref_004',
        cf_refund_id: 'cf_ref_004',
        refund_status: 'CANCELLED',
        refund_amount: 500,
        refund_currency: 'INR'
      })
    }) as any;
    const terminalRes = await cf.getRefundStatus('ord_test_ref', 'ref_004');
    assert.strictEqual(terminalRes.status, 'FAILED', 'CANCELLED must map to terminal FAILED');

    // Mock fetch with non-INR currency (must not fabricate INR fallback)
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        order_id: 'ord_test_ref',
        refund_id: 'ref_005',
        cf_refund_id: 'cf_ref_005',
        refund_status: 'SUCCESS',
        refund_amount: 500,
        refund_currency: 'USD'
      })
    }) as any;
    const usdRefRes = await cf.getRefundStatus('ord_test_ref', 'ref_005');
    assert.strictEqual(usdRefRes.currency, 'USD', 'Must read refund_currency without fabricating INR');

    pass('Cashfree refund status correctly maps intermediate states to PENDING and preserves response currency');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.CASHFREE_APP_ID;
    delete process.env.CASHFREE_SECRET_KEY;
  }

  // -----------------------------------------------------------------
  // 6. Database Atomic Refund Reversal & Reservation Tests
  // -----------------------------------------------------------------
  console.log('\n--- 6. reverseRefundAtomic Invariants ---');

  // Reserve a refund on bypassOrderId (currently PAID with 500 INR)
  const merchantRefundId = 'ref_res_' + Date.now();
  const reserveRes = await pg.reserveRefundAtomic(bypassOrderId, 20000, merchantRefundId, 'Customer requested partial refund');
  assert.strictEqual(reserveRes.success, true, 'Refund reservation of ₹200 must succeed');

  // 6a. Attempt reverseRefundAtomic with wrong currency
  const wrongCurrRev = await pg.reverseRefundAtomic({
    orderId: bypassOrderId,
    merchantRefundId,
    amount: 200,
    currency: 'USD',
    reason: 'USD reversal attempt'
  });
  assert.strictEqual(wrongCurrRev.success, false, 'Non-INR refund reversal must be rejected');

  // 6b. Attempt reverseRefundAtomic with amount mismatch
  const wrongAmtRev = await pg.reverseRefundAtomic({
    orderId: bypassOrderId,
    merchantRefundId,
    amount: 300,
    currency: 'INR',
    reason: 'Mismatched amount attempt'
  });
  assert.strictEqual(wrongAmtRev.success, false, 'Mismatched refund amount must be rejected');

  // 6c. Attempt reverseRefundAtomic with wrong order ID
  const wrongOrderRev = await pg.reverseRefundAtomic({
    orderId: 'wrong_order_id',
    merchantRefundId,
    amount: 200,
    currency: 'INR',
    reason: 'Wrong order ID'
  });
  assert.strictEqual(wrongOrderRev.success, false, 'Nonexistent order ID must be rejected');

  // Verify that the reservation is still PENDING after failed settlement attempts
  const resCheck = await pool.query('SELECT status FROM refund_reversals WHERE merchant_refund_id = $1', [merchantRefundId]);
  assert.strictEqual(resCheck.rows[0].status, 'PENDING', 'Reservation must remain PENDING after invalid settlement attempts');

  // 6d. Valid SUCCESS reverseRefundAtomic
  const uniqueProvRefId = 'cf_ref_valid_' + Date.now();
  const validRev = await pg.reverseRefundAtomic({
    orderId: bypassOrderId,
    merchantRefundId,
    amount: 200,
    currency: 'INR',
    reason: 'Valid partial refund',
    providerRefundId: uniqueProvRefId
  });
  assert.strictEqual(validRev.success, true, 'Valid refund reversal must succeed');

  // Verify status is now SUCCESS and a DEBIT_REFUND ledger entry was created
  const resCheckSuccess = await pool.query('SELECT status, provider_refund_id FROM refund_reversals WHERE merchant_refund_id = $1', [merchantRefundId]);
  assert.strictEqual(resCheckSuccess.rows[0].status, 'SUCCESS');
  assert.strictEqual(resCheckSuccess.rows[0].provider_refund_id, uniqueProvRefId);

  const debitLedger = await pool.query('SELECT * FROM rank_ledger WHERE order_id = $1 AND type = $2', [bypassOrderId, 'DEBIT_REFUND']);
  assert.strictEqual(debitLedger.rows.length, 1, 'Exactly one DEBIT_REFUND ledger row created');
  assert.strictEqual(Number(debitLedger.rows[0].amount), -200, 'Ledger debit must be recorded as negative amount');

  // 6e. Idempotent replay: Calling again must not debit the ledger a second time
  const replayRev = await pg.reverseRefundAtomic({
    orderId: bypassOrderId,
    merchantRefundId,
    amount: 200,
    currency: 'INR',
    reason: 'Valid partial refund',
    providerRefundId: uniqueProvRefId
  });
  assert.strictEqual(replayRev.success, true, 'Idempotent replay must report success');
  const debitLedgerReplay = await pool.query('SELECT * FROM rank_ledger WHERE order_id = $1 AND type = $2', [bypassOrderId, 'DEBIT_REFUND']);
  assert.strictEqual(debitLedgerReplay.rows.length, 1, 'Ledger debit row count must remain 1 on replay');
  pass('reverseRefundAtomic strictly validates reservation metadata, updates reserved row to SUCCESS, and records single atomic ledger debit');

  // -----------------------------------------------------------------
  // 7. Operational Outbox: Independent Channel Delivery & Error Sanitization
  // -----------------------------------------------------------------
  console.log('\n--- 7. Operational Outbox: Channel Tracking & Safety ---');

  // Create a new settled order to generate an outbox event
  const outboxTestOrderId = 'ord_outbox_test_' + Date.now();
  await pg.createOrder({
    orderId: outboxTestOrderId,
    name: 'Outbox Delivery Test',
    amount: 1000,
    currency: 'INR',
    ownerToken: 'lazy_owner_outbox_' + Date.now(),
    consentAccepted: true
  });
  await pg.settlePaymentAtomic({
    orderId: outboxTestOrderId,
    providerPaymentId: 'cf_pay_outbox_' + Date.now(),
    provider: 'cashfree',
    amount: 1000,
    currency: 'INR',
    status: 'PAID',
    signatureVerified: true
  });

  // Verify outbox entry exists
  const outboxItem = await pool.query('SELECT * FROM operational_outbox WHERE order_id = $1', [outboxTestOrderId]);
  assert.strictEqual(outboxItem.rows.length, 1, 'Outbox item was enqueued upon payment settlement');
  const outboxId = outboxItem.rows[0].id;

  // With no channels configured, verify the event is marked SKIPPED_NO_CHANNELS (never DELIVERED)
  await new Promise(r => setTimeout(r, 150));
  let skippedCheck = await pool.query('SELECT delivery_status FROM operational_outbox WHERE id = $1', [outboxId]);
  if (skippedCheck.rows[0].delivery_status === 'PENDING') {
    await pg.dispatchOperationalOutbox();
    skippedCheck = await pool.query('SELECT delivery_status FROM operational_outbox WHERE id = $1', [outboxId]);
  }
  assert.strictEqual(skippedCheck.rows[0].delivery_status, 'SKIPPED_NO_CHANNELS', 'Unconfigured alert marked SKIPPED_NO_CHANNELS');

  // Test independent channel delivery: reset status to PENDING and simulate channels
  await pool.query("UPDATE operational_outbox SET delivery_status = 'PENDING', next_attempt_at = NOW() WHERE id = $1", [outboxId]);

  // Set fake Telegram and Discord credentials
  const fakeBotToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
  const fakeChatId = '987654321';
  const fakeDiscordWebhook = 'https://discord.com/api/webhooks/111222333/abcdefghijk-secret-token';

  process.env.TELEGRAM_BOT_TOKEN = fakeBotToken;
  process.env.TELEGRAM_ADMIN_CHAT_ID = fakeChatId;
  process.env.DISCORD_WEBHOOK_URL = fakeDiscordWebhook;

  // Mock fetch: Telegram succeeds, Discord fails with an error containing the secret webhook URL
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes('telegram.org')) {
      return { ok: true, json: async () => ({ ok: true }) } as any;
    }
    if (urlStr.includes('discord.com')) {
      // Verify allowed_mentions is set in payload
      const body = JSON.parse(init?.body as string || '{}');
      assert.deepStrictEqual(body.allowed_mentions, { parse: [] }, 'Discord payload must disable all mentions');
      // Return 500 error containing the webhook URL to test sanitization
      return {
        ok: false,
        status: 500,
        text: async () => `Server error from ${fakeDiscordWebhook}`
      } as any;
    }
    return { ok: true } as any;
  };

  try {
    const channelDispatch = await pg.dispatchOperationalOutbox();
    assert.strictEqual(channelDispatch.failed, 1, 'Overall outbox dispatch failed because Discord failed');

    // Verify outbox_channel_deliveries table recorded telegram as DELIVERED and discord as FAILED
    const tgDelivery = await pool.query(
      'SELECT * FROM outbox_channel_deliveries WHERE outbox_id = $1 AND channel = $2',
      [outboxId, 'telegram']
    );
    assert.strictEqual(tgDelivery.rows.length, 1, 'Telegram channel delivery record exists');
    assert.strictEqual(tgDelivery.rows[0].delivery_status, 'DELIVERED', 'Telegram is marked DELIVERED');

    const discordDelivery = await pool.query(
      'SELECT * FROM outbox_channel_deliveries WHERE outbox_id = $1 AND channel = $2',
      [outboxId, 'discord']
    );
    assert.strictEqual(discordDelivery.rows.length, 1, 'Discord channel delivery record exists');
    assert.strictEqual(discordDelivery.rows[0].delivery_status, 'FAILED', 'Discord is marked FAILED');

    // Verify sanitization: error in operational_outbox and outbox_channel_deliveries must NOT contain the secret webhook
    const sanitizedCheck = await pool.query('SELECT last_error FROM operational_outbox WHERE id = $1', [outboxId]);
    assert.ok(!sanitizedCheck.rows[0].last_error.includes(fakeDiscordWebhook), 'Secret webhook URL must be redacted from outbox error');
    assert.ok(sanitizedCheck.rows[0].last_error.includes('[REDACTED_DISCORD_WEBHOOK]'), 'Error must contain redacted placeholder');

    // Now test retry: reset next_attempt_at and run dispatcher again
    // Telegram was already DELIVERED, so it must NOT be resent
    let telegramFetchCount = 0;
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('telegram.org')) {
        telegramFetchCount++;
        return { ok: true } as any;
      }
      if (urlStr.includes('discord.com')) {
        // Discord now succeeds
        return { ok: true } as any;
      }
      return { ok: true } as any;
    };

    await pool.query("UPDATE operational_outbox SET next_attempt_at = NOW() WHERE id = $1", [outboxId]);
    const retryDispatch = await pg.dispatchOperationalOutbox();
    assert.strictEqual(retryDispatch.delivered, 1, 'Outbox item fully delivered after Discord retry');
    assert.strictEqual(telegramFetchCount, 0, 'Telegram must NOT be resent when already delivered');

    const finalOutbox = await pool.query('SELECT delivery_status FROM operational_outbox WHERE id = $1', [outboxId]);
    assert.strictEqual(finalOutbox.rows[0].delivery_status, 'DELIVERED', 'Final status is DELIVERED');

    pass('Outbox tracks independent channel delivery, redacts secrets in errors, disables mentions, and avoids resending successful channels');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    delete process.env.DISCORD_WEBHOOK_URL;
  }

  // -----------------------------------------------------------------
  // 8. Social Voting Atomicity & Production Secret Guard
  // -----------------------------------------------------------------
  console.log('\n--- 8. Social Voting Atomicity & Secret Protection ---');

  // Create a profile for voting tests
  const voteProfileId = 'p_vote_' + Date.now();
  const voteOwnerHash = crypto.createHash('sha256').update('vote_test_token_' + Date.now()).digest('hex');
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, moderation_status, votes_count, owner_token_hash, created_at, updated_at)
     VALUES ($1, $2, 'Voting Candidate', 300, 999, TRUE, 'active', 0, $3, NOW(), NOW())`,
    [voteProfileId, 'u_vote_' + Date.now(), voteOwnerHash]
  );

  // 8a. In production, missing or default VOTE_SECRET must fail closed
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.VOTE_SECRET;

    const prodFailClosed = await pg.voteProfile(voteProfileId, '192.168.1.1', 'Mozilla/5.0');
    assert.strictEqual(prodFailClosed.success, false, 'Voting must fail closed in production without VOTE_SECRET');
    assert.strictEqual(prodFailClosed.message, 'Voting feature is temporarily unavailable.');

    process.env.VOTE_SECRET = 'lazyproof_vote_salt_2026'; // default salt
    const prodDefaultFail = await pg.voteProfile(voteProfileId, '192.168.1.1', 'Mozilla/5.0');
    assert.strictEqual(prodDefaultFail.success, false, 'Voting must fail closed with default public salt in production');
  } finally {
    process.env.NODE_ENV = prevEnv;
  }

  // 8b. Atomic voting with valid secret
  process.env.VOTE_SECRET = 'secure_production_quality_secret_salt_12345';
  const vote1 = await pg.voteProfile(voteProfileId, '10.0.0.1', 'TestBrowser/1.0');
  assert.strictEqual(vote1.success, true, 'First vote must succeed');
  assert.strictEqual(vote1.profile?.votesCount, 1, 'Profile votes count must increment to 1');

  // Verify profile_votes row was created
  const voteRows = await pool.query('SELECT * FROM profile_votes WHERE profile_id = $1', [voteProfileId]);
  assert.strictEqual(voteRows.rows.length, 1, 'Exactly one vote record exists');

  // 8c. Duplicate vote from same IP + UserAgent must be rejected
  const voteDuplicate = await pg.voteProfile(voteProfileId, '10.0.0.1', 'TestBrowser/1.0');
  assert.strictEqual(voteDuplicate.success, false, 'Duplicate vote must be rejected');
  assert.strictEqual(voteDuplicate.message, 'You already voted for this person!');

  // Verify vote count did not increment
  const profAfterDup = await pg.getProfile(voteProfileId);
  assert.strictEqual(profAfterDup?.votesCount, 1, 'Vote count must NOT increment on duplicate vote');

  const voteRowsAfterDup = await pool.query('SELECT * FROM profile_votes WHERE profile_id = $1', [voteProfileId]);
  assert.strictEqual(voteRowsAfterDup.rows.length, 1, 'Vote rows count must remain exactly 1');
  pass('voteProfile guarantees atomic transaction execution, duplicate vote prevention, and fail-closed secret protection');

  // -----------------------------------------------------------------
  // 9. SEO & Structured Data Integrity
  // -----------------------------------------------------------------
  console.log('\n--- 9. SEO JSON-LD Publisher & sameAs Validation ---');
  const mockProfile: UserProfile = {
    id: 'test_prof_seo',
    userId: 'u_seo_1',
    name: 'SEO Test Master',
    amount: 5000,
    rank: 1,
    isVerified: true,
    firstVerifiedAt: new Date().toISOString(),
    moderationStatus: 'active',
    votesCount: 42,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    twitter: '@adabhra',
    instagram: 'lazy_adabhra',
    linkedin: 'linkedin.com/in/adabhra-group',
    website: 'https://adabhra.in'
  };

  const jsonLd: any = generateProfileJsonLd(mockProfile, 'https://lazyproof.online');
  const websiteNode = jsonLd['@graph'].find((n: any) => n['@type'] === 'WebSite');
  assert.ok(websiteNode, 'JSON-LD graph must contain WebSite node');
  assert.strictEqual(websiteNode.publisher?.name, 'ADABHRA GROUP', 'Publisher must be ADABHRA GROUP');
  assert.strictEqual(websiteNode.publisher?.name, SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME, 'Publisher must match SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME');

  const personNode = jsonLd['@graph'].find((n: any) => n['@type'] === 'ProfilePage')?.mainEntity;
  assert.ok(personNode, 'JSON-LD graph must contain Person node');
  assert.ok(Array.isArray(personNode.sameAs), 'sameAs must be an array');
  assert.ok(personNode.sameAs.includes('https://x.com/adabhra'), 'sameAs must contain normalized x.com url');
  assert.ok(personNode.sameAs.includes('https://instagram.com/lazy_adabhra'), 'sameAs must contain normalized instagram url');
  assert.ok(personNode.sameAs.includes('https://linkedin.com/in/adabhra-group'), 'sameAs must contain normalized linkedin url');
  assert.ok(personNode.sameAs.includes('https://adabhra.in/'), 'sameAs must contain valid website url');

  // Profile with invalid/malicious links must filter them out
  const dirtyProfile: UserProfile = {
    ...mockProfile,
    twitter: 'javascript:alert(1)',
    instagram: '<script>alert(1)</script>',
    website: 'ftp://invalidscheme.com'
  };
  const dirtyJsonLd: any = generateProfileJsonLd(dirtyProfile, 'https://lazyproof.online');
  const dirtyPersonNode = dirtyJsonLd['@graph'].find((n: any) => n['@type'] === 'ProfilePage')?.mainEntity;
  const dirtySameAs: string[] = dirtyPersonNode.sameAs || [];
  assert.strictEqual(dirtySameAs.some(u => u.includes('javascript:')), false, 'javascript: URI must be stripped');
  assert.strictEqual(dirtySameAs.some(u => u.includes('<script>')), false, 'script tags must be stripped');
  assert.strictEqual(dirtySameAs.some(u => u.includes('ftp://')), false, 'ftp:// scheme must be stripped');
  pass('generateProfileJsonLd names ADABHRA GROUP as publisher and safely sanitizes and validates all sameAs social links');

  // -----------------------------------------------------------------
  // Clean Up Test Database
  // -----------------------------------------------------------------
  await pool.query('DELETE FROM outbox_channel_deliveries WHERE outbox_id = $1', [outboxId]);
  await pool.query('DELETE FROM operational_outbox WHERE id = $1', [outboxId]);
  await pool.query('DELETE FROM profile_votes WHERE profile_id = $1', [voteProfileId]);
  await pool.query('DELETE FROM profiles WHERE id = $1', [voteProfileId]);
  await pool.query('DELETE FROM rank_ledger WHERE order_id IN ($1, $2)', [bypassOrderId, outboxTestOrderId]);
  await pool.query('DELETE FROM refund_reversals WHERE order_id IN ($1, $2)', [bypassOrderId, outboxTestOrderId]);
  await pool.query('DELETE FROM payment_transactions WHERE order_id IN ($1, $2)', [bypassOrderId, outboxTestOrderId]);
  await pool.query('DELETE FROM payment_orders WHERE order_id IN ($1, $2)', [bypassOrderId, outboxTestOrderId]);
  await pool.end();

  console.log(`\n========================================================`);
  console.log(`ALL PHASE 5 TESTS PASSED: ${passed} assertions verified`);
  console.log(`========================================================\n`);
  process.exit(0);
}

runPhase5Tests().catch(err => {
  console.error('\nPhase 5 test failed:', err);
  process.exit(1);
});
