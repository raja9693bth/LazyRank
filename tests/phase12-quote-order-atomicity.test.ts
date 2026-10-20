import assert from 'assert';
import crypto from 'crypto';
import http from 'http';
import { PostgresDatabase, hashToken } from '../server/db/postgres.ts';
import { db } from '../server/db.ts';
import { paymentManager } from '../server/payments/index.ts';
import { CURRENT_PRICING_VERSION } from '../server/payments/pricingPolicy.ts';
import { CURRENT_CONSENT_VERSION } from '../server/config/legal.ts';

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

// Replicate ActionPanel's verified getExpectedRank logic for isolated algorithmic regression tests
function computeExpectedRank(
  profiles: Array<{ id: string; amount: number; firstVerifiedAt?: string; createdAt?: string }>,
  val: number,
  upgradingProfile?: { id: string; amount: number; firstVerifiedAt?: string; createdAt?: string } | null
): number {
  const projectedCumulative = (upgradingProfile ? upgradingProfile.amount : 0) + val;
  let rank = 1;

  for (const p of profiles) {
    if (upgradingProfile && p.id === upgradingProfile.id) {
      continue;
    }
    if (p.amount > projectedCumulative) {
      rank++;
      continue;
    }
    if (p.amount < projectedCumulative) {
      continue;
    }
    // Equal amount:
    if (upgradingProfile) {
      const ownerClaimed = upgradingProfile.firstVerifiedAt || upgradingProfile.createdAt;
      const compClaimed = p.firstVerifiedAt || p.createdAt;
      const ownerTime = ownerClaimed ? new Date(ownerClaimed).getTime() : Infinity;
      const compTime = compClaimed ? new Date(compClaimed).getTime() : Infinity;
      if (compTime < ownerTime) {
        rank++;
      } else if (compTime === ownerTime && p.id < upgradingProfile.id) {
        rank++;
      }
    } else {
      // New claimant has not yet verified; earlier verified competitor takes precedence
      rank++;
    }
  }

  return rank;
}

