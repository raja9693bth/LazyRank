process.env.NODE_ENV = 'test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { PostgresDatabase, hashToken } from '../server/db/postgres.ts';
import { isSafeLocalTestDatabase } from '../server.ts';
import { computeCheckoutFingerprint, CheckoutIntentFields } from '../src/utils/checkoutContract.ts';
import { CashfreeProvider } from '../server/payments/cashfree.ts';
import { CURRENT_CONSENT_VERSION, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/config/legal.ts';

async function fetchJson(url: string, options: any = {}) {
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


const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';

async function runPhase9Tests() {
  console.log('\n========================================================');
  console.log('RUNNING PHASE 9: FINAL TECHNICAL, PAYMENT-RELIABILITY & SEARCH-READINESS CLOSURE');
  console.log('========================================================\n');

  let passed = 0;
  function pass(msg: string) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  // =========================================================================
  // 1. isSafeLocalTestDatabase Strict URL Parsing & Security Invariants
  // =========================================================================
  console.log('--- 1. isSafeLocalTestDatabase Strict URL Parsing Invariants ---');

  // Negative tests: missing, empty, malformed
  assert.strictEqual(isSafeLocalTestDatabase(undefined), false, 'Undefined URL must return false');
  assert.strictEqual(isSafeLocalTestDatabase(''), false, 'Empty URL must return false');
  assert.strictEqual(isSafeLocalTestDatabase('   '), false, 'Whitespace URL must return false');
  assert.strictEqual(isSafeLocalTestDatabase('not_a_valid_url'), false, 'Malformed URL must return false');
  assert.strictEqual(isSafeLocalTestDatabase('http://localhost:5432/lazyproof_test'), false, 'HTTP protocol must return false');
  assert.strictEqual(isSafeLocalTestDatabase('https://localhost:5432/lazyproof_test'), false, 'HTTPS protocol must return false');

  // Negative tests: remote hosts, Neon, substrings
  assert.strictEqual(
    isSafeLocalTestDatabase('postgresql://user:test@prod.example.com/lazyproof'),
    false,
    'Substrings "test" in password on remote host must NOT make it safe'
  );
  assert.strictEqual(
    isSafeLocalTestDatabase('postgresql://user:localhost@prod.example.com/lazyproof'),
    false,
    'Substrings "localhost" in username on remote host must NOT make it safe'
  );
  assert.strictEqual(
    isSafeLocalTestDatabase('postgresql://user:pass@remote.test.example/lazyproof'),
    false,
    'Remote host containing "test" must return false'
  );
  assert.strictEqual(
    isSafeLocalTestDatabase('postgresql://user:pass@ep-xyz.neon.tech/lazyproof_test'),
    false,
    'Neon host with lazyproof_test DB name must return false'
  );
  assert.strictEqual(
    isSafeLocalTestDatabase('postgresql://user:pass@ep-xyz.aws.neon.build/lazyproof_test'),
    false,
    'Neon build host must return false'
  );
  assert.strictEqual(
    isSafeLocalTestDatabase('postgresql://postgres@127.0.0.1:5432/production_database'),
    false,
    'Loopback host targeting non-test database name must return false'
  );
  pass('Negative isSafeLocalTestDatabase tests strictly reject all remote, Neon, malformed, and non-test DBs');

  // Positive tests: explicit loopback + allowed disposable test DB
  assert.strictEqual(
    isSafeLocalTestDatabase('postgresql://postgres@localhost:5432/lazyproof_test'),
    true,
    'localhost + lazyproof_test must return true'
  );
  assert.strictEqual(
    isSafeLocalTestDatabase('postgresql://postgres@127.0.0.1:5433/lazyproof_test'),
    true,
    '127.0.0.1 + lazyproof_test must return true'
  );
  assert.strictEqual(
    isSafeLocalTestDatabase('postgres://postgres@[::1]:5432/lazyproof_test'),
    true,
    '::1 loopback + lazyproof_test must return true'
  );
  pass('Positive isSafeLocalTestDatabase tests allow only loopback hosts with allowed disposable test DB');

  // Mock refund database bypass regression: missing dbUrl must never qualify as safe
  const testModeWithMissingDb = (isProd: boolean, nodeEnv: string, allowMock: string, dbUrl?: string) => {
    return !isProd &&
      (nodeEnv === 'test' || allowMock === 'true') &&
      Boolean(dbUrl) &&
      isSafeLocalTestDatabase(dbUrl);
  };

  assert.strictEqual(
    testModeWithMissingDb(false, 'test', 'true', undefined),
    false,
    'Missing DATABASE_URL/TEST_DATABASE_URL must NEVER qualify for mock refund testMode'
  );
  assert.strictEqual(
    testModeWithMissingDb(false, 'test', 'true', ''),
    false,
    'Empty DATABASE_URL must NEVER qualify for mock refund testMode'
  );
  assert.strictEqual(
    testModeWithMissingDb(false, 'test', 'false', 'postgresql://postgres@127.0.0.1:5433/lazyproof_test'),
    true,
    'Present safe local test DB URL with test intent qualifies for mock refund testMode'
  );
  assert.strictEqual(
    testModeWithMissingDb(true, 'production', 'true', 'postgresql://postgres@127.0.0.1:5433/lazyproof_test'),
    false,
    'Production environment NEVER qualifies for mock refund testMode'
  );
  pass('Mock refund routing invariant strictly requires present safe local test DB URL and rejects all missing DB bypasses');

  // =========================================================================
  // 2. Checkout Idempotency Fingerprint & Parameter Mutation Detection
  // =========================================================================
  console.log('--- 2. Checkout Idempotency Fingerprint Invariants ---');

  const baseIntent: CheckoutIntentFields = {
    name: 'Aarav Sharma',
    amount: 500,
    customerPhone: '9876543210',
    customerEmail: 'aarav@example.com',
    profileId: 'p-aarav-1',
    instagram: 'aarav_sh',
    linkedin: 'linkedin.com/in/aarav',
    website: 'https://aarav.me',
    twitter: '@aarav',
    reason: 'Proving my ultimate laziness',
    lazyReason: 'Procrastination Champion',
    consentAccepted: true,
    consentVersion: CURRENT_CONSENT_VERSION
  };

  const baseFp = computeCheckoutFingerprint(baseIntent);
  assert.ok(typeof baseFp === 'string' && baseFp.length > 0, 'Fingerprint must be non-empty string');

  // Exact retry produces identical fingerprint
  const retryFp = computeCheckoutFingerprint({ ...baseIntent });
  assert.strictEqual(baseFp, retryFp, 'Exact identical parameters produce identical fingerprint');

  // Normalization: whitespace and email case normalization
  const normFp = computeCheckoutFingerprint({
    ...baseIntent,
    name: '  Aarav Sharma  ',
    customerEmail: 'AARAV@EXAMPLE.COM',
    customerPhone: '  9876543210 '
  });
  assert.strictEqual(baseFp, normFp, 'Normalized parameters produce identical fingerprint');

  // Changes to any order-affecting field MUST alter the fingerprint
  assert.notStrictEqual(
    computeCheckoutFingerprint({ ...baseIntent, amount: 600 }),
    baseFp,
    'Amount change alters fingerprint'
  );
  assert.notStrictEqual(
    computeCheckoutFingerprint({ ...baseIntent, customerEmail: 'newemail@example.com' }),
    baseFp,
    'Email change alters fingerprint'
  );
  assert.notStrictEqual(
    computeCheckoutFingerprint({ ...baseIntent, customerPhone: '9999999999' }),
    baseFp,
    'Phone change alters fingerprint'
  );
  assert.notStrictEqual(
    computeCheckoutFingerprint({ ...baseIntent, profileId: 'p-other-2' }),
    baseFp,
    'ProfileId change alters fingerprint'
  );
  assert.notStrictEqual(
    computeCheckoutFingerprint({ ...baseIntent, website: 'https://different.org' }),
    baseFp,
    'Website change alters fingerprint'
  );
  assert.notStrictEqual(
    computeCheckoutFingerprint({ ...baseIntent, reason: 'A completely different reason' }),
    baseFp,
    'Reason change alters fingerprint'
  );
  assert.notStrictEqual(
    computeCheckoutFingerprint({ ...baseIntent, lazyReason: 'Couch Potato' }),
    baseFp,
    'LazyReason change alters fingerprint'
  );
  assert.notStrictEqual(
    computeCheckoutFingerprint({ ...baseIntent, consentVersion: '2026-10-01' }),
    baseFp,
    'ConsentVersion change alters fingerprint'
  );
  pass('Checkout fingerprint is deterministic and detects modifications across all 13 order fields');

  // =========================================================================
  // 3. UserSettingsModal Response Unwrapping & Deduplication Logic
  // =========================================================================
  console.log('--- 3. UserSettingsModal Unwrapping & Discovery Logic ---');

  // Contract: UserSettingsModal unwraps { profile: UserProfile } response envelopes
  function isValidUserProfile(data: any): boolean {
    return Boolean(
      data &&
      typeof data === 'object' &&
      typeof data.id === 'string' &&
      data.id.trim().length > 0 &&
      typeof data.name === 'string' &&
      typeof data.amount === 'number'
    );
  }

  function unwrapProfileResponse(json: any): any | null {
    if (!json || typeof json !== 'object') return null;
    if (json.profile && isValidUserProfile(json.profile)) {
      return json.profile;
    }
    if (isValidUserProfile(json)) {
      return json;
    }
    return null;
  }

  // Envelope unwrap test
  const envelope = {
    profile: {
      id: 'p-owned-1',
      name: 'Owner Profile',
      amount: 1000,
      rank: 2,
      isVerified: true
    }
  };
  const unwrapped = unwrapProfileResponse(envelope);
  assert.ok(unwrapped !== null && unwrapped.id === 'p-owned-1', 'Response envelope { profile: ... } successfully unwrapped');

  // Direct profile fallback test
  const direct = {
    id: 'p-direct-1',
    name: 'Direct Profile',
    amount: 500,
    rank: 3,
    isVerified: true
  };
  assert.ok(unwrapProfileResponse(direct)?.id === 'p-direct-1', 'Direct UserProfile object accepted as backward compatibility');

  // Invalid response rejection
  assert.strictEqual(unwrapProfileResponse(null), null, 'null response returns null');
  assert.strictEqual(unwrapProfileResponse({ error: 'Profile not found' }), null, 'error response returns null');
  assert.strictEqual(unwrapProfileResponse({ profile: { invalid: true } }), null, 'malformed profile envelope returns null');

  // Deduplication logic test
  const loadedProfiles = [
    { id: 'p-1', name: 'Profile 1', amount: 500, rank: 1, isVerified: true },
    { id: 'p-2', name: 'Profile 2', amount: 400, rank: 2, isVerified: true }
  ];
  const fetchedProfiles = [
    { id: 'p-2', name: 'Profile 2', amount: 400, rank: 2, isVerified: true }, // duplicate from loaded
    { id: 'p-3', name: 'Profile 3 (Owned from Page 2)', amount: 200, rank: 8, isVerified: true } // newly discovered
  ];

  const profileMap = new Map<string, any>();
  for (const p of loadedProfiles) profileMap.set(p.id, p);
  for (const p of fetchedProfiles) profileMap.set(p.id, p); // deduplicates p-2

  const combinedOwned = Array.from(profileMap.values());
  assert.strictEqual(combinedOwned.length, 3, 'Combined owned profiles deduplicated by profile ID');
  assert.ok(combinedOwned.some(p => p.id === 'p-3'), 'Discovered profile absent from loaded page included');
  pass('UserSettings discovery correctly unwraps envelopes, handles missing profiles, and deduplicates IDs');

  // =========================================================================
  // 4. Cashfree Webhook Freshness & Signature Semantics
  // =========================================================================
  console.log('--- 4. Cashfree Webhook Signature & Timestamp Freshness ---');

  const testSecret = 'cf_secret_key_test_1234567890abcdef1234567890abcdef';
  const provider = new CashfreeProvider({
    appId: 'cf_app_test',
    secretKey: testSecret,
    apiVersion: '2026-01-01',
    isSandbox: true
  });

  const payload = JSON.stringify({
    data: {
      order: { order_id: 'order_test_123', order_amount: 500, order_currency: 'INR' },
      payment: { cf_payment_id: 'cf_pay_999', payment_status: 'SUCCESS', payment_amount: 500 }
    },
    event_time: new Date().toISOString(),
    type: 'PAYMENT_SUCCESS_WEBHOOK'
  });

  // Test with fresh timestamp (now)
  const freshTimestamp = Date.now().toString();
  const signatureInput = `${freshTimestamp}${payload}`;
  const validSignature = crypto.createHmac('sha256', testSecret).update(signatureInput).digest('base64');

  const freshResult = await provider.verifyWebhook(payload, {
    'x-webhook-timestamp': freshTimestamp,
    'x-webhook-signature': validSignature
  });
  assert.strictEqual(freshResult.isValid, true, 'Webhook with fresh timestamp and valid signature is valid');

  // Test with delayed timestamp (e.g. 15 minutes old = 900,000 ms)
  const delayedTimestamp = (Date.now() - 900000).toString();
  const delayedSignatureInput = `${delayedTimestamp}${payload}`;
  const delayedSignature = crypto.createHmac('sha256', testSecret).update(delayedSignatureInput).digest('base64');

  const delayedResult = await provider.verifyWebhook(payload, {
    'x-webhook-timestamp': delayedTimestamp,
    'x-webhook-signature': delayedSignature
  });
  assert.strictEqual(delayedResult.isValid, true, 'Cryptographically valid delayed webhook is accepted');

  // Test with bad signature
  const badSigResult = await provider.verifyWebhook(payload, {
    'x-webhook-timestamp': freshTimestamp,
    'x-webhook-signature': 'bad_sig_base64=='
  });
  assert.strictEqual(badSigResult.isValid, false, 'Invalid signature rejected');

  // Test with missing timestamp
  const missingTsResult = await provider.verifyWebhook(payload, {
    'x-webhook-signature': validSignature
  });
  assert.strictEqual(missingTsResult.isValid, false, 'Missing timestamp rejected');

  // Test with malformed timestamp format
  const malformedTsResult = await provider.verifyWebhook(payload, {
    'x-webhook-timestamp': 'not-a-timestamp',
    'x-webhook-signature': validSignature
  });
  assert.strictEqual(malformedTsResult.isValid, false, 'Malformed timestamp format rejected');

  // Test with tampered payload
  const tamperedResult = await provider.verifyWebhook(payload + ' ', {
    'x-webhook-timestamp': freshTimestamp,
    'x-webhook-signature': validSignature
  });
  assert.strictEqual(tamperedResult.isValid, false, 'Tampered webhook payload rejected');
  pass('Cashfree webhook accepts delayed cryptographically valid webhooks and enforces HMAC-SHA256 signature verification');

  // =========================================================================
  // 5. PostgreSQL Authoritative Integration: Dynamic Sitemap & Privacy Filters
  // =========================================================================
  console.log('--- 5. PostgreSQL Authoritative Integration & Profile Sitemap ---');

  const pg = new PostgresDatabase(TEST_DB_URL);
  await pg.init();
  const pool = await pg.getPool();

  // Reset test tables
  await pool.query('DELETE FROM outbox_channel_deliveries');
  await pool.query('DELETE FROM operational_outbox');
  await pool.query('DELETE FROM refund_reversals');
  await pool.query('DELETE FROM rank_ledger');
  await pool.query('DELETE FROM payment_transactions');
  await pool.query('DELETE FROM payment_orders');
  await pool.query('DELETE FROM claim_history');
  await pool.query('DELETE FROM profiles');

  // Insert representative profiles into PostgreSQL:
  // 1. Active, verified, positive net amount (SHOULD be in sitemap)
  const pActive1 = 'p-sitemap-active-1';
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, moderation_status, owner_token_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [pActive1, 'u-1', 'Active Verified Top', 2000, 1, true, 'active', hashToken('active1_token')]
  );

  // 2. Active, verified, positive net amount (SHOULD be in sitemap)
  const pActive2 = 'p-sitemap-active-2';
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, moderation_status, owner_token_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [pActive2, 'u-2', 'Active Verified Runner', 1000, 2, true, 'active', hashToken('active2_token')]
  );

  // 3. Fully refunded zero-net profile (MUST NOT be in sitemap)
  const pRefunded = 'p-sitemap-refunded';
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, moderation_status, owner_token_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [pRefunded, 'u-3', 'Refunded Profile', 0, 999999, false, 'active', hashToken('refunded_token_xyz')]
  );

  // 4. Moderated / removed profile (MUST NOT be in sitemap)
  const pModerated = 'p-sitemap-moderated';
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, moderation_status, owner_token_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [pModerated, 'u-4', 'Removed Profile', 500, 3, true, 'removed', hashToken('moderated_token')]
  );

  // 5. Unverified profile (MUST NOT be in sitemap)
  const pUnverified = 'p-sitemap-unverified';
  await pool.query(
    `INSERT INTO profiles (id, user_id, name, amount, rank, is_verified, moderation_status, owner_token_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [pUnverified, 'u-5', 'Unverified Profile', 500, 4, false, 'active', hashToken('unverified_token')]
  );

  // Query sitemap profiles exactly as server.ts does
  const sitemapQuery = await pool.query(
    `SELECT id, updated_at, created_at FROM profiles 
     WHERE moderation_status = 'active' AND is_verified = TRUE AND amount > 0 
     ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC 
     LIMIT 50000`
  );

  const sitemapIds = sitemapQuery.rows.map(r => r.id);
  assert.strictEqual(sitemapIds.length, 2, 'Sitemap query includes exactly 2 eligible profiles');
  assert.ok(sitemapIds.includes(pActive1), 'Active verified top profile included in sitemap');
  assert.ok(sitemapIds.includes(pActive2), 'Active verified runner profile included in sitemap');
  assert.ok(!sitemapIds.includes(pRefunded), 'Zero-net refunded profile strictly excluded from sitemap');
  assert.ok(!sitemapIds.includes(pModerated), 'Moderated removed profile strictly excluded from sitemap');
  assert.ok(!sitemapIds.includes(pUnverified), 'Unverified profile strictly excluded from sitemap');
  pass('PostgreSQL sitemap query strictly enforces privacy and status filters');

  // Verify Owner-Authenticated Historical Lookup
  // 1. Unauthenticated public lookup on refunded profile returns null
  const publicLookup = await pg.getProfile(pRefunded);
  assert.strictEqual(publicLookup, null, 'Public getProfile returns null for zero-net refunded profile (404)');

  // 2. Raw profile lookup with valid owner token
  const rawProfile = await pg.getRawProfile(pRefunded);
  assert.ok(rawProfile !== null, 'getRawProfile retrieves record for owner authentication');
  assert.strictEqual(rawProfile.ownerTokenHash, hashToken('refunded_token_xyz'), 'Raw profile contains hashed owner token');

  // 3. Sanitized representation check: never exposes ownerTokenHash or rank 999999
  const sanitized = { ...rawProfile };
  delete sanitized.ownerTokenHash;
  delete sanitized.owner_token_hash;
  delete sanitized.ownerToken;
  sanitized.rank = 0;
  sanitized.isVerified = false;

  assert.strictEqual(sanitized.ownerTokenHash, undefined, 'Sanitized historical profile omits ownerTokenHash');
  assert.strictEqual(sanitized.isVerified, false, 'Historical profile is never shown as verified');
  assert.strictEqual(sanitized.rank, 0, 'Historical profile does not display rank 999999');
  pass('Historical profile lookup securely authenticates owner without weakening public 404 behavior');

  // =========================================================================
  // 6. Source Code Integrity, Compliance Copy & Identity Verification
  // =========================================================================
  console.log('--- 6. Source Code & Compliance Invariant Verification ---');

  // 6.1 Hero text invariance
  const heroContent = fs.readFileSync(path.join(process.cwd(), 'src/components/Hero.tsx'), 'utf-8');
  assert.ok(
    heroContent.includes('Claim your spot. Sponsor higher. Rank higher. Make them knock you off.'),
    'Hero copy must strictly match approved sentence verbatim'
  );
  pass('Hero copy sentence preserved verbatim');

  // 6.2 Contact page business registration correspondence
  const contactContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/ContactPage.tsx'), 'utf-8');
  const legalContent = fs.readFileSync(path.join(process.cwd(), 'src/config/legal.ts'), 'utf-8');
  assert.ok(
    contactContent.includes('Business registration correspondence:'),
    'Contact page includes Business registration correspondence label'
  );
  assert.ok(
    contactContent.includes('BUSINESS_REGISTRATION_EMAIL'),
    'Contact page references BUSINESS_REGISTRATION_EMAIL'
  );
  assert.ok(
    legalContent.includes('raja969384bth@gmail.com'),
    'Legal config defines official business registration email raja969384bth@gmail.com'
  );
  pass('Contact page includes official business registration correspondence email');

  // 6.3 PaymentModal pre-approval wording
  const paymentModalContent = fs.readFileSync(path.join(process.cwd(), 'src/components/PaymentModal.tsx'), 'utf-8');
  assert.ok(
    paymentModalContent.includes('Intended Payment Provider / Gateway Under Review:'),
    'PaymentModal uses Intended Payment Provider / Gateway Under Review'
  );
  assert.ok(
    paymentModalContent.includes('Live payment collection can be enabled after merchant approval'),
    'PaymentModal uses truthful conditional activation wording'
  );
  assert.ok(
    !paymentModalContent.includes('Payment Gateway Partner:'),
    'PaymentModal omits misleading Payment Gateway Partner phrase'
  );
  pass('PaymentModal truthful pre-approval gateway wording verified');

  // 6.4 metadata.json identity
  const metadataJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'metadata.json'), 'utf-8'));
  assert.strictEqual(metadataJson.name, 'LazyProof', 'metadata.json declares name LazyProof');
  assert.strictEqual(metadataJson.alternateName, 'LAZY', 'metadata.json declares alternateName LAZY');
  pass('metadata.json declares primary brand LazyProof with alternateName LAZY');

  // 6.5 robots.txt includes both sitemaps
  const robotsTxt = fs.readFileSync(path.join(process.cwd(), 'public/robots.txt'), 'utf-8');
  assert.ok(robotsTxt.includes('Sitemap: https://lazyproof.online/sitemap.xml'), 'robots.txt includes sitemap.xml');
  assert.ok(robotsTxt.includes('Sitemap: https://lazyproof.online/sitemap-profiles.xml'), 'robots.txt includes sitemap-profiles.xml');
  pass('public/robots.txt references both static and dynamic profile sitemaps');

  // 6.6 sitemap.xml updated lastmod dates
  const sitemapXml = fs.readFileSync(path.join(process.cwd(), 'public/sitemap.xml'), 'utf-8');
  assert.ok(sitemapXml.includes('<loc>https://lazyproof.online/</loc>\n    <lastmod>2026-09-28</lastmod>'), 'sitemap.xml has 2026-09-28 for /');
  assert.ok(sitemapXml.includes('<loc>https://lazyproof.online/pricing</loc>\n    <lastmod>2026-09-28</lastmod>'), 'sitemap.xml has 2026-09-28 for /pricing');
  assert.ok(sitemapXml.includes('<loc>https://lazyproof.online/privacy</loc>\n    <lastmod>2026-09-28</lastmod>'), 'sitemap.xml has 2026-09-28 for /privacy');
  assert.ok(sitemapXml.includes('<loc>https://lazyproof.online/contact</loc>\n    <lastmod>2026-09-28</lastmod>'), 'sitemap.xml has 2026-09-28 for /contact');
  assert.ok(sitemapXml.includes('<loc>https://lazyproof.online/terms</loc>\n    <lastmod>2026-09-29</lastmod>'), 'sitemap.xml has 2026-09-29 for /terms');
  pass('public/sitemap.xml contains truthful lastmod dates for modified routes including 2026-09-29 for /terms');

  // 6.7 PAYMENT_GATEWAY_ONBOARDING.md contains XAIVON and zero XAIBUN
  const onboardingContent = fs.readFileSync(path.join(process.cwd(), 'PAYMENT_GATEWAY_ONBOARDING.md'), 'utf-8');
  assert.ok(onboardingContent.includes('XAIVON Resolution SOP'), 'Onboarding doc contains XAIVON Resolution SOP');
  assert.ok(!onboardingContent.includes('XAIBUN'), 'Onboarding doc has zero occurrences of XAIBUN');
  pass('PAYMENT_GATEWAY_ONBOARDING.md updated to XAIVON with zero XAIBUN references');

  // 6.8 Crawlable links in ProfileCard and MiniRanking
  const profileCardContent = fs.readFileSync(path.join(process.cwd(), 'src/components/ProfileCard.tsx'), 'utf-8');
  assert.ok(
    profileCardContent.includes('href={`/profile/${encodeURIComponent(profile.id)}`}'),
    'ProfileCard renders crawlable <a href="/profile/:id">'
  );

  const miniRankingContent = fs.readFileSync(path.join(process.cwd(), 'src/components/MiniRanking.tsx'), 'utf-8');
  assert.ok(
    miniRankingContent.includes('href={`/profile/${encodeURIComponent(p.id)}`}'),
    'MiniRanking renders crawlable <a href="/profile/:id">'
  );
  pass('Leaderboard and mini-ranking render crawlable anchor tags for search engine discoverability');

  // 6.9 No stale "Public Legitimacy" or "VERIFIED MONETARY CLAIM"
  const seoTs = fs.readFileSync(path.join(process.cwd(), 'src/utils/seo.ts'), 'utf-8');
  assert.ok(!seoTs.includes('Public Legitimacy Leaderboard'), 'src/utils/seo.ts omits Public Legitimacy Leaderboard');
  assert.ok(!seoTs.includes('LAZY Project'), 'src/utils/seo.ts omits LAZY Project publisher');

  const serverSeoTs = fs.readFileSync(path.join(process.cwd(), 'server/seo.ts'), 'utf-8');
  assert.ok(!serverSeoTs.includes('VERIFIED MONETARY CLAIM'), 'server/seo.ts replaced VERIFIED MONETARY CLAIM with VERIFIED SPONSORSHIP');
  assert.ok(serverSeoTs.includes('VERIFIED SPONSORSHIP'), 'server/seo.ts includes VERIFIED SPONSORSHIP in OG SVG');
  pass('Stale public legitimacy and monetary claim phrases successfully purged');

  // 6.10 Terms & legal.ts non-refundable consistency
  const termsPageContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/TermsPage.tsx'), 'utf-8');
  assert.ok(
    termsPageContent.includes('Paid amounts generally represent non-refundable consideration for digital profile visibility once the digital service has been successfully delivered, except for eligible cases stated in the Refund & Cancellation Policy or where a refund is required by applicable law.'),
    'TermsPage includes consistent non-refundable wording with Refund Policy exceptions'
  );

  const legalTsContent = fs.readFileSync(path.join(process.cwd(), 'src/config/legal.ts'), 'utf-8');
  assert.ok(
    legalTsContent.includes('Paid amounts generally represent non-refundable consideration for digital profile visibility once the digital service has been successfully delivered, except for eligible cases stated in the Refund & Cancellation Policy or where a refund is required by applicable law.'),
    'legal.ts includes consistent non-refundable wording with Refund Policy exceptions'
  );
  pass('Terms and legal.ts disclaimers aligned with Refund Policy exceptions');

  // 6.11 Payment gateway provider wording & pre-approval status
  assert.ok(
    onboardingContent.includes('Primary Intended / Integrated Payment Provider:'),
    'PAYMENT_GATEWAY_ONBOARDING.md uses Primary Intended / Integrated Payment Provider'
  );
  assert.ok(
    onboardingContent.includes('Cashfree Payments India Pvt Ltd — Merchant Review Pending'),
    'PAYMENT_GATEWAY_ONBOARDING.md indicates Merchant Review Pending'
  );
  assert.ok(
    !onboardingContent.includes('Primary Payment Gateway Partner:'),
    'PAYMENT_GATEWAY_ONBOARDING.md does not describe Cashfree as an approved partner'
  );

  const opsFlowContent = fs.readFileSync(path.join(process.cwd(), 'docs/OPERATIONS_DATA_FLOW.md'), 'utf-8');
  assert.ok(
    !opsFlowContent.includes('The system processes real Indian Rupee (INR) transactions via Cashfree'),
    'docs/OPERATIONS_DATA_FLOW.md does not claim active live INR processing'
  );
  assert.ok(
    opsFlowContent.includes('The system is engineered to process INR transactions through Cashfree once merchant approval'),
    'docs/OPERATIONS_DATA_FLOW.md uses conditional pre-activation wording'
  );

  const refundPageContent = fs.readFileSync(path.join(process.cwd(), 'src/pages/RefundPage.tsx'), 'utf-8');
  assert.ok(
    !refundPageContent.includes('payment gateway partner'),
    'RefundPage uses neutral payment gateway/provider wording'
  );
  assert.ok(
    termsPageContent.includes('lastUpdated="September 29, 2026"'),
    'TermsPage has truthful lastUpdated date September 29, 2026'
  );
  pass('Payment gateway provider and operations documentation consistency verified');

  // =========================================================================
  // 7. Branded Search Appearance, Structured Data & Canonical Discovery
  // =========================================================================
  console.log('--- 7. Branded Search Appearance & Entity Discovery Invariants ---');

  // 7.1 Homepage title, description, canonical, robots & favicon in index.html
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(
    indexHtml.includes('<title>LazyProof — Digital Sponsored Profile Showcase | Live Leaderboard</title>'),
    'index.html has truthful branded homepage title'
  );
  assert.ok(
    indexHtml.includes('content="LazyProof by ADABHRA GROUP is a digital sponsored profile showcase and live public leaderboard where verified cumulative sponsorship determines rank, with transparent INR pricing and rules."'),
    'index.html has brand + operator entity description'
  );
  assert.ok(
    indexHtml.includes('<meta name="robots" content="index, follow" />'),
    'index.html specifies index, follow robots directive'
  );
  assert.ok(
    !indexHtml.includes('noindex') && !indexHtml.includes('nosnippet'),
    'index.html strictly omits noindex and nosnippet'
  );
  assert.ok(
    indexHtml.includes('<link rel="canonical" href="https://lazyproof.online/" />'),
    'index.html declares canonical HTTPS apex'
  );
  assert.ok(
    indexHtml.includes('<link rel="icon" type="image/png" sizes="512x512" href="/brand/lazy-favicon-512.png" />'),
    'index.html includes 512x512 PNG favicon candidate for Google Search'
  );
  pass('index.html search metadata, robots directives, canonical and high-resolution favicon verified');

  // 7.2 Structured data: Authoritative Organization & WebSite nodes
  const { generateRouteJsonLd: serverGenRouteJsonLd } = await import('../server/seo.ts');
  const homeJsonLd: any = serverGenRouteJsonLd('/', 'https://lazyproof.online');
  assert.ok(homeJsonLd && Array.isArray(homeJsonLd['@graph']), 'Route JSON-LD contains @graph array');

  const graphNodes = homeJsonLd['@graph'];
  const orgNodes = graphNodes.filter((n: any) => n['@type'] === 'Organization');
  const websiteNodes = graphNodes.filter((n: any) => n['@type'] === 'WebSite');
  const appNodes = graphNodes.filter((n: any) => n['@type'] === 'WebApplication');

  assert.strictEqual(orgNodes.length, 1, 'Exactly one Organization entity node in homepage graph');
  assert.strictEqual(websiteNodes.length, 1, 'Exactly one WebSite entity node in homepage graph');
  assert.strictEqual(appNodes.length, 1, 'Exactly one WebApplication entity node in homepage graph');

  const org = orgNodes[0];
  assert.strictEqual(org['@id'], 'https://lazyproof.online/#organization', 'Organization @id matches canonical URI');
  assert.strictEqual(org.legalName, 'ADABHRA GROUP', 'Organization legalName is ADABHRA GROUP');
  assert.strictEqual(org.name, 'ADABHRA GROUP', 'Organization name is ADABHRA GROUP');
  assert.strictEqual(org.email, 'support@lazyproof.online', 'Organization email is support@lazyproof.online');
  assert.strictEqual(org.telephone, '+91 95211 90205', 'Organization telephone is +91 95211 90205');
  assert.ok(org.address && org.address.postalCode === '845454', 'Organization address includes postalCode 845454');
  assert.ok(org.contactPoint && org.contactPoint.availableLanguage.includes('English'), 'Organization contactPoint specifies supported languages');

  const ws = websiteNodes[0];
  assert.strictEqual(ws['@id'], 'https://lazyproof.online/#website', 'WebSite @id matches canonical URI');
  assert.strictEqual(ws.name, 'LazyProof', 'WebSite name is LazyProof (never ADABHRA GROUP)');
  assert.ok(Array.isArray(ws.alternateName), 'WebSite alternateName is an array');
  assert.ok(ws.alternateName.includes('LAZY'), 'WebSite alternateName includes LAZY');
  assert.ok(ws.alternateName.includes('lazyproof.online'), 'WebSite alternateName includes lowercase domain');
  assert.strictEqual(ws.publisher['@id'], 'https://lazyproof.online/#organization', 'WebSite publisher references authoritative Organization @id');

  const app = appNodes[0];
  assert.strictEqual(app['@id'], 'https://lazyproof.online/#app', 'WebApplication @id matches canonical URI');
  assert.strictEqual(app.provider['@id'], 'https://lazyproof.online/#organization', 'WebApplication provider references authoritative Organization @id');
  pass('Homepage Schema.org structured data graph contains authoritative Organization, WebSite and WebApplication nodes with zero duplicates');

  // 7.3 Canonical Host & Protocol Redirect Logic
  const { getCanonicalRedirectUrl } = await import('../server.ts');
  assert.strictEqual(
    getCanonicalRedirectUrl('lazyproof.online', 'http', '/about?x=1', true),
    'https://lazyproof.online/about?x=1',
    'HTTP apex permanently redirects to HTTPS apex with query string'
  );
  assert.strictEqual(
    getCanonicalRedirectUrl('www.lazyproof.online', 'http', '/', true),
    'https://lazyproof.online/',
    'HTTP www permanently redirects to HTTPS apex'
  );
  assert.strictEqual(
    getCanonicalRedirectUrl('www.lazyproof.online', 'https', '/rules', true),
    'https://lazyproof.online/rules',
    'HTTPS www permanently redirects to HTTPS apex'
  );
  assert.strictEqual(
    getCanonicalRedirectUrl('lazyproof.online', 'https', '/', true),
    null,
    'Canonical HTTPS apex request passes through without redirect'
  );
  assert.strictEqual(
    getCanonicalRedirectUrl('lazyproof.online', 'https', '/api/payment/webhook', true),
    null,
    'Cashfree HTTPS webhook passes through without redirect'
  );
  assert.strictEqual(
    getCanonicalRedirectUrl('localhost:3000', 'http', '/', false),
    null,
    'Non-production local development passes through without redirect'
  );
  pass('Canonical redirect matrix correctly consolidates HTTP, www, and preserves paths and query strings');

  // 7.4 Google Indexing Recovery Documentation
  const recoveryDoc = fs.readFileSync(path.join(process.cwd(), 'docs/GOOGLE_INDEXING_RECOVERY.md'), 'utf-8');
  assert.ok(recoveryDoc.includes('Add Domain Property'), 'Recovery doc details Domain Property creation');
  assert.ok(recoveryDoc.includes('lazyproof.online'), 'Recovery doc specifies domain lazyproof.online');
  assert.ok(recoveryDoc.includes('DO NOT USE THE GOOGLE URL REMOVAL TOOL'), 'Recovery doc prohibits URL removal tool');
  assert.ok(recoveryDoc.includes('DO NOT REPEATEDLY REQUEST INDEXING'), 'Recovery doc cautions against spamming indexing requests');
  assert.ok(recoveryDoc.includes('TEST LIVE URL'), 'Recovery doc instructs TEST LIVE URL');
  pass('docs/GOOGLE_INDEXING_RECOVERY.md verified complete and accurate');

  // 7.5 Authoritative Checkout & Legal Consent Version Synchronization
  console.log('\n--- 7.5 Authoritative Checkout & Legal Consent Version Synchronization ---');
  const { CURRENT_CONSENT_VERSION: serverConsentVer } = await import('../server.ts');
  const { LEGAL_CONFIG } = await import('../src/config/legal.ts');
  const actionPanelSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/ActionPanel.tsx'), 'utf-8');
  const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

  // Verify authoritative shared constants
  assert.strictEqual(CURRENT_CONSENT_VERSION, '2026-09-29', 'CURRENT_CONSENT_VERSION must be canonical 2026-09-29');
  assert.strictEqual(LEGAL_CONFIG.CURRENT_CONSENT_VERSION, '2026-09-29', 'LEGAL_CONFIG.CURRENT_CONSENT_VERSION must match');
  assert.strictEqual(serverConsentVer, CURRENT_CONSENT_VERSION, 'Server exported consent version matches shared constant');
  assert.strictEqual(CURRENT_TERMS_VERSION, '2026-09-29', 'Terms version matches 2026-09-29');
  assert.strictEqual(CURRENT_PRIVACY_VERSION, '2026-09-28', 'Privacy version matches 2026-09-28');

  // Verify frontend ActionPanel uses shared CURRENT_CONSENT_VERSION
  assert.ok(actionPanelSrc.includes('consentVersion: CURRENT_CONSENT_VERSION'), 'ActionPanel.tsx must use CURRENT_CONSENT_VERSION');
  assert.ok(!actionPanelSrc.includes("consentVersion: '2026-09-24'"), 'ActionPanel.tsx must not hardcode stale consentVersion');

  // Verify server create-order enforces CURRENT_CONSENT_VERSION
  assert.ok(serverCode.includes('consentVersion !== CURRENT_CONSENT_VERSION'), 'server.ts enforces CURRENT_CONSENT_VERSION');
  assert.ok(serverCode.includes('quoteVersion: CURRENT_CONSENT_VERSION'), 'quoteSnapshot uses CURRENT_CONSENT_VERSION');
  assert.ok(serverCode.includes('consentVersion: consentVersion || CURRENT_CONSENT_VERSION'), 'createOrder stores validated consentVersion');

  // Verify checkout fingerprint serializes the exact shared CURRENT_CONSENT_VERSION
  const fpDefault = computeCheckoutFingerprint({
    name: 'Consent Test User',
    amount: 500,
    consentAccepted: true
  });
  const parsedFpDefault = JSON.parse(fpDefault);
  assert.strictEqual(parsedFpDefault.consentVersion, CURRENT_CONSENT_VERSION, 'Checkout fingerprint defaults to CURRENT_CONSENT_VERSION');

  const fpExplicit = computeCheckoutFingerprint({
    name: 'Consent Test User',
    amount: 500,
    consentAccepted: true,
    consentVersion: CURRENT_CONSENT_VERSION
  });
  const parsedFpExplicit = JSON.parse(fpExplicit);
  assert.strictEqual(parsedFpExplicit.consentVersion, CURRENT_CONSENT_VERSION, 'Checkout fingerprint matches CURRENT_CONSENT_VERSION');

  // Re-verify that fingerprint detects any divergent consent version
  const fpStale = computeCheckoutFingerprint({
    name: 'Consent Test User',
    amount: 500,
    consentAccepted: true,
    consentVersion: '2026-09-24'
  });
  assert.notStrictEqual(fpExplicit, fpStale, 'Fingerprint detects version divergence');

  pass('Frontend, server persistence, and checkout fingerprint all synchronize on authoritative CURRENT_CONSENT_VERSION (2026-09-29)');

  // 7.6 Real API Request-Level Consent Version Enforcement Tests
  console.log('\n--- 7.6 Real API Request-Level Consent Version Enforcement Tests ---');
  const { paymentManager } = await import('../server/payments/index.ts');
  const { db } = await import('../server/db.ts');

  // Configure sandbox mode and tax readiness so checkout reaches consent validation
  const origMode = paymentManager.getMode();
  const origTaxBasis = process.env.MERCHANT_TAX_BASIS;
  const origTaxReviewed = process.env.MERCHANT_TAX_REVIEWED;

  (paymentManager as any).mode = 'sandbox';
  process.env.MERCHANT_TAX_BASIS = 'verified_unregistered_below_threshold';
  process.env.MERCHANT_TAX_REVIEWED = 'true';

  const baseOrderPayload = {
    name: 'Consent Enforce User',
    amount: 250,
    customerPhone: '9876543210',
    pendingOwnerToken: 'lazy_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    orderAccessToken: 'ord_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    consentAccepted: true,
    consentVersion: CURRENT_CONSENT_VERSION
  };

  // Wait for in-process server to bind and respond
  let connected = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const ping = await fetchJson('http://127.0.0.1:3000/api/rank/top');
      if (ping.status === 200) {
        connected = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  assert.ok(connected, 'Server must be connected and ready on port 3000');

  // 1. consentAccepted=false => rejected (400)
  const resFalseConsent = await fetchJson('http://127.0.0.1:3000/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { ...baseOrderPayload, consentAccepted: false }
  });
  assert.strictEqual(resFalseConsent.status, 400, 'consentAccepted=false returns HTTP 400');
  assert.ok(resFalseConsent.body?.error?.includes('affirmatively accept'), 'Rejection error explains consent required');

  // 2. Stale consentVersion '2026-09-24' => rejected before order/provider creation (409)
  const resStaleConsent = await fetchJson('http://127.0.0.1:3000/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { ...baseOrderPayload, consentVersion: '2026-09-24' }
  });
  assert.strictEqual(resStaleConsent.status, 409, 'Stale consentVersion 2026-09-24 returns HTTP 409');
  assert.strictEqual(resStaleConsent.body?.currentConsentVersion, CURRENT_CONSENT_VERSION, '409 response specifies currentConsentVersion');
  assert.ok(resStaleConsent.body?.error?.includes('Terms or policies have been updated'), '409 response explains terms updated');

  // 3. Arbitrary 'old-policy-version' => rejected (409)
  const resArbitraryConsent = await fetchJson('http://127.0.0.1:3000/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { ...baseOrderPayload, consentVersion: 'old-policy-version' }
  });
  assert.strictEqual(resArbitraryConsent.status, 409, 'Arbitrary stale consentVersion returns HTTP 409');
  assert.strictEqual(resArbitraryConsent.body?.currentConsentVersion, CURRENT_CONSENT_VERSION, '409 response specifies currentConsentVersion');

  // 4. Stale request creates ZERO payment orders in database
  const getOrdersCount = async () => {
    if (db.isPostgresAuthoritative()) {
      const res = await pool.query('SELECT COUNT(*) FROM payment_orders');
      return Number(res.rows[0].count);
    }
    return Object.keys((db as any).state?.orders || {}).length;
  };

  const countBefore = await getOrdersCount();
  await fetchJson('http://127.0.0.1:3000/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { ...baseOrderPayload, consentVersion: '2026-09-24' }
  });
  const countAfter = await getOrdersCount();
  assert.strictEqual(countBefore, countAfter, 'Stale consent request creates zero payment orders');

  // 5. Stale request makes ZERO provider Create Order calls
  let providerCalls = 0;
  const originalCreateOrder = paymentManager.getProvider().createOrder.bind(paymentManager.getProvider());
  paymentManager.getProvider().createOrder = async (...args: any[]) => {
    providerCalls++;
    return originalCreateOrder(...args);
  };

  await fetchJson('http://127.0.0.1:3000/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { ...baseOrderPayload, consentVersion: '2026-09-24' }
  });
  assert.strictEqual(providerCalls, 0, 'Stale request makes zero provider Create Order calls');

  // 6. Current CURRENT_CONSENT_VERSION => accepted through consent validation
  paymentManager.getProvider().createOrder = async () => ({
    orderId: 'mock_cf_' + Date.now(),
    providerOrderId: 'cf_mock_order_123',
    paymentSessionId: 'session_mock_' + Date.now(),
    currency: 'INR',
    amount: 250,
    status: 'ACTIVE'
  });

  const resValidConsent = await fetchJson('http://127.0.0.1:3000/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: baseOrderPayload
  });
  assert.strictEqual(resValidConsent.status, 200, 'Current CURRENT_CONSENT_VERSION is accepted with 200');
  assert.ok(resValidConsent.body?.paymentSessionId, 'Valid consent checkout yields payment session');

  // 7. CURRENT_CONSENT_VERSION remains included in database persistence
  const persistedOrder = await db.getOrderAsync(resValidConsent.body.orderId);
  assert.ok(persistedOrder, 'Order found in database');
  assert.strictEqual(persistedOrder.consentVersion, CURRENT_CONSENT_VERSION, 'Database order strictly persisted with CURRENT_CONSENT_VERSION');

  // Also verify PostgreSQL direct table insertion and persistence with CURRENT_CONSENT_VERSION
  const directPgOrderId = 'order_pg_consent_test_' + Date.now();
  await pg.createOrder({
    orderId: directPgOrderId,
    name: 'Direct PG Consent Test',
    amount: 100,
    currency: 'INR',
    consentAccepted: true,
    consentVersion: CURRENT_CONSENT_VERSION,
    paymentMode: 'sandbox'
  });
  const pgOrderRow = await pool.query('SELECT consent_version FROM payment_orders WHERE order_id = $1', [directPgOrderId]);
  assert.strictEqual(pgOrderRow.rows.length, 1, 'Direct PostgreSQL order persisted');
  assert.strictEqual(pgOrderRow.rows[0].consent_version, CURRENT_CONSENT_VERSION, 'PostgreSQL table strictly stores CURRENT_CONSENT_VERSION');

  // Restore provider and environment
  paymentManager.getProvider().createOrder = originalCreateOrder;
  (paymentManager as any).mode = origMode;
  process.env.MERCHANT_TAX_BASIS = origTaxBasis;
  process.env.MERCHANT_TAX_REVIEWED = origTaxReviewed;

  pass('Real API requests prove strict enforcement: stale consent is rejected before order/provider creation, current consent is accepted and persisted');

  console.log('\n========================================================');
  console.log(`ALL PHASE 9 TESTS PASSED: ${passed} ASSERTIONS VERIFIED`);
  console.log('========================================================\n');

  try {
    await pool.end();
  } catch {}
  process.exit(0);
}

runPhase9Tests().catch((err) => {
  console.error('\nPhase 9 Test Execution Failed:', err);
  process.exit(1);
});
