import assert from 'assert';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

function makeRequest(url: string, options: http.RequestOptions = {}, body?: string): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 15000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out to ${url}`));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function waitForServer(port: number, maxTries = 30): Promise<boolean> {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await makeRequest(`http://127.0.0.1:${port}/api/health`);
      if (res.statusCode === 200) return true;
    } catch {
      // server still spinning up
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function runCompiledSmokeTests() {
  console.log('\n========================================================');
  console.log('MANDATORY COMPILED PRODUCTION SMOKE TEST (PHASE E)');
  console.log('Running: node dist/server.cjs in NODE_ENV=production');
  console.log('========================================================\n');

  // --- SCENARIO 1: Healthy PostgreSQL ---
  console.log('>>> SCENARIO 1: Healthy Isolated PostgreSQL Backend');
  const port1 = 3891;
  const env1 = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port1),
    PAYMENT_MODE: 'disabled',
    CHECKOUT_ENABLED: 'false',
    DATABASE_URL: 'postgresql://postgres@127.0.0.1:5433/lazyproof_test',
  };

  const proc1 = spawn(process.execPath, ['dist/server.cjs'], {
    env: env1,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc1.stdout?.on('data', (d) => process.stdout.write(`[Server:3891] ${d}`));
  proc1.stderr?.on('data', (d) => process.stderr.write(`[Server:3891 ERR] ${d}`));
  proc1.on('error', (err) => console.error('[Server:3891 SPAWN ERR]', err));
  proc1.on('exit', (code, sig) => console.log(`[Server:3891 EXIT] code=${code} sig=${sig}`));

  const isUp1 = await waitForServer(port1, 50);
  assert.ok(isUp1, 'Scenario 1: Production server failed to bind and start within timeout');
  console.log('  ✓ PASS: Production artifact booted successfully and bound to port', port1);

  // 1. GET /
  const homeRes = await makeRequest(`http://127.0.0.1:${port1}/`);
  assert.strictEqual(homeRes.statusCode, 200, 'GET / must return 200');
  assert.ok(homeRes.body.includes('<title>'), 'GET / must contain HTML title');
  console.log('  ✓ PASS: GET / returns 200 with HTML document');

  // 2. GET /api/health
  const healthRes = await makeRequest(`http://127.0.0.1:${port1}/api/health`);
  assert.strictEqual(healthRes.statusCode, 200, 'GET /api/health must return 200');
  const healthData = JSON.parse(healthRes.body);
  assert.strictEqual(healthData.status, 'ok');
  assert.strictEqual(healthData.storage, 'postgresql');
  console.log('  ✓ PASS: GET /api/health returns 200 ok (storage: postgresql)');

  // 3. GET /api/ready
  const readyRes = await makeRequest(`http://127.0.0.1:${port1}/api/ready`);
  assert.strictEqual(readyRes.statusCode, 200, 'GET /api/ready must return 200 when DB is healthy');
  const readyData = JSON.parse(readyRes.body);
  assert.strictEqual(readyData.ready, true);
  console.log('  ✓ PASS: GET /api/ready returns 200 with ready: true');

  // 4. GET /api/leaderboard
  const lbRes = await makeRequest(`http://127.0.0.1:${port1}/api/leaderboard`);
  assert.strictEqual(lbRes.statusCode, 200, 'GET /api/leaderboard must return 200');
  const lbData = JSON.parse(lbRes.body);
  assert.ok(Array.isArray(lbData.profiles), 'GET /api/leaderboard returns profiles array');
  console.log('  ✓ PASS: GET /api/leaderboard returns 200 with database-backed profiles');

  // 5. GET /api/payment/config
  const cfgRes = await makeRequest(`http://127.0.0.1:${port1}/api/payment/config`);
  assert.strictEqual(cfgRes.statusCode, 200, 'GET /api/payment/config must return 200');
  const cfgData = JSON.parse(cfgRes.body);
  assert.strictEqual(cfgData.checkoutEnabled, false, 'checkoutEnabled must be false in safe production');
  console.log('  ✓ PASS: GET /api/payment/config returns 200 with checkoutEnabled: false');

  // 6. Legal Pages (/terms, /privacy, /refund-cancellation)
  const termsRes = await makeRequest(`http://127.0.0.1:${port1}/terms`);
  assert.strictEqual(termsRes.statusCode, 200, 'GET /terms must return 200');
  const privRes = await makeRequest(`http://127.0.0.1:${port1}/privacy`);
  assert.strictEqual(privRes.statusCode, 200, 'GET /privacy must return 200');
  const refRes = await makeRequest(`http://127.0.0.1:${port1}/refund-cancellation`);
  assert.strictEqual(refRes.statusCode, 200, 'GET /refund-cancellation must return 200');
  console.log('  ✓ PASS: Legal routes (/terms, /privacy, /refund-cancellation) return 200 HTML');

  // 7. Invalid Route
  const badRes = await makeRequest(`http://127.0.0.1:${port1}/invalid-page-test-xyz`);
  assert.strictEqual(badRes.statusCode, 404, 'Invalid route must return 404');
  console.log('  ✓ PASS: Invalid path returns 404 Not found');

  // 8. Order Creation attempt with checkout disabled
  const orderRes = await makeRequest(`http://127.0.0.1:${port1}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: 'TestUser', amount: 99 }));
  assert.strictEqual(orderRes.statusCode, 503, 'Order creation must return 503 when checkout disabled');
  console.log('  ✓ PASS: POST /api/payment/create-order returns 503 fail-closed when checkout disabled');

  // Kill scenario 1
  proc1.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 500));

  // --- SCENARIO 2: Database Unavailable (Fail-Closed & Process Resilient) ---
  console.log('\n>>> SCENARIO 2: Database Unavailable (Fail-Closed Resilience)');
  const port2 = 3892;
  const env2 = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port2),
    PAYMENT_MODE: 'disabled',
    CHECKOUT_ENABLED: 'false',
    // Point to non-existent database to simulate downtime / cold start failure
    DATABASE_URL: 'postgresql://postgres@127.0.0.1:5433/db_unavailable_test',
  };

  const proc2 = spawn(process.execPath, ['dist/server.cjs'], {
    env: env2,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc2.stdout?.on('data', (d) => process.stdout.write(`[Server:3892] ${d}`));
  proc2.stderr?.on('data', (d) => process.stderr.write(`[Server:3892 ERR] ${d}`));
  proc2.on('error', (err) => console.error('[Server:3892 SPAWN ERR]', err));
  proc2.on('exit', (code, sig) => console.log(`[Server:3892 EXIT] code=${code} sig=${sig}`));

  const isUp2 = await waitForServer(port2, 50);
  assert.ok(isUp2, 'Scenario 2: Server should NOT crash-bomb on DB connection failure; it must bind and serve liveness & static pages');
  console.log('  ✓ PASS: Production process survived database unavailability without crash-bombing');

  // 1. /api/health -> 200 (Liveness passes)
  const healthRes2 = await makeRequest(`http://127.0.0.1:${port2}/api/health`);
  assert.strictEqual(healthRes2.statusCode, 200, 'Process liveness must return 200');
  console.log('  ✓ PASS: /api/health returns 200 (process liveness ok)');

  // 2. /api/ready -> 503 (Readiness fails closed)
  const readyRes2 = await makeRequest(`http://127.0.0.1:${port2}/api/ready`);
  assert.strictEqual(readyRes2.statusCode, 503, '/api/ready must return 503 Service Unavailable when DB unreachable');
  console.log('  ✓ PASS: /api/ready returns 503 Service Unavailable');

  // 3. /api/leaderboard -> 503 (Leaderboard fails closed, NO fake demo seed data)
  const lbRes2 = await makeRequest(`http://127.0.0.1:${port2}/api/leaderboard`);
  assert.strictEqual(lbRes2.statusCode, 503, '/api/leaderboard must fail closed with 503, never fake JSON');
  console.log('  ✓ PASS: /api/leaderboard returns 503 fail-closed without fabricating ranks');

  // 4. Static pages remain available
  const termsRes2 = await makeRequest(`http://127.0.0.1:${port2}/terms`);
  assert.strictEqual(termsRes2.statusCode, 200, 'Static legal pages remain accessible');
  console.log('  ✓ PASS: Static compliance pages remain accessible during DB outage');

  // Kill scenario 2
  proc2.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 500));

  console.log('\n========================================================');
  console.log('COMPILED PRODUCTION SMOKE TEST: ALL SCENARIOS PASSED (100%)');
  console.log('========================================================\n');
}

runCompiledSmokeTests().catch(err => {
  console.error('\nSMOKE TEST FAILED:', err);
  process.exit(1);
});
