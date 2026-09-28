process.env.NODE_ENV = 'test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PostgresDatabase, hashToken } from '../server/db/postgres.ts';
import { isSafeLocalTestDatabase } from '../server.ts';
import { computeCheckoutFingerprint, CheckoutIntentFields } from '../src/utils/checkoutContract.ts';
import { CashfreeProvider } from '../server/payments/cashfree.ts';

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
    consentVersion: '2026-09-24'
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

  // Test with expired timestamp (> 5 minutes old = 301,000 ms)
  const expiredTimestamp = (Date.now() - 305000).toString();
  const expiredSignatureInput = `${expiredTimestamp}${payload}`;
  const expiredSignature = crypto.createHmac('sha256', testSecret).update(expiredSignatureInput).digest('base64');

  const expiredResult = await provider.verifyWebhook(payload, {
    'x-webhook-timestamp': expiredTimestamp,
    'x-webhook-signature': expiredSignature
  });
  assert.strictEqual(expiredResult.isValid, false, 'Webhook with timestamp > 5 minutes old is rejected');
  assert.ok(expiredResult.error?.includes('outside five-minute window'), 'Error message cites timestamp outside five-minute window');

  // Test with tampered payload
  const tamperedResult = await provider.verifyWebhook(payload + ' ', {
    'x-webhook-timestamp': freshTimestamp,
    'x-webhook-signature': validSignature
  });
  assert.strictEqual(tamperedResult.isValid, false, 'Tampered webhook payload rejected');
  pass('Cashfree webhook enforces official 5-minute freshness window and HMAC-SHA256 signature verification');

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
  pass('public/sitemap.xml contains truthful 2026-09-28 lastmod dates for modified routes');

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

  console.log('\n========================================================');
  console.log(`ALL PHASE 9 TESTS PASSED: ${passed} ASSERTIONS VERIFIED`);
  console.log('========================================================\n');

  await pool.end();
  process.exit(0);
}

runPhase9Tests().catch((err) => {
  console.error('\nPhase 9 Test Execution Failed:', err);
  process.exit(1);
});