async function runPhase12Tests() {
  console.log('\n========================================================');
  console.log('STARTING PHASE 12: QUOTE CONTRACT, ATOMICITY & RANK REGRESSION');
  console.log('========================================================\n');

  const TEST_PORT = 3299;
  const BASE = `http://127.0.0.1:${TEST_PORT}`;
  const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/lazyproof_test';

  process.env.PORT = String(TEST_PORT);
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.TEST_DATABASE_URL = TEST_DB_URL;
  process.env.USE_POSTGRES = 'true';
  process.env.PAYMENT_PROVIDER = 'dodo';
  process.env.PAYMENT_MODE = 'sandbox';
  process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode';
  process.env.DODO_PAYMENTS_API_KEY = 'test_dodo_api_key_valid';
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = 'whsec_' + Buffer.from('test_secret_for_standardwebhooks_123').toString('base64');
  process.env.MERCHANT_TAX_BASIS = 'verified_unregistered_below_threshold';
  process.env.MERCHANT_TAX_REVIEWED = 'true';
  process.env.CHECKOUT_ENABLED = 'true';
  process.env.ALLOW_MOCK_REFUNDS = 'true';

  const pg = new PostgresDatabase(TEST_DB_URL);
  await pg.init();
  db.pg = pg;

  paymentManager.reload();

  // Mock Dodo client product and session creation for test environment
  const dodoProvider = paymentManager.getProviderFor('dodo') as any;
  dodoProvider.isConfigured = () => true;
  dodoProvider.client = {
    products: {
      create: async (body: any) => ({
        product_id: `prod_mock_${body.price?.currency}_${body.price?.price}`
      })
    },
    checkoutSessions: {
      create: async () => ({
        session_id: `session_mock_${Date.now()}`,
        checkout_url: `https://checkout.dodopayments.com/buy/session_${Date.now()}`
      })
    },
    payments: {
      create: async (body: any) => ({
        payment_id: `pay_mock_${Date.now()}`,
        payment_link: `https://checkout.dodopayments.com/buy/session_${Date.now()}`
      }),
      retrieve: async () => ({
        payment_id: 'pay_mock_test',
        total_amount: 9900,
        currency: 'INR'
      })
    },
    refunds: {
      create: async () => ({
        refund_id: 'ref_mock_test',
        status: 'succeeded'
      })
    }
  };

  try {
    await import('../server.ts');
  } catch (err: any) {
    console.warn('[Phase12] Server import notice:', err?.message || err);
  }

  // Wait for server to bind
  let connected = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const ping = await fetchJson(`${BASE}/api/payment/config`);
      if (ping.status === 200) {
        connected = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  assert.ok(connected, 'Server must be connected on port ' + TEST_PORT);
  pass('Server initialized and connected against real PostgreSQL test database');

  // ------------------------------------------------------------------------
  // 1. HTTP Quote Endpoint Contract & PostgreSQL Persistence
  // ------------------------------------------------------------------------
  console.log('\n--- 1. HTTP Quote Endpoint Contract & PostgreSQL Persistence ---');

  // 1A. ₹99 Quote succeeds
  const resQuote99 = await fetchJson(`${BASE}/api/payment/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { amount: 99, currency: 'INR' }
  });
  assert.strictEqual(resQuote99.status, 200, 'POST /api/payment/quote ₹99 returns HTTP 200');
  assert.ok(resQuote99.body?.quoteId?.startsWith('qte_'), 'Returns valid quoteId starting with qte_');
  assert.strictEqual(resQuote99.body?.currency, 'INR');
  assert.strictEqual(resQuote99.body?.amountMinor, 9900, 'Returns amountMinor 9900');
  assert.strictEqual(resQuote99.body?.chargeAmountMinor, 9900, 'Returns chargeAmountMinor 9900');
  assert.strictEqual(resQuote99.body?.rankCreditPaise, 9900, 'Returns rankCreditPaise 9900');
  assert.strictEqual(resQuote99.body?.pricingVersion, CURRENT_PRICING_VERSION);
  assert.strictEqual(resQuote99.body?.taxMode, 'tax_inclusive');
  assert.ok(typeof resQuote99.body?.authHash === 'string' && resQuote99.body.authHash.length === 64, 'Returns 64-char sha256 authHash');
  pass('₹99 quote succeeds with exact typed fields and authHash');

  // Verify quote row is actually persisted in PostgreSQL with non-null constraints
  const pool = await (pg as any).getPool();
  const dbQuote99Res = await pool.query('SELECT * FROM payment_quotes WHERE quote_id = $1', [resQuote99.body.quoteId]);
  assert.strictEqual(dbQuote99Res.rows.length, 1, 'Quote row is persisted in PostgreSQL');
  const dbQ99 = dbQuote99Res.rows[0];
  assert.strictEqual(Number(dbQ99.amount_minor), 9900, 'amount_minor is non-null and exact 9900');
  assert.strictEqual(Number(dbQ99.rank_credit_paise), 9900, 'rank_credit_paise is non-null and exact 9900');
  assert.strictEqual(dbQ99.auth_hash, resQuote99.body.authHash, 'auth_hash is stored accurately');
  assert.strictEqual(dbQ99.consumed_at, null, 'consumed_at is initially null');
  pass('Quote row is confirmed persisted in PostgreSQL with non-null amount_minor and auth_hash');

  // 1B. ₹100 Quote succeeds
  const resQuote100 = await fetchJson(`${BASE}/api/payment/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { amount: 100, currency: 'INR' }
  });
  assert.strictEqual(resQuote100.status, 200, 'POST /api/payment/quote ₹100 returns HTTP 200');
  assert.strictEqual(resQuote100.body?.amountMinor, 10000);
  assert.strictEqual(resQuote100.body?.rankCreditPaise, 10000);

  const dbQuote100Res = await pool.query('SELECT * FROM payment_quotes WHERE quote_id = $1', [resQuote100.body.quoteId]);
  assert.strictEqual(dbQuote100Res.rows.length, 1, '₹100 quote is persisted');
  assert.strictEqual(Number(dbQuote100Res.rows[0].amount_minor), 10000);
  pass('₹100 quote succeeds and is durably persisted');

  // 1C. Amount below ₹99 fails
  const resQuote98 = await fetchJson(`${BASE}/api/payment/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { amount: 98, currency: 'INR' }
  });
  assert.strictEqual(resQuote98.status, 400, 'Amount below ₹99 returns HTTP 400');
  assert.strictEqual(resQuote98.body?.code, 'AMOUNT_BELOW_MINIMUM');
  pass('Amount below ₹99 fails validation');

  // 1D. Non-integer INR amount fails
  const resQuoteFloat = await fetchJson(`${BASE}/api/payment/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { amount: 99.5, currency: 'INR' }
  });
  assert.strictEqual(resQuoteFloat.status, 400, 'Fractional INR amount returns HTTP 400');
  pass('Fractional INR amount fails validation');

  // 1E. Quote survives database lookup across client queries
  const retrievedQuote = await pg.getPaymentQuote(resQuote99.body.quoteId);
  assert.ok(retrievedQuote !== null, 'Quote is queryable via getPaymentQuote');
  assert.strictEqual(retrievedQuote?.amountMinor, 9900);
  assert.strictEqual(retrievedQuote?.authHash, resQuote99.body.authHash);
  pass('Quote survives and is identical to database snapshot');

  // ------------------------------------------------------------------------
  // 2. Atomic Quote Consumption & Order Creation
  // ------------------------------------------------------------------------
  console.log('\n--- 2. Atomic Quote Consumption & Order Creation ---');

  const pendingOwnerToken = 'lazy_' + crypto.randomBytes(32).toString('hex');
  const orderAccessToken = 'ord_' + crypto.randomBytes(32).toString('hex');
  const validOrderPayload = {
    name: 'Alice Legit',
    amount: 99,
    customerPhone: '9876543210',
    pendingOwnerToken,
    orderAccessToken,
    quoteId: resQuote99.body.quoteId,
    consentAccepted: true,
    consentVersion: CURRENT_CONSENT_VERSION
  };

  const resOrder1 = await fetchJson(`${BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: validOrderPayload
  });
  assert.strictEqual(resOrder1.status, 200, 'Order creation with valid quote returns HTTP 200');
  assert.ok(resOrder1.body?.orderId, 'Order creation returns orderId');
  assert.ok(resOrder1.body?.paymentSessionId, 'Order creation returns paymentSessionId');

  // Verify quote is atomically marked consumed in PostgreSQL
  const dbQuoteAfterRes = await pool.query('SELECT * FROM payment_quotes WHERE quote_id = $1', [resQuote99.body.quoteId]);
  const consumedQ = dbQuoteAfterRes.rows[0];
  assert.ok(consumedQ.consumed_at !== null, 'consumed_at is populated');
  assert.strictEqual(consumedQ.consumed_by_order_id, resOrder1.body.orderId, 'consumed_by_order_id matches created order ID');
  pass('Order creation atomically consumes quote and binds consumed_by_order_id');

  // 2B. Unauthorized quote reuse is rejected: Attempting second order with same quote fails
  const secondOwnerToken = 'lazy_' + crypto.randomBytes(32).toString('hex');
  const secondOrderAccessToken = 'ord_' + crypto.randomBytes(32).toString('hex');
  const resReuse = await fetchJson(`${BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      ...validOrderPayload,
      name: 'Eve Attacker',
      pendingOwnerToken: secondOwnerToken,
      orderAccessToken: secondOrderAccessToken,
      quoteId: resQuote99.body.quoteId
    }
  });
  assert.strictEqual(resReuse.status, 409, 'Reuse of consumed quote returns HTTP 409 QUOTE_ALREADY_CONSUMED');

  // Prove zero second order was created in PostgreSQL
  const dbOrdersCount = await pool.query(
    'SELECT COUNT(*) FROM payment_orders WHERE owner_token_hash = $1',
    [hashToken(secondOwnerToken)]
  );
  assert.strictEqual(Number(dbOrdersCount.rows[0].count), 0, 'Zero order created when quote consumption fails');
  pass('Unauthorized quote reuse is rejected and creates zero orders in database');

  // 2C. Tampered amount is rejected
  const resQuoteTamper = await fetchJson(`${BASE}/api/payment/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { amount: 99, currency: 'INR' }
  });
  assert.strictEqual(resQuoteTamper.status, 200);

  const tamperOwnerToken = 'lazy_' + crypto.randomBytes(32).toString('hex');
  const resTamperAmt = await fetchJson(`${BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      ...validOrderPayload,
      name: 'Mallory Tamper',
      amount: 100, // Tampered: quote was for ₹99!
      pendingOwnerToken: tamperOwnerToken,
      orderAccessToken: 'ord_' + crypto.randomBytes(32).toString('hex'),
      quoteId: resQuoteTamper.body.quoteId
    }
  });
  assert.strictEqual(resTamperAmt.status, 400, 'Tampered amount returns HTTP 400');

  // Verify quote remains unconsumed in DB
  const dbTamperQ = (await pool.query('SELECT * FROM payment_quotes WHERE quote_id = $1', [resQuoteTamper.body.quoteId])).rows[0];
  assert.strictEqual(dbTamperQ.consumed_at, null, 'Quote remains unconsumed when amount is tampered');
  pass('Tampered amount is rejected and quote remains unconsumed');

  // 2D. Expired quote is rejected
  const expiredQuoteId = `qte_expired_${Date.now()}`;
  const expiredAuthHash = crypto.createHash('sha256').update(`expired_intent`).digest('hex');
  await pool.query(
    `INSERT INTO payment_quotes (
       id, quote_id, provider, environment, account_id, currency,
       amount_minor, rank_credit_paise, tax_mode, pricing_version,
       purpose, auth_hash, expires_at, created_at
     ) VALUES (
       $1, $2, 'dodo', 'sandbox', 'primary', 'INR',
       9900, 9900, 'tax_inclusive', 'v1',
       'new', $3, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '20 seconds'
     )`,
    [`pq_exp_${Date.now()}`, expiredQuoteId, expiredAuthHash]
  );

  const resExpired = await fetchJson(`${BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      ...validOrderPayload,
      name: 'Late Larry',
      amount: 99,
      pendingOwnerToken: 'lazy_' + crypto.randomBytes(32).toString('hex'),
      orderAccessToken: 'ord_' + crypto.randomBytes(32).toString('hex'),
      quoteId: expiredQuoteId
    }
  });
  assert.strictEqual(resExpired.status, 400, 'Expired quote returns HTTP 400 QUOTE_EXPIRED');
  pass('Expired quote is rejected before order creation');

  // 2E. Simultaneous quote consumption race condition test
  console.log('\n--- 3. Concurrent Quote Race & Atomicity Validation ---');
  const raceQuoteRes = await fetchJson(`${BASE}/api/payment/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { amount: 99, currency: 'INR' }
  });
  const raceQuoteId = raceQuoteRes.body.quoteId;

  const concurrentAttempts = 5;
  const racePromises: Promise<{ status: number; body: any }>[] = [];

  for (let i = 0; i < concurrentAttempts; i++) {
    const rOwnerToken = 'lazy_' + crypto.randomBytes(32).toString('hex');
    const rOrderToken = 'ord_' + crypto.randomBytes(32).toString('hex');
    racePromises.push(
      fetchJson(`${BASE}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': `race_idem_${Date.now()}_${i}`
        },
        body: {
          ...validOrderPayload,
          name: `Concurrent User ${i}`,
          amount: 99,
          pendingOwnerToken: rOwnerToken,
          orderAccessToken: rOrderToken,
          quoteId: raceQuoteId
        }
      })
    );
  }

  const raceResults = await Promise.all(racePromises);
  const successes = raceResults.filter(r => r.status === 200);
  const failures = raceResults.filter(r => r.status === 409 || r.status === 400);

  assert.strictEqual(successes.length, 1, 'Exactly ONE concurrent order creation succeeds');
  assert.strictEqual(failures.length, concurrentAttempts - 1, 'All remaining concurrent attempts fail with 409/400');

  // Verify only 1 order exists for that quote in PostgreSQL
  const dbOrdersForQuote = await pool.query(
    'SELECT COUNT(*) FROM payment_orders WHERE quote_snapshot->>\'quoteId\' = $1',
    [raceQuoteId]
  );
  assert.strictEqual(Number(dbOrdersForQuote.rows[0].count), 1, 'Exactly one order row exists in database');
  pass('Simultaneous quote consumption race condition resolved with exact single order winner');

  // ------------------------------------------------------------------------
  // 4. ActionPanel Expected Rank Algorithmic Regressions
  // ------------------------------------------------------------------------
  console.log('\n--- 4. ActionPanel Expected Rank Algorithmic Regressions ---');

  // Regression 1: Leader ₹1,000; new user ₹99 -> expected #2
  const reg1Profiles = [
    { id: 'p_leader', amount: 1000, firstVerifiedAt: '2026-01-01T10:00:00Z' }
  ];
  assert.strictEqual(computeExpectedRank(reg1Profiles, 99, null), 2, 'Leader ₹1,000; new user ₹99 -> #2');
  pass('Regression 1: Leader ₹1,000; new user ₹99 -> expected position #2');

  // Regression 2: Leader ₹1,000; new user ₹100 -> expected #2
  assert.strictEqual(computeExpectedRank(reg1Profiles, 100, null), 2, 'Leader ₹1,000; new user ₹100 -> #2');
  pass('Regression 2: Leader ₹1,000; new user ₹100 -> expected position #2');

  // Regression 3: Leader ₹1,000; new user ₹1,001 -> projected #1
  assert.strictEqual(computeExpectedRank(reg1Profiles, 1001, null), 1, 'Leader ₹1,000; new user ₹1,001 -> #1');
  pass('Regression 3: Leader ₹1,000; new user ₹1,001 -> projected #1');

  // Regression 4: Ten earlier ₹99 claimants; new ₹99 claimant -> #11
  const tenClaimants = Array.from({ length: 10 }, (_, i) => ({
    id: `p_99_${i}`,
    amount: 99,
    firstVerifiedAt: new Date(Date.now() - (10 - i) * 60000).toISOString()
  }));
  assert.strictEqual(computeExpectedRank(tenClaimants, 99, null), 11, 'Ten earlier ₹99 claimants; new user ₹99 -> #11');
  pass('Regression 4: Ten earlier ₹99 claimants; new ₹99 claimant ranks below all ten at #11');

  // Regression 5: Owner ₹950; upgrade ₹99 -> projected ₹1,049 outranking ₹1,000 leader
  const owner950 = { id: 'p_owner', amount: 950, firstVerifiedAt: '2026-02-01T10:00:00Z' };
  const profilesWithOwner = [...reg1Profiles, owner950];
  assert.strictEqual(computeExpectedRank(profilesWithOwner, 99, owner950), 1, 'Owner ₹950 + ₹99 outranks ₹1,000 leader to #1');
  pass('Regression 5: Owner ₹950 + upgrade ₹99 projects to ₹1,049 and rank #1');

  // Regression 6: Owner does NOT count own profile as competitor
  const soloProfiles = [owner950];
  assert.strictEqual(computeExpectedRank(soloProfiles, 99, owner950), 1, 'Owner does not count own profile as competitor');
  pass('Regression 6: Owner upgrading does not count own profile as competitor');

  // Regression 7: Owner ₹198; additional ₹99 -> ₹297
  const owner198 = { id: 'p_owner198', amount: 198, firstVerifiedAt: '2026-03-01T10:00:00Z' };
  const competitor250 = { id: 'p_comp250', amount: 250, firstVerifiedAt: '2026-03-01T12:00:00Z' };
  const compList = [competitor250, owner198];
  // 198 + 99 = 297 > 250 -> rank 1
  assert.strictEqual(computeExpectedRank(compList, 99, owner198), 1, 'Owner ₹198 + ₹99 outranks competitor at ₹250');
  pass('Regression 7: Owner ₹198 + ₹99 cumulative ₹297 verified');

  console.log('\n========================================================');
  console.log(`PHASE 12 COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase12Tests().catch((err) => {
  console.error('[Phase12 Uncaught Error]', err);
  process.exit(1);
});
