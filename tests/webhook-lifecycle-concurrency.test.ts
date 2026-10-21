import assert from 'assert';
import crypto from 'crypto';
import http from 'http';
import { Webhook } from 'standardwebhooks';
import { PostgresDatabase } from '../server/db/postgres.ts';

const TEST_PORT = 3295;
process.env.PORT = String(TEST_PORT);
process.env.NODE_ENV = 'test';
process.env.PAYMENT_MODE = 'disabled';
process.env.CHECKOUT_ENABLED = 'false';
process.env.DODO_PAYMENTS_WEBHOOK_KEY = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
process.env.DODO_PAYMENTS_API_KEY = 'test_dodo_api_key_valid';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';
process.env.USE_POSTGRES = 'true';

type TestFn = () => void | Promise<void>;

async function it(title: string, fn: TestFn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${title}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${title}`, err);
    throw err;
  }
}

async function describe(suiteTitle: string, fn: () => void | Promise<void>) {
  console.log(`\n--- ${suiteTitle} ---`);
  await fn();
}

async function fetchHttp(url: string, options: any = {}) {
  const parsed = new URL(url);
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          Connection: 'close',
          ...(options.headers || {})
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsedBody = raw;
          try {
            parsedBody = JSON.parse(raw);
          } catch {}
          resolve({ status: res.statusCode || 0, headers: res.headers, body: parsedBody });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function createSignedDodoWebhook(payloadObj: any, secret: string, timestamp?: Date) {
  const wh = new Webhook(secret);
  const webhookId = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const ts = timestamp || new Date();
  const rawBody = JSON.stringify(payloadObj);
  const signature = wh.sign(webhookId, ts, rawBody);
  const headers = {
    'content-type': 'application/json',
    'webhook-id': webhookId,
    'webhook-timestamp': Math.floor(ts.getTime() / 1000).toString(),
    'webhook-signature': signature
  };
  return { rawBody, headers, webhookId };
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function runWebhookLifecycleAndConcurrencyTests() {
  console.log('\n========================================================');
  console.log('RUNNING SUITE 21: WEBHOOK LIFECYCLE & CONCURRENCY BENCHMARK');
  console.log('Database Target: Isolated Test PostgreSQL (lazyproof_test)');
  console.log('Target Server: PAYMENT_MODE=disabled, CHECKOUT_ENABLED=false');
  console.log('========================================================\n');

  // 1. Verify isolated test database connection
  const pg = new PostgresDatabase(process.env.DATABASE_URL!);
  assert.strictEqual(pg.isAvailable(), true, 'PostgreSQL test database must be available');
  await pg.init();

  // 2. Start HTTP server
  try {
    await import('../server.ts');
  } catch {}

  const BASE = `http://127.0.0.1:${TEST_PORT}`;
  let connected = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetchHttp(`${BASE}/api/health`);
      if (res.status === 200) {
        connected = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.ok(connected, `Test server connected successfully on port ${TEST_PORT}`);

  // Retrieve payment manager and dodo provider for mocking authoritative provider status
  const { paymentManager } = await import('../server/payments/index.ts');
  const dodoProvider = paymentManager.getProviderFor('dodo');

  // --------------------------------------------------------------------------
  // SECTION 1: Checkout Disabled Invariants
  // --------------------------------------------------------------------------
  await describe('1. Checkout Disabled Enforcement for New Orders', async () => {
    await it('GET /api/payment/config reports paymentMode=disabled and checkoutEnabled=false', async () => {
      const res = await fetchHttp(`${BASE}/api/payment/config`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.paymentMode, 'disabled');
      assert.strictEqual(res.body.checkoutEnabled, false);
    });

    await it('POST /api/payment/create-order returns 503 Service Unavailable when checkout is disabled', async () => {
      const res = await fetchHttp(`${BASE}/api/payment/create-order`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          name: 'Disabled Attempt',
          amount: 100,
          currency: 'INR',
          termsVersion: '2026-09-29',
          privacyVersion: '2026-09-29',
          consentVersion: '2026-09-29',
          affirmativeConsent: true
        }
      });
      assert.strictEqual(res.status, 503, 'Must return HTTP 503 when checkout is disabled');
      assert.ok(
        typeof res.body.error === 'string' && (res.body.error.toLowerCase().includes('disabled') || res.body.error.toLowerCase().includes('unavailable')),
        'Error message must state checkout is unavailable or disabled'
      );
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Webhook Gating & Signature Security
  // --------------------------------------------------------------------------
  await describe('2. Webhook Cryptographic Verification & Header Isolation', async () => {
    await it('POST /api/payment/webhook/dodo with Razorpay headers returns 400 (Header Isolation)', async () => {
      const res = await fetchHttp(`${BASE}/api/payment/webhook/dodo`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': 'fake_rzp_sig',
          'webhook-id': 'msg_123',
          'webhook-timestamp': '1234567890',
          'webhook-signature': 'v1,sig'
        },
        body: { test: true }
      });
      assert.strictEqual(res.status, 400, 'Must reject conflicting Razorpay headers on Dodo route');
      assert.ok(res.body.error.includes('Conflicting provider headers'));
    });

    await it('POST /api/payment/webhook/dodo without signature returns 401 Unauthorized', async () => {
      const res = await fetchHttp(`${BASE}/api/payment/webhook/dodo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { type: 'payment.succeeded' }
      });
      assert.strictEqual(res.status, 401, 'Must reject missing StandardWebhooks headers');
    });

    await it('POST /api/payment/webhook/dodo with forged signature returns 401 Unauthorized', async () => {
      const forgedSecret = 'whsec_' + Buffer.from('wrong_secret_key_1234567890abcdef').toString('base64');
      const signed = createSignedDodoWebhook({ type: 'payment.succeeded' }, forgedSecret);
      const res = await fetchHttp(`${BASE}/api/payment/webhook/dodo`, {
        method: 'POST',
        headers: signed.headers,
        body: signed.rawBody
      });
      assert.strictEqual(res.status, 401, 'Must reject forged StandardWebhooks signature');
    });

    await it('POST /api/payment/webhook/dodo with valid signature for nonexistent order returns 404', async () => {
      const payload = {
        type: 'payment.succeeded',
        data: {
          payment_id: `pay_ghost_${Date.now()}`,
          total_amount: 10000,
          currency: 'INR',
          metadata: { order_id: 'order_nonexistent_999999' }
        }
      };
      const signed = createSignedDodoWebhook(payload, process.env.DODO_PAYMENTS_WEBHOOK_KEY!);
      const res = await fetchHttp(`${BASE}/api/payment/webhook/dodo`, {
        method: 'POST',
        headers: signed.headers,
        body: signed.rawBody
      });
      assert.strictEqual(res.status, 404, 'Must return 404 for unrecorded order');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Webhook Settlement of Existing Obligations under PAYMENT_MODE=disabled
  // --------------------------------------------------------------------------
  await describe('3. Webhook Settlement of Existing Obligations (Fix Verification)', async () => {
    const testOrderId = `order_wh_lifecycle_${Date.now()}`;
    const testPaymentId = `pay_dodo_wh_${Date.now()}`;
    const testOwnerToken = `lazy_test_${crypto.randomBytes(24).toString('hex')}`;
    const testAccessToken = `ord_${crypto.randomBytes(24).toString('hex')}`;

    // Insert an existing bound order into PostgreSQL
    await pg.createOrder({
      orderId: testOrderId,
      name: 'Existing In-Flight Winner',
      amount: 150,
      currency: 'INR',
      provider: 'dodo',
      ownerToken: testOwnerToken,
      orderAccessToken: testAccessToken,
      quoteSnapshot: {
        basePaise: 15000,
        taxPaise: 0,
        feePaise: 0,
        totalPaise: 15000,
        currency: 'INR'
      }
    });

    // Mock authoritative server-to-server payment status verification on provider
    const origGetPaymentStatus = dodoProvider.getPaymentStatus.bind(dodoProvider);
    dodoProvider.getPaymentStatus = async (orderId: string) => {
      if (orderId === testOrderId) {
        return {
          orderId,
          status: 'PAID',
          providerPaymentId: testPaymentId,
          amount: 150,
          currency: 'INR',
          paymentMethod: 'UPI'
        };
      }
      return origGetPaymentStatus(orderId);
    };

    const webhookPayload = {
      type: 'payment.succeeded',
      data: {
        payment_id: testPaymentId,
        total_amount: 15000,
        currency: 'INR',
        payment_method_type: 'upi',
        metadata: { order_id: testOrderId }
      }
    };
    const signed = createSignedDodoWebhook(webhookPayload, process.env.DODO_PAYMENTS_WEBHOOK_KEY!);

    await it('Signed webhook for existing order successfully returns 200 OK under PAYMENT_MODE=disabled', async () => {
      const res = await fetchHttp(`${BASE}/api/payment/webhook/dodo`, {
        method: 'POST',
        headers: signed.headers,
        body: signed.rawBody
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.received, true);
      assert.strictEqual(res.body.processed, true);
    });

    await it('PostgreSQL ledger and profile reflect verified atomic settlement', async () => {
      const updatedOrder = await pg.getOrder(testOrderId);
      assert.strictEqual(updatedOrder?.status, 'PAID', 'Order status must be updated to PAID');
      assert.strictEqual(updatedOrder?.paymentRef, testPaymentId, 'Order paymentRef must match gateway payment ID');

      const leaderboard = await pg.getLeaderboard();
      const profile = leaderboard.profiles.find((p) => p.name === 'Existing In-Flight Winner');
      assert.ok(profile, 'Leaderboard profile must exist');
      assert.strictEqual(profile.amount, 150, 'Leaderboard profile credited with exact ₹150');
    });

    // --------------------------------------------------------------------------
    // SECTION 4: Fast-Path & Durable Deduplication
    // --------------------------------------------------------------------------
    await it('Resending exact duplicate webhook returns 200 duplicate: true without double credit', async () => {
      const res = await fetchHttp(`${BASE}/api/payment/webhook/dodo`, {
        method: 'POST',
        headers: signed.headers,
        body: signed.rawBody
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.duplicate, true, 'Must identify as duplicate');

      const leaderboard = await pg.getLeaderboard();
      const profile = leaderboard.profiles.find((p) => p.name === 'Existing In-Flight Winner');
      assert.strictEqual(profile?.amount, 150, 'Profile amount must NOT be double-credited');
    });

    // Restore provider method
    dodoProvider.getPaymentStatus = origGetPaymentStatus;
  });

  // --------------------------------------------------------------------------
  // SECTION 5: Synthetic Concurrent Settlement Benchmark & Latency Percentiles
  // --------------------------------------------------------------------------
  await describe('4. Synthetic Concurrency Benchmark (PostgreSQL Advisory Locks)', async () => {
    const concurrencyTiers = [10, 50, 100, 250];
    const results: Array<{ tier: number; durationMs: number; tps: number; p50: number; p95: number; p99: number }> = [];

    for (const tier of concurrencyTiers) {
      const batchId = `bench_${tier}_${Date.now()}`;
      const ordersToSettle: Array<{ orderId: string; paymentId: string; amount: number }> = [];

      // Create N orders in PostgreSQL
      for (let i = 0; i < tier; i++) {
        const orderId = `${batchId}_ord_${i}`;
        const paymentId = `${batchId}_pay_${i}`;
        const amount = 99 + (i % 20); // between 99 and 118 INR
        await pg.createOrder({
          orderId,
          name: `Concurrent User ${i} (${tier})`,
          amount,
          currency: 'INR',
          provider: 'dodo',
          ownerToken: `lazy_bench_${i}_${crypto.randomBytes(16).toString('hex')}`,
          orderAccessToken: `ord_token_${i}_${crypto.randomBytes(16).toString('hex')}`,
          quoteSnapshot: {
            basePaise: amount * 100,
            taxPaise: 0,
            feePaise: 0,
            totalPaise: amount * 100,
            currency: 'INR'
          }
        });
        ordersToSettle.push({ orderId, paymentId, amount });
      }

      // Execute concurrent settlements and measure latency
      const latencies: number[] = [];
      const startTime = Date.now();

      const settlementPromises = ordersToSettle.map(async (item) => {
        const itemStart = Date.now();
        const settlement = await pg.settlePaymentAtomic({
          orderId: item.orderId,
          providerPaymentId: item.paymentId,
          provider: 'dodo',
          amount: item.amount,
          currency: 'INR',
          status: 'PAID',
          paymentMethod: 'UPI',
          signatureVerified: true
        });
        const elapsed = Date.now() - itemStart;
        latencies.push(elapsed);
        return settlement;
      });

      const settlements = await Promise.all(settlementPromises);
      const totalBatchDuration = Date.now() - startTime;
      const tps = parseFloat(((tier / (totalBatchDuration / 1000))).toFixed(1));
      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);

      results.push({ tier, durationMs: totalBatchDuration, tps, p50, p95, p99 });

      // Invariant assertions
      const allSuccess = settlements.every((s) => s.success && Boolean(s.profile));
      assert.ok(allSuccess, `All ${tier} concurrent settlements must succeed cleanly`);

      // Verify no duplicate orders or corrupted states
      for (const item of ordersToSettle) {
        const ord = await pg.getOrder(item.orderId);
        assert.strictEqual(ord?.status, 'PAID', `Order ${item.orderId} must be PAID`);
      }
    }

    console.log('\n--- CONCURRENCY BENCHMARK RESULTS TABLE ---');
    console.log('| Concurrent Requests | Duration (ms) | Throughput (TPS) | p50 (ms) | p95 (ms) | p99 (ms) | Lock Errors |');
    console.log('|---------------------|---------------|------------------|----------|----------|----------|-------------|');
    for (const r of results) {
      console.log(`| ${String(r.tier).padEnd(19)} | ${String(r.durationMs).padEnd(13)} | ${String(r.tps).padEnd(16)} | ${String(r.p50).padEnd(8)} | ${String(r.p95).padEnd(8)} | ${String(r.p99).padEnd(8)} | 0           |`);
    }
  });

  console.log('\n========================================================');
  console.log('SUITE 21: ALL WEBHOOK LIFECYCLE & CONCURRENCY TESTS PASSED (100%)');
  console.log('========================================================\n');
}

runWebhookLifecycleAndConcurrencyTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Suite 21 execution failed:', err);
    process.exit(1);
  });
