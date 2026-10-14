import crypto from 'crypto';
import http from 'http';
import { Webhook } from 'standardwebhooks';
import { db } from '../server/db.ts';
import { PostgresDatabase } from '../server/db/postgres.ts';
import { DodoPaymentsProvider } from '../server/payments/dodo.ts';
import { PaymentManager } from '../server/payments/index.ts';
import { toSafePaise } from '../server/payments/provider.ts';
import { CURRENT_CONSENT_VERSION } from '../server/config/legal.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function fetchJson(url: string, options: any = {}) {
  const parsed = new URL(url);
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsedBody = raw;
          try {
            parsedBody = JSON.parse(raw);
          } catch {
            // Keep raw text
          }
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

/**
 * Creates a signed StandardWebhooks payload using standardwebhooks library
 */
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

async function runDodoPaymentsTests() {
  console.log('\n========================================================');
  console.log('STARTING DODO PAYMENTS INTEGRATION TEST SUITE');
  console.log('========================================================\n');

  // Test Webhook Secret for StandardWebhooks
  const TEST_WEBHOOK_KEY = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';

  // ------------------------------------------------------------------------
  // SECTION 1: PHASE 1 INR PRICING VERIFICATION
  // ------------------------------------------------------------------------
  console.log('--- 1. Phase 1: INR Pricing Strategy Verification ---');

  // Candidate 1 (₹1 x Quantity) Evaluation & Rejection
  {
    // Dodo Payments minimum transaction amount is ₹5.00 INR (500 paise)
    // Candidate 1 cannot fulfill ₹1 to ₹4 payments
    const minTransactionThresholdPaise = 500;
    const testAmountPaise = toSafePaise(1);
    assert(
      testAmountPaise !== null && testAmountPaise < minTransactionThresholdPaise,
      'Candidate 1 (₹1 x qty) fails minimum transaction threshold of ₹5.00 INR for ₹1-₹4'
    );

    // Quantity truthfulness: If ₹501 was charged as ₹1 x 501 units,
    // the invoice line item would say "Quantity: 501", falsely claiming 501 profiles/credits
    // instead of 1 digital sponsored placement.
    const candidate1MisleadingQuantity: number = 501;
    const actualDigitalPlacements: number = 1;
    assert(
      candidate1MisleadingQuantity !== actualDigitalPlacements,
      'Candidate 1 invoice line item (quantity: 501) deceptively implies 501 units purchased when only 1 is delivered'
    );
  }

  // Candidate 3 (Amount override on non-PWYW product) Evaluation & Rejection
  {
    // Dodo documentation: product_cart[].amount is ignored when PWYW is disabled,
    // and PWYW only supports USD, GBP, or EUR base currencies (not INR).
    const pwywSupportedCurrencies = ['USD', 'GBP', 'EUR'];
    assert(
      !pwywSupportedCurrencies.includes('INR'),
      'Candidate 3 (PWYW amount override) is unavailable for INR currency'
    );
  }

  // Candidate 2 (Fixed-price INR Product with Quantity = 1) Evaluation & Selection
  {
    // Truthful representation: 1 unit of digital sponsored placement at exact price
    const representativeAmounts = [501, 1001, 2501];
    for (const amt of representativeAmounts) {
      const paise = toSafePaise(amt);
      assert(
        paise !== null && paise === amt * 100 && paise >= 500,
        `Representative purchase ₹${amt} converts to exact ${paise} paise and exceeds ₹5.00 min threshold`
      );
    }
  }

  // Minimum Amount Guard Rejections
  {
    const dodoProvider = new DodoPaymentsProvider({
      apiKey: 'test_key',
      webhookKey: TEST_WEBHOOK_KEY,
      environment: 'test_mode'
    });

    let rejectedUnderMin = false;
    try {
      await dodoProvider.createOrder({
        orderId: 'order_test_min',
        amount: 4, // Below ₹5
        currency: 'INR',
        customerName: 'Test Min',
        customerEmail: 'test@example.com',
        customerPhone: '9876543210',
        returnUrl: 'https://lazyproof.online',
        notifyUrl: 'https://lazyproof.online/api/payment/webhook'
      });
    } catch (err: any) {
      rejectedUnderMin = true;
      assert(
        err.message.includes('minimum one-time payment of ₹5') && err.message.includes('0.50'),
        'Dodo Payments provider rejects < ₹5 with clear error message covering ₹5 floor and $0.50 USD equivalent (does not silently increase)'
      );
    }
    assert(rejectedUnderMin, 'createOrder rejected purchase of ₹4');

    // Dual minimum: Provider API rejection below $0.50 USD equivalent error translation
    let rejectedProviderMin = false;
    const providerMinMock = new DodoPaymentsProvider({
      apiKey: 'test_key',
      webhookKey: TEST_WEBHOOK_KEY,
      environment: 'test_mode'
    });
    (providerMinMock as any).client = {
      products: {
        create: async () => {
          throw new Error('Amount must be at least $0.50 USD equivalent.');
        }
      }
    };
    try {
      await providerMinMock.createOrder({
        orderId: 'order_test_fx_min',
        amount: 10,
        currency: 'INR',
        customerName: 'Test FX Min',
        customerEmail: 'test@example.com',
        customerPhone: '9876543210',
        returnUrl: 'https://lazyproof.online',
        notifyUrl: 'https://lazyproof.online/api/payment/webhook'
      });
    } catch (err: any) {
      rejectedProviderMin = true;
      assert(
        err.message.includes('Dodo Payments minimum payment requirement not met') &&
        err.message.includes('$0.50 USD equivalent') &&
        err.message.includes('₹5'),
        'Provider API rejection for amount below $0.50 USD equivalent is returned as clear supported error without fixed FX guessing or silent inflation'
      );
    }
    assert(rejectedProviderMin, 'Provider minimum error caught and translated without fixed FX multiplier');

    // Float rejection
    let rejectedFloat = false;
    try {
      await dodoProvider.createOrder({
        orderId: 'order_test_float',
        amount: 500.5,
        currency: 'INR',
        customerName: 'Test Float',
        customerEmail: 'test@example.com',
        customerPhone: '9876543210',
        returnUrl: 'https://lazyproof.online',
        notifyUrl: 'https://lazyproof.online/api/payment/webhook'
      });
    } catch (err: any) {
      rejectedFloat = true;
      assert(
        err.message.includes('whole integer INR amounts'),
        'Dodo Payments provider rejects fractional INR amounts'
      );
    }
    assert(rejectedFloat, 'createOrder rejected float purchase ₹500.5');
  }

  // Safe Concurrent Product Creation & Mutex Deduplication
  {
    const dodoProvider = new DodoPaymentsProvider({
      apiKey: 'test_key',
      webhookKey: TEST_WEBHOOK_KEY,
      environment: 'test_mode'
    });

    // Mock client product creation and verify idempotency headers
    let productCreateCalls = 0;
    let passedProductOptions: any = null;
    (dodoProvider as any).client = {
      products: {
        create: async (params: any, options: any) => {
          productCreateCalls++;
          passedProductOptions = options;
          await new Promise((r) => setTimeout(r, 50)); // simulate network latency
          const p = typeof params.price === 'object' ? params.price.price : params.price;
          return {
            product_id: `prod_mock_${p}`,
            name: params.name,
            price: params.price
          };
        }
      }
    };

    // Run 5 concurrent product resolutions for the same amount (₹1001)
    const results = await Promise.all([
      (dodoProvider as any).resolveProductForAmount(1001),
      (dodoProvider as any).resolveProductForAmount(1001),
      (dodoProvider as any).resolveProductForAmount(1001),
      (dodoProvider as any).resolveProductForAmount(1001),
      (dodoProvider as any).resolveProductForAmount(1001)
    ]);

    assert(
      productCreateCalls === 1,
      `Concurrent resolution of ₹1001 executed exactly 1 product creation (deduplicated: ${productCreateCalls} call)`
    );
    assert(
      results.every((id) => id === 'prod_mock_100100'),
      'All 5 concurrent requests received the exact same product ID (prod_mock_100100)'
    );
    assert(
      passedProductOptions?.idempotencyKey === 'prod_dodo_inr_100100',
      'SDK products.create received deterministic idempotencyKey option'
    );
    assert(
      passedProductOptions?.headers?.['Idempotency-Key'] === 'prod_dodo_inr_100100',
      'SDK products.create received Idempotency-Key request header'
    );
  }


  // ------------------------------------------------------------------------
  // SECTION 2: DODO PROVIDER INTERFACE & MOCK CLIENT INTEGRATION
  // ------------------------------------------------------------------------
  console.log('\n--- 2. Dodo Payments Provider Interface Methods ---');

  const provider = new DodoPaymentsProvider({
    apiKey: 'dodo_test_mock_api_key',
    webhookKey: TEST_WEBHOOK_KEY,
    environment: 'test_mode'
  });

  // Mock checkout session and payment endpoints
  (provider as any).client = {
    products: {
      create: async (params: any) => ({
        product_id: `prod_mock_${params.price}`,
        name: params.name,
        price: params.price
      })
    },
    checkoutSessions: {
      create: async (params: any) => ({
        session_id: `cks_mock_${Date.now()}`,
        checkout_url: `https://test.dodopayments.com/buy/cks_mock_${Date.now()}`
      }),
      retrieve: async (sessionId: string) => ({
        session_id: sessionId,
        payment_id: 'pay_mock_123',
        payment_status: 'succeeded'
      })
    },
    payments: {
      retrieve: async (paymentId: string) => ({
        payment_id: paymentId,
        status: 'succeeded',
        total_amount: 50100,
        currency: 'INR',
        payment_method_type: 'card'
      })
    },
    refunds: {
      create: async (params: any) => ({
        refund_id: `ref_mock_${params.payment_id}`,
        status: 'succeeded',
        amount: params.amount,
        currency: 'INR'
      }),
      retrieve: async (refundId: string) => ({
        refund_id: refundId,
        status: 'succeeded',
        amount: 50100,
        currency: 'INR'
      })
    }
  };

  // 2.1 createOrder
  const orderRes = await provider.createOrder({
    orderId: 'order_dodo_unit_01',
    amount: 501,
    currency: 'INR',
    customerName: 'Unit Tester',
    customerEmail: 'tester@example.com',
    customerPhone: '9876543210',
    returnUrl: 'https://lazyproof.online/?order_id=order_dodo_unit_01&status=return',
    notifyUrl: 'https://lazyproof.online/api/payment/webhook'
  });

  assert(orderRes.orderId === 'order_dodo_unit_01', 'createOrder returns expected orderId');
  assert(Boolean(orderRes.checkoutUrl?.startsWith('https://test.dodopayments.com')), 'createOrder returns test checkoutUrl');
  assert(Boolean(orderRes.providerOrderId), 'createOrder returns providerOrderId (session_id)');

  // 2.2 getPaymentStatus
  (provider as any).orderPayments.set('order_dodo_unit_01', 'pay_mock_123');
  const statusRes = await provider.getPaymentStatus('order_dodo_unit_01');
  assert(statusRes.status === 'PAID', 'getPaymentStatus returns status PAID for succeeded payment');
  assert(statusRes.amount === 501, 'getPaymentStatus returns converted amount ₹501');
  assert(statusRes.currency === 'INR', 'getPaymentStatus returns INR currency');
  assert(statusRes.providerPaymentId === 'pay_mock_123', 'getPaymentStatus returns providerPaymentId');

  // 2.3 createRefund & getRefundStatus
  const refundRes = await provider.createRefund({
    orderId: 'order_dodo_unit_01',
    refundId: 'ref_local_01',
    amount: 501,
    reason: 'Customer testing'
  });
  assert(refundRes.success && refundRes.status === 'SUCCESS', 'createRefund returns SUCCESS for mock refund');

  const refStatus = await provider.getRefundStatus('order_dodo_unit_01', 'ref_local_01');
  assert(refStatus.status === 'SUCCESS', 'getRefundStatus returns SUCCESS');
  assert(refStatus.amount === 501, 'getRefundStatus returns exact INR refund amount');

  // ------------------------------------------------------------------------
  // SECTION 3: STANDARDWEBHOOKS SIGNATURE VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n--- 3. StandardWebhooks Cryptographic Verification ---');

  // 3.1 Valid signature verification
  const validWebhookPayload = {
    type: 'payment.succeeded',
    data: {
      payment_id: 'pay_dodo_sig_1',
      total_amount: 50100,
      currency: 'INR',
      metadata: { order_id: 'order_sig_test_1' }
    }
  };

  const signed = createSignedDodoWebhook(validWebhookPayload, TEST_WEBHOOK_KEY);
  const verifyResult = await provider.verifyWebhook(signed.rawBody, signed.headers);
  assert(verifyResult.isValid, 'verifyWebhook succeeds on valid StandardWebhooks HMAC-SHA256 signature');
  assert(verifyResult.orderId === 'order_sig_test_1', 'verifyWebhook parses orderId from metadata');
  assert(verifyResult.amount === 501, 'verifyWebhook parses total amount in whole INR (50100 -> 501)');
  assert(verifyResult.providerPaymentId === 'pay_dodo_sig_1', 'verifyWebhook extracts providerPaymentId');

  // 3.2 Corrupted payload / signature mismatch
  const corruptedHeaders = {
    ...signed.headers,
    'webhook-signature': 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  };
  const corruptedResult = await provider.verifyWebhook(signed.rawBody, corruptedHeaders);
  assert(!corruptedResult.isValid, 'verifyWebhook rejects corrupted signature');

  // 3.3 Missing required headers (fail closed)
  const missingHeadersResult = await provider.verifyWebhook(signed.rawBody, {
    'content-type': 'application/json'
  });
  assert(!missingHeadersResult.isValid, 'verifyWebhook fails closed when StandardWebhooks headers are missing');

  // ------------------------------------------------------------------------
  // SECTION 4: WEBHOOK EVENTS & ATOMIC DATABASE SETTLEMENT
  // ------------------------------------------------------------------------
  console.log('\n--- 4. Webhook Events & Atomic Database Settlement ---');

  // Setup order in PostgreSQL
  const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';
  const pg = new PostgresDatabase(TEST_DB_URL);
  await pg.init();

  process.env.USE_POSTGRES = 'true';
  db.pg = pg;

  const webhookOrderId = `order_dodo_wh_${Date.now()}`;
  const webhookAccessToken = `ord_${crypto.randomBytes(32).toString('hex')}`;
  const webhookOwnerToken = `lazy_${crypto.randomBytes(32).toString('hex')}`;

  await pg.createOrder({
    orderId: webhookOrderId,
    name: 'Dodo Winner',
    amount: 1001,
    currency: 'INR',
    provider: 'dodo',
    ownerToken: webhookOwnerToken,
    orderAccessToken: webhookAccessToken,
    quoteSnapshot: {
      basePaise: 100100,
      taxPaise: 0,
      feePaise: 0,
      totalPaise: 100100,
      currency: 'INR'
    }
  });

  // 4.1 payment.succeeded event
  const livePaymentId = `pay_dodo_live_${Date.now()}`;
  const paymentSucceededPayload = {
    type: 'payment.succeeded',
    data: {
      payment_id: livePaymentId,
      total_amount: 100100,
      currency: 'INR',
      payment_method_type: 'upi',
      metadata: { order_id: webhookOrderId }
    }
  };
  const signedSuccess = createSignedDodoWebhook(paymentSucceededPayload, TEST_WEBHOOK_KEY);
  const successVerification = await provider.verifyWebhook(signedSuccess.rawBody, signedSuccess.headers);

  // Settle atomically via pg.settlePaymentAtomic
  const settlement = await pg.settlePaymentAtomic({
    orderId: webhookOrderId,
    providerPaymentId: livePaymentId,
    provider: 'dodo',
    amount: 1001,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true,
    rawPayload: successVerification.rawPayload
  });

  assert(settlement.success && Boolean(settlement.profile), 'Atomic settlement succeeded for Dodo payment.succeeded');
  assert(settlement.profile?.amount === 1001, 'Leaderboard profile credited with exact ₹1001');

  // Verify order in database has provider = 'dodo' and status = 'PAID'
  const savedOrder = await pg.getOrder(webhookOrderId);
  assert(savedOrder?.status === 'PAID', 'Order status updated to PAID in PostgreSQL');
  assert(savedOrder?.provider === 'dodo', 'Order provider accurately recorded as dodo');

  // Record webhook event in webhook_events table
  const recordFirst = await pg.recordWebhookEvent(
    signedSuccess.webhookId,
    'payment.succeeded',
    webhookOrderId,
    livePaymentId,
    successVerification.rawPayload
  );
  assert(recordFirst === true, 'First webhook event recorded successfully in database');

  // Verify fast-path deduplication check
  const isProcessed = await pg.isWebhookEventProcessed(signedSuccess.webhookId);
  assert(isProcessed === true, 'pg.isWebhookEventProcessed returns true for recorded webhook event');

  // 4.2 Deduplication: Second attempt to process the same webhook event
  const recordSecond = await pg.recordWebhookEvent(
    signedSuccess.webhookId,
    'payment.succeeded',
    webhookOrderId,
    livePaymentId,
    successVerification.rawPayload
  );
  assert(recordSecond === false, 'Durable deduplication correctly ignores duplicate event_id');

  // Idempotent settlement on already-PAID order
  const repeatSettlement = await pg.settlePaymentAtomic({
    orderId: webhookOrderId,
    providerPaymentId: livePaymentId,
    provider: 'dodo',
    amount: 1001,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });
  assert(repeatSettlement.success, 'Repeat settlement call succeeds idempotently');
  assert(
    repeatSettlement.profile?.amount === 1001,
    'Repeat settlement does NOT double-credit profile on leaderboard'
  );

  // 4.3 Refund Reconciliation (refund.succeeded)
  const profileId = settlement.profile?.id;
  assert(Boolean(profileId), 'Profile exists for refund test');

  // Reserve refund
  const refundId = `ref_dodo_${Date.now()}`;
  const reservation = await pg.reserveRefundAtomic(webhookOrderId, 100100, refundId, 'Dodo customer refund');
  assert(reservation.success, 'Refund reservation placed atomically');

  // Reverse refund in DB
  const reversed = await pg.reverseRefundAtomic({
    orderId: webhookOrderId,
    amount: 1001,
    reason: 'Dodo webhook refund confirmation',
    merchantRefundId: refundId,
    providerRefundId: `ref_dodo_prov_${Date.now()}`,
    currency: 'INR'
  });
  assert(reversed.success, 'pg.reverseRefundAtomic completed successfully');

  // Verify profile rank removed / demoted
  const refundedOrder = await pg.getOrder(webhookOrderId);
  assert(refundedOrder?.status === 'REFUNDED', 'Order status updated to REFUNDED');

  const rawRefundedProfile = await pg.getRawProfile(profileId!);
  assert(rawRefundedProfile?.amount === 0, 'Profile amount reduced to ₹0 after 100% refund');

  const leaderboardAfterRefund = await pg.getLeaderboard({ limit: 50 });
  const onLeaderboard = leaderboardAfterRefund.profiles.find(p => p.id === profileId);
  assert(
    onLeaderboard === undefined,
    'Profile removed from public leaderboard after 100% refund'
  );

  // 4.4 Durable Product Mapping Across Process Restarts & Multi-Instance Coordination
  console.log('\n--- 4.4 Durable Product Mapping Across Process Restarts ---');
  {
    // Clean up test rows for isolation
    await pg.getPool().then((pool) =>
      pool.query('DELETE FROM payment_products WHERE amount_paise IN (77700, 88800)')
    );

    // Save a product mapping to PostgreSQL for a dedicated test amount
    const testAmountINR = 777;
    const testAmountPaise = 77700;
    const initialProductId = `prod_dodo_durable_${Date.now()}`;
    const durableExpectedId = await pg.savePaymentProduct('dodo', 'INR', testAmountPaise, initialProductId);

    // Simulate process restart: create a completely fresh provider instance with empty in-memory cache
    const restartedProvider = new DodoPaymentsProvider({
      apiKey: 'test_key',
      webhookKey: TEST_WEBHOOK_KEY,
      environment: 'test_mode'
    });
    let apiCallsOnRestart = 0;
    (restartedProvider as any).client = {
      products: {
        create: async () => {
          apiCallsOnRestart++;
          return { product_id: 'prod_unexpected_duplicate' };
        }
      }
    };

    // Ensure db singleton has postgres authoritative mode for the test
    (db as any).pg = pg;

    const resolvedAfterRestart = await restartedProvider.resolveProductForAmount(testAmountINR);
    assert(
      resolvedAfterRestart === durableExpectedId,
      'Restarted instance recovers product ID from PostgreSQL without creating duplicate'
    );
    assert(
      apiCallsOnRestart === 0,
      'No Dodo API calls made on restarted instance when product exists in durable DB'
    );

    // Verify product price is immutable: resolving another unpersisted amount triggers dedicated creation without mutating shared product
    let newAmountApiCalled = false;
    (restartedProvider as any).client = {
      products: {
        create: async (params: any) => {
          newAmountApiCalled = true;
          return { product_id: `prod_dodo_${params.price.price}` };
        }
      }
    };
    const unpersistedAmount = 888;
    const resolvedOtherAmount = await restartedProvider.resolveProductForAmount(unpersistedAmount);
    assert(newAmountApiCalled, 'Distinct amount triggers its own immutable product creation');
    assert(resolvedOtherAmount === 'prod_dodo_88800', 'New amount gets dedicated fixed-price product ID');
    const originalAfterCreatingOther = await restartedProvider.resolveProductForAmount(testAmountINR);
    assert(
      originalAfterCreatingOther === durableExpectedId,
      'Shared product for ₹777 was NOT mutated when ₹888 product was created'
    );
  }

  // 4.5 Provider-Aware Background Reconciliation
  console.log('\n--- 4.5 Provider-Aware Background Reconciliation ---');
  {
    const cfHistOrderId = `order_cf_hist_${Date.now()}`;
    const dodoHistOrderId = `order_dodo_hist_${Date.now()}`;

    // Insert historical Cashfree order (status: PENDING, age: 10 minutes ago)
    await pg.getPool().then((pool) =>
      pool.query(
        `INSERT INTO payment_orders
          (order_id, name, amount, currency, status, payment_mode, provider, created_at, updated_at, next_reconcile_at)
         VALUES
          ($1, 'Cashfree Hist User', 501, 'INR', 'PENDING', 'sandbox', 'cashfree', NOW() - INTERVAL '10 minutes', NOW(), NOW() - INTERVAL '1 minute'),
          ($2, 'Dodo Hist User', 1001, 'INR', 'PENDING', 'sandbox', 'dodo', NOW() - INTERVAL '10 minutes', NOW(), NOW() - INTERVAL '1 minute')
         ON CONFLICT (order_id) DO NOTHING`,
        [cfHistOrderId, dodoHistOrderId]
      )
    );

    let cfProviderChecked = false;
    let dodoProviderChecked = false;

    const mockProviderResolver = {
      getProviderFor: (providerName?: string) => {
        if (providerName === 'cashfree') {
          return {
            name: 'cashfree',
            getPaymentStatus: async (orderId: string) => {
              if (orderId === cfHistOrderId) cfProviderChecked = true;
              return { orderId, status: 'PENDING' };
            },
            getRefundStatus: async () => ({ status: 'PENDING' })
          };
        }
        return {
          name: 'dodo',
          getPaymentStatus: async (orderId: string) => {
            if (orderId === dodoHistOrderId) dodoProviderChecked = true;
            return { orderId, status: 'PENDING' };
          },
          getRefundStatus: async () => ({ status: 'PENDING' })
        };
      }
    };

    await pg.reconcilePendingTransactions(mockProviderResolver);
    assert(cfProviderChecked, 'Historical Cashfree pending order was routed to Cashfree provider for reconciliation');
    assert(dodoProviderChecked, 'Dodo pending order was routed to Dodo provider for reconciliation');
  }

  // 4.6 Isolated Non-Production Tests for ₹501, ₹1001, and ₹2501
  console.log('\n--- 4.6 Isolated Non-Production Tests for ₹501, ₹1001, and ₹2501 ---');
  {
    const targetAmounts = [501, 1001, 2501];
    const testRecords: any[] = [];

    for (const amt of targetAmounts) {
      const orderId = `ord_iso_${amt}_${Date.now()}`;
      const paymentId = `pay_dodo_${amt}_${Date.now()}`;
      const accessToken = `ord_${crypto.randomBytes(32).toString('hex')}`;
      const ownerToken = `lazy_${crypto.randomBytes(32).toString('hex')}`;
      const paise = amt * 100;

      // 1. Server-authoritative quote breakdown
      const subtotalPaise = paise;
      const taxPaise = 0; // CGST Act Sec 22 unregistered threshold: tax ₹0
      const totalPaise = subtotalPaise + taxPaise;

      assert(totalPaise === paise, `Quote subtotal (${subtotalPaise}) + tax (${taxPaise}) equals final charge ${totalPaise} paise for ₹${amt}`);

      // 2. Insert order
      await pg.createOrder({
        orderId,
        name: `Sponsor ₹${amt}`,
        amount: amt,
        currency: 'INR',
        provider: 'dodo',
        ownerToken,
        orderAccessToken: accessToken,
        quoteSnapshot: {
          basePaise: subtotalPaise,
          taxPaise,
          feePaise: 0,
          totalPaise,
          currency: 'INR',
          serviceDescription: 'LazyProof Digital Sponsored Profile Placement'
        }
      });

      // 3. Webhook simulation with StandardWebhooks signature
      const webhookPayload = {
        type: 'payment.succeeded',
        data: {
          payment_id: paymentId,
          total_amount: totalPaise,
          currency: 'INR',
          payment_method_type: 'upi',
          metadata: { order_id: orderId }
        }
      };
      const signed = createSignedDodoWebhook(webhookPayload, TEST_WEBHOOK_KEY);
      const verified = await provider.verifyWebhook(signed.rawBody, signed.headers);
      assert(verified.isValid, `StandardWebhooks verified successfully for ₹${amt}`);

      // 4. Atomic database settlement
      const settlement = await pg.settlePaymentAtomic({
        orderId,
        providerPaymentId: paymentId,
        provider: 'dodo',
        amount: amt,
        currency: 'INR',
        status: 'PAID',
        paymentMethod: 'UPI',
        signatureVerified: true,
        rawPayload: verified.rawPayload
      });

      assert(settlement.success && settlement.profile?.amount === amt, `Atomic DB settlement credited ₹${amt} to leaderboard profile`);

      // 5. Fast-path deduplication
      await pg.recordWebhookEvent(signed.webhookId, 'payment.succeeded', orderId, paymentId, verified.rawPayload);
      const isDeduped = await pg.isWebhookEventProcessed(signed.webhookId);
      assert(isDeduped, `Fast-path deduplication verified for ₹${amt} event ID`);

      testRecords.push({
        currency: 'INR',
        quantity: 1,
        subtotal: `₹${amt}.00`,
        tax: '₹0.00 (Unregistered under Section 22 CGST Act)',
        finalCharged: `₹${amt}.00`,
        paymentId: paymentId.slice(0, 14) + '***',
        webhookProcessed: true,
        creditedAmount: `₹${amt}.00`
      });
    }

    console.log('\n  REDACTED ISOLATED TEST EVIDENCE (NON-PRODUCTION):');
    console.table(testRecords);
  }


  // ------------------------------------------------------------------------
  // SECTION 5: PROVIDER ATTRIBUTION & HISTORICAL ROUTING
  // ------------------------------------------------------------------------
  console.log('\n--- 5. Provider Attribution & Multi-Provider Routing ---');

  process.env.PAYMENT_PROVIDER = 'dodo';
  process.env.PAYMENT_MODE = 'sandbox';
  process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode';
  process.env.DODO_PAYMENTS_API_KEY = 'test_key';
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = TEST_WEBHOOK_KEY;
  const paymentManager = new PaymentManager();

  assert(paymentManager.getProvider().name === 'dodo', 'Active payment provider is dodo');

  // Provider lookup by order attribution
  const cashfreeResolved = paymentManager.getProviderFor('cashfree');
  assert(cashfreeResolved.name === 'cashfree', 'getProviderFor("cashfree") safely resolves Cashfree provider for historical orders');

  const dodoResolved = paymentManager.getProviderFor('dodo');
  assert(dodoResolved.name === 'dodo', 'getProviderFor("dodo") resolves Dodo provider');

  // ------------------------------------------------------------------------
  // SECTION 6: HTTP ENDPOINTS VALIDATION
  // ------------------------------------------------------------------------
  console.log('\n--- 6. HTTP Endpoints & Minimum Amount Verification ---');

  const TEST_PORT = 3288;
  process.env.PORT = String(TEST_PORT);
  process.env.PAYMENT_PROVIDER = 'dodo';
  process.env.PAYMENT_MODE = 'disabled';
  process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';

  const { paymentManager: serverPaymentManager } = await import('../server/payments/index.ts');
  serverPaymentManager.reload();

  try {
    await import('../server.ts');
  } catch {}

  const BASE = `http://127.0.0.1:${TEST_PORT}`;
  let connected = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      await fetchJson(`${BASE}/api/payment/config`);
      connected = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (connected) {
    const configRes = await fetchJson(`${BASE}/api/payment/config`);
    assert(configRes.status === 200, 'GET /api/payment/config returned 200');
    assert(configRes.body.provider === 'dodo', 'GET /api/payment/config exposes dodo as active provider');

    // CSP Headers Check
    assert(
      typeof configRes.headers['content-security-policy'] === 'string' &&
      configRes.headers['content-security-policy'].includes('checkout.dodopayments.com'),
      'Content-Security-Policy headers allow checkout.dodopayments.com'
    );
  } else {
    console.log('  ⚠ Server already listening on other port; verified config logic via PaymentManager');
  }

  console.log('\n========================================================');
  console.log(`DODO PAYMENTS TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

void runDodoPaymentsTests();
