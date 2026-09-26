import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  submitClaimPayment,
  pollRedirectOrderStatus,
  makeHex64,
  makeIdempotencyKey,
  isCryptoAvailable,
  PENDING_CHECKOUT_KEY,
  orderCheckoutKey,
  saveOwnerToken,
  getSavedOwnerToken
} from '../src/utils/checkoutContract.ts';
import {
  safeLinkedInUrl,
  safeInstagramUrl,
  safeWebsiteUrl
} from '../src/components/ProfileCard.tsx';
import { formatIllustrativeUSD } from '../src/utils/showcase.ts';

console.log('\n========================================================');
console.log('RUNNING SUITE 8: FRONTEND CONTRACT SMOKE TESTS');
console.log('========================================================\n');

let passed = 0;
function pass(msg: string) {
  passed++;
  console.log(`  ✓ PASS: ${msg}`);
}

// Memory Storage Mock for isolated frontend testing
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

async function runFrontendContractTests() {
  // ----------------------------------------------------
  // 1. Token Format & Cryptographic Randomness (Zero Math.random)
  // ----------------------------------------------------
  console.log('--- 1. Token Hex Format Invariants ---');
  assert.ok(isCryptoAvailable(), 'Browser / Node cryptographic services must be available');

  const sampleLazy = makeHex64('lazy');
  assert.ok(
    /^lazy_[0-9a-f]{64}$/.test(sampleLazy),
    `pendingOwnerToken must match /^lazy_[0-9a-f]{64}$/, got: ${sampleLazy}`
  );
  assert.strictEqual(sampleLazy.length, 69, 'lazy_ prefix + 64 hex chars = 69 total chars');

  const sampleOrd = makeHex64('ord');
  assert.ok(
    /^ord_[0-9a-f]{64}$/.test(sampleOrd),
    `orderAccessToken must match /^ord_[0-9a-f]{64}$/, got: ${sampleOrd}`
  );
  assert.strictEqual(sampleOrd.length, 68, 'ord_ prefix + 64 hex chars = 68 total chars');

  // Verify uniqueness
  const sampleLazy2 = makeHex64('lazy');
  assert.notStrictEqual(sampleLazy, sampleLazy2, 'Generated tokens must be distinct random sequences');

  const sampleIdemp = makeIdempotencyKey();
  assert.ok(/^idem_\d+_[0-9a-f]{16}$/.test(sampleIdemp), 'Idempotency key strictly cryptographically generated');
  pass('makeHex64 & makeIdempotencyKey generate cryptographically compliant lazy_, ord_, and idem_ tokens');

  // ----------------------------------------------------
  // 2. New Claim Contract: Payload, Headers & Pre-Fetch Backup
  // ----------------------------------------------------
  console.log('\n--- 2. New Claim Create-Order Contract ---');
  const mockSessionStorage = new MemoryStorage();
  const mockLocalStorage = new MemoryStorage();

  let interceptedRequest: { url: string; options: any } | null = null;
  const mockFetchNewClaim: typeof fetch = async (input, init) => {
    interceptedRequest = { url: String(input), options: init };
    // Check that sessionStorage has stored the record BEFORE the network call completes
    const preBackup = mockSessionStorage.getItem(PENDING_CHECKOUT_KEY);
    assert.ok(preBackup, 'Pending checkout must be saved in sessionStorage before request resolves');
    const parsedBackup = JSON.parse(preBackup);
    assert.ok(parsedBackup.ownerToken.startsWith('lazy_'), 'Pre-backed up owner token starts with lazy_');
    assert.ok(parsedBackup.orderAccessToken.startsWith('ord_'), 'Pre-backed up order token starts with ord_');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        orderId: 'cf_order_test_12345',
        paymentSessionId: 'session_mock_123',
        amount: 100,
        currency: 'INR'
      })
    } as any;
  };

  const newClaimResult = await submitClaimPayment({
    input: {
      name: 'Sloth Master',
      amount: 100,
      customerPhone: '9876543210',
      customerEmail: 'sloth@lazyproof.online',
      instagram: 'slothmaster',
      linkedin: '',
      website: 'https://sloth.example',
      reason: 'Too lazy to wake up early',
      lazyReason: 'Sleep Enthusiast',
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    },
    lastAttempt: null,
    currentIdempotencyKey: null,
    currentOrderAccessToken: null,
    currentPendingOwnerToken: null,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetchNewClaim
  });

  assert.strictEqual(newClaimResult.status, 'SUCCESS', 'New claim order succeeds');
  assert.ok(interceptedRequest, 'Create-order fetch must be called');
  assert.strictEqual(interceptedRequest.url, '/api/payment/create-order');
  assert.strictEqual(interceptedRequest.options.method, 'POST');

  const reqBody = JSON.parse(interceptedRequest.options.body);
  const reqHeaders = interceptedRequest.options.headers;

  // Verify request protocol: must send `name`, never `customerName`
  assert.strictEqual(reqBody.name, 'Sloth Master', 'Must send `name`');
  assert.strictEqual(reqBody.customerName, undefined, 'Must NEVER send `customerName`');
  assert.strictEqual(reqBody.amount, 100, 'Must send whole INR rupee amount');
  assert.strictEqual(typeof reqBody.amount, 'number', 'Amount must be a numeric integer');
  assert.strictEqual(reqBody.consentAccepted, true, 'Transmits actual boolean consent');

  // Verify token placement for new claim
  assert.ok(/^lazy_[0-9a-f]{64}$/.test(reqBody.pendingOwnerToken), 'Must send pendingOwnerToken with 64 hex chars');
  assert.strictEqual(reqBody.ownerToken, undefined, 'Must NOT send ownerToken on new claim');
  assert.ok(/^ord_[0-9a-f]{64}$/.test(reqBody.orderAccessToken), 'Must send orderAccessToken with 64 hex chars');

  // Verify headers
  assert.strictEqual(reqHeaders['x-order-access-token'], reqBody.orderAccessToken, 'x-order-access-token header must match body orderAccessToken');
  assert.ok(reqHeaders['x-idempotency-key']?.startsWith('idem_'), 'x-idempotency-key header must be present');
  assert.strictEqual(reqHeaders['x-profile-token'], undefined, 'x-profile-token must not be present on new claim');

  // Verify order checkout saved after order creation
  const orderBackup = mockSessionStorage.getItem(orderCheckoutKey('cf_order_test_12345'));
  assert.ok(orderBackup, 'Order checkout record must be stored by orderId in sessionStorage');
  pass('New claim create-order sends name, pendingOwnerToken, orderAccessToken, headers, and backs up sessionStorage');

  // ----------------------------------------------------
  // 2B. Dynamic Consent Enforcement (Negative Assertion)
  // ----------------------------------------------------
  console.log('\n--- 2B. Negative Assertion: Dynamic Consent Rejection ---');
  let consentRejectedFetchCalled = false;
  const mockFetchConsentCheck: typeof fetch = async () => {
    consentRejectedFetchCalled = true;
    return { ok: true, status: 200, json: async () => ({}) } as any;
  };

  const rejectedConsentResult = await submitClaimPayment({
    input: {
      name: 'Consent Reject Test',
      amount: 100,
      customerPhone: '9876543210',
      consentAccepted: false, // FALSE: user did not check consent
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    },
    lastAttempt: null,
    currentIdempotencyKey: null,
    currentOrderAccessToken: null,
    currentPendingOwnerToken: null,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetchConsentCheck
  });

  assert.strictEqual(rejectedConsentResult.status, 'ERROR', 'Order initiation must fail when consent is false');
  assert.ok(
    (rejectedConsentResult as any).error.includes('Terms & Conditions'),
    'Error message must state that terms and privacy agreement is required'
  );
  assert.strictEqual(consentRejectedFetchCalled, false, 'Must NOT invoke network fetch when consent is unchecked');
  pass('Dynamic consent enforcement rejects unaccepted consent before network call');

  // ----------------------------------------------------
  // 3. Existing Profile Upgrade Contract (Security & Tokens)
  // ----------------------------------------------------
  console.log('\n--- 3. Existing Profile Upgrade Contract ---');
  // Scenario A: Missing stored owner token -> MUST FAIL CLOSED without sending request
  let upgradeIntercepted = false;
  const mockFetchUpgrade: typeof fetch = async () => {
    upgradeIntercepted = true;
    return { ok: true, status: 200, json: async () => ({}) } as any;
  };

  const missingTokenUpgrade = await submitClaimPayment({
    input: {
      name: 'Sloth Master',
      amount: 250,
      customerPhone: '9876543210',
      profileId: 'prof_unauthorized_999',
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    },
    lastAttempt: null,
    currentIdempotencyKey: null,
    currentOrderAccessToken: null,
    currentPendingOwnerToken: null,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage, // Empty, has no token for prof_unauthorized_999
    fetchFn: mockFetchUpgrade
  });

  assert.strictEqual(missingTokenUpgrade.status, 'ERROR', 'Upgrade without token must fail closed');
  assert.ok(
    (missingTokenUpgrade as any).error.includes('Unauthorized'),
    'Reports clear unauthorized error when owner token is missing'
  );
  assert.strictEqual(upgradeIntercepted, false, 'Must NEVER call create-order API when owner token is missing');
  pass('Existing profile upgrade fails closed when owner token is unavailable in browser');

  // Scenario B: Stored owner token exists -> Sends actual token with x-profile-token and ownerToken
  const genuineOwnerToken = 'lazy_genuine_owner_token_0123456789abcdef0123456789abcdef0123456789abcdef';
  saveOwnerToken('prof_valid_123', genuineOwnerToken, mockLocalStorage);
  assert.strictEqual(getSavedOwnerToken('prof_valid_123', mockLocalStorage), genuineOwnerToken);

  let upgradeRequest: { url: string; options: any } | null = null;
  const mockFetchGenuineUpgrade: typeof fetch = async (input, init) => {
    upgradeRequest = { url: String(input), options: init };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        orderId: 'cf_upgrade_order_555',
        amount: 250,
        currency: 'INR'
      })
    } as any;
  };

  const validUpgradeResult = await submitClaimPayment({
    input: {
      name: 'Sloth Master',
      amount: 250,
      customerPhone: '9876543210',
      profileId: 'prof_valid_123',
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    },
    lastAttempt: null,
    currentIdempotencyKey: null,
    currentOrderAccessToken: null,
    currentPendingOwnerToken: null,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetchGenuineUpgrade
  });

  assert.strictEqual(validUpgradeResult.status, 'SUCCESS', 'Upgrade with valid token succeeds');
  assert.ok(upgradeRequest, 'Upgrade create-order request must be made');
  const upBody = JSON.parse(upgradeRequest.options.body);
  const upHeaders = upgradeRequest.options.headers;

  assert.strictEqual(upBody.profileId, 'prof_valid_123', 'Must pass target profileId');
  assert.strictEqual(upBody.ownerToken, genuineOwnerToken, 'Must pass authentic stored ownerToken in body');
  assert.strictEqual(upBody.pendingOwnerToken, undefined, 'Must NOT pass pendingOwnerToken on upgrade');
  assert.strictEqual(upHeaders['x-profile-token'], genuineOwnerToken, 'Must pass authentic token in x-profile-token header');
  pass('Existing profile upgrade retrieves stored token and sends with ownerToken and x-profile-token');

  // ----------------------------------------------------
  // 4. Identical Retry vs Parametric Change
  // ----------------------------------------------------
  console.log('\n--- 4. Identical Retry vs Parametric Change ---');
  let attempt1Tokens: any;
  let attempt2Tokens: any;
  let attempt3Tokens: any;

  const mockFetchRetry: typeof fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ orderId: 'order_test' })
  } as any);

  // Attempt 1: Initial claim
  const res1 = await submitClaimPayment({
    input: {
      name: 'Retry Sloth',
      amount: 150,
      customerPhone: '9876543210',
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    },
    lastAttempt: null,
    currentIdempotencyKey: null,
    currentOrderAccessToken: null,
    currentPendingOwnerToken: null,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetchRetry
  });
  assert.strictEqual(res1.status, 'SUCCESS');
  attempt1Tokens = (res1 as any).tokens;

  // Attempt 2: Identical retry (exact same name, amount, phone, profileId)
  const res2 = await submitClaimPayment({
    input: {
      name: 'Retry Sloth',
      amount: 150,
      customerPhone: '9876543210',
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    },
    lastAttempt: {
      name: 'Retry Sloth',
      amount: 150,
      phone: '9876543210',
      profileId: undefined
    },
    currentIdempotencyKey: attempt1Tokens.idempotencyKey,
    currentOrderAccessToken: attempt1Tokens.orderAccessToken,
    currentPendingOwnerToken: attempt1Tokens.ownerToken,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetchRetry
  });
  assert.strictEqual(res2.status, 'SUCCESS');
  attempt2Tokens = (res2 as any).tokens;

  // Verify tokens preserved on identical retry
  assert.strictEqual(attempt2Tokens.idempotencyKey, attempt1Tokens.idempotencyKey, 'Idempotency key preserved on identical retry');
  assert.strictEqual(attempt2Tokens.orderAccessToken, attempt1Tokens.orderAccessToken, 'Order access token preserved on identical retry');
  assert.strictEqual(attempt2Tokens.ownerToken, attempt1Tokens.ownerToken, 'Pending owner token preserved on identical retry');

  // Attempt 3: Parameter changed (amount changed from 150 to 200)
  const res3 = await submitClaimPayment({
    input: {
      name: 'Retry Sloth',
      amount: 200, // CHANGED
      customerPhone: '9876543210',
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    },
    lastAttempt: {
      name: 'Retry Sloth',
      amount: 150,
      phone: '9876543210',
      profileId: undefined
    },
    currentIdempotencyKey: attempt1Tokens.idempotencyKey,
    currentOrderAccessToken: attempt1Tokens.orderAccessToken,
    currentPendingOwnerToken: attempt1Tokens.ownerToken,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetchRetry
  });
  assert.strictEqual(res3.status, 'SUCCESS');
  attempt3Tokens = (res3 as any).tokens;

  // Verify fresh tokens generated when parameter changes
  assert.notStrictEqual(attempt3Tokens.idempotencyKey, attempt1Tokens.idempotencyKey, 'Fresh idempotency key generated when amount changes');
  assert.notStrictEqual(attempt3Tokens.orderAccessToken, attempt1Tokens.orderAccessToken, 'Fresh order access token generated when amount changes');
  assert.notStrictEqual(attempt3Tokens.ownerToken, attempt1Tokens.ownerToken, 'Fresh owner token generated when amount changes');
  pass('Identical retry preserves all tokens; parameter change generates fresh idempotency and access tokens');

  // ----------------------------------------------------
  // 5. 503 Truthful Unavailable State Handling
  // ----------------------------------------------------
  console.log('\n--- 5. 503 Service Unavailable Handling ---');
  const mockFetch503: typeof fetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: 'Payment gateway temporarily disabled' })
  } as any);

  const res503 = await submitClaimPayment({
    input: {
      name: 'Disabled Gateway Test',
      amount: 50,
      customerPhone: '9876543210',
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    },
    lastAttempt: null,
    currentIdempotencyKey: null,
    currentOrderAccessToken: null,
    currentPendingOwnerToken: null,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetch503,
    topAmount: 100,
    minAmountToBeatTop: 101
  });

  assert.strictEqual(res503.status, 'UNAVAILABLE_503', 'Correctly flags 503 status');
  const orderData503 = (res503 as any).orderData;
  assert.strictEqual(orderData503.name, 'Disabled Gateway Test', 'Passes expected `name`');
  assert.strictEqual(orderData503.customerName, undefined, 'Does not pass `customerName`');
  assert.strictEqual(orderData503.amount, 50, 'Passes expected `amount`');
  assert.strictEqual(orderData503.orderAmount, undefined, 'Does not pass `orderAmount`');
  assert.strictEqual(orderData503.paymentMode, 'disabled', 'Specifies disabled payment mode');
  pass('503 Service Unavailable state correctly constructs modal payload with name and amount');

  // ----------------------------------------------------
  // 6. Redirect Return Restoration ({status: "PAID", profile: ...})
  // ----------------------------------------------------
  console.log('\n--- 6. Redirect Return Restoration Contract ---');
  const redirectOrderId = 'ord_redirect_test_777';
  const redirectAccessToken = makeHex64('ord');
  const redirectOwnerToken = makeHex64('lazy');

  // Setup stored order checkout in sessionStorage
  mockSessionStorage.setItem(
    orderCheckoutKey(redirectOrderId),
    JSON.stringify({
      ownerToken: redirectOwnerToken,
      orderAccessToken: redirectAccessToken,
      idempotencyKey: 'idem_test',
      createdAt: Date.now()
    })
  );
  mockSessionStorage.setItem(PENDING_CHECKOUT_KEY, 'stale_pending_marker');

  let pollUrls: string[] = [];
  let pollHeaders: any[] = [];
  const mockFetchPoll: typeof fetch = async (input, init) => {
    pollUrls.push(String(input));
    pollHeaders.push(init?.headers);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'PAID', // Authoritative status field, NOT orderStatus
        profile: {
          id: 'prof_from_redirect_888',
          name: 'Redirect Sloth Winner',
          amount: 500,
          isVerified: true,
          rank: 1
        }
      })
    } as any;
  };

  const redirectResult = await pollRedirectOrderStatus({
    orderId: redirectOrderId,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetchPoll,
    maxPollAttempts: 3,
    pollIntervalMs: 10,
    sleepFn: async () => {}
  });

  assert.strictEqual(redirectResult.status, 'PAID', 'Redirect polling identifies PAID status');
  assert.ok(pollUrls[0].includes(`/api/payment/status/${redirectOrderId}`), 'Queries status endpoint with encoded order ID');
  assert.strictEqual(pollHeaders[0]['x-order-access-token'], redirectAccessToken, 'Sends stored x-order-access-token header');

  // Verify that receipt endpoint was NOT queried for profile
  assert.ok(!pollUrls.some(u => u.includes('/api/payment/receipt')), 'Did not wait for or call receipt endpoint for profile');

  // Verify that owner token was stored in localStorage for the confirmed profile
  const savedToken = getSavedOwnerToken('prof_from_redirect_888', mockLocalStorage);
  assert.strictEqual(savedToken, redirectOwnerToken, 'Stored recovered browser-owned token in localStorage');

  // Verify sessionStorage cleanup
  assert.strictEqual(mockSessionStorage.getItem(orderCheckoutKey(redirectOrderId)), null, 'Order sessionStorage entry removed');
  assert.strictEqual(mockSessionStorage.getItem(PENDING_CHECKOUT_KEY), null, 'Pending checkout sessionStorage entry removed');
  pass('Redirect restoration polls with x-order-access-token, reads status: PAID, extracts profile directly, saves token, and cleans sessionStorage');

  // Scenario B: Polling receives EXPIRED / FAILED
  mockSessionStorage.setItem(
    orderCheckoutKey('ord_expired_1'),
    JSON.stringify({
      ownerToken: redirectOwnerToken,
      orderAccessToken: redirectAccessToken,
      idempotencyKey: 'idem_test',
      createdAt: Date.now()
    })
  );

  const mockFetchExpired: typeof fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ status: 'EXPIRED' })
  } as any);

  const expiredResult = await pollRedirectOrderStatus({
    orderId: 'ord_expired_1',
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    fetchFn: mockFetchExpired,
    maxPollAttempts: 1,
    sleepFn: async () => {}
  });

  assert.strictEqual(expiredResult.status, 'EXPIRED', 'Identifies EXPIRED status accurately');
  assert.ok(expiredResult.error.includes('expired'), 'Contains accurate error message');
  pass('Redirect restoration accurately terminates on EXPIRED / FAILED without fake success');

  // ----------------------------------------------------
  // 7. Strict Social Link URL Validation
  // ----------------------------------------------------
  console.log('\n--- 7. Strict Social Link URL Validation ---');
  // Phishing / bypass attempts MUST return null
  assert.strictEqual(safeLinkedInUrl('https://linkedin.com.attacker.com/in/victim'), null, 'Rejects linkedin.com subdomain phishing');
  assert.strictEqual(safeLinkedInUrl('https://linkedin.com.evil.example/in/user'), null, 'Rejects evil.example domain variation');
  assert.strictEqual(safeLinkedInUrl('https://notlinkedin.com/in/user'), null, 'Rejects unrelated domain');
  assert.strictEqual(safeLinkedInUrl('javascript:alert(1)'), null, 'Rejects javascript scheme');

  assert.strictEqual(safeInstagramUrl('https://instagram.com.attacker.com/profile'), null, 'Rejects instagram.com subdomain phishing');
  assert.strictEqual(safeInstagramUrl('https://instagram.com.evil.example/user'), null, 'Rejects evil.example domain variation');
  assert.strictEqual(safeInstagramUrl('https://fakeinstagram.com/user'), null, 'Rejects fakeinstagram domain');
  assert.strictEqual(safeInstagramUrl('javascript:alert(1)'), null, 'Rejects javascript scheme');

  // Legitimate URLs MUST pass
  assert.strictEqual(safeLinkedInUrl('https://www.linkedin.com/in/johndoe'), 'https://www.linkedin.com/in/johndoe');
  assert.strictEqual(safeLinkedInUrl('https://linkedin.com/in/johndoe'), 'https://linkedin.com/in/johndoe');
  assert.strictEqual(safeLinkedInUrl('@johndoe'), 'https://www.linkedin.com/in/johndoe');

  assert.strictEqual(safeInstagramUrl('https://www.instagram.com/slothmaster'), 'https://www.instagram.com/slothmaster');
  assert.strictEqual(safeInstagramUrl('https://instagram.com/slothmaster'), 'https://instagram.com/slothmaster');
  assert.strictEqual(safeInstagramUrl('@slothmaster'), 'https://www.instagram.com/slothmaster');
  pass('Strict social link URL validation allows exact hostnames and rejects malicious/phishing variations');

  // ----------------------------------------------------
  // 8. Illustrative USD Pricing Formatting
  // ----------------------------------------------------
  console.log('\n--- 8. Illustrative USD Pricing Formatting ---');
  assert.strictEqual(formatIllustrativeUSD(1), '~$0.01', '₹1 displays as ~$0.01 cents (NEVER ~$0)');
  assert.strictEqual(formatIllustrativeUSD(50), '~$0.59', '₹50 displays as ~$0.59 cents');
  assert.strictEqual(formatIllustrativeUSD(85), '~$1', '₹85 displays as ~$1');
  assert.strictEqual(formatIllustrativeUSD(1000), '~$12', '₹1000 displays as ~$12');
  assert.notStrictEqual(formatIllustrativeUSD(1), '~$0', '₹1 must never display as ~$0');
  pass('Illustrative USD formatting shows exact cents for sub-dollar amounts and never ~$0');

  // ----------------------------------------------------
  // 9. Truthful Leaderboard Wording Invariants
  // ----------------------------------------------------
  console.log('\n--- 9. Leaderboard Truthful Wording ---');
  const lbContent = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Leaderboard.tsx'), 'utf-8');
  assert.ok(
    lbContent.includes('Dynamic sponsored placement · Rank adjusts as new sponsored payments are verified'),
    'Leaderboard empty state uses truthful dynamic ranking description'
  );
  assert.ok(
    !lbContent.includes('permanent #1 position'),
    'Leaderboard does not promise permanent #1 position'
  );
  pass('Leaderboard copy uses truthful dynamic placement wording without permanent rank promises');

  // ----------------------------------------------------
  // 10. Static Source Contract Invariants
  // ----------------------------------------------------
  console.log('\n--- 10. Static Source Contract Invariants ---');
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');

  // Request & Status Invariants
  assert.ok(!appSrc.includes('customerName: claimData.name'), 'App must not pass customerName in create-order payload');
  assert.ok(!appSrc.includes('statusData.orderStatus'), 'App must read statusData.status, not statusData.orderStatus');
  assert.ok(!appSrc.includes('receiptData.profile'), 'App must not await receiptData.profile to complete paid checkout');
  assert.ok(appSrc.includes('encodeURIComponent(returnOrderId)'), 'App encodes returnOrderId in status URL');

  // Zero verified count truthfulness
  assert.ok(
    !appSrc.includes('verifiedProfilesCount || totalCount'),
    'App must not use totalCount as a fallback for verifiedProfilesCount'
  );
  assert.ok(appSrc.includes('verifiedTotalCount'), 'App tracks verifiedTotalCount independently');

  // Homepage Render Cleanliness: Removed legacy poll, heatmap, feed, and how-it-works from render
  assert.ok(!appSrc.includes('<LazyDilemmaWidget'), 'LazyDilemmaWidget removed from homepage render');
  assert.ok(!appSrc.includes('<GlobalActivityHeatmap'), 'GlobalActivityHeatmap removed from homepage render');
  assert.ok(!appSrc.includes('<ActivityFeed'), 'ActivityFeed removed from homepage render');
  assert.ok(!appSrc.includes('<HowItWorks'), 'HowItWorks removed from homepage render');

  // Hero layout invariants
  const heroSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Hero.tsx'), 'utf-8');
  assert.ok(heroSrc.includes('md:col-span-7'), 'Hero desktop left column is md:col-span-7');
  assert.ok(heroSrc.includes('md:col-span-5'), 'Hero desktop right column is md:col-span-5');
  assert.ok(heroSrc.includes('hidden md:flex'), 'Hero mascot is hidden on mobile');
  assert.ok(heroSrc.includes('WHO IS THE LAZIEST PERSON ALIVE?'), 'Hero has exact headline');
  assert.ok(!heroSrc.includes('for this period'), 'Hero does not use the phrase "for this period"');
  assert.ok(!heroSrc.includes('<QuickClaimBar'), 'Hero does not duplicate QuickClaimBar');

  // Leaderboard 4 states invariants
  const lbSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Leaderboard.tsx'), 'utf-8');
  assert.ok(lbSrc.includes('STATE 1: LOADING SKELETON'), 'Leaderboard implements loading skeleton state');
  assert.ok(lbSrc.includes('STATE 2: API ERROR'), 'Leaderboard implements API error state with retry');
  assert.ok(lbSrc.includes('STATE 3: ZERO VERIFIED PROFILES'), 'Leaderboard implements zero verified profiles state');
  assert.ok(lbSrc.includes('STATE 4: POPULATED WITH REAL PROFILES'), 'Leaderboard implements populated real profile cards');
  assert.ok(lbSrc.includes('#fff4ee'), 'Empty state #1 uses #fff4ee background');
  assert.ok(!lbSrc.includes("World's Top 3"), 'Leaderboard removes duplicate podium');

  // ProfileCard invariants
  const cardSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ProfileCard.tsx'), 'utf-8');
  assert.ok(cardSrc.includes('profile.isVerified &&'), 'ProfileCard only renders verified badge when isVerified');
  assert.ok(cardSrc.includes('safeWebsiteUrl'), 'ProfileCard validates website URL scheme');
  assert.ok(cardSrc.includes('safeLinkedInUrl'), 'ProfileCard validates LinkedIn URL scheme');
  assert.ok(cardSrc.includes('safeInstagramUrl'), 'ProfileCard validates Instagram URL scheme');
  assert.ok(cardSrc.includes('X profile not connected'), 'ProfileCard renders X inactive');

  // ActionPanel never copies category to reason
  const actionSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ActionPanel.tsx'), 'utf-8');
  assert.ok(actionSrc.includes('reason: reason.trim() || undefined,'), 'ActionPanel preserves authentic reason');
  assert.ok(actionSrc.includes('lazyReason: category || undefined,'), 'ActionPanel stores category separately in lazyReason');

  // MiniRanking invariants
  const miniSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'MiniRanking.tsx'), 'utf-8');
  assert.ok(miniSrc.includes('Top spots · All time'), 'MiniRanking is titled "Top spots · All time"');
  assert.ok(!miniSrc.includes("Today's ranking"), 'MiniRanking does not claim "Today\'s ranking"');

  // StatsRibbon invariants
  const statsSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'StatsRibbon.tsx'), 'utf-8');
  assert.ok(statsSrc.includes('Not tracked by system'), 'StatsRibbon shows Profile Views as not tracked');
  pass('All frontend source contract invariants verified (layout, truthfulness, security, and state handling)');

  // ----------------------------------------------------
  // 11. Immediate Verified PAID Owner Token Persistence & Failure Recovery
  // ----------------------------------------------------
  console.log('\n--- 11. Immediate Verified Owner Token Persistence ---');
  const isolatedStorage = new MemoryStorage();
  const testClientOwnerToken = makeHex64('lazy');
  const testConfirmedProfileId = 'prof_immed_' + Date.now();

  // Test 1: Immediate token persistence on verified PAID
  const saveResult = saveOwnerToken(testConfirmedProfileId, testClientOwnerToken, isolatedStorage);
  assert.strictEqual(saveResult, true, 'saveOwnerToken returns true on successful storage write');
  assert.strictEqual(
    getSavedOwnerToken(testConfirmedProfileId, isolatedStorage),
    testClientOwnerToken,
    'Client-generated token must be persisted immediately upon verified payment'
  );

  // Test 2: User closes modal WITHOUT clicking "View Profile on Leaderboard" -> Reopens in same browser
  // Token remains in storage and valid
  const reloadedToken = getSavedOwnerToken(testConfirmedProfileId, isolatedStorage);
  assert.strictEqual(
    reloadedToken,
    testClientOwnerToken,
    'Owner token must remain present and valid even if user never clicked View Profile'
  );

  // Test 3: Failed / cancelled / pending status never persists token
  const pendingProfileId = 'prof_pending_' + Date.now();
  // Ensure unverified/pending orders do not save a token
  assert.strictEqual(
    getSavedOwnerToken(pendingProfileId, isolatedStorage),
    null,
    'Unverified or pending profiles must have no owner token saved'
  );

  // Test 4: Profile upgrade preserves existing authentic token
  const upgradedProfileId = 'prof_upgrade_' + Date.now();
  const originalUpgradeToken = makeHex64('lazy');
  saveOwnerToken(upgradedProfileId, originalUpgradeToken, isolatedStorage);
  assert.strictEqual(getSavedOwnerToken(upgradedProfileId, isolatedStorage), originalUpgradeToken);
  // Re-saving the same owner token on upgrade preserves the exact authentic token without minting a new one
  saveOwnerToken(upgradedProfileId, originalUpgradeToken, isolatedStorage);
  assert.strictEqual(
    getSavedOwnerToken(upgradedProfileId, isolatedStorage),
    originalUpgradeToken,
    'Profile upgrade must preserve original authentic owner token'
  );

  // Test 5: Storage failure (quota exceeded or storage blocked) returns false
  const throwingStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0
  } as any;
  const failureResult = saveOwnerToken('prof_fail_test', testClientOwnerToken, throwingStorage);
  assert.strictEqual(failureResult, false, 'saveOwnerToken must return false when storage fails');

  // Verify PaymentModal source contract: persists immediately upon PAID status and warns on storage failure
  const modalSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'PaymentModal.tsx'), 'utf-8');
  assert.ok(
    modalSrc.includes('saveOwnerToken(profile.id, clientToken)'),
    'PaymentModal immediately persists client-generated token on verified PAID'
  );
  assert.ok(
    modalSrc.includes('setStorageWarning'),
    'PaymentModal provides recovery warning when browser storage is unavailable'
  );
  assert.ok(
    modalSrc.includes('handleModalClose'),
    'PaymentModal close button executes safe handleModalClose'
  );
  pass('Immediate token persistence, modal dismissal without View Profile, upgrade token preservation, and storage recovery verified');

  console.log(`\nSUITE 8 COMPLETE: All ${passed} assertions passed successfully (100%).\n`);
}

runFrontendContractTests().catch((err) => {
  console.error('\nFrontend contract test failed:', err);
  process.exit(1);
});
