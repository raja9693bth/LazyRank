import crypto from 'crypto';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { db, LazyDatabase } from '../server/db.ts';
import { SERVER_LEGAL_CONFIG } from '../server/config/legal.ts';
import { LEGAL_CONFIG } from '../src/config/legal.ts';
import { CashfreeProvider } from '../server/payments/cashfree.ts';
import { PaymentManager, paymentManager } from '../server/payments/index.ts';
import { PostgresDatabase } from '../server/db/postgres.ts';
import { ROUTE_SEO } from '../server/seo.ts';

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

async function runCommercialTests() {
  console.log('\n========================================================');
  console.log('STARTING LAZY COMMERCIAL PRODUCTION & PAYMENT GATEWAY TEST SUITE');
  console.log('========================================================\n');

  // ----------------------------------------------------
  // SUITE 1: LEGAL & BUSINESS ENTITY CONSISTENCY
  // ----------------------------------------------------
  console.log('--- 1. Legal Entity & Centralized Identity Invariants ---');
  assert(
    LEGAL_CONFIG.LEGAL_BUSINESS_NAME === 'Adabhra Group' &&
    SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME === 'Adabhra Group',
    'Legal business name is strictly Adabhra Group across client and server'
  );

  assert(
    LEGAL_CONFIG.ORGANISATION_TYPE.includes('Sole Proprietorship') &&
    SERVER_LEGAL_CONFIG.ORGANISATION_TYPE.includes('Sole Proprietorship'),
    'Entity type is Sole Proprietorship registered in India'
  );

  assert(
    !LEGAL_CONFIG.ORGANISATION_TYPE.toLowerCase().includes('private limited') &&
    !LEGAL_CONFIG.ORGANISATION_TYPE.toLowerCase().includes('corporation') &&
    !LEGAL_CONFIG.ORGANISATION_TYPE.toLowerCase().includes('llp'),
    'Entity is NOT falsely represented as Pvt Ltd, LLP, or corporation'
  );

  assert(
    LEGAL_CONFIG.APP_URL === 'https://lazyproof.online' &&
    SERVER_LEGAL_CONFIG.APP_URL === 'https://lazyproof.online',
    'Canonical URL is https://lazyproof.online'
  );

  assert(
    LEGAL_CONFIG.SUPPORT_EMAIL === 'support@lazyproof.online' &&
    SERVER_LEGAL_CONFIG.SUPPORT_EMAIL === 'support@lazyproof.online',
    'Customer support email is support@lazyproof.online'
  );

  assert(
    LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS.includes('Bettiah') &&
    LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS.includes('Bihar') &&
    LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS.includes('845454'),
    'Public business address is registered in Bettiah, Bihar with PIN 845454'
  );

  // ----------------------------------------------------
  // SUITE 2: COMPLIANCE PAGES & DELIVERY ROUTE
  // ----------------------------------------------------
  console.log('\n--- 2. Compliance Pages & Digital Delivery Route ---');
  assert(Boolean(ROUTE_SEO['/delivery']), '/delivery route is defined in server SEO registry');
  assert(
    ROUTE_SEO['/delivery'].title.includes('Digital Delivery'),
    '/delivery route title clearly defines Digital Delivery'
  );

  assert(Boolean(ROUTE_SEO['/terms']), '/terms route is defined in server SEO registry');
  assert(Boolean(ROUTE_SEO['/refund-cancellation']), '/refund-cancellation route is defined in server SEO registry');
  assert(Boolean(ROUTE_SEO['/privacy']), '/privacy route is defined in server SEO registry');
  assert(Boolean(ROUTE_SEO['/contact']), '/contact route is defined in server SEO registry');

  // Verify non-gambling disclaimers
  assert(
    LEGAL_CONFIG.NON_GAMBLING_DISCLAIMER.includes('NOT gambling') &&
    LEGAL_CONFIG.NON_GAMBLING_DISCLAIMER.includes('no prize money') &&
    LEGAL_CONFIG.NON_GAMBLING_DISCLAIMER.includes('no winnings'),
    'Explicit non-gambling and no-winnings disclaimers are present'
  );

  // ----------------------------------------------------
  // SUITE 3: CASHFREE PAYMENT PROVIDER & WEBHOOK CRYPTOGRAPHY
  // ----------------------------------------------------
  console.log('\n--- 3. Cashfree Provider & Cryptographic HMAC Verification ---');
  const dummyAppId = 'TEST_CF_APP_12345';
  const dummySecret = 'TEST_CF_SECRET_9876543210_SECURE_KEY';
  const provider = new CashfreeProvider({
    appId: dummyAppId,
    secretKey: dummySecret,
    isSandbox: true
  });

  assert(provider.isConfigured() === true, 'Cashfree provider configured with credentials returns true');
  assert(provider.name === 'cashfree', 'Provider name is cashfree');

  // Test Webhook Verification Algorithm: Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
  const testTimestamp = String(Date.now());
  const testPayload = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: 'order_test_cf_001', order_amount: 500, order_currency: 'INR' },
      payment: { cf_payment_id: 'cf_pay_998877', payment_status: 'SUCCESS', payment_amount: 500, payment_currency: 'INR' }
    }
  });

  const correctSignature = crypto
    .createHmac('sha256', dummySecret)
    .update(testTimestamp + testPayload)
    .digest('base64');

  // Valid webhook
  const validRes = await provider.verifyWebhook(testPayload, {
    'x-webhook-timestamp': testTimestamp,
    'x-webhook-signature': correctSignature
  });
  assert(validRes.isValid === true, 'Authentic Cashfree webhook passes HMAC-SHA256 signature verification');
  assert(validRes.status === 'SUCCESS', 'Webhook status parsed as SUCCESS');
  assert(validRes.orderId === 'order_test_cf_001', 'Order ID extracted correctly');
  assert(validRes.amount === 500, 'Order amount extracted correctly');
  assert(validRes.providerPaymentId === 'cf_pay_998877', 'Cashfree payment ID extracted correctly');

  // Signature mismatch rejection
  const badSignatureRes = await provider.verifyWebhook(testPayload, {
    'x-webhook-timestamp': testTimestamp,
    'x-webhook-signature': 'bad_fake_signature_abc123'
  });
  assert(badSignatureRes.isValid === false, 'Invalid webhook signature is rejected');
  assert(badSignatureRes.error?.includes('signature mismatch'), 'Detailed mismatch error returned');

  // Missing header rejection
  const missingHeaderRes = await provider.verifyWebhook(testPayload, {
    'x-webhook-signature': correctSignature
  });
  assert(missingHeaderRes.isValid === false, 'Webhook missing timestamp header is rejected');

  // Replay attack rejection: timestamp 20 minutes in the past
  const oldTimestamp = String(Date.now() - 20 * 60 * 1000);
  const oldSignature = crypto
    .createHmac('sha256', dummySecret)
    .update(oldTimestamp + testPayload)
    .digest('base64');

  const replayRes = await provider.verifyWebhook(testPayload, {
    'x-webhook-timestamp': oldTimestamp,
    'x-webhook-signature': oldSignature
  });
  assert(replayRes.isValid === false, 'Replay attack with stale timestamp (>10 min) is rejected');
  assert(replayRes.error?.includes('10-minute window'), 'Explicit replay window error returned');

  // ----------------------------------------------------
  // SUITE 4: PAYMENT MODES & PRODUCTION SAFETY
  // ----------------------------------------------------
  console.log('\n--- 4. Payment Modes & Production Safety Guardrails ---');
  // 4.1 Production + Sandbox is strictly forbidden
  const origEnv = process.env.NODE_ENV;
  const origMode = process.env.PAYMENT_MODE;
  let sandboxProdForbidden = false;
  try {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_MODE = 'sandbox';
    new PaymentManager();
  } catch (err: any) {
    if (err?.message?.includes('PAYMENT_MODE=sandbox is strictly forbidden in a production environment')) {
      sandboxProdForbidden = true;
    }
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.PAYMENT_MODE = origMode;
  }
  assert(sandboxProdForbidden, 'PaymentManager throws fatal error if PAYMENT_MODE=sandbox in production');

  // 4.2 Live mode without credentials safely falls back to disabled
  let liveWithoutCredsSafelyDisabled = false;
  try {
    process.env.NODE_ENV = 'development';
    process.env.PAYMENT_MODE = 'live';
    delete process.env.CASHFREE_APP_ID;
    delete process.env.CASHFREE_SECRET_KEY;
    const pm = new PaymentManager();
    if (pm.getMode() === 'disabled') {
      liveWithoutCredsSafelyDisabled = true;
    }
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.PAYMENT_MODE = origMode;
  }
  assert(liveWithoutCredsSafelyDisabled, 'Live mode without API keys safely falls back to disabled mode');

  // ----------------------------------------------------
  // SUITE 5: POSTGRESQL & ATOMIC REFUND RANK REVERSAL
  // ----------------------------------------------------
  console.log('\n--- 5. PostgreSQL Architecture & Atomic Rank Deduction ---');
  const schemaPath = path.resolve(process.cwd(), 'server/db/schema.sql');
  assert(fs.existsSync(schemaPath), 'Production schema.sql exists');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS profiles'), 'schema.sql defines profiles table');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS payment_orders'), 'schema.sql defines payment_orders table');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS payment_transactions'), 'schema.sql defines payment_transactions table');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS rank_ledger'), 'schema.sql defines rank_ledger table');

  // Test reverseRefund state machine on database
  const refundProfileId = 'p-refund-test-' + Date.now();
  const refundOrderId = 'order_refund_test_' + Date.now();

  // Create active profile in DB with verified amount ₹1,000
  db.addProfile({
    id: refundProfileId,
    userId: 'u-' + refundProfileId,
    name: 'Refund Target User',
    amount: 1000,
    rank: 1,
    isVerified: true,
    ownerToken: 'owner-refund-token-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Create matching order with valid owner token
  db.createOrder({
    orderId: refundOrderId,
    name: 'Refund Target User',
    amount: 1000,
    profileId: refundProfileId,
    ownerToken: 'owner-refund-token-123'
  });

  const profBefore = db.getProfile(refundProfileId);
  assert(profBefore?.amount === 1000, 'Profile created with initial verified amount ₹1,000');

  // Execute reverseRefund of ₹600
  const refundSuccess = await db.reverseRefund(refundOrderId, 600, 'Customer requested partial refund');
  assert(refundSuccess === true, 'db.reverseRefund completes successfully');

  const profAfter = db.getProfile(refundProfileId);
  assert(profAfter?.amount === 400, 'Verified amount accurately decremented from ₹1,000 to ₹400 upon refund');

  // Execute full refund of remaining ₹400
  await db.reverseRefund(refundOrderId, 400, 'Customer requested complete refund');
  const profFinal = db.getProfile(refundProfileId);
  assert(profFinal?.amount === 0, 'Verified amount accurately reduced to ₹0 after full refund');

  // ----------------------------------------------------
  // SUITE 6: API ENDPOINTS INTEGRATION (/api/payment/*)
  // ----------------------------------------------------
  console.log('\n--- 6. Payment API Endpoints & Truthful Review Mode ---');
  const TEST_PORT = 3198;
  process.env.PORT = String(TEST_PORT);
  process.env.ADMIN_KEY = 'test-forensic-admin-key-2026';
  process.env.PAYMENT_MODE = 'disabled';
  process.env.DEMO_MODE = 'false';
  process.env.APP_URL = 'https://lazyproof.online';

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
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  if (!connected) {
    throw new Error(`Server failed to bind and respond on ${BASE} within 8 seconds`);
  }

  // 6.1 /api/payment/config
  const resConfig = await fetchJson(`${BASE}/api/payment/config`);
  assert(resConfig.status === 200, '/api/payment/config returns 200');
  assert(resConfig.body.legalBusinessName === 'Adabhra Group', 'Config exposes Adabhra Group as operator');
  assert(resConfig.body.currency === 'INR', 'Config specifies INR currency');
  assert(resConfig.body.provider === 'cashfree', 'Config specifies Cashfree as provider');

  // 6.2 /api/payment/create-order input validations
  // When payments disabled, it returns 503
  const resOrderDisabled = await fetchJson(`${BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { name: 'Valid Name', amount: 50 }
  });
  assert(resOrderDisabled.status === 503, 'create-order returns 503 when PAYMENT_MODE=disabled');

  // 6.3 Receipt Endpoint
  const dummyReceiptOrderId = 'order_receipt_test_' + Date.now();
  db.createOrder({
    orderId: dummyReceiptOrderId,
    name: 'Receipt User',
    amount: 750
  });

  const resReceipt = await fetchJson(`${BASE}/api/payment/receipt/${dummyReceiptOrderId}`);
  assert(resReceipt.status === 200, '/api/payment/receipt/:orderId returns 200');
  assert(resReceipt.body.operator === 'Adabhra Group', 'Receipt operator is Adabhra Group');
  assert(resReceipt.body.amount === 750, 'Receipt amount matches order amount');
  assert(resReceipt.body.currency === 'INR', 'Receipt currency is INR');
  assert(
    resReceipt.body.taxTreatment.includes('Standard GST invoicing is not applicable'),
    'Receipt contains truthful tax disclosure (no fake GST invoice)'
  );

  // 6.4 Status Polling Endpoint
  const resStatus = await fetchJson(`${BASE}/api/payment/status/${dummyReceiptOrderId}`);
  assert(resStatus.status === 200, '/api/payment/status/:orderId returns 200');
  assert(resStatus.body.orderId === dummyReceiptOrderId, 'Status orderId matches');

  // 6.5 Existing Profile Upgrade Ownership Validation
  const upgradeTargetId = 'p-upgrade-test-' + Date.now();
  const validOwnerToken = 'upgrade-owner-token-' + Date.now();
  db.addProfile({
    id: upgradeTargetId,
    userId: 'u-' + upgradeTargetId,
    name: 'Upgrade Target User',
    amount: 100,
    rank: 5,
    isVerified: true,
    ownerToken: validOwnerToken,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Verify unauthorized upgrade order without token
  // Temporarily enable payment mode in paymentManager to test input validation
  const pmMode = (paymentManager as any).mode;
  (paymentManager as any).mode = 'sandbox';

  try {
    const resBadToken = await fetchJson(`${BASE}/api/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Upgrade Target User',
        amount: 200,
        profileId: upgradeTargetId,
        ownerToken: 'wrong-owner-token'
      }
    });
    assert(resBadToken.status === 403, 'Unauthorized profile upgrade rejected with 403');

    // Invalid amount (non-integer)
    const resFloatAmount = await fetchJson(`${BASE}/api/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Upgrade Target User',
        amount: 150.75
      }
    });
    assert(resFloatAmount.status === 400, 'Non-integer amount rejected with 400');

    // Invalid amount (> ₹10,00,000)
    const resOverMax = await fetchJson(`${BASE}/api/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Upgrade Target User',
        amount: 1000001
      }
    });
    assert(resOverMax.status === 400, 'Amount over ₹10,00,000 limit rejected with 400');

  } finally {
    (paymentManager as any).mode = pmMode;
  }

  // 6.6 Admin-authorized refund endpoint
  const resRefundNoAdmin = await fetchJson(`${BASE}/api/payment/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { orderId: dummyReceiptOrderId, amount: 750 }
  });
  assert(resRefundNoAdmin.status === 403, 'Unauthenticated refund request rejected with 403');

  const resRefundAdmin = await fetchJson(`${BASE}/api/payment/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': 'test-forensic-admin-key-2026'
    },
    body: { orderId: dummyReceiptOrderId, amount: 750, reason: 'Approved test refund' }
  });
  assert(resRefundAdmin.status === 200, 'Admin-authorized refund processed with 200');
  assert(resRefundAdmin.body.status === 'REFUNDED', 'Order status marked as REFUNDED');

  console.log('\n========================================================');
  console.log(`COMMERCIAL SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCommercialTests().catch((err) => {
  console.error('Fatal commercial test error:', err);
  process.exit(1);
});
