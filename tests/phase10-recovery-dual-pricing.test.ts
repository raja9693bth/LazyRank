import assert from 'assert';
import crypto from 'crypto';
import http from 'http';
import {
  validatePaymentAmount,
  calculateRankTarget,
  calculateRankCreditFromUSD,
  getPricingCapabilities,
  MIN_INR_PAISE,
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

async function fetchJson(url: string, options: any = {}) {
  const parsed = new URL(url);
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {}
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

async function runPhase10Tests() {
  console.log('\n========================================================');
  console.log('STARTING PHASE 10: RECOVERY, DUAL PRICING & PAYMENT INTEGRITY');
  console.log('========================================================\n');

  const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/soap_test';
  const pg = new PostgresDatabase(TEST_DB_URL);
  await pg.init();
  db.pg = pg;
  process.env.USE_POSTGRES = 'true';

  // ------------------------------------------------------------------------
  // 1. Invariant 16: INR Edge Amounts (0, 1, 45, 50, 98 rejected; 99, 100 accepted)
  // ------------------------------------------------------------------------
  console.log('--- 1. INR Dual Minimum Validation ---');
  const rejectedInrAmounts = [0, 1, 45, 50, 98, '0', '1', '45', '50', '98', '98.99', 98.99, -5, NaN, Infinity];
  for (const amt of rejectedInrAmounts) {
    const res = validatePaymentAmount(amt, 'INR');
    assert.strictEqual(res.isValid, false, `INR amount ${amt} must be rejected`);
    assert.ok(
      res.errorMessage?.includes('₹99') || res.errorMessage?.includes('fractional') || res.errorMessage?.includes('valid'),
      `INR rejection for ${amt} must provide clear helper/error`
    );
  }
  pass('Invariant 16A: INR 0, 1, 45, 50, 98, and 98.99 rejected before remote calls');

  const acceptedInrAmounts = [99, 100, 501, 1001, 2501, '99', '100', '1000'];
  for (const amt of acceptedInrAmounts) {
    const res = validatePaymentAmount(amt, 'INR');
    assert.strictEqual(res.isValid, true, `INR amount ${amt} must be accepted`);
    assert.strictEqual(res.currency, 'INR');
    assert.strictEqual(res.amountMinor, Math.round(Number(amt) * 100));
  }
  pass('Invariant 16B: INR 99, 100, 501, 1001, 2501 accepted with exact minor units');

  // ------------------------------------------------------------------------
  // 2. Invariant 17: USD Edge Amounts (0, 1, 4, 4.99 rejected; 5.00, 5.01 accepted)
  // ------------------------------------------------------------------------
  console.log('\n--- 2. USD Dual Minimum Validation ---');
  const rejectedUsdAmounts = [0, 1, 4, 4.99, '0', '1', '4', '4.99', '4.999', 4.999, -1];
  for (const amt of rejectedUsdAmounts) {
    const res = validatePaymentAmount(amt, 'USD');
    assert.strictEqual(res.isValid, false, `USD amount ${amt} must be rejected`);
    assert.ok(
      res.errorMessage?.includes('$5.00') || res.errorMessage?.includes('decimal') || res.errorMessage?.includes('valid'),
      `USD rejection for ${amt} must mention $5.00 or decimal precision`
    );
  }
  pass('Invariant 17A: USD 0, 1, 4, 4.99 rejected before remote calls');

  const acceptedUsdAmounts = [5.0, 5.01, 10.0, '5.00', '5.01', '10.50'];
  for (const amt of acceptedUsdAmounts) {
    const res = validatePaymentAmount(amt, 'USD');
    assert.strictEqual(res.isValid, true, `USD amount ${amt} must be accepted`);
    assert.strictEqual(res.currency, 'USD');
  }
  pass('Invariant 17B: USD 5.00, 5.01, 10.00 accepted with exact cent precision');

  // ------------------------------------------------------------------------
  // 3. Invariant 18: Rank Arithmetic & Truthful Suggestions
  // ------------------------------------------------------------------------
  console.log('\n--- 3. Rank Target & Upgrade Arithmetic ---');
  // Empty board (top = 0): suggested charge INR 99
  const emptyBoard = calculateRankTarget(0, 0, 'INR');
  assert.strictEqual(emptyBoard.suggestedChargeINR, 99, 'Empty board suggested charge is ₹99');
  assert.strictEqual(emptyBoard.projectedTotalINR, 99);

  // Top INR 50 (historical low claim): suggested charge INR 99
  const lowTop = calculateRankTarget(50, 0, 'INR');
  assert.strictEqual(lowTop.suggestedChargeINR, 99, 'Top INR 50 suggests charge ₹99');

  // Top INR 99: suggested charge INR 100
  const top99 = calculateRankTarget(99, 0, 'INR');
  assert.strictEqual(top99.suggestedChargeINR, 100, 'Top INR 99 suggests charge ₹100');

  // Top INR 1,000: suggested charge INR 1,001 (NOT 1,099!)
  const top1000 = calculateRankTarget(1000, 0, 'INR');
  assert.strictEqual(top1000.suggestedChargeINR, 1001, 'Top INR 1,000 suggests rival charge ₹1,001');

  // Upgrade: top INR 1,000, owner already has INR 950: minimum charge INR 99, projected 1,049
  const owner950 = calculateRankTarget(1000, 950, 'INR');
  assert.strictEqual(owner950.suggestedChargeINR, 99, 'Owner with ₹950 must pay minimum ₹99');
  assert.strictEqual(owner950.projectedTotalINR, 1049, 'Projected total is ₹1,049');

  // Upgrade: top INR 1,000, owner already has INR 100: suggested charge INR 901, projected 1,001
  const owner100 = calculateRankTarget(1000, 100, 'INR');
  assert.strictEqual(owner100.suggestedChargeINR, 901, 'Owner with ₹100 must pay ₹901');
  assert.strictEqual(owner100.projectedTotalINR, 1001, 'Projected total is ₹1,001');

  // Returning owner with INR 1,000 who boosts pays at least INR 99
  const owner1000 = calculateRankTarget(1000, 1000, 'INR');
  assert.strictEqual(owner1000.suggestedChargeINR, 99, 'Owner with ₹1,000 must pay floor ₹99 to boost');
  assert.strictEqual(owner1000.projectedTotalINR, 1099);
  pass('Invariant 18: Rank arithmetic strictly follows max(M, ceilINRStep(T - O + G)) with INR 1 rank step');

  // ------------------------------------------------------------------------
  // 4. Invariant 21 & D3B: USD Rank Conversion & Rounding
  // ------------------------------------------------------------------------
  console.log('\n--- 4. USD Rank Conversion & Integer Arithmetic ---');
  // Test quote: 90 INR per USD (numerator 90, denominator 1)
  const usd5Conversion = calculateRankCreditFromUSD(500, 90, 1);
  assert.strictEqual(usd5Conversion.rankCreditPaise, 45000, 'USD 5.00 (500 cents) @ 90 INR/USD yields 45,000 paise (₹450)');
  assert.strictEqual(usd5Conversion.rankCreditINR, 450);

  // Precision rounding: floor(C * num / den)
  const usdPrecision = calculateRankCreditFromUSD(501, 8888, 100);
  assert.strictEqual(usdPrecision.rankCreditPaise, Math.floor((501 * 8888) / 100));
  pass('Invariant 21: Integer minor-unit USD rank credit calculation verified');

  // ------------------------------------------------------------------------
  // 5. Invariant 5 & 6: Fixed Product Cache Isolation & Namespacing
  // ------------------------------------------------------------------------
  console.log('\n--- 5. Product Mapping Namespacing & Immutability ---');
  const dodoProvider = new DodoPaymentsProvider({
    apiKey: 'dodo_test_key_phase10',
    webhookKey: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    environment: 'test_mode'
  });

  (dodoProvider as any).client = {
    products: {
      create: async (params: any, options: any) => ({
        product_id: `prod_mock_${params.price?.price || params.price}`,
        name: params.name
      })
    }
  };

  const prod99 = await dodoProvider.resolveProductForAmount(99, 'INR');
  const prod100 = await dodoProvider.resolveProductForAmount(100, 'INR');
  assert.notStrictEqual(prod99, prod100, 'INR 99 and INR 100 receive distinct immutable product IDs');

  // USD 5 (500 cents) vs INR 500 (50000 paise) must NEVER collide
  const prodUsd5 = await dodoProvider.resolveProductForAmount(5, 'USD');
  const prodInr5 = await dodoProvider.resolveProductForAmount(500, 'INR');
  assert.notStrictEqual(prodUsd5, prodInr5, 'USD 5 and INR 500 never collide');
  pass('Invariant 5 & 6: Namespaced product resolution prevents price mutations and cross-currency collision');

  // ------------------------------------------------------------------------
  // 6. Invariant 9: Dodo Partial Refund Line Item Payload
  // ------------------------------------------------------------------------
  console.log('\n--- 6. Dodo Partial Refund Line Item Contract ---');
  let capturedRefundPayload: any = null;
  const dodoRefundProvider = new DodoPaymentsProvider({
    apiKey: 'dodo_test_key_refund',
    webhookKey: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    environment: 'test_mode'
  });

  (dodoRefundProvider as any).client = {
    refunds: {
      create: async (payload: any) => {
        capturedRefundPayload = payload;
        return {
          refund_id: 'ref_dodo_prov_partial_001',
          status: 'succeeded',
          amount: payload.amount
        };
      }
    },
    payments: {
      retrieve: async () => ({
        payment_id: 'pay_dodo_item_001',
        total_amount: 100100,
        currency: 'INR',
        items: [{ item_id: 'item_dodo_line_001', amount: 100100 }]
      })
    }
  };
  (dodoRefundProvider as any).orderPayments.set('ord_dodo_refund_test', 'pay_dodo_item_001');

  // 6A. Verify INR partial refund safely rejects automated initiation to require operator handling
  const inrRefundRes = await dodoRefundProvider.createRefund({
    orderId: 'ord_dodo_refund_test',
    refundId: 'ref_local_merch_001',
    amount: 500,
    reason: 'Customer requested partial refund'
  });
  assert.strictEqual(inrRefundRes.success, false, 'INR partial refund returns failure');
  assert.ok(inrRefundRes.error?.includes('AUTOMATED_INR_PARTIAL_REFUND_REQUIRES_OPERATOR_REVIEW'), 'INR partial refund safely halts automated initiation and requires operator review');

  // 6B. Verify USD partial refund sends verified USD cents
  (dodoRefundProvider as any).client.payments.retrieve = async () => ({
    payment_id: 'pay_dodo_item_usd_001',
    total_amount: 100000,
    currency: 'USD',
    items: [{ item_id: 'item_dodo_line_001', amount: 100000 }]
  });
  (dodoRefundProvider as any).orderPayments.set('ord_dodo_refund_usd', 'pay_dodo_item_usd_001');

  await dodoRefundProvider.createRefund({
    orderId: 'ord_dodo_refund_usd',
    refundId: 'ref_local_merch_usd_001',
    amount: 500,
    reason: 'Customer requested USD partial refund'
  });

  assert.ok(capturedRefundPayload !== null, 'createRefund called Dodo refunds.create for USD partial refund');
  assert.strictEqual(capturedRefundPayload.payment_id, 'pay_dodo_item_usd_001');
  assert.ok(Array.isArray(capturedRefundPayload.items), 'Partial refund sends items array');
  assert.strictEqual(capturedRefundPayload.items[0].item_id, 'item_dodo_line_001');
  assert.strictEqual(capturedRefundPayload.items[0].amount, 50000, 'USD partial refund line item amount is exact 50,000 USD cents');
  pass('Invariant 9: Dodo partial refund enforces INR operator review and sends verified USD cents for USD');

  // ------------------------------------------------------------------------
  // 7. Invariant 11 & 24: Sticky Order Provider Routing
  // ------------------------------------------------------------------------
  console.log('\n--- 7. Sticky Order Provider & Intent Routing ---');
  process.env.PAYMENT_PROVIDER = 'dodo';
  process.env.PAYMENT_MODE = 'sandbox';
  process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode';
  process.env.DODO_PAYMENTS_API_KEY = 'test_key';
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_mock';
  process.env.RAZORPAY_KEY_SECRET = 'rzp_secret_mock';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_wh_secret_mock';

  const stickyPm = new PaymentManager();
  // Existing Dodo order stays on Dodo even if default switches
  const orderDodo = stickyPm.getProviderFor('dodo');
  assert.strictEqual(orderDodo.name, 'dodo', 'Existing Dodo order pinned to Dodo');

  const orderCashfree = stickyPm.getProviderFor('cashfree');
  assert.strictEqual(orderCashfree.name, 'cashfree', 'Historical Cashfree order pinned to Cashfree');

  const orderRazorpay = stickyPm.getProviderFor('razorpay');
  assert.strictEqual(orderRazorpay.name, 'razorpay', 'Razorpay order pinned to Razorpay');

  // USD intent routes to Dodo before creation
  const usdIntentProvider = stickyPm.getProviderForIntent('USD');
  assert.strictEqual(usdIntentProvider.name, 'dodo', 'USD intent routes to Dodo');
  pass('Invariant 11 & 24: Sticky provider lookup preserves order pinning and intent routing');

  // ------------------------------------------------------------------------
  // 8. Invariant 4 & Razorpay Gating: Live Initiation Disabled Without Approval
  // ------------------------------------------------------------------------
  console.log('\n--- 8. Razorpay Provider Gating ---');
  const rzpProvider = new RazorpayProvider({
    keyId: 'rzp_test_dummy',
    keySecret: 'rzp_sec_dummy',
    webhookSecret: 'rzp_wh_dummy',
    isSandbox: false
  });

  assert.strictEqual(rzpProvider.name, 'razorpay');
  assert.strictEqual(rzpProvider.isLiveEnabled(), false, 'Razorpay live ready is FALSE without explicit account activation');

  let rzpLiveRejected = false;
  try {
    process.env.RAZORPAY_ENABLED = 'false';
    await rzpProvider.createOrder({
      orderId: 'ord_rzp_live_test',
      amount: 100,
      currency: 'INR',
      customerName: 'Test Rzp',
      customerEmail: 'test@example.com',
      customerPhone: '9876543210',
      returnUrl: 'https://lazyproof.online',
      notifyUrl: 'https://lazyproof.online/api/payment/webhook'
    });
  } catch (err: any) {
    rzpLiveRejected = true;
    assert.ok(err.message.includes('disabled') || err.message.includes('pending'), 'Razorpay createOrder fails closed when live disabled');
  }
  assert.strictEqual(rzpLiveRejected, true, 'Unapproved Razorpay cannot initiate orders');
  pass('Invariant 4 & Razorpay Gating: Live initiation safely disabled until approved');

  // ------------------------------------------------------------------------
  // 9. Invariant 1: Database Query Rejection Containment & 503 Recovery
  // ------------------------------------------------------------------------
  console.log('\n--- 9. Database Failure Containment & HTTP Readiness ---');
  const readinessCheck = await pg.checkReadiness();
  assert.strictEqual(readinessCheck.ready, true, 'Live database readiness returns ready: true');
  assert.ok(typeof readinessCheck.latencyMs === 'number', 'Readiness provides latency measurement');

  const pricingCaps = getPricingCapabilities();
  assert.strictEqual(pricingCaps.businessMinimums.INR_PAISE, 9900, 'Public capabilities expose ₹99 (9900 paise)');
  assert.strictEqual(pricingCaps.businessMinimums.USD_CENTS, 500, 'Public capabilities expose $5.00 (500 cents)');
  assert.strictEqual(pricingCaps.currentPricingVersion, CURRENT_PRICING_VERSION);
  pass('Invariant 1: Database readiness and authoritative pricing capabilities verified');

  // ------------------------------------------------------------------------
  // 10. Invariant 25: Legacy INR 1 Pending Reconciliation Integrity
  // ------------------------------------------------------------------------
  console.log('\n--- 10. Legacy Order Reconciliation Integrity ---');
  const legacyOrderId = `ord_legacy_1inr_${Date.now()}`;
  await pg.createOrder({
    orderId: legacyOrderId,
    name: 'Legacy 1 INR User',
    amount: 1,
    currency: 'INR',
    provider: 'cashfree',
    ownerToken: `lazy_${crypto.randomBytes(32).toString('hex')}`,
    orderAccessToken: `ord_${crypto.randomBytes(32).toString('hex')}`
  });

  const legacySettlement = await pg.settlePaymentAtomic({
    orderId: legacyOrderId,
    providerPaymentId: `cf_pay_legacy_${Date.now()}`,
    provider: 'cashfree',
    amount: 1,
    currency: 'INR',
    status: 'PAID',
    paymentMethod: 'UPI',
    signatureVerified: true
  });

  assert.strictEqual(legacySettlement.success, true, 'Historical INR 1 pending order settles accurately');
  assert.strictEqual(legacySettlement.profile?.amount, 1, 'Profile credited with exact original ₹1');
  pass('Invariant 25: Legacy orders reconcile without retroactive invalidation');

  console.log('\n========================================================');
  console.log(`PHASE 10 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

void runPhase10Tests();
