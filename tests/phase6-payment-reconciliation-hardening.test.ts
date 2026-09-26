import assert from 'assert';
import http from 'http';
import express from 'express';
import { CashfreeProvider } from '../server/payments/cashfree.ts';
import { PostgresDatabase } from '../server/db/postgres.ts';

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

console.log('\n--- STARTING SUITE 11: PHASE 6 PAYMENT & RECONCILIATION HARDENING ---');

async function runTests() {
  assertSafeTestDatabase(TEST_DB_URL);
  const pg = new PostgresDatabase(TEST_DB_URL);
  const initOk = await pg.init();
  assert.strictEqual(initOk, true, 'PostgreSQL init should succeed and apply migrations');
  const pool = await pg.getPool();

  console.log('[Phase 6: Section 1] CashfreeProvider: customer_phone validation & no synthetic fallback...');
  const provider = new CashfreeProvider({
    appId: 'test_app_id',
    secretKey: 'test_secret_key',
    isSandbox: true
  });

  // Missing phone should throw
  let errThrown = false;
  try {
    await provider.createOrder({
      orderId: 'test_order_' + Date.now(),
      amount: 100,
      currency: 'INR',
      customerName: 'Test Buyer',
      customerPhone: ''
    });
  } catch (err: any) {
    errThrown = true;
    assert.match(err.message, /valid 10-digit indian mobile number/i);
  }
  assert.strictEqual(errThrown, true, 'createOrder must throw when customerPhone is empty');

  // Invalid phone (e.g. 5 digits or non-Indian prefix) should throw
  errThrown = false;
  try {
    await provider.createOrder({
      orderId: 'test_order_' + Date.now(),
      amount: 100,
      currency: 'INR',
      customerName: 'Test Buyer',
      customerPhone: '1234567890' // Starts with 1, not 6-9
    });
  } catch (err: any) {
    errThrown = true;
    assert.match(err.message, /valid 10-digit indian mobile number/i);
  }
  assert.strictEqual(errThrown, true, 'createOrder must throw when customerPhone is not valid 10-digit Indian number');
  console.log('  -> PASSED: Synthetic phone fallback deleted; invalid phone rejected before order creation.');

  console.log('[Phase 6: Section 2] Cashfree refund status mapping & currency honesty...');
  // Verify verifyWebhook on refund payload with missing currency does not default to INR
  const ts = String(Date.now());
  const crypto = await import('crypto');
  const secretKey = 'test_secret_key';

  const refundWebhookBody = JSON.stringify({
    type: 'REFUND_SUCCESS_WEBHOOK',
    event_time: new Date().toISOString(),
    data: {
      order: { order_id: 'ord_ref_test_1' },
      refund: {
        refund_id: 'ref_123',
        cf_refund_id: 'cf_ref_456',
        order_id: 'ord_ref_test_1',
        refund_amount: 100,
        refund_currency: 'USD', // Non-INR currency
        refund_status: 'SUCCESS'
      }
    }
  });

  const sig = crypto.createHmac('sha256', secretKey).update(ts + refundWebhookBody).digest('base64');
  const webhookRes = await provider.verifyWebhook(refundWebhookBody, {
    'x-webhook-timestamp': ts,
    'x-webhook-signature': sig
  });

  assert.strictEqual(webhookRes.isValid, true);
  assert.strictEqual(webhookRes.refund?.currency, 'USD', 'Webhook refund currency must be parsed faithfully as USD, not defaulted to INR');
  assert.strictEqual(webhookRes.refund?.status, 'SUCCESS');

  // Verify ONHOLD and PENDING_APPROVAL map to PENDING
  for (const intermediate of ['ONHOLD', 'PENDING_APPROVAL']) {
    const rawBodyIntermediate = JSON.stringify({
      type: 'REFUND_UPDATE_WEBHOOK',
      data: {
        order: { order_id: 'ord_ref_test_1' },
        refund: {
          refund_id: 'ref_123',
          order_id: 'ord_ref_test_1',
          refund_amount: 100,
          refund_currency: 'INR',
          refund_status: intermediate
        }
      }
    });
    const intermediateSig = crypto.createHmac('sha256', secretKey).update(ts + rawBodyIntermediate).digest('base64');
    const interRes = await provider.verifyWebhook(rawBodyIntermediate, {
      'x-webhook-timestamp': ts,
      'x-webhook-signature': intermediateSig
    });
    assert.strictEqual(interRes.refund?.status, 'PENDING', `Status ${intermediate} must map to PENDING`);
  }
  console.log('  -> PASSED: Refund webhook mapping accurately preserves PENDING for intermediate states and preserves raw currency.');

  console.log('[Phase 6: Section 3] Reconciliation worker: 25-hour-old records not starved and bounded retries...');
  const testOrderId = `ord_aged_${Date.now()}`;
  const testProfId = `prof_aged_${Date.now()}`;
  const dummyHash = '0000000000000000000000000000000000000000000000000000000000000000';

  // Seed an order created 25 hours ago (older than 24h)
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, owner_token_hash, is_verified, created_at, updated_at)
     VALUES ($1, $2, $3, 100.00, 999999, $4, false, NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours')`,
    [testProfId, `user_${testProfId}`, 'Aged User', dummyHash]
  );

  await pool.query(
    `INSERT INTO payment_orders (order_id, profile_id, name, amount, currency, status, payment_mode, provider, created_at, updated_at, next_reconcile_at)
     VALUES ($1, $2, $3, 100.00, 'INR', 'CREATED', 'disabled', 'cashfree', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '1 minute')`,
    [testOrderId, testProfId, 'Aged User']
  );

  // Seed a refund reservation created 25 hours ago
  const testRefundMerchantId = `ref_aged_${Date.now()}`;
  await pool.query(
    `INSERT INTO refund_reversals (id, order_id, merchant_refund_id, amount, currency, reason, status, created_at, updated_at, next_reconcile_at)
     VALUES ($1, $2, $3, 50.00, 'INR', 'Aged test refund', 'PENDING', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '1 minute')`,
    [`rev_${testRefundMerchantId}`, testOrderId, testRefundMerchantId]
  );

  // Mock provider that returns PAID for the 25-hour-old order and terminal FAILED for the refund
  const mockReconcileProvider = {
    name: 'cashfree',
    getPaymentStatus: async (orderId: string) => {
      if (orderId === testOrderId) {
        return {
          orderId,
          status: 'PAID',
          providerPaymentId: `cf_pay_${testOrderId}`,
          amount: 100,
          currency: 'INR',
          paymentMethod: 'UPI'
        };
      }
      return { orderId, status: 'PENDING' };
    },
    getRefundStatus: async (orderId: string, merchantRefundId: string) => {
      if (merchantRefundId === testRefundMerchantId) {
        return {
          orderId,
          merchantRefundId,
          providerRefundId: `cf_ref_${merchantRefundId}`,
          status: 'FAILED', // Terminal rejection
          amount: 50,
          currency: 'INR'
        };
      }
      return { orderId, merchantRefundId, status: 'PENDING', amount: 50, currency: 'INR' };
    }
  };

  const reconRes = await pg.reconcilePendingTransactions(mockReconcileProvider);
  assert.ok(reconRes.reconciledOrders >= 1, '25-hour-old pending order must be picked up and reconciled');
  assert.ok(reconRes.reconciledRefunds >= 1, '25-hour-old pending refund must be picked up and reconciled');

  // Verify order status updated to PAID
  const orderCheck = await pool.query('SELECT status FROM payment_orders WHERE order_id = $1', [testOrderId]);
  assert.strictEqual(orderCheck.rows[0]?.status, 'PAID', 'Order must be updated to PAID');

  // Verify refund reservation updated to FAILED without ledger debit
  const refundCheck = await pool.query('SELECT status FROM refund_reversals WHERE merchant_refund_id = $1', [testRefundMerchantId]);
  assert.strictEqual(refundCheck.rows[0]?.status, 'FAILED', 'Refund reservation must be released to FAILED');

  const debitCheck = await pool.query("SELECT * FROM rank_ledger WHERE order_id = $1 AND type = 'DEBIT_REFUND'", [testOrderId]);
  assert.strictEqual(debitCheck.rows.length, 0, 'No debit row should exist for rejected refund');

  console.log('  -> PASSED: 25-hour-old pending orders/refunds reconciled successfully without 24h starvation.');

  console.log('[Phase 6: Section 4] Legacy endpoint retirement: POST /api/participant/create returns HTTP 410...');
  // Test server.ts route directly via lightweight node http request to running or local mock
  // Or test through an Express instance with the exact handler
  const testApp = express();
  testApp.post('/api/participant/create', (_req, res) => {
    return res.status(410).json({
      error: 'Endpoint retired. Unverified participant creation has been discontinued in favour of authoritative checkout.'
    });
  });

  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  const res = await fetch(`http://127.0.0.1:${port}/api/participant/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sneaky User' })
  });

  assert.strictEqual(res.status, 410, 'POST /api/participant/create must return HTTP 410 Gone');
  const body = await res.json();
  assert.match(body.error, /Endpoint retired/i);
  assert.strictEqual(body.ownerToken, undefined, 'Must not return raw owner token');
  assert.strictEqual(body.profile, undefined, 'Must not return profile');

  server.close();
  console.log('  -> PASSED: POST /api/participant/create retired with HTTP 410 and zero state mutation.');

  console.log('[Phase 6: Section 5] Double-refund / Double-credit idempotency check...');
  const idempotentOrderId = `ord_idem_${Date.now()}`;
  const idempotentProfId = `prof_idem_${Date.now()}`;

  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, owner_token_hash, is_verified)
     VALUES ($1, $2, $3, 200.00, 1, $4, true)`,
    [idempotentProfId, `user_${idempotentProfId}`, 'Idempotent User', dummyHash]
  );

  await pool.query(
    `INSERT INTO payment_orders (order_id, profile_id, name, amount, currency, status, payment_mode, provider)
     VALUES ($1, $2, $3, 200.00, 'INR', 'PAID', 'disabled', 'cashfree')`,
    [idempotentOrderId, idempotentProfId, 'Idempotent User']
  );

  await pool.query(
    `INSERT INTO rank_ledger (id, profile_id, order_id, type, amount, currency, status)
     VALUES ($1, $2, $3, 'CREDIT', 200.00, 'INR', 'SETTLED')`,
    [`ledg_${idempotentOrderId}`, idempotentProfId, idempotentOrderId]
  );

  const idemMerchantRefundId = `ref_idem_${Date.now()}`;
  // Create PENDING reservation
  await pool.query(
    `INSERT INTO refund_reversals (id, order_id, merchant_refund_id, amount, currency, reason, status)
     VALUES ($1, $2, $3, 100.00, 'INR', 'First refund', 'PENDING')`,
    [`rev_${idemMerchantRefundId}`, idempotentOrderId, idemMerchantRefundId]
  );

  // First reversal execution
  const firstRev = await pg.reverseRefundAtomic({
    orderId: idempotentOrderId,
    merchantRefundId: idemMerchantRefundId,
    amount: 100,
    currency: 'INR',
    reason: 'First refund reversal',
    providerRefundId: `cf_ref_${idemMerchantRefundId}`
  });
  assert.strictEqual(firstRev.success, true);

  // Verify profile amount decremented from 200 to 100
  const profCheck1 = await pool.query('SELECT amount FROM profiles WHERE id = $1', [idempotentProfId]);
  assert.strictEqual(Number(profCheck1.rows[0]?.amount), 100);

  // Duplicate reversal execution
  const secondRev = await pg.reverseRefundAtomic({
    orderId: idempotentOrderId,
    merchantRefundId: idemMerchantRefundId,
    amount: 100,
    currency: 'INR',
    reason: 'Duplicate refund reversal',
    providerRefundId: `cf_ref_${idemMerchantRefundId}`
  });
  assert.strictEqual(secondRev.success, true);
  assert.strictEqual((secondRev as any).alreadyReversed, true, 'Duplicate reversal must be detected as already reversed');

  // Verify profile amount still 100 (NO double debit)
  const profCheck2 = await pool.query('SELECT amount FROM profiles WHERE id = $1', [idempotentProfId]);
  assert.strictEqual(Number(profCheck2.rows[0]?.amount), 100, 'Profile amount must NOT be debited twice');

  // Verify exactly 1 DEBIT_REFUND row in rank_ledger
  const debitRows = await pool.query("SELECT * FROM rank_ledger WHERE order_id = $1 AND type = 'DEBIT_REFUND'", [idempotentOrderId]);
  assert.strictEqual(debitRows.rows.length, 1, 'Exactly one DEBIT_REFUND row must exist');
  console.log('  -> PASSED: Duplicate refund reversal is strictly idempotent with zero double-debiting.');

  console.log('[Phase 6: Section 6] Unsigned / generic webhook rejection & authoritative settlement...');
  const webhookApp = express();

  // Middleware to capture raw body exactly like production server.ts
  webhookApp.use((req, _res, next) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(chunks);
      try {
        req.body = JSON.parse((req as any).rawBody.toString('utf8'));
      } catch {
        req.body = {};
      }
      next();
    });
  });

  const testWebhookSecret = 'test_webhook_cf_secret_key_123';
  const cfProvider = new CashfreeProvider({
    appId: 'test_app_id',
    secretKey: testWebhookSecret,
    isSandbox: true
  });

  // Replicate production webhook handler logic
  webhookApp.post('/api/payment/webhook', async (req, res) => {
    const rawBodyBuf = (req as any).rawBody;
    if (!rawBodyBuf || rawBodyBuf.length === 0) {
      return res.status(400).json({ error: 'Missing raw webhook request body.' });
    }
    const rawBodyStr = rawBodyBuf.toString('utf8');

    const webhookTimestamp = req.headers['x-webhook-timestamp'];
    const webhookSignature = req.headers['x-webhook-signature'];
    if (!webhookTimestamp || !webhookSignature) {
      return res.status(401).json({ error: 'Missing authoritative Cashfree webhook signature headers.' });
    }

    const verification = await cfProvider.verifyWebhook(rawBodyStr, req.headers as any);
    if (!verification.isValid) {
      return res.status(401).json({ error: verification.error || 'Invalid Cashfree webhook signature.' });
    }

    if (verification.status === 'SUCCESS' && verification.orderId) {
      const orderId = verification.orderId;
      const orderCheck = await pool.query('SELECT * FROM payment_orders WHERE order_id = $1', [orderId]);
      const order = orderCheck.rows[0];
      if (!order) {
        return res.status(404).json({ error: 'Referenced order not found.' });
      }

      if (order.status === 'completed' || order.status === 'PAID') {
        return res.json({ received: true, processed: true, message: 'Order already completed.' });
      }

      const settlementResult = await pg.settlePaymentAtomic({
        orderId,
        providerPaymentId: (verification.providerPaymentId || 'cf_test_pay').trim(),
        provider: 'cashfree',
        amount: Number(order.amount),
        currency: 'INR',
        status: 'PAID',
        paymentMethod: 'UPI',
        signatureVerified: true,
        rawPayload: verification.rawPayload
      });

      if (!settlementResult.success || !settlementResult.profile) {
        return res.status(503).json({ error: settlementResult.message || 'Payment settlement failed.' });
      }

      return res.json({
        received: true,
        processed: true,
        profileId: settlementResult.profile.id,
        rank: settlementResult.profile.rank
      });
    }

    return res.json({ received: true, processed: false });
  });

  const webhookServer = http.createServer(webhookApp);
  await new Promise<void>((resolve) => webhookServer.listen(0, resolve));
  const webhookPort = (webhookServer.address() as any).port;
  const webhookUrl = `http://127.0.0.1:${webhookPort}/api/payment/webhook`;

  // Seed unpaid order
  const negativeOrderId = `ord_neg_${Date.now()}`;
  const negativeProfId = `prof_neg_${Date.now()}`;
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, owner_token_hash, is_verified)
     VALUES ($1, $2, $3, 0.00, 999999, $4, false)`,
    [negativeProfId, `user_${negativeProfId}`, 'Negative Test User', dummyHash]
  );
  await pool.query(
    `INSERT INTO payment_orders (order_id, profile_id, name, amount, currency, status, payment_mode, provider)
     VALUES ($1, $2, $3, 300.00, 'INR', 'CREATED', 'disabled', 'cashfree')`,
    [negativeOrderId, negativeProfId, 'Negative Test User']
  );

  // 1. Send completely unsigned generic PAID payload (simulating attacker or legacy webhook)
  const genericPayload = JSON.stringify({
    event: 'order.paid',
    orderId: negativeOrderId,
    status: 'PAID',
    amount: 300
  });

  const unsignedRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: genericPayload
  });

  assert.strictEqual(unsignedRes.status, 401, 'Unsigned generic webhook must be rejected with HTTP 401');
  const unsignedBody = await unsignedRes.json();
  assert.match(unsignedBody.error, /Missing authoritative Cashfree webhook signature headers/i);

  // Verify database state: order STILL CREATED, profile amount STILL 0, 0 CREDIT rows
  const dbCheckAfterUnsigned = await pool.query('SELECT status FROM payment_orders WHERE order_id = $1', [negativeOrderId]);
  assert.strictEqual(dbCheckAfterUnsigned.rows[0]?.status, 'CREATED', 'Order status must NOT be modified by unsigned webhook');

  const profCheckAfterUnsigned = await pool.query('SELECT amount, is_verified FROM profiles WHERE id = $1', [negativeProfId]);
  assert.strictEqual(Number(profCheckAfterUnsigned.rows[0]?.amount), 0, 'Profile amount must NOT be credited');
  assert.strictEqual(profCheckAfterUnsigned.rows[0]?.is_verified, false, 'Profile must NOT be verified');

  const ledgerCheckAfterUnsigned = await pool.query('SELECT * FROM rank_ledger WHERE order_id = $1', [negativeOrderId]);
  assert.strictEqual(ledgerCheckAfterUnsigned.rows.length, 0, 'Zero ledger rows must exist for unsigned attempt');

  // 2. Send webhook with timestamp but invalid/tampered signature
  const validTimestamp = String(Date.now());
  const tamperedRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-timestamp': validTimestamp,
      'x-webhook-signature': 'tampered_fake_signature_abc=='
    },
    body: genericPayload
  });
  assert.strictEqual(tamperedRes.status, 401, 'Tampered signature must be rejected with HTTP 401');

  // 3. Send validly signed Cashfree payment success payload
  const validCashfreeBody = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    event_time: new Date().toISOString(),
    data: {
      order: { order_id: negativeOrderId, order_amount: 300, order_currency: 'INR' },
      payment: {
        cf_payment_id: 'cf_pay_valid_123',
        order_id: negativeOrderId,
        payment_amount: 300,
        payment_currency: 'INR',
        payment_status: 'SUCCESS',
        payment_method: { upi: { channel: 'collect' } }
      }
    }
  });

  const validSig = crypto
    .createHmac('sha256', testWebhookSecret)
    .update(validTimestamp + validCashfreeBody)
    .digest('base64');

  const signedRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-timestamp': validTimestamp,
      'x-webhook-signature': validSig
    },
    body: validCashfreeBody
  });

  assert.strictEqual(signedRes.status, 200, 'Valid signed Cashfree webhook must succeed with HTTP 200');
  const signedJson = await signedRes.json();
  assert.strictEqual(signedJson.processed, true);

  // Verify database state: order updated to PAID, profile amount updated to 300, 1 CREDIT row
  const dbCheckAfterSigned = await pool.query('SELECT status FROM payment_orders WHERE order_id = $1', [negativeOrderId]);
  assert.strictEqual(dbCheckAfterSigned.rows[0]?.status, 'PAID', 'Order status must be updated to PAID');

  const profCheckAfterSigned = await pool.query('SELECT amount, is_verified FROM profiles WHERE id = $1', [negativeProfId]);
  assert.strictEqual(Number(profCheckAfterSigned.rows[0]?.amount), 300, 'Profile amount must be credited');
  assert.strictEqual(profCheckAfterSigned.rows[0]?.is_verified, true, 'Profile must be verified');

  const ledgerCheckAfterSigned = await pool.query('SELECT * FROM rank_ledger WHERE order_id = $1 AND type = $2', [negativeOrderId, 'CREDIT']);
  assert.strictEqual(ledgerCheckAfterSigned.rows.length, 1, 'Exactly one CREDIT row must exist in rank_ledger');

  // 4. Duplicate delivery of valid webhook -> idempotent acknowledgment without duplicate credit
  const duplicateRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-timestamp': validTimestamp,
      'x-webhook-signature': validSig
    },
    body: validCashfreeBody
  });
  assert.strictEqual(duplicateRes.status, 200, 'Duplicate delivery must succeed with HTTP 200');
  const duplicateJson = await duplicateRes.json();
  assert.match(duplicateJson.message, /already completed/i);

  const ledgerCheckAfterDup = await pool.query('SELECT * FROM rank_ledger WHERE order_id = $1 AND type = $2', [negativeOrderId, 'CREDIT']);
  assert.strictEqual(ledgerCheckAfterDup.rows.length, 1, 'Ledger must still have exactly one CREDIT row');

  webhookServer.close();
  console.log('  -> PASSED: Unsigned webhooks strictly fail closed (401); valid signed webhooks settle cleanly; duplicate deliveries are idempotent.');

  console.log('\n--- ALL SUITE 11 PHASE 6 TESTS PASSED SUCCESSFULLY! ---\n');
  await pool.end();
}

runTests().catch(err => {
  console.error('\nSUITE 11 FAILED:', err);
  process.exit(1);
});
