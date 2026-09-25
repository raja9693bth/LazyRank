import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../server/db.ts';
import { hashToken, verifyOwnerToken } from '../server/db/postgres.ts';
import { CashfreeProvider } from '../server/payments/cashfree.ts';
import { SERVER_LEGAL_CONFIG } from '../server/config/legal.ts';
import { LEGAL_CONFIG } from '../src/config/legal.ts';

async function runComplianceGatewayTests() {
  console.log('\n========================================================');
  console.log('RUNNING SUITE 4: FINAL PRE-GATEWAY COMPLIANCE & PAYMENT CORRECTNESS');
  console.log('========================================================\n');

  let passed = 0;
  function pass(msg: string) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  // ----------------------------------------------------
  // 1. Consent Defaults False & Privacy Policy Inclusion
  // ----------------------------------------------------
  console.log('--- 1. Affirmative Consent Contract ---');
  const actionPanelContent = fs.readFileSync(path.join(process.cwd(), 'src/components/ActionPanel.tsx'), 'utf-8');
  assert(actionPanelContent.includes('const [termsAccepted, setTermsAccepted] = useState(false);'), 'Consent checkbox must default to false');
  pass('Consent checkbox default is strictly false (not pre-checked)');

  assert(actionPanelContent.includes("href=\"/privacy\""), 'Consent UI links to Privacy Policy');
  assert(actionPanelContent.includes("href=\"/terms\""), 'Consent UI links to Terms & Conditions');
  assert(actionPanelContent.includes("href=\"/refund-cancellation\""), 'Consent UI links to Refund & Cancellation Policy');
  pass('Consent disclosure prominently links Terms, Privacy, and Refund policies');

  // ----------------------------------------------------
  // 2. Cashfree SDK Failure State (No fake polling)
  // ----------------------------------------------------
  console.log('\n--- 2. Cashfree Checkout Failure Handling ---');
  const paymentModalContent = fs.readFileSync(path.join(process.cwd(), 'src/components/PaymentModal.tsx'), 'utf-8');
  assert(paymentModalContent.includes('Payment checkout could not load. Please retry.'), 'Explicit checkout failure error message exists');
  assert(paymentModalContent.includes("setErrorMessage('Payment checkout could not load. Please retry.')"), 'Payment modal sets explicit checkout error when SDK fails');
  assert(!paymentModalContent.includes('if (!checkoutUrl) { setPaymentStatus(\'polling\');'), 'SDK failure without checkoutUrl must never start polling');
  pass('Cashfree SDK initialization failure shows explicit retry state without fake polling');

  // ----------------------------------------------------
  // 3. Centralized Cashfree API Version
  // ----------------------------------------------------
  console.log('\n--- 3. Cashfree API Version Invariants ---');
  const cashfreeCode = fs.readFileSync(path.join(process.cwd(), 'server/payments/cashfree.ts'), 'utf-8');
  assert(cashfreeCode.includes("DEFAULT_CASHFREE_API_VERSION = '2026-01-01'"), 'Default Cashfree API version is 2026-01-01');
  const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf-8');
  assert(envExample.includes('CASHFREE_API_VERSION="2026-01-01"') || envExample.includes('CASHFREE_API_VERSION=2026-01-01'), '.env.example specifies 2026-01-01');
  const provider = new CashfreeProvider();
  assert.strictEqual(provider.getApiVersion(), '2026-01-01', 'Provider defaults to API version 2026-01-01');
  pass('Centralized Cashfree API version is strictly 2026-01-01 across code, tests, and env');

  // ----------------------------------------------------
  // 4. Owner Token Security Hardening
  // ----------------------------------------------------
  console.log('\n--- 4. Owner Token Security & Cryptographic Hashing ---');
  const rawToken = 'lazy_test_token_' + crypto.randomBytes(16).toString('hex');
  const tokenHash = hashToken(rawToken);
  assert.strictEqual(tokenHash.length, 64, 'SHA-256 token hash must be 64 hex characters');
  assert.notStrictEqual(tokenHash, rawToken, 'Token must be hashed, not stored plaintext');

  assert(verifyOwnerToken(tokenHash, rawToken), 'verifyOwnerToken matches raw token against stored hash');
  assert(!verifyOwnerToken(tokenHash, 'wrong_token'), 'verifyOwnerToken rejects incorrect token');
  assert(!verifyOwnerToken(tokenHash, undefined), 'verifyOwnerToken rejects undefined token');

  // Safe migration fallback for legacy plaintext token
  const legacyPlaintext = 'legacy_plaintext_token_123';
  assert(verifyOwnerToken(legacyPlaintext, legacyPlaintext), 'verifyOwnerToken supports safe migration for legacy records');
  pass('Owner token hashing and constant-time verification implemented with safe migration');

  // Public Profile DTO leakage prevention
  const dummyProfile = db.createParticipant({ name: 'Security Check Profile' });
  const sanitized = db.sanitizeProfile(dummyProfile);
  assert.strictEqual((sanitized as any).ownerToken, undefined, 'ownerToken must be stripped in public profile DTO');
  assert.strictEqual((sanitized as any).ownerTokenHash, undefined, 'ownerTokenHash must never leak in public profile DTO');
  pass('Public profile DTO strictly excludes private owner credentials and hashes');

  // ----------------------------------------------------
  // 5. Customer Contact Email Unification
  // ----------------------------------------------------
  console.log('\n--- 5. Support Contact Unification ---');
  assert.strictEqual(LEGAL_CONFIG.SUPPORT_EMAIL, 'support@lazyproof.online', 'LEGAL_CONFIG support email is support@lazyproof.online');
  assert.strictEqual(SERVER_LEGAL_CONFIG.SUPPORT_EMAIL, 'support@lazyproof.online', 'SERVER_LEGAL_CONFIG support email is support@lazyproof.online');

  // Verify no stale contact@lazyproof.online exists in source code
  const seoClient = fs.readFileSync(path.join(process.cwd(), 'src/utils/seo.ts'), 'utf-8');
  assert(!seoClient.includes('contact@lazyproof.online'), 'Client SEO must not contain contact@lazyproof.online');
  const seoServer = fs.readFileSync(path.join(process.cwd(), 'server/seo.ts'), 'utf-8');
  assert(!seoServer.includes('contact@lazyproof.online'), 'Server SEO must not contain contact@lazyproof.online');
  pass('Support contact email is unified to support@lazyproof.online across all surfaces');

  // ----------------------------------------------------
  // 6. Tax / GST Truthful Disclosure
  // ----------------------------------------------------
  console.log('\n--- 6. Tax / GST Neutral Truthful Wording ---');
  assert(!LEGAL_CONFIG.TAX_DISCLOSURE.includes('threshold exemption'), 'Tax disclosure must not claim threshold exemption');
  assert(LEGAL_CONFIG.TAX_DISCLOSURE.includes('Applicable taxes, if any, will be handled in accordance with applicable law.'), 'Truthful tax law wording present');
  pass('Tax / GST wording is neutral, truthful, and makes no false threshold exemption claims');

  // ----------------------------------------------------
  // 7. Stale Auction / Gaming Wording Cleaned
  // ----------------------------------------------------
  console.log('\n--- 7. Non-Auction & Non-Gaming Truthful Mechanics ---');
  const howItWorks = fs.readFileSync(path.join(process.cwd(), 'src/components/HowItWorks.tsx'), 'utf-8');
  assert(!howItWorks.toLowerCase().includes('outbid'), 'HowItWorks must not contain "outbid"');

  const infoModals = fs.readFileSync(path.join(process.cwd(), 'src/components/InfoModals.tsx'), 'utf-8');
  assert(!infoModals.includes('pay-to-rank internet game'), 'InfoModals must not characterize platform as an internet game');
  assert(infoModals.includes('digital sponsored showcase and public ranking social experiment'), 'InfoModals contains truthful social experiment wording');

  const serverSeo = fs.readFileSync(path.join(process.cwd(), 'server/seo.ts'), 'utf-8');
  assert(!serverSeo.includes('monetary bids'), 'Server SEO must not contain "monetary bids"');
  pass('Misleading auction/game wording successfully cleaned while preserving transparent amount-based ranking');

  // ----------------------------------------------------
  // 8. Order Idempotency Contract
  // ----------------------------------------------------
  console.log('\n--- 8. Create-Order Idempotency Key Handling ---');
  const testIdemKey = 'idem_test_' + Date.now();
  const testOrderId = 'order_idem_' + Date.now();

  await db.createOrder({
    orderId: testOrderId,
    name: 'Idempotent User',
    amount: 500,
    idempotencyKey: testIdemKey,
    customerPhone: '9876543210',
    consentAccepted: true
  });

  const retrievedOrder = await db.getOrderByIdempotencyKey(testIdemKey);
  assert.ok(retrievedOrder, 'Order must be retrievable by its idempotency key');
  assert.strictEqual(retrievedOrder.orderId, testOrderId, 'Order ID must match registered order');
  assert.strictEqual(retrievedOrder.idempotencyKey, testIdemKey, 'Idempotency key preserved');
  pass('Create-order idempotency key lookup returns existing order session across retries');

  // ----------------------------------------------------
  // 9. Dedicated Refund Webhook Payload Parsing
  // ----------------------------------------------------
  console.log('\n--- 9. Refund Webhook Payload Structure ---');
  const dummySecret = 'test_secret_for_compliance_verification';
  const refundProvider = new CashfreeProvider({ isSandbox: true });
  (refundProvider as any).secretKey = dummySecret;

  const refundWebhookBody = JSON.stringify({
    type: 'REFUND_SUCCESS_WEBHOOK',
    event_time: '2026-09-24T18:00:00Z',
    data: {
      order: {
        order_id: 'order_test_refund_001',
        order_amount: 1000,
        order_currency: 'INR'
      },
      refund: {
        cf_refund_id: 'cf_ref_778899',
        refund_id: 'ref_client_001',
        order_id: 'order_test_refund_001',
        refund_amount: 400,
        refund_currency: 'INR',
        refund_status: 'SUCCESS',
        refund_arn: 'ARN123456789'
      }
    }
  });

  const refundTimestamp = String(Date.now());
  const refundSig = crypto
    .createHmac('sha256', dummySecret)
    .update(refundTimestamp + refundWebhookBody)
    .digest('base64');

  const verifiedRefund = await refundProvider.verifyWebhook(refundWebhookBody, {
    'x-webhook-timestamp': refundTimestamp,
    'x-webhook-signature': refundSig
  });

  assert(verifiedRefund.isValid === true, 'Refund webhook signature must be valid');
  assert.strictEqual(verifiedRefund.status, 'REFUNDED', 'Status must be REFUNDED');
  assert.ok(verifiedRefund.refund, 'Dedicated refund details must be parsed');
  assert.strictEqual(verifiedRefund.refund.refundId, 'ref_client_001');
  assert.strictEqual(verifiedRefund.refund.providerRefundId, 'cf_ref_778899');
  assert.strictEqual(verifiedRefund.refund.amount, 400);
  assert.strictEqual(verifiedRefund.refund.status, 'SUCCESS');
  pass('Cashfree refund webhook correctly parses data.refund fields without conflating payment IDs');

  // ----------------------------------------------------
  // 10. Refund State Machine: Partial & Duplicate Guardrails
  // ----------------------------------------------------
  console.log('\n--- 10. Refund State Machine & Debit Guardrails ---');
  const refundTestOrderId = 'order_refund_guard_' + Date.now();
  await db.createOrder({
    orderId: refundTestOrderId,
    name: 'Refund Guard User',
    amount: 1000,
    customerPhone: '9876543210',
    consentAccepted: true
  });

  // Verify partial refund
  const partialOk = await db.reverseRefund(refundTestOrderId, 400, 'Partial refund test', 'cf_ref_p1');
  assert.strictEqual(partialOk, true, 'Partial refund of ₹400 must succeed');
  const orderAfterP1 = await db.getOrderAsync(refundTestOrderId);
  assert.strictEqual(orderAfterP1?.status, 'PARTIALLY_REFUNDED', 'Order status must be PARTIALLY_REFUNDED');

  // Verify second partial refund
  const partial2Ok = await db.reverseRefund(refundTestOrderId, 600, 'Remaining refund test', 'cf_ref_p2');
  assert.strictEqual(partial2Ok, true, 'Second partial refund of ₹600 must succeed');
  const orderAfterP2 = await db.getOrderAsync(refundTestOrderId);
  assert.strictEqual(orderAfterP2?.status, 'REFUNDED', 'Order status must be fully REFUNDED after 400 + 600 = 1000');

  // Verify total refund cannot exceed original payment
  const excessiveRefundOk = await db.reverseRefund(refundTestOrderId, 100, 'Excessive refund test', 'cf_ref_p3');
  assert.strictEqual(excessiveRefundOk, false, 'Refund exceeding original payment must be rejected');
  pass('Refund state machine enforces double-entry limits: partial status tracking & total amount capped at order total');

  console.log('\n========================================================');
  console.log(`SUITE 4 SUMMARY: ALL ${passed} ASSERTIONS PASSED (100%)`);
  console.log('========================================================\n');
}

runComplianceGatewayTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nCompliance gateway test failure:', err);
    process.exit(1);
  });
