import http from 'http';
import { db, LazyDatabase } from '../server/db.ts';
import { serializeJsonLd, injectProfileMetadata, generateProfileJsonLd, generateRouteJsonLd } from '../server/seo.ts';

// Test runner assertion helper
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
            // keep raw string if not JSON
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

async function runTests() {
  console.log('\n========================================================');
  console.log('STARTING LAZY FORENSIC REMEDIATION TEST SUITE');
  console.log('========================================================\n');

  // ----------------------------------------------------
  // UNIT TEST SUITE: DB & SECURITY PRIMITIVES
  // ----------------------------------------------------
  console.log('--- 1. Security Primitives & Constant-Time Token Matching ---');
  assert(db.constantTimeMatch('secret123', 'secret123') === true, 'Matching identical tokens returns true');
  assert(db.constantTimeMatch('secret123', 'secret124') === false, 'Mismatching token returns false');
  assert(db.constantTimeMatch('secret123', 'short') === false, 'Different length token returns false without throwing');
  assert(db.constantTimeMatch(undefined, 'secret123') === false, 'Undefined token returns false');
  assert(db.constantTimeMatch('', '') === false, 'Empty strings return false');
  assert(db.constantTimeMatch('   ', '   ') === false, 'Whitespace-only strings return false');

  console.log('\n--- 2. Synthetic Production Data Isolation & Global Activity ---');
  // In our test environment, ensure honest fields without fabricated Math.max fallbacks
  const activity = db.getGlobalActivity();
  assert(typeof activity.claimsToday === 'number', 'Activity returns numeric claimsToday');
  assert(typeof activity.claimsTotal === 'number', 'Activity returns numeric claimsTotal');
  assert(typeof activity.totalAmountToday === 'number', 'Activity returns numeric totalAmountToday');
  assert(Array.isArray(activity.hourlyActivity), 'Activity returns hourlyActivity array');
  assert(Array.isArray(activity.recentDays), 'Activity returns recentDays array');
  assert(typeof activity.activeParticipantsNow === 'number', 'Activity returns numeric activeParticipantsNow');

  console.log('\n--- 3. Notification Truthfulness Contract ---');
  const subResult = db.subscribeNotification({ email: 'test@example.com', name: 'user-123' });
  assert(subResult.success === true, 'Subscription records successfully');
  assert(
    subResult.message === 'Notification preference saved. Email delivery is not active yet.',
    'Notification returns truthful un-activated email delivery message'
  );

  console.log('\n--- 4. JSON-LD XSS Escaping (Anti-Script Breakout) ---');
  const maliciousName = '</script><script>alert("XSS")</script>';
  const maliciousProfile: any = {
    id: 'xss-test',
    name: maliciousName,
    bio: 'Malicious </script> bio',
    amount: 100,
    rank: 1,
    socialHandle: 'sloth',
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const rawJsonLd = serializeJsonLd(maliciousProfile);
  assert(!rawJsonLd.includes('</script>'), 'JSON-LD does not contain literal </script>');
  assert(rawJsonLd.includes('\\u003c/script\\u003e'), 'JSON-LD safely escapes < to \\u003c');
  assert(rawJsonLd.includes('\\u003cscript\\u003e'), 'JSON-LD safely escapes script opening tag');

  const htmlWithMeta = injectProfileMetadata('<html><head></head><body></body></html>', maliciousProfile, 'https://test.lazyproof.online');
  // Verify it contains exactly one opening and one closing application/ld+json script tag without being broken in the middle
  const occurrences = (htmlWithMeta.match(/<\/script>/g) || []).length;
  assert(occurrences === 1, 'HTML contains exactly 1 closing </script> tag for the entire JSON-LD block (no breakout)', `Found ${occurrences}`);

  // ----------------------------------------------------
  // INTEGRATION TEST SUITE (Live Server API Endpoints)
  // ----------------------------------------------------
  console.log('\n--- 5. Starting In-Process Server Verification ---');
  const TEST_PORT = 3199;
  process.env.PORT = String(TEST_PORT);
  process.env.ADMIN_KEY = 'test-forensic-admin-key-2026';
  process.env.PAYMENT_MODE = 'disabled';
  process.env.DEMO_MODE = 'false';
  process.env.APP_URL = 'https://lazyproof.online';

  // Spawn the server by importing server.ts
  // Note: server.ts calls startServer() automatically
  await import('../server.ts');

  const BASE = `http://127.0.0.1:${TEST_PORT}`;

  // Robust poll until server is ready and responding
  let connected = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      await fetchJson(`${BASE}/api/rank/top`);
      connected = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  if (!connected) {
    throw new Error(`Server failed to bind and respond on ${BASE} within 8 seconds`);
  }

  console.log('\n--- 6. Owner Token / IDOR Tests (/api/profile/lazy-reason) ---');
  // Seed a test profile directly in db
  const testProfileId = 'forensic-test-profile-' + Date.now();
  const testOwnerToken = 'correct-owner-token-' + Date.now();
  const otherOwnerToken = 'wrong-owner-token-999';

  db.addProfile({
    id: testProfileId,
    userId: 'u-' + testProfileId,
    name: 'Forensic Sloth',
    reason: 'Testing security invariants',
    amount: 50,
    rank: 99,
    lazyReason: 'Original reason',
    ownerToken: testOwnerToken,
    instagram: 'sloth_test',
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 6.1 NO TOKEN
  const resNoToken = await fetchJson(`${BASE}/api/profile/lazy-reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { profileId: testProfileId, lazyReason: 'Hacked without token' },
  });
  assert(resNoToken.status === 401, 'No token returns 401 Unauthorized', `Status: ${resNoToken.status}`);

  // 6.2 EMPTY TOKEN
  const resEmptyToken = await fetchJson(`${BASE}/api/profile/lazy-reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-profile-token': '   ' },
    body: { profileId: testProfileId, lazyReason: 'Hacked with empty token' },
  });
  assert(resEmptyToken.status === 401, 'Empty token returns 401 Unauthorized', `Status: ${resEmptyToken.status}`);

  // 6.3 WRONG TOKEN
  const resWrongToken = await fetchJson(`${BASE}/api/profile/lazy-reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-profile-token': otherOwnerToken },
    body: { profileId: testProfileId, lazyReason: 'Hacked with wrong token' },
  });
  assert(resWrongToken.status === 403, 'Wrong token returns 403 Forbidden', `Status: ${resWrongToken.status}`);

  // 6.4 VALID TOKEN
  const resValidToken = await fetchJson(`${BASE}/api/profile/lazy-reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-profile-token': testOwnerToken },
    body: { profileId: testProfileId, lazyReason: 'Legitimately updated reason by owner' },
  });
  assert(resValidToken.status === 200, 'Valid owner token successfully mutates profile reason', `Status: ${resValidToken.status}`);

  // Verify profile was actually updated in DB
  const updatedProfile = db.getProfile(testProfileId);
  assert(updatedProfile?.lazyReason === 'Legitimately updated reason by owner', 'Profile lazyReason matches updated value');

  console.log('\n--- 7. Force Roast Regeneration Authorization (/api/roast) ---');
  // 7.1 Unauthorized force regenerate (no token)
  const resRoastNoToken = await fetchJson(`${BASE}/api/roast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { profileId: testProfileId, forceRegenerate: true },
  });
  assert(resRoastNoToken.status === 401, 'Unauthorized forceRegenerate (no token) rejected with 401', `Status: ${resRoastNoToken.status}`);

  // 7.2 Unauthorized force regenerate (wrong token)
  const resRoastWrongToken = await fetchJson(`${BASE}/api/roast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-profile-token': 'fake-token' },
    body: { profileId: testProfileId, forceRegenerate: true },
  });
  assert(resRoastWrongToken.status === 403, 'Unauthorized forceRegenerate (wrong token) rejected with 403', `Status: ${resRoastWrongToken.status}`);

  // 7.3 Authorized force regenerate with valid owner token
  const resRoastOwner = await fetchJson(`${BASE}/api/roast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-profile-token': testOwnerToken },
    body: { profileId: testProfileId, forceRegenerate: true },
  });
  assert(resRoastOwner.status === 200, 'Owner with valid token can force roast regeneration', `Status: ${resRoastOwner.status}`);

  // 7.4 Authorized force regenerate with valid admin key
  const resRoastAdmin = await fetchJson(`${BASE}/api/roast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': 'test-forensic-admin-key-2026' },
    body: { profileId: testProfileId, forceRegenerate: true },
  });
  assert(resRoastAdmin.status === 200, 'Admin with valid key can force roast regeneration', `Status: ${resRoastAdmin.status}`);

  console.log('\n--- 8. Admin Endpoint Hardening (/api/admin/data & /api/admin/moderate) ---');
  // 8.1 /api/admin/data without key -> 401
  const resAdminNoKey = await fetchJson(`${BASE}/api/admin/data`);
  assert(resAdminNoKey.status === 401, '/api/admin/data rejects unauthenticated request with 401');

  // 8.2 /api/admin/data with invalid key -> 401
  const resAdminBadKey = await fetchJson(`${BASE}/api/admin/data`, {
    headers: { 'x-admin-key': 'wrong-admin-key' },
  });
  assert(resAdminBadKey.status === 401, '/api/admin/data rejects bad key with 401');

  // 8.3 /api/admin/data with valid key -> 200 and no-store
  const resAdminGoodKey = await fetchJson(`${BASE}/api/admin/data`, {
    headers: { 'x-admin-key': 'test-forensic-admin-key-2026' },
  });
  assert(resAdminGoodKey.status === 200, '/api/admin/data returns 200 with valid key');
  assert(resAdminGoodKey.headers['cache-control']?.includes('no-store'), '/api/admin/data sets Cache-Control: no-store');

  // 8.4 /api/admin/moderate with invalid action enum -> 400
  const resModBadAction = await fetchJson(`${BASE}/api/admin/moderate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': 'test-forensic-admin-key-2026',
    },
    body: {
      targetType: 'profile',
      targetId: testProfileId,
      action: 'drop_database',
    },
  });
  assert(resModBadAction.status === 400, '/api/admin/moderate rejects invalid action with 400');

  // 8.5 /api/admin/moderate with non-existent targetId -> 404
  const resModNonExistent = await fetchJson(`${BASE}/api/admin/moderate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': 'test-forensic-admin-key-2026',
    },
    body: {
      targetType: 'profile',
      targetId: 'non-existent-id-99999',
      action: 'remove',
    },
  });
  assert(resModNonExistent.status === 404, '/api/admin/moderate rejects non-existent target with 404');

  console.log('\n--- 9. Strict Payment Disabled Enforcement (PAYMENT_MODE=disabled) ---');
  // 9.1 /api/payment/create-order -> 503
  const resCreateOrder = await fetchJson(`${BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { name: 'Sloth Order', amount: 100 },
  });
  assert(resCreateOrder.status === 503, '/api/payment/create-order returns 503 Disabled', `Status: ${resCreateOrder.status}`);
  assert(
    resCreateOrder.body?.error === 'Payments are currently unavailable until payment processing is enabled.',
    'create-order returns truthful disabled message'
  );

  // 9.2 /api/payment/verify -> 503
  const resVerifyPayment = await fetchJson(`${BASE}/api/payment/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { orderId: 'fake-order-123', paymentId: 'fake-payment-123' },
  });
  assert(resVerifyPayment.status === 503, '/api/payment/verify returns 503 Disabled', `Status: ${resVerifyPayment.status}`);
  assert(
    resVerifyPayment.body?.error === 'Payments are currently unavailable until payment processing is enabled.',
    'verify returns truthful disabled message'
  );

  console.log('\n--- 10. Live Stats API Contract & Bounded Sessions ---');
  // 10.1 x-session-id header
  const testSessionHeader = 'client-session-uuid-12345';
  const resStatsHeader = await fetchJson(`${BASE}/api/stats/live`, {
    headers: { 'x-session-id': testSessionHeader },
  });
  assert(resStatsHeader.status === 200, '/api/stats/live responds with 200 using x-session-id header');
  assert(typeof resStatsHeader.body.online === 'number', 'live stats returns online number');

  // 10.2 query param sessionId
  const resStatsQuery = await fetchJson(`${BASE}/api/stats/live?sessionId=client-session-query-67890`);
  assert(resStatsQuery.status === 200, '/api/stats/live responds with 200 using query sessionId');

  console.log('\n--- 11. Analytics Integrity & Strict Allowlist ---');
  // 11.1 Allowed UI event
  const resAnalyticsAllowed = await fetchJson(`${BASE}/api/analytics/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { event: 'shareClicks' },
  });
  assert(resAnalyticsAllowed.status === 200, '/api/analytics/track accepts allowed UI event (shareClicks)');

  // 11.2 Disallowed authoritative metric (successfulPurchases)
  const resAnalyticsDisallowed1 = await fetchJson(`${BASE}/api/analytics/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { event: 'successfulPurchases' },
  });
  assert(resAnalyticsDisallowed1.status === 400, '/api/analytics/track rejects forbidden metric (successfulPurchases) with 400');

  // 11.3 Disallowed authoritative metric (totalRevenueINR)
  const resAnalyticsDisallowed2 = await fetchJson(`${BASE}/api/analytics/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { event: 'totalRevenueINR' },
  });
  assert(resAnalyticsDisallowed2.status === 400, '/api/analytics/track rejects forbidden metric (totalRevenueINR) with 400');

  console.log('\n--- 12. Public Profile DTO Security (No ownerToken leakage) ---');
  const resPublicProfile = await fetchJson(`${BASE}/api/profile/${testProfileId}`);
  assert(resPublicProfile.status === 200, 'Public profile endpoint returns 200');
  assert(resPublicProfile.body.profile?.id === testProfileId, 'Profile ID matches');
  assert(resPublicProfile.body.profile?.ownerToken === undefined, 'CRITICAL: ownerToken is NOT present in public profile DTO');

  console.log('\n--- 13. Dilemma Server-Controlled Voter Identity ---');
  const resDilemma = await fetchJson(`${BASE}/api/dilemma`);
  assert(resDilemma.status === 200, '/api/dilemma returns dilemma options');
  assert(Array.isArray(resDilemma.body.options) && resDilemma.body.options.length > 0, 'Dilemma contains options array');

  const optionIdToVote = resDilemma.body.options[0]?.id;
  const resVote = await fetchJson(`${BASE}/api/dilemma/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { optionId: optionIdToVote },
  });
  assert(resVote.status === 200, '/api/dilemma/vote accepts vote and tracks server identity');
  assert(typeof resVote.body.dilemma?.totalVotes === 'number', 'Dilemma returns updated vote counts');

  console.log('\n--- 14. Moderation target validation (/api/report) ---');
  // 14.1 Invalid targetType
  const resReportBadType = await fetchJson(`${BASE}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { targetType: 'invalid_type', targetId: testProfileId, reason: 'spam' },
  });
  assert(resReportBadType.status === 400, '/api/report rejects invalid targetType with 400');

  // 14.2 Non-existent targetId
  const resReportMissingTarget = await fetchJson(`${BASE}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { targetType: 'profile', targetId: 'does-not-exist-123', reason: 'spam' },
  });
  assert(resReportMissingTarget.status === 404, '/api/report rejects non-existent target with 404');

  // 14.3 Valid report on existing target
  const resReportValid = await fetchJson(`${BASE}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { targetType: 'profile', targetId: testProfileId, reason: 'Harassment or offensive content' },
  });
  assert(resReportValid.status === 200, '/api/report accepts valid report on existing target');

  console.log('\n--- 15. Schema.org Truthfulness (No InStock Offers while Payments Disabled) ---');
  const dummyProfile = db.getProfile(testProfileId) || {
    id: testProfileId,
    name: 'Forensic Sloth',
    amount: 50,
    rank: 1,
    isVerified: true,
    createdAt: new Date().toISOString()
  };
  const profileLd: any = generateProfileJsonLd(dummyProfile as any);
  const profileGraphLd = profileLd['@graph'] || [];
  const hasProfileOffer = profileGraphLd.some((node: any) => node.hasPart && node.hasPart['@type'] === 'Offer');
  assert(!hasProfileOffer, 'generateProfileJsonLd does NOT expose purchasable InStock Offer while payments disabled');

  const routeLd: any = generateRouteJsonLd('/');
  const routeGraphLd = routeLd['@graph'] || [];
  const appNode = routeGraphLd.find((node: any) => node['@type'] === 'WebApplication');
  assert(!appNode?.offers, 'Home page WebApplication schema does NOT expose active InStock offers while payments disabled');

  console.log('\n--- 16. Moderation State Machine & DoS Resistance ---');
  // Reporting a profile must NOT de-rank it from active leaderboard
  const leaderBefore = db.getLeaderboard().profiles;
  const targetInLeader = leaderBefore.find(p => p.id === testProfileId);
  assert(!!targetInLeader, 'Reported profile is NOT de-ranked by unverified user report alone (DoS protection)');

  // Admin moderation action: 'remove'
  const resAdminRemove = await fetchJson(`${BASE}/api/admin/moderate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': 'test-forensic-admin-key-2026'
    },
    body: {
      targetType: 'profile',
      targetId: testProfileId,
      action: 'remove'
    }
  });
  assert(resAdminRemove.status === 200, 'Admin remove action succeeds with 200');

  // Verify removed profile is no longer in public leaderboard or public profile view
  const leaderAfterRemove = db.getLeaderboard().profiles;
  assert(!leaderAfterRemove.some(p => p.id === testProfileId), 'Removed profile is completely excluded from public leaderboard');
  const resRemovedProfile = await fetchJson(`${BASE}/api/profile/${testProfileId}`);
  assert(resRemovedProfile.status === 404, 'Removed profile returns 404 on public profile lookup');

  // Admin moderation action: 'restore'
  const resAdminRestore = await fetchJson(`${BASE}/api/admin/moderate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': 'test-forensic-admin-key-2026'
    },
    body: {
      targetType: 'profile',
      targetId: testProfileId,
      action: 'restore'
    }
  });
  assert(resAdminRestore.status === 200, 'Admin restore action succeeds with 200');
  const leaderAfterRestore = db.getLeaderboard().profiles;
  assert(leaderAfterRestore.some(p => p.id === testProfileId), 'Restored profile reappears in public leaderboard');

  console.log('\n--- 17. Webhook Payment Disablement & Gate Enforcement ---');
  const resWebhookDisabled = await fetchJson(`${BASE}/api/payment/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { event: 'payment.captured' }
  });
  assert(resWebhookDisabled.status === 503, 'POST /api/payment/webhook returns 503 when payments disabled');

  console.log('\n--- 18. Direct Settlement Gate (verifyAndClaimRank defense-in-depth) ---');
  const directSettlement = db.verifyAndClaimRank({
    name: 'Direct Attacker',
    amount: 100,
    paymentRef: 'direct_attack_ref_999'
  });
  assert(directSettlement.success === false, 'db.verifyAndClaimRank rejects direct settlement when PAYMENT_MODE=disabled');
  assert(
    !!directSettlement.message && directSettlement.message.includes('Settlement disabled'),
    'verifyAndClaimRank returns explicit disabled message'
  );

  console.log('\n--- 19. Demo Isolation & Production Fail-Fast ---');
  // Verify production + DEMO_MODE=true throws fatal error
  const prevEnv = process.env.NODE_ENV;
  const prevDemo = process.env.DEMO_MODE;
  let productionFailFastPassed = false;
  try {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    new LazyDatabase();
  } catch (err: any) {
    if (err?.message?.includes('DEMO_MODE cannot be enabled in production')) {
      productionFailFastPassed = true;
    }
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.DEMO_MODE = prevDemo;
  }
  assert(productionFailFastPassed, 'Database throws fatal error when NODE_ENV=production and DEMO_MODE=true');

  console.log('\n--- 20. Single-Node Concurrency & Persistence Safe Execution ---');
  // Fire 15 concurrent updates
  const concurrentPromises = Array.from({ length: 15 }, () =>
    fetchJson(`${BASE}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { event: 'shareClicks' }
    })
  );
  const concurrentResults = await Promise.all(concurrentPromises);
  const allSuccessful = concurrentResults.every(r => r.status === 200);
  assert(allSuccessful, '15 concurrent requests execute successfully without file corruption or locks');

  console.log('\n========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
